import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Alert } from 'antd';
import { useAuth } from './AuthContext';
import BrandLogo from '../components/BrandLogo';
import { brand } from '../theme/tokens';

const { Text } = Typography;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  async function onFinish({ email, password }) {
    setError('');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(145deg, ${brand.background} 0%, #0D160F 45%, ${brand.background} 100%)`,
        padding: 24,
      }}
    >
      <div style={{ width: 420, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <BrandLogo size={72} />
          </div>
          <Typography.Title level={2} style={{ margin: '0 0 4px', color: brand.textPrimary }}>
            Money<span style={{ color: brand.primary }}>Bot</span>
          </Typography.Title>
          <Text style={{ color: brand.textSecondary }}>Control Panel</Text>
        </div>

        <Card
          className="mb-brand-card"
          styles={{ body: { padding: '28px 24px' } }}
        >
          {error ? (
            <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
          ) : null}

          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              label={<span style={{ color: brand.textSecondary }}>Email</span>}
              name="email"
              rules={[{ required: true, message: 'Email is required' }]}
            >
              <Input size="large" placeholder="you@example.com" autoComplete="email" />
            </Form.Item>
            <Form.Item
              label={<span style={{ color: brand.textSecondary }}>Password</span>}
              name="password"
              rules={[{ required: true, message: 'Password is required' }]}
            >
              <Input.Password size="large" placeholder="••••••••" autoComplete="current-password" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                style={{ fontWeight: 600, height: 46 }}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>

          <Text
            style={{
              display: 'block',
              marginTop: 16,
              fontSize: 12,
              textAlign: 'center',
              color: brand.textMuted,
            }}
          >
            Staff access only · Authorized personnel
          </Text>
        </Card>
      </div>
    </div>
  );
}
