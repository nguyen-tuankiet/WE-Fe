import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { initApi } from './api';
import { IN_MEMORY_ROUTER } from './env';
import { AuthProvider } from './auth/AuthContext';
import { App } from './app/App';
import { theme } from './theme';
import './index.css';

dayjs.locale('vi');

/** Bản đóng gói để xem thử trong khung nhúng không có đường dẫn URL riêng, nên định tuyến giữ trong bộ nhớ. */
const Router = IN_MEMORY_ROUTER ? MemoryRouter : BrowserRouter;

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
});

/** Bản backend thật cần biết "hôm nay" theo máy chủ trước khi vẽ giao diện; lỗi mạng vẫn cho vào để trang đăng nhập báo lỗi rõ. */
initApi()
  .catch(() => undefined)
  .finally(() =>
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={viVN} theme={theme}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Router>
              <App />
            </Router>
          </AuthProvider>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
),
  );
