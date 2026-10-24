/** Gọi HTTP tới backend (cookie phiên HttpOnly nên luôn gửi `credentials: 'include'`). */
function resolveApiUrl(): string {
  const raw = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  try {
    const u = new URL(raw);
    // Chạy máy cục bộ: localhost và 127.0.0.1 là hai "site" khác nhau nên cookie phiên (SameSite=Lax) bị trình duyệt chặn.
    // Dùng đúng tên máy đang mở trang để API và giao diện luôn cùng site.
    if (['localhost', '127.0.0.1'].includes(u.hostname) && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      u.hostname = window.location.hostname;
      return u.origin;
    }
  } catch {
    /* VITE_API_URL trống hoặc không phải URL tuyệt đối: dùng nguyên giá trị */
  }
  return raw;
}

export const API_URL = resolveApiUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Phát khi máy chủ báo chưa đăng nhập / phiên hết hạn để giao diện quay về trang đăng nhập. */
export const UNAUTHORIZED_EVENT = 'we:unauthorized';

const SILENT_401 = new Set(['/api/v1/me', '/api/v1/auth/login']);

export async function http<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', 0, 'NETWORK');
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && !SILENT_401.has(path.split('?')[0])) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    const fields = data?.error?.fields as Record<string, string> | undefined;
    const detail = fields ? Object.values(fields).join(' ') : '';
    const message = [data?.error?.message ?? `Lỗi máy chủ (${res.status}).`, detail].filter(Boolean).join(' ');
    throw new ApiError(message, res.status, data?.error?.code ?? 'ERROR', fields);
  }
  return data as T;
}
