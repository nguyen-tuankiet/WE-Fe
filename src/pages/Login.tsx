import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Divider, Flex, Form, Input, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { listStaff } from '../api';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL } from '../i18n/vi';
import logo from '../assets/logo.png';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const staff = useQuery({ queryKey: ['staff'], queryFn: listStaff });

  const submit = (v: { email: string; pin: string }) => {
    const s = staff.data?.find((x) => x.email.toLowerCase() === v.email.trim().toLowerCase());
    if (!s || !s.active) {
      message.error('Email không đúng hoặc tài khoản đã bị khóa.');
      return;
    }
    login({ id: s.id, name: s.name, email: s.email, roles: s.roles });
    navigate('/tong-quan');
  };

  const quick = (id: string) => {
    const s = staff.data?.find((x) => x.id === id);
    if (s) {
      login({ id: s.id, name: s.name, email: s.email, roles: s.roles });
      navigate('/tong-quan');
    }
  };

  return (
    <Flex
      align="center"
      justify="center"
      style={{ minHeight: '100vh', padding: 16, background: '#ffffff' }}
    >
      <Card style={{ width: 420, maxWidth: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 28 } }}>
        <Flex vertical align="center" gap={4} style={{ marginBottom: 20 }}>
          <img src={logo} alt="WE Kết Nối Quốc Tế" style={{ width: 190, maxWidth: '70%', height: 'auto' }} />
          <Typography.Text type="secondary" style={{ marginTop: 12 }}>Đăng nhập hệ thống nội bộ</Typography.Text>
        </Flex>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Bản xem trước giao diện"
          description="Dữ liệu là giả lập. Nhập đúng email nhân sự, PIN nhập bất kỳ — hoặc chọn nhanh một vai trò bên dưới."
        />

        <Form layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Nhập email' }, { type: 'email', message: 'Email chưa hợp lệ' }]}>
            <Input prefix={<MailOutlined />} placeholder="admin@we.vn" autoComplete="username" />
          </Form.Item>
          <Form.Item name="pin" label="Mã PIN" rules={[{ required: true, message: 'Nhập mã PIN' }, { pattern: /^\d{4,6}$/, message: 'PIN gồm 4–6 chữ số' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="••••" maxLength={6} inputMode="numeric" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">
            Đăng nhập
          </Button>
        </Form>

        <Divider plain>Đăng nhập nhanh theo vai trò</Divider>
        <Flex wrap gap={8} justify="center">
          {[
            ['u-admin', 'admin'],
            ['u-manager', 'manager'],
            ['u-jade', 'teacher'],
            ['u-inspector', 'inspector'],
          ].map(([id, role]) => (
            <Button key={id} onClick={() => quick(id)}>
              {ROLE_LABEL[role as keyof typeof ROLE_LABEL]}
            </Button>
          ))}
        </Flex>
      </Card>
    </Flex>
  );
}
