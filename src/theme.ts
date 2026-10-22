import type { ThemeConfig } from 'antd';

/** Màu lấy từ logo WE (đỏ đậm ≈ #860d12). */
export const BRAND = {
  red: '#860d12',
  redDark: '#5c080c',
  redDeep: '#470609',
  redHover: '#a3141b',
  redSoft: '#f6e9ea',
  orange: '#fa8c18',
  amber: '#fba346',
  gold: '#f6b305',
  brick: '#d4380d',
  slate: '#4a5a7a',
};

export const theme: ThemeConfig = {
  token: {
    colorPrimary: BRAND.red,
    colorInfo: BRAND.slate,
    colorWarning: BRAND.orange,
    colorError: BRAND.brick,
    borderRadius: 8,
    colorBgLayout: '#f7f4f3',
  },
  components: {
    Layout: { siderBg: BRAND.redDark, headerBg: '#ffffff', triggerBg: BRAND.redDeep },
    Menu: {
      darkItemBg: BRAND.redDark,
      darkSubMenuItemBg: BRAND.redDark,
      darkItemSelectedBg: BRAND.red,
      darkItemSelectedColor: '#ffffff',
      darkItemHoverBg: '#7a0b10',
    },
    Table: { headerBg: BRAND.redSoft },
  },
};
