import type { Rating, Student, UnitScore, UnitTemplate } from './types';

export const DEFAULT_REDFLAG = 60;
export const DEFAULT_GOOD = 80;

export interface Criterion {
  key: string;
  label: string;
  kind: 'score' | 'choice';
  options?: { value: string; label: string }[];
  /** tiêu chí chọn: giá trị tính là đạt */
  passValue?: string;
  /** chỉ báo cáo riêng, không tính vào điểm tổng */
  reportOnly?: boolean;
}

export const CRITERIA: Record<UnitTemplate, Criterion[]> = {
  baby: [
    { key: 'spelling', label: 'Spelling', kind: 'score' },
    { key: 'writing', label: 'Writing', kind: 'score' },
  ],
  foundation: [
    { key: 'vocabulary', label: 'Vocabulary (số từ đạt)', kind: 'score' },
    { key: 'communication', label: 'Communication', kind: 'score' },
    {
      key: 'pronunciation',
      label: 'Pronunciation',
      kind: 'choice',
      reportOnly: true,
      options: [
        { value: 'clear', label: 'Clear' },
        { value: 'unclear', label: 'Unclear' },
      ],
    },
  ],
  cambridge: [
    { key: 'pattern', label: 'Pattern', kind: 'score' },
    { key: 'freestyle', label: 'Freestyle', kind: 'score' },
    {
      key: 'pron1',
      label: 'Pronunciation 1',
      kind: 'choice',
      reportOnly: true,
      options: [
        { value: 'clear', label: 'Clear' },
        { value: 'unclear', label: 'Unclear' },
      ],
    },
    {
      key: 'pron2',
      label: 'Pronunciation 2',
      kind: 'choice',
      reportOnly: true,
      options: [
        { value: 'clear', label: 'Clear' },
        { value: 'unclear', label: 'Unclear' },
      ],
    },
    {
      key: 'gram1',
      label: 'Ngữ pháp: One / Many',
      kind: 'choice',
      reportOnly: true,
      options: [
        { value: 'ok', label: 'Đạt' },
        { value: 'no', label: 'Chưa đạt' },
      ],
    },
    {
      key: 'gram2',
      label: 'Ngữ pháp: Am / Is / Are',
      kind: 'choice',
      reportOnly: true,
      options: [
        { value: 'ok', label: 'Đạt' },
        { value: 'no', label: 'Chưa đạt' },
      ],
    },
  ],
};

export function classify(percent: number, redflagBelow = DEFAULT_REDFLAG, goodAbove = DEFAULT_GOOD): Rating {
  if (percent < redflagBelow) return 'redflag';
  if (percent > goodAbove) return 'good';
  return 'average';
}

export function thresholdsFor(student?: Pick<Student, 'star' | 'redflagBelow' | 'goodAbove'>) {
  if (student?.star) {
    return {
      redflagBelow: student.redflagBelow ?? DEFAULT_REDFLAG,
      goodAbove: student.goodAbove ?? DEFAULT_GOOD,
    };
  }
  return { redflagBelow: DEFAULT_REDFLAG, goodAbove: DEFAULT_GOOD };
}

export function scoredCriteria(template: UnitTemplate): Criterion[] {
  return CRITERIA[template].filter((c) => c.kind === 'score');
}

export function isUnitComplete(template: UnitTemplate, unit: UnitScore): boolean {
  return CRITERIA[template].every((c) => {
    const v = unit.values[c.key];
    return v !== null && v !== undefined && v !== '';
  });
}

export interface Summary {
  percent: number;
  overall: Rating;
  perCriterion: { key: string; label: string; percent: number; rating: Rating }[];
}

/** Điểm tổng = trung bình % các tiêu chí điểm; có Redflag thì chung Redflag, ngược lại > ngưỡng Good là Good. */
export function summarize(
  template: UnitTemplate,
  units: UnitScore[],
  thresholds: { redflagBelow: number; goodAbove: number },
): Summary {
  const criteria = scoredCriteria(template);
  const perCriterion = criteria.map((c) => {
    const vals = units.map((u) => Number(u.values[c.key] ?? 0));
    const percent = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { key: c.key, label: c.label, percent, rating: classify(percent, thresholds.redflagBelow, thresholds.goodAbove) };
  });
  const percent = perCriterion.length ? perCriterion.reduce((a, c) => a + c.percent, 0) / perCriterion.length : 0;
  const anyRed = perCriterion.some((c) => c.rating === 'redflag');
  const overall: Rating = anyRed ? 'redflag' : percent > thresholds.goodAbove ? 'good' : 'average';
  return { percent, overall, perCriterion };
}
