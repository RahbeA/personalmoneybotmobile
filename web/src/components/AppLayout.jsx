import { useState, useEffect } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Typography } from 'antd';
import {
  DashboardOutlined,
  BookOutlined,
  SkinOutlined,
  TeamOutlined,
  RobotOutlined,
  LogoutOutlined,
  UserOutlined,
  SolutionOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
  TrophyOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import BrandLogo from './BrandLogo';
import ChangePasswordModal from './ChangePasswordModal';
import { brand } from '../theme/tokens';

const { Sider, Content, Header } = Layout;

const NAV_ITEMS = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/courses', icon: <BookOutlined />, label: 'Courses' },
  { key: '/onboarding', icon: <SolutionOutlined />, label: 'Onboarding' },
  { key: '/characters', icon: <SkinOutlined />, label: 'Characters' },
  { key: '/badges', icon: <TrophyOutlined />, label: 'Badges' },
  { key: '/daily-rewards', icon: <GiftOutlined />, label: 'Daily Rewards' },
  { key: '/users', icon: <TeamOutlined />, label: 'Users' },
  { key: '/admin-access', icon: <SafetyCertificateOutlined />, label: 'Admin Access' },
  { key: '/ai', icon: <RobotOutlined />, label: 'AI Inspector' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [pwModalOpen, setPwModalOpen] = useState(false);

  // Force a password change when an owner created/reset this admin's password.
  const mustChange = !!user?.must_change_password;
  useEffect(() => {
    if (mustChange) setPwModalOpen(true);
  }, [mustChange]);

  const selectedKey =
    NAV_ITEMS.map((i) => i.key)
      .filter((key) => key !== '/' && location.pathname.startsWith(key))
      .sort((a, b) => b.length - a.length)[0] || '/';

  const userMenu = {
    items: [
      { key: 'change-password', icon: <KeyOutlined />, label: 'Change password' },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out' },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') logout().then(() => navigate('/login'));
      else if (key === 'change-password') setPwModalOpen(true);
    },
  };

  return (
    <Layout style={{ minHeight: '100vh', width: '100%' }}>
      <Sider
        width={brand.sidebarWidth}
        breakpoint="lg"
        collapsedWidth="0"
        theme="dark"
        style={{ borderRight: `1px solid ${brand.border}` }}
      >
        <div
          style={{
            padding: '20px 16px 12px',
            borderBottom: `1px solid ${brand.border}`,
          }}
        >
          <BrandLogo size={44} showWordmark wordmarkSize="md" />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 'none', paddingTop: 8 }}
        />
        <div style={{ padding: '16px', marginTop: 'auto' }}>
          <Typography.Text style={{ color: brand.textMuted, fontSize: 11 }}>
            MoneyBot Admin · v1.0
          </Typography.Text>
        </div>
      </Sider>
      <Layout style={{ background: brand.background }}>
        <Header
          style={{
            background: brand.surfaceElevated,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingInline: 20,
            height: 56,
            lineHeight: '56px',
            borderBottom: `1px solid ${brand.border}`,
          }}
        >
          <Typography.Text style={{ color: brand.textSecondary, fontSize: 13 }}>
            {NAV_ITEMS.find((i) => i.key === selectedKey)?.label || 'Dashboard'}
          </Typography.Text>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Button type="text" style={{ height: 'auto', padding: '4px 8px', color: brand.textPrimary }}>
              <Avatar
                size="small"
                icon={<UserOutlined />}
                style={{ marginRight: 8, backgroundColor: brand.primary, color: brand.background }}
              />
              {user?.email}
              {user?.is_superuser ? (
                <span style={{ marginLeft: 6, color: brand.botBucks, fontSize: 11 }}>super</span>
              ) : null}
            </Button>
          </Dropdown>
        </Header>
        <Content
          style={{
            padding: '16px 20px',
            background: brand.background,
            minHeight: 'calc(100vh - 56px)',
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
      <ChangePasswordModal
        open={pwModalOpen}
        forced={mustChange}
        onClose={() => setPwModalOpen(false)}
      />
    </Layout>
  );
}
