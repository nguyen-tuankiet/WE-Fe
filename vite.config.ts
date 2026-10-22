import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `--mode artifact`: bản đóng gói để xem thử trong khung nhúng (đường dẫn tương đối, định tuyến trong bộ nhớ).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'artifact' ? './' : '/',
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 1500 },
  test: { include: ['src/**/*.test.ts'] },
}));
