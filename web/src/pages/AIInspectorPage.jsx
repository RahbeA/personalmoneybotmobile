import { useState } from 'react';
import {
  Typography, Card, Table, Tabs, Drawer, Tag, Space, App, Spin, Empty, Input,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';
import { brand } from '../theme/tokens';

const { Title, Text, Paragraph } = Typography;

function MessageList({ messages }) {
  if (!messages?.length) return <Empty description="No messages" />;
  return (
    <div>
      {messages.map((m) => (
        <div
          key={m.id}
          style={{
            display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              maxWidth: '80%',
              padding: '8px 12px',
              borderRadius: 12,
              background: m.role === 'user' ? 'rgba(61,220,95,0.15)' : brand.surfaceElevated,
              border: `1px solid ${brand.border}`,
            }}
          >
            <Text style={{ fontSize: 11, textTransform: 'uppercase', color: brand.textMuted }}>{m.role}</Text>
            <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: brand.textPrimary }}>{m.content}</Paragraph>
          </div>
        </div>
      ))}
    </div>
  );
}

function PaginatedInspectorTable({ endpoint, columns, onOpen, searchPlaceholder }) {
  const {
    results, loading, search, setSearch, pagination,
  } = usePaginatedQuery(endpoint);

  return (
    <>
      <Input
        placeholder={searchPlaceholder}
        prefix={<SearchOutlined />}
        value={search}
        allowClear
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: 320, marginBottom: 12 }}
      />
      <Table
        rowKey="id"
        loading={loading}
        dataSource={results}
        columns={columns}
        pagination={pagination}
        scroll={{ x: 700 }}
        onRow={(r) => ({ onClick: () => onOpen(r), style: { cursor: 'pointer' } })}
      />
    </>
  );
}

function TutorTab() {
  const { message } = App.useApp();
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function open(record) {
    setDetailLoading(true);
    setDetail({});
    try {
      setDetail(await api.get(`/ai/tutor-conversations/${record.id}/`));
    } catch (e) {
      message.error(e.message);
    } finally {
      setDetailLoading(false);
    }
  }

  const columns = [
    { title: 'User', dataIndex: 'user_email', ellipsis: true },
    { title: 'Title', dataIndex: 'title', ellipsis: true },
    { title: 'Messages', dataIndex: 'message_count', width: 100 },
    { title: 'Updated', dataIndex: 'updated_at', width: 170, render: (d) => new Date(d).toLocaleString() },
  ];

  return (
    <>
      <PaginatedInspectorTable
        endpoint="/ai/tutor-conversations/"
        columns={columns}
        onOpen={open}
        searchPlaceholder="Search by user email or title"
      />
      <Drawer open={!!detail} title={detail?.title} width={560} onClose={() => setDetail(null)}>
        {detailLoading ? <Spin /> : (
          <>
            <Text style={{ color: brand.textSecondary }}>{detail?.user_email}</Text>
            <div style={{ marginTop: 16 }}><MessageList messages={detail?.messages} /></div>
          </>
        )}
      </Drawer>
    </>
  );
}

function MoneyChatTab() {
  const { message } = App.useApp();
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function open(record) {
    setDetailLoading(true);
    setDetail({});
    try {
      setDetail(await api.get(`/ai/money-chat-sessions/${record.id}/`));
    } catch (e) {
      message.error(e.message);
    } finally {
      setDetailLoading(false);
    }
  }

  const columns = [
    { title: 'User', dataIndex: 'user_email', ellipsis: true },
    { title: 'Module', dataIndex: 'module_title', ellipsis: true },
    {
      title: 'Status', dataIndex: 'status', width: 110,
      render: (s, r) => <Tag color={r.passed ? 'green' : 'blue'}>{s}</Tag>,
    },
    { title: 'Messages', dataIndex: 'message_count', width: 100 },
    { title: 'Started', dataIndex: 'created_at', width: 170, render: (d) => new Date(d).toLocaleString() },
  ];

  return (
    <>
      <PaginatedInspectorTable
        endpoint="/ai/money-chat-sessions/"
        columns={columns}
        onOpen={open}
        searchPlaceholder="Search by user email or module"
      />
      <Drawer
        open={!!detail}
        title={detail?.module_title ? `Money Chat — ${detail.module_title}` : 'Money Chat'}
        width={560}
        onClose={() => setDetail(null)}
      >
        {detailLoading ? <Spin /> : (
          <>
            <Space direction="vertical" style={{ marginBottom: 16 }}>
              <Text style={{ color: brand.textSecondary }}>{detail?.user_email}</Text>
              <Tag color={detail?.passed ? 'green' : 'blue'}>{detail?.status}</Tag>
            </Space>
            {detail?.benchmarks?.length ? (
              <Card size="small" title="Benchmarks" className="mb-brand-card" style={{ marginBottom: 16 }}>
                {detail.benchmarks.map((b, i) => {
                  const id = b.id ?? i;
                  const met = detail.met_benchmark_ids?.includes(id);
                  return (
                    <div key={id}>
                      <Tag color={met ? 'green' : 'default'}>{met ? '✓' : '○'}</Tag>
                      {b.label || b.text || JSON.stringify(b)}
                    </div>
                  );
                })}
              </Card>
            ) : null}
            <MessageList messages={detail?.messages} />
          </>
        )}
      </Drawer>
    </>
  );
}

export default function AIInspectorPage() {
  return (
    <Card className="mb-brand-card">
      <Title level={4} className="mb-page-title" style={{ marginTop: 0, marginBottom: 16 }}>
        AI Inspector
      </Title>
      <Tabs
        items={[
          { key: 'tutor', label: 'Tutor Conversations', children: <TutorTab /> },
          { key: 'money', label: 'Money Chat Sessions', children: <MoneyChatTab /> },
        ]}
      />
    </Card>
  );
}
