export const IN_MEMORY_ROUTER = import.meta.env.VITE_ROUTER === 'memory';

/** `real` = gọi backend thật (cần `VITE_API_URL`); mặc định `mock` = dữ liệu giả để xem trước giao diện. */
export const API_MODE: 'mock' | 'real' = import.meta.env.VITE_API_MODE === 'real' ? 'real' : 'mock';
