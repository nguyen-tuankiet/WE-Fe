import type { TablePaginationConfig } from 'antd';

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const showTotal = (total: number) => `${total} mục`;

/** Phân trang chung cho bảng: mặc định 10 dòng, cho chọn 5 / 10 / 20 / 50 dòng mỗi trang. */
export const TABLE_PAGINATION: TablePaginationConfig = {
  defaultPageSize: 10,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  showSizeChanger: true,
  showTotal,
};

/** Cùng quy cách cho danh sách (List). */
export const LIST_PAGINATION = {
  defaultPageSize: 10,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  showSizeChanger: true,
  size: 'small' as const,
  align: 'end' as const,
  showTotal,
};
