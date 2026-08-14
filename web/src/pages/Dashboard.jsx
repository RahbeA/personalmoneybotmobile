import { useEffect, useState } from 'react';
import { Typography, Row, Col, Card, Statistic, Spin, App, Progress } from 'antd';
import {
  TeamOutlined, BookOutlined, TrophyOutlined, DollarOutlined,
  CheckCircleOutlined, SkinOutlined, FireOutlined, RobotOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import BrandLogo from '../components/BrandLogo';
import { brand } from '../theme/tokens';

const { Title, Text } = Typography;

function StatCard({ title, value, icon, suffix }) {
  return (
    <Card className="mb-stat-card" styles={{ body: { padding: '16px 20px' } }}>
      <Statistic title={title} value={value} prefix={icon} suffix={suffix} />
    </Card>
  );
}

export default function Dashboard() {
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setData(await api.get('/stats/summary/'));
      } catch (e) {
        message.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [message]);

  if (loading) {
    return <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>;
  }
  if (!data) return null;

  const maxSignups = Math.max(1, ...data.signups_by_day.map((d) => d.count));

  return (
    <div>
      <div className="mb-page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <BrandLogo size={48} />
          <div>
            <Title level={3} className="mb-page-title">Dashboard</Title>
            <Text style={{ color: brand.textSecondary }}>MoneyBot platform overview</Text>
          </div>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}><StatCard title="Total Users" value={data.users.total} icon={<TeamOutlined />} /></Col>
        <Col xs={12} md={6}><StatCard title="New (7d)" value={data.users.new_last_7_days} icon={<TeamOutlined />} /></Col>
        <Col xs={12} md={6}><StatCard title="Active (7d)" value={data.users.active_last_7_days} icon={<FireOutlined />} /></Col>
        <Col xs={12} md={6}><StatCard title="Admins" value={data.users.staff} icon={<TeamOutlined />} /></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={12} md={6}><StatCard title="Modules" value={data.content.modules} icon={<BookOutlined />} /></Col>
        <Col xs={12} md={6}><StatCard title="Lessons" value={data.content.lessons} icon={<BookOutlined />} /></Col>
        <Col xs={12} md={6}><StatCard title="Questions" value={data.content.questions} icon={<BookOutlined />} /></Col>
        <Col xs={12} md={6}><StatCard title="Characters" value={data.content.characters} icon={<SkinOutlined />} /></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} md={6}><StatCard title="Lessons Completed" value={data.engagement.lessons_completed} icon={<CheckCircleOutlined />} /></Col>
        <Col xs={24} sm={12} md={6}><StatCard title="Money Chats Passed" value={data.engagement.money_chats_passed} icon={<RobotOutlined />} /></Col>
        <Col xs={12} md={6}><StatCard title="Total XP" value={data.economy.total_xp} icon={<TrophyOutlined />} /></Col>
        <Col xs={12} md={6}><StatCard title="Total Bot Bucks" value={data.economy.total_bot_bucks} icon={<DollarOutlined />} /></Col>
      </Row>

      <Card className="mb-brand-card" title="Signups — last 7 days" style={{ marginTop: 16 }}>
        {data.signups_by_day.map((d) => (
          <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Text style={{ width: 90, color: brand.textSecondary }}>
              {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
            <div style={{ flex: 1 }}>
              <Progress
                percent={Math.round((d.count / maxSignups) * 100)}
                showInfo={false}
                strokeColor={brand.primary}
                trailColor={brand.border}
              />
            </div>
            <Text strong style={{ width: 30, textAlign: 'right', color: brand.textPrimary }}>{d.count}</Text>
          </div>
        ))}
      </Card>
    </div>
  );
}
