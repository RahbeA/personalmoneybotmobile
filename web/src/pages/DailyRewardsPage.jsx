import { useEffect, useState, useCallback } from 'react';
import { Typography, Table, InputNumber, Button, App, Alert } from 'antd';
import { api } from '../api/client';

const { Title, Text } = Typography;

export default function DailyRewardsPage() {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/daily-rewards/');
      setRows(Array.isArray(data) ? data : data.results ?? []);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  function updateLocal(id, bot_bucks) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, bot_bucks } : r)));
  }

  async function saveAll() {
    setSaving(true);
    try {
      await Promise.all(rows.map((r) => api.patch(`/daily-rewards/${r.id}/`, { bot_bucks: r.bot_bucks })));
      message.success('Daily rewards saved');
      load();
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { title: 'Day', dataIndex: 'day', width: 80, render: (d) => `Day ${d}` },
    {
      title: 'Bot Bucks',
      dataIndex: 'bot_bucks',
      render: (v, r) => (
        <InputNumber min={0} value={v} onChange={(n) => updateLocal(r.id, n ?? 0)} />
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>Daily rewards</Title>
      <Text type="secondary">Bot Bucks granted for consecutive daily app logins (7-day ladder).</Text>
      <Alert
        type="info"
        showIcon
        style={{ margin: '16px 0' }}
        message="Default ladder: 5 → 10 → 15 → 20 → 30 → 40 → 75. Missing a day resets to Day 1."
      />
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} scroll={{ x: 'max-content' }} />
      <Button type="primary" onClick={saveAll} loading={saving} style={{ marginTop: 16 }}>
        Save changes
      </Button>
    </div>
  );
}
