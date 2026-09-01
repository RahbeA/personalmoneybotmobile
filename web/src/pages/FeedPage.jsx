import { useEffect, useState, useCallback } from 'react';
import { Typography, Button, App, Table, Space, Image, Tag, Select } from 'antd';
import { api } from '../api/client';
import { resolveMediaUrl } from '../utils/media';
import SwipeFeedModeration from '../components/SwipeFeedModeration';

const { Title, Text } = Typography;

const STATUS_COLOR = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
};

export default function FeedPage() {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moderating, setModerating] = useState(false);
  const [status, setStatus] = useState('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const data = await api.get(`/feed/${qs}`);
      setRows(Array.isArray(data) ? data : data.results ?? []);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [message, status]);

  useEffect(() => { load(); }, [load]);

  const moderate = useCallback(async (record, action) => {
    setModerating(true);
    try {
      await api.post(`/feed/${record.id}/${action}/`, {});
      message.success(action === 'approve' ? 'Approved' : 'Rejected');
      setRows((prev) => prev.filter((row) => row.id !== record.id));
    } catch (e) {
      message.error(e.message);
      if (e.status) load();
    } finally {
      setModerating(false);
    }
  }, [load, message]);

  const columns = [
    {
      title: 'Image',
      dataIndex: 'image',
      width: 90,
      render: (url) => (
        url ? <Image src={resolveMediaUrl(url)} width={56} height={56} style={{ objectFit: 'cover' }} /> : null
      ),
    },
    { title: 'Caption', dataIndex: 'caption', ellipsis: true },
    { title: 'Author', dataIndex: 'author_email', width: 220 },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (s) => <Tag color={STATUS_COLOR[s] || 'default'}>{s}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      width: 180,
      render: (v) => (v ? new Date(v).toLocaleString() : ''),
    },
    {
      title: '',
      width: 200,
      render: (_, r) => (
        <Space>
          {r.status !== 'approved' && (
            <Button size="small" type="primary" onClick={() => moderate(r, 'approve')}>Approve</Button>
          )}
          {r.status !== 'rejected' && (
            <Button size="small" danger onClick={() => moderate(r, 'reject')}>Reject</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-page-header">
        <div>
          <Title level={4} className="mb-page-title">Feed moderation</Title>
          <Text type="secondary">Approve financial-education posts before they appear in the app.</Text>
        </div>
        <Select
          value={status}
          onChange={setStatus}
          style={{ width: 160 }}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: '', label: 'All' },
          ]}
        />
      </div>
      {status === 'pending' ? (
        loading ? (
          <div className="mb-feed-swipe-empty"><Text type="secondary">Loading pending posts…</Text></div>
        ) : (
          <SwipeFeedModeration posts={rows} onDecision={moderate} busy={moderating} />
        )
      ) : (
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} />
      )}
    </div>
  );
}
