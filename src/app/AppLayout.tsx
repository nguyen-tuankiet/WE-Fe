import { BellOutlined, DownOutlined, HomeOutlined, LogoutOutlined, MenuOutlined, SwapOutlined, UserOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Avatar, Badge, Breadcrumb, Button, Dropdown, Flex, Grid, Layout, Menu, Spin, Tag, Typography } from 'antd';
import { useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { listStaff, listTasks } from '../api';
import { useAuth } from '../auth/AuthContext';
import { API_MODE } from '../env';
import { can, isManagement } from '../auth/permissions';
import { ROLE_LABEL } from '../i18n/vi';
import logoWhite from '../assets/logo-white.png';
import mark from '../assets/mark.png';
import { BRAND } from '../theme';
import { NAV } from './nav';

const { Sider, Header, Content } = Layout;

export function AppLayout() {
  const { user, ready, login, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const mobile = !screens.lg;
  const [collapsed, setCollapsed] = useState(true);
  const staff = useQuery({ queryKey: ['staff'], queryFn: listStaff, enabled: !!user && API_MODE === 'mock' });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: listTasks, enabled: !!user });

  if (!ready) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;
  if (!user) return <Navigate to="/dang-nhap" replace state={{ from: location.pathname }} />;

  const items = NAV.filter((n) => can(user.roles, n.feature));
  const current = items.find((n) => location.pathname.startsWith(n.path));
  if (!current && location.pathname !== '/') {
    const first = items[0];
    if (first) return <Navigate to={first.path} replace />;
  }

  const demoAccounts = (staff.data ?? []).filter((s) => s.active);
  const openTasks = isManagement(user.roles) ? (tasks.data ?? []).filter((t) => !t.handled).length : 0;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        breakpoint="lg"
        collapsedWidth={0}
        trigger={null}
        collapsed={mobile ? collapsed : false}
        width={230}
        className="no-print"
        style={
          mobile
            ? { position: 'fixed', zIndex: 100, height: '100vh', left: 0, top: 0 }
            : { position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }
        }
      >
        <Flex vertical align="center" style={{ padding: '20px 20px 14px' }}>
          <img src={logoWhite} alt="WE Kết Nối Quốc Tế" style={{ width: 150, maxWidth: '100%', height: 'auto' }} />
        </Flex>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={current ? [current.path] : []}
          items={items.map((n) => ({ key: n.path, icon: n.icon, label: n.label }))}
          onClick={({ key }) => {
            navigate(key);
            if (mobile) setCollapsed(true);
          }}
        />
        <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <img src={logoWhite} alt="" style={{ position: 'absolute', left: -60, bottom: -30, width: 300, opacity: 0.08 }} />
        </div>
      </Sider>
      <Layout>
        <Header className="no-print" style={{ padding: '0 20px', borderBottom: '1px solid #e6e9f2' }}>
          <Flex justify="space-between" align="center" style={{ height: '100%' }}>
            <Flex align="center" gap={8}>
              {mobile && <Button type="text" aria-label="Mở menu" icon={<MenuOutlined />} onClick={() => setCollapsed((c) => !c)} />}
              {mobile && <img src={mark} alt="WE" width={28} height={28} />}
              {mobile ? (
                <Typography.Text type="secondary">Kết nối quốc tế</Typography.Text>
              ) : (
                <Breadcrumb
                  items={[
                    { title: <HomeOutlined />, href: '/tong-quan', onClick: (e) => { e.preventDefault(); navigate('/tong-quan'); } },
                    { title: 'Trung tâm Ngoại ngữ WE Kết Nối Quốc Tế' },
                    ...(current ? [{ title: <strong style={{ color: '#2b2726' }}>{current.label}</strong> }] : []),
                  ]}
                />
              )}
            </Flex>
            <Flex align="center" gap={18}>
            <Badge dot={openTasks > 0} offset={[-4, 4]}>
              <Button
                type="text"
                shape="circle"
                aria-label={openTasks > 0 ? `${openTasks} việc cần quan tâm` : 'Thông báo'}
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                onClick={() => navigate('/tong-quan')}
              />
            </Badge>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  ...(API_MODE === 'mock'
                    ? [
                        {
                          key: 'switch',
                          icon: <SwapOutlined />,
                          label: 'Chuyển tài khoản (demo)',
                          children: demoAccounts.map((s) => ({
                            key: `acc:${s.id}`,
                            label: `${s.name} · ${s.roles.map((r) => ROLE_LABEL[r]).join(', ')}`,
                          })),
                        },
                        { type: 'divider' as const },
                      ]
                    : []),
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
                ],
                onClick: ({ key }) => {
                  if (key === 'logout') {
                    logout();
                    navigate('/dang-nhap');
                  } else if (key.startsWith('acc:')) {
                    const s = demoAccounts.find((x) => `acc:${x.id}` === key);
                    if (s) {
                      login({ id: s.id, name: s.name, email: s.email, roles: s.roles });
                      navigate('/tong-quan');
                    }
                  }
                },
              }}
            >
              <Flex align="center" gap={10} style={{ cursor: 'pointer' }}>
                <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 600 }}>{user.name}</div>
                  <Flex gap={4} justify="flex-end">
                    {user.roles.map((r) => (
                      <Tag key={r} variant="filled" style={{ margin: 0, background: BRAND.redSoft, color: BRAND.red }}>
                        {ROLE_LABEL[r]}
                      </Tag>
                    ))}
                  </Flex>
                </div>
                <Avatar style={{ background: BRAND.red }} icon={<UserOutlined />} />
                <DownOutlined style={{ fontSize: 11, color: '#8a8483' }} />
              </Flex>
            </Dropdown>
            </Flex>
          </Flex>
        </Header>
        <Content style={{ padding: 20 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
