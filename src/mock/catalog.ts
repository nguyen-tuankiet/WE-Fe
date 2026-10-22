import type { Program, ProgramGroup, UnitContent, UnitTemplate } from '../domain/types';

export const GROUP_LABEL: Record<ProgramGroup, string> = {
  baby: 'Baby',
  foundation: 'Kids Foundation',
  cambridge: 'Cambridge',
  ket: 'KET',
  pet: 'PET',
  ielts: 'IELTS',
  communication: 'Giao tiếp',
  grade10: 'Tuyển sinh lớp 10',
};

const programs: Program[] = [];

function add(
  id: string,
  group: ProgramGroup,
  name: string,
  tuition: number,
  sessions: number | null,
  maxSize = 10,
  unitTemplate: UnitTemplate | null = null,
  note?: string,
) {
  programs.push({ id, group, name, tuition, sessions, maxSize, unitTemplate, note });
}

add('baby-stars', 'baby', 'Baby Stars', 6_000_000, 36, 10, 'baby', 'Bé 4–6 tuổi hoặc chưa đọc viết chữ cái');

const kids: [string, number, string[]][] = [
  ['Smart Explorers', 6_100_000, ['SK1.1-6', 'SK1.7-9 · SK2.1-3', '']],
  ['Smart Learners', 6_200_000, ['SK2.4-9', 'SK3.1-6', '']],
  ['Smart Performers', 6_300_000, ['SK3.7-9 · SK4.1-3', 'SK4.4-9', '']],
  ['Smart Achievers', 6_400_000, ['SK5.1-6', 'SK5.7-9 · SK6.1-3', '']],
];
for (const [name, tuition, sk] of kids) {
  for (let i = 1; i <= 3; i++) {
    add(`${name.toLowerCase().replace(/\s/g, '-')}-${i}`, 'foundation', `${name} ${i}`, tuition, 24, 10, 'foundation', sk[i - 1] || undefined);
  }
}

const cam: [string, number][] = [
  ['Starters', 9_300_000],
  ['Movers', 9_400_000],
  ['Flyers', 9_500_000],
];
for (const [name, tuition] of cam) {
  add(`${name.toLowerCase()}-nen-tang`, 'cambridge', `${name} Nền tảng`, tuition, 36, 10, 'cambridge');
  add(`${name.toLowerCase()}-luyen-de`, 'cambridge', `${name} Luyện đề`, tuition, 36, 10, 'cambridge');
}

for (let i = 1; i <= 2; i++) add(`ket-foundation-${i}`, 'ket', `KET Foundation ${i}`, 10_000_000, 36, 10, 'cambridge');
for (let i = 1; i <= 2; i++) add(`ket-intensive-${i}`, 'ket', `KET Intensive ${i}`, 10_500_000, 36, 10, 'cambridge');
for (let i = 1; i <= 3; i++) add(`pet-foundation-${i}`, 'pet', `PET Foundation ${i}`, 11_000_000, 36, 10, 'cambridge');
for (let i = 1; i <= 3; i++) add(`pet-intensive-${i}`, 'pet', `PET Intensive ${i}`, 11_500_000, 36, 10, 'cambridge');

add('ielts-we101', 'ielts', 'IELTS Foundation WE101', 7_500_000, 36);
add('ielts-we102', 'ielts', 'IELTS Foundation WE102', 8_700_000, 36);
add('ielts-we103', 'ielts', 'IELTS Foundation WE103', 9_800_000, 36);
add('pre-ielts-1', 'ielts', 'Pre-IELTS 1', 12_500_000, 36);
add('pre-ielts-2', 'ielts', 'Pre-IELTS 2', 13_700_000, 36);
add('ielts-50-55', 'ielts', 'IELTS 5.0–5.5 (4 kỹ năng)', 14_800_000, 42);
add('ielts-60-4', 'ielts', 'IELTS 6.0+ (4 kỹ năng)', 16_800_000, 42);
add('ielts-60-2', 'ielts', 'IELTS 6.0+ (2 kỹ năng)', 13_250_000, 25);

