import { useState } from 'react';
import {
  Typography, Table, Button, Space, Input, Card, Tag, Switch, Modal,
  Form, InputNumber, App, Descriptions,
} from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';

const { Title } = Typography;

const PROVIDER_COLORS = { google: 'red', apple: 'default', email: 'blue' };

export default function UsersPage() {
  const { message, modal } = App.useApp();
  const [adjusting, setAdjusting] = useState(null);
  const [form] = Form.useForm();

  const {
    results,
    loading,
    search,
    setSearch,
    pagination,
    refresh,
  } = usePaginatedQuery('/users/', { extraParams: { staff: 'false' } });

  async function toggleActive(record, checked) {
    try {
      await api.patch(`/users/${record.id}/`, { is_active: checked });
      message.success(checked ? 'Account activated' : 'Account deactivated');
      refresh();
    } catch (e) {
      message.error(e.message);
    }
  }

  function openAdjust(record) {
    setAdjusting(record);
    form.setFieldsValue({ xp: record.stats?.xp ?? 0, bot_bucks: record.stats?.bot_bucks ?? 0 });
  }

  async function saveAdjust() {
    const values = await form.validateFields();
    try {
      await api.post(`/users/${adjusting.id}/adjust_stats/`, values);
      message.success('Stats updated');
      setAdjusting(null);
      refresh();
    } catch (e) {
      message.error(e.message);
    }
  }

  function resetProgress(record) {
    modal.confirm({
      title: `Reset progress for ${record.email}?`,
      content: 'Deletes all lesson progress and resets XP, streak, badges, Bot Bucks, and onboarding. Cannot be undone.',
      okButtonProps: { danger: true },
      okText: 'Reset',
      onOk: async () => {
        try {
          await api.post(`/users/${record.id}/reset_progress/`);
          message.success('Progress reset');
          refresh();
        } catch (e) {
          message.error(e.message);
        }
      },
    });
  }

  const columns = [
    { title: 'Email', dataIndex: 'email', ellipsis: true },
    {
      title: 'Provider', dataIndex: 'auth_provider', width: 100,
      render: (p) => <Tag color={PROVIDER_COLORS[p]}>{p}</Tag>,
    },
    { title: 'XP', width: 80, render: (_, r) => r.stats?.xp ?? 0 },
    { title: 'Bot Bucks', width: 100, render: (_, r) => r.stats?.bot_bucks ?? 0 },
    {
      title: 'Lessons', width: 90,
      render: (_, r) => r.stats?.lessons_completed ?? r.lessons_completed ?? 0,
    },
    {
      title: 'Active', dataIndex: 'is_active', width: 90,
      render: (active, r) => (
        <Switch
          checked={active}
          size="small"
          onChange={(checked) => toggleActive(r, checked)}
        />
      ),
    },
    {
      title: 'Actions', width: 200, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => openAdjust(r)}>Adjust</Button>
          <Button size="small" danger icon={<ReloadOutlined />} onClick={() => resetProgress(r)}>Reset</Button>
        </Space>
      ),
    },
  ];

  return (
    <Card className="mb-brand-card">
      <div className="mb-page-header">
        <Title level={4} className="mb-page-title">App Users</Title>
        <Input
          placeholder="Search by email or name"
          prefix={<SearchOutlined />}
          value={search}
          allowClear
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280 }}
        />
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={results}
        columns={columns}
        pagination={pagination}
        scroll={{ x: 900 }}
        expandable={{
          expandedRowRender: (r) => (
            <Descriptions size="small" column={3}>
              <Descriptions.Item label="Name">{r.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Streak">{r.stats?.streak_days ?? 0} days</Descriptions.Item>
              <Descriptions.Item label="Onboarding">
                {r.stats?.onboarding_completed ? `Done (${r.stats?.onboarding_score})` : 'Not done'}
              </Descriptions.Item>
              <Descriptions.Item label="Badges" span={3}>
                {r.stats?.badges?.length ? r.stats.badges.join(', ') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Joined" span={3}>
                {new Date(r.date_joined).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          ),
        }}
      />

      <Modal
        open={!!adjusting}
        title={`Adjust stats — ${adjusting?.email || ''}`}
        onCancel={() => setAdjusting(null)}
        onOk={saveAdjust}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="xp" label="XP">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="bot_bucks" label="Bot Bucks">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
