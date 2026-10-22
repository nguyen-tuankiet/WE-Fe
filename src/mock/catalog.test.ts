import { describe, expect, it } from 'vitest';
import { PROGRAMS } from './catalog';

describe('danh mục chương trình', () => {
  it('có đúng 46 gói như tài liệu', () => {
    expect(PROGRAMS).toHaveLength(46);
  });

  it('phân bổ theo nhóm: 1/12/6/4/6/8/6/3', () => {
    const count = (g: string) => PROGRAMS.filter((p) => p.group === g).length;
    expect([count('baby'), count('foundation'), count('cambridge'), count('ket'), count('pet'), count('ielts'), count('communication'), count('grade10')]).toEqual([1, 12, 6, 4, 6, 8, 6, 3]);
  });

  it('mã chương trình không trùng', () => {
    expect(new Set(PROGRAMS.map((p) => p.id)).size).toBe(PROGRAMS.length);
  });
});