const talk: [string, string, number, number][] = [
  ['we201', 'WE201 Giao tiếp sơ cấp', 6_000_000, 8_500_000],
  ['we202', 'WE202 Giao tiếp trung cấp', 6_500_000, 8_700_000],
  ['we203', 'WE203 Giao tiếp chuyên sâu', 7_000_000, 9_000_000],
];
for (const [id, name, group, solo] of talk) {
  add(`${id}-nhom`, 'communication', `${name} · lớp nhóm`, group, 24, 8);
  add(`${id}-1k1`, 'communication', `${name} · một kèm một`, solo, 24, 1);
}

add('lop10-gd1', 'grade10', 'Lớp 10 · Giai đoạn 1: Hoàn tất lớp 9', 13_200_000, null, 10, null, '4,5 tháng, 3 buổi/tuần');
add('lop10-gd2', 'grade10', 'Lớp 10 · Giai đoạn 2: Tổng ôn lớp 6–9', 9_150_000, null, 10, null, '3 tháng, 3 buổi/tuần');
add('lop10-gd3', 'grade10', 'Lớp 10 · Giai đoạn 3: Luyện thi giải đề', 9_150_000, null, 10, null, '3 tháng, 3 buổi/tuần');

export const PROGRAMS: Program[] = programs;
export const programById = (id: string): Program => {
  const p = programs.find((x) => x.id === id);
  if (!p) throw new Error(`Chương trình không tồn tại: ${id}`);
  return p;
};

/** Khung chương trình mẫu để demo phiếu chấm (nội dung thật do học vụ cung cấp). */
export const CURRICULUM: Record<UnitTemplate, UnitContent[]> = {
  baby: [
    { id: 'baby-u1', name: 'Unit 1', topic: 'Hello & Colors', words: ['hello', 'red', 'blue', 'green'], patterns: ['Hello, I am …'] },
    { id: 'baby-u2', name: 'Unit 2', topic: 'Animals', words: ['cat', 'dog', 'bird', 'fish'], patterns: ['It is a …'] },
    { id: 'baby-u3', name: 'Unit 3', topic: 'Family', words: ['mom', 'dad', 'baby', 'sister'], patterns: ['This is my …'] },
    { id: 'baby-u4', name: 'Unit 4', topic: 'Fruits', words: ['apple', 'banana', 'orange'], patterns: ['I like …'] },
  ],
  foundation: [
    { id: 'found-u1', name: 'Unit 1', topic: 'School things', words: ['pencil', 'ruler', 'eraser', 'bag', 'book', 'desk', 'chair', 'board'], patterns: ['What is this?', 'It is a …'] },
    { id: 'found-u2', name: 'Unit 2', topic: 'My body', words: ['head', 'hand', 'leg', 'eye', 'ear', 'nose', 'mouth'], patterns: ['I have …'] },
    { id: 'found-u3', name: 'Unit 3', topic: 'Daily routines', words: ['wake up', 'brush', 'eat', 'study', 'sleep', 'play'], patterns: ['I … every day.'] },
    { id: 'found-u4', name: 'Unit 4', topic: 'Weather', words: ['sunny', 'rainy', 'windy', 'cloudy', 'hot', 'cold'], patterns: ['It is …'] },
  ],
  cambridge: [
    { id: 'cam-u1', name: 'Unit 1', topic: 'People & Family', words: ['aunt', 'uncle', 'cousin', 'neighbour'], patterns: ['He/She has …', 'There is / are …'] },
    { id: 'cam-u2', name: 'Unit 2', topic: 'Home', words: ['kitchen', 'bedroom', 'garden', 'sofa'], patterns: ['Where is the …?'] },
    { id: 'cam-u3', name: 'Unit 3', topic: 'Food & Drink', words: ['sandwich', 'juice', 'cheese', 'noodles'], patterns: ['Would you like …?'] },
    { id: 'cam-u4', name: 'Unit 4', topic: 'Hobbies', words: ['swimming', 'painting', 'cycling', 'dancing'], patterns: ['I enjoy …'] },
  ],
};
