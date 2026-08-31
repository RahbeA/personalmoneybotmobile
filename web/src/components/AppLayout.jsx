import { useState, useEffect } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Typography, Drawer } from 'antd';
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
  BellOutlined,
  MailOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import BrandLogo from './BrandLogo';
import ChangePasswordModal from './ChangePasswordModal';
import { brand } from '../theme/tokens';

const { Sider, Content, Header } = Layout;

const MOBILE_QUERY = '(max-width: 991px)';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return isMobile;
}

const NAV_ITEMS = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/courses', icon: <BookOutlined />, label: 'Courses' },
  { key: '/onboarding', icon: <SolutionOutlined />, label: 'Onboarding' },
  { key: '/characters', icon: <SkinOutlined />, label: 'Characters' },
  { key: '/badges', icon: <TrophyOutlined />, label: 'Badges' },
  { key: '/tips', icon: <GiftOutlined />, label: 'Money Tips' },
  { key: '/feed', icon: <BellOutlined />, label: 'Feed' },
  { key: '/daily-rewards', icon: <GiftOutlined />, label: 'Daily Rewards' },
  { key: '/users', icon: <TeamOutlined />, label: 'Users' },
  { key: '/invites', icon: <MailOutlined />, label: 'Invites' },
  { key: '/notifications', icon: <BellOutlined />, label: 'Notifications' },
  { key: '/admin-access', icon: <SafetyCertificateOutlined />, label: 'Admin Access' },
  { key: '/ai', icon: <RobotOutlined />, label: 'AI Inspector' },
];

function NavMenu({ selectedKey, onNavigate }) {
  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selectedKey]}
      items={NAV_ITEMS}
      onClick={({ key }) => onNavigate(key)}
      style={{ borderInlineEnd: 'none', paddingTop: 8 }}
    />
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const mustChange = !!user?.must_change_password;
  useEffect(() => {
    if (mustChange) setPwModalOpen(true);
  }, [mustChange]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const selectedKey =
    NAV_ITEMS.map((i) => i.key)
      .filter((key) => key !== '/' && location.pathname.startsWith(key))
      .sort((a, b) => b.length - a.length)[0] || '/';

  const pageLabel = NAV_ITEMS.find((i) => i.key === selectedKey)?.label || 'Dashboard';

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

  function go(key) {
    navigate(key);
    setMobileNavOpen(false);
  }

  const siderBrand = (
    <div
      style={{
        padding: '20px 16px 12px',
        borderBottom: `1px solid ${brand.border}`,
      }}
    >
      <BrandLogo size={44} showWordmark wordmarkSize="md" />
    </div>
  );

  return (
    <Layout className="mb-app-shell" style={{ minHeight: '100vh', width: '100%' }}>
      {!isMobile && (
        <Sider
          width={brand.sidebarWidth}
          theme="dark"
          style={{ borderRight: `1px solid ${brand.border}` }}
        >
          {siderBrand}
          <NavMenu selectedKey={selectedKey} onNavigate={go} />
          <div style={{ padding: '16px', marginTop: 'auto' }}>
            <Typography.Text style={{ color: brand.textMuted, fontSize: 11 }}>
              MoneyBot Admin · v1.0
            </Typography.Text>
          </div>
        </Sider>
      )}

      <Drawer
        placement="left"
        open={isMobile && mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        width={280}
        className="mb-mobile-nav"
        styles={{
          body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
          header: { display: 'none' },
        }}
      >
        {siderBrand}
        <NavMenu selectedKey={selectedKey} onNavigate={go} />
        <div style={{ padding: '16px', marginTop: 'auto' }}>
          <Typography.Text style={{ color: brand.textMuted, fontSize: 11 }}>
            MoneyBot Admin · v1.0
          </Typography.Text>
        </div>
      </Drawer>

      <Layout style={{ background: brand.background, minWidth: 0, flex: 1 }}>
        <Header className="mb-app-header">
          <div className="mb-app-header-left">
            {isMobile && (
              <Button
                type="text"
                aria-label="Open navigation"
                icon={<MenuOutlined />}
                onClick={() => setMobileNavOpen(true)}
                style={{ color: brand.textPrimary, marginRight: 4 }}
              />
            )}
            {isMobile && <BrandLogo size={28} />}
            <Typography.Text className="mb-app-header-title">
              {pageLabel}
            </Typography.Text>
          </div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Button type="text" className="mb-app-user-btn">
              <Avatar
                size="small"
                icon={<UserOutlined />}
                style={{ backgroundColor: brand.primary, color: brand.background }}
              />
              <span className="mb-app-user-email">{user?.email}</span>
              {user?.is_superuser ? (
                <span className="mb-app-user-badge">super</span>
              ) : null}
            </Button>
          </Dropdown>
        </Header>
        <Content className="mb-app-content">
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
