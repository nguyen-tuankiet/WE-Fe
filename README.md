# Frontend — WE - Kết nối quốc tế

Giao diện React + Ant Design 6 (Vite, TypeScript). **Hiện là bản xem trước với dữ liệu giả** lưu trong bộ nhớ (mất khi tải lại trang, trừ phiên đăng nhập).

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # Vitest: logic lịch / học bù / ngưỡng đánh giá, danh mục 46 gói
npm run build      # tsc + vite build → dist/
```

## Dùng thử
Trang đăng nhập có nút đăng nhập nhanh theo vai trò (Admin, Manager, Giáo viên, Thanh tra). Góc phải trên có "Chuyển tài khoản (demo)". Menu và dữ liệu thay đổi theo quyền (giáo viên chỉ thấy lớp của mình; liên hệ & học phí chỉ Admin/Manager).
"Hôm nay" cố định là `2026-10-22` (`src/mock/db.ts`) để dữ liệu demo nhất quán.

## Cấu trúc
- `src/api/` — mỗi hàm = một endpoint `/api/v1/...` sau này; hiện đọc/ghi `src/mock/`. Khi có backend, thay thân hàm bằng HTTP, giữ chữ ký.
- `src/domain/` — logic nghiệp vụ thuần + test.
- `src/pages/` — các trang; `src/app/` — layout, route, menu; `src/auth/` — phiên & quyền (ẩn/hiện UI, backend vẫn phải kiểm).
- `src/mock/` — dữ liệu giả (tên không phải học viên thật). Bỏ khi nối backend.

Tài liệu nghiệp vụ & quyết định kỹ thuật: `../.claude/docs/`.
