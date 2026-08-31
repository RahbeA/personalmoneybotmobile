import { useCallback, useEffect, useState } from 'react';
import {
  Typography, InputNumber, Button, Table, Tag, Space, App, Alert,
  Card, Statistic, Row, Col, Select, Input, Modal, List,
} from 'antd';
import {
  MailOutlined, CopyOutlined, ReloadOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import { brand } from '../theme/tokens';

const { Title, Text, Paragraph } = Typography;

const STATUS_COLOR = {
  available: 'green',
  used: 'gold',
  revoked: 'red',
};

export default function InvitesPage() {
  const { message } = App.useApp();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [bulkCount, setBulkCount] = useState(20);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [seedModal, setSeedModal] = useState(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/invite-config/');
      setConfig(data);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [message]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '25' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const data = await api.get(`/invites/?${params.toString()}`);
      setRows(data.results ?? data);
      setTotal(data.count ?? (data.results?.length ?? 0));
    } catch (e) {
      message.error(e.message);
    } finally {
      setListLoading(false);
    }
  }, [message, page, search, statusFilter]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadList(); }, [loadList]);

  async function saveConfig(patch) {
    setSaving(true);
    try {
      const data = await api.patch('/invite-config/', patch);
      setConfig(data);
      message.success('Invite settings saved');
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function generateSeeds() {
    setBulkBusy(true);
    try {
      const data = await api.post('/invites/bulk/', { count: bulkCount, note: 'admin seed' });
      setSeedModal(data.invites || []);
      message.success(`Generated ${data.created} seed invites`);
      loadConfig();
      loadList();
    } catch (e) {
      message.error(e.message);
    } finally {
      setBulkBusy(false);
    }
  }

  function copyText(text, label = 'Copied') {
    navigator.clipboard?.writeText(text).then(() => message.success(label)).catch(() => {
      message.error('Could not copy');
    });
  }

  function copyAllSeedLinks() {
    if (!seedModal?.length) return;
    copyText(seedModal.map((i) => i.url).join('\n'), 'All join links copied');
  }

  const stats = config?.stats || {};
  const realUsers = stats.real_users ?? 0;

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      render: (code, row) => (
        <Space>
          <Text code>{code}</Text>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyText(row.url, 'Join link copied')}
          />
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (s) => <Tag color={STATUS_COLOR[s] || 'default'}>{s}</Tag>,
    },
    {
      title: 'Created by',
      dataIndex: ['created_by', 'email'],
      render: (_, row) => row.created_by?.email || row.created_by?.name || (
        <Text type="secondary">Seed</Text>
      ),
    },
    {
      title: 'Used by',
      dataIndex: ['used_by', 'email'],
      render: (_, row) => row.used_by?.email || row.used_by?.name || '—',
    },
    {
      title: 'Used at',
      dataIndex: 'used_at',
      render: (v) => (v ? new Date(v).toLocaleString() : '—'),
    },
    {
      title: 'Note',
      dataIndex: 'note',
      ellipsis: true,
    },
  ];

  return (
    <div>
      <div className="mb-page-header">
        <div>
          <Title level={4} className="mb-page-title">Invites</Title>
          <Text style={{ color: brand.textSecondary }}>
            Referral codes users share after they sign up. Account creation is open — no join code required.
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => { loadConfig(); loadList(); }}>
          Refresh
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic title="Real users" value={realUsers} suffix={`/ 1000`} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic title="Invites used" value={stats.invites_used ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic title="Available" value={stats.invites_available ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic title="Seed pool" value={stats.seed_available ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 20 }} loading={loading}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Text>Invites per user</Text>
            <InputNumber
              min={0}
              max={100}
              value={config?.invites_per_user ?? 10}
              onChange={(n) => setConfig((c) => ({ ...c, invites_per_user: n ?? 10 }))}
            />
            <Button
              loading={saving}
              onClick={() => saveConfig({ invites_per_user: config?.invites_per_user ?? 10 })}
            >
              Save
            </Button>
          </div>
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        icon={<ThunderboltOutlined />}
        style={{ marginBottom: 20 }}
        message="Bootstrap seed invites"
        description={(
          <div>
            <Paragraph style={{ marginBottom: 12 }}>
              Generate codes with no creator to hand out for the first cohort.
              Each new user then automatically gets their own shareable invites.
            </Paragraph>
            <Space wrap>
              <InputNumber min={1} max={500} value={bulkCount} onChange={(n) => setBulkCount(n ?? 1)} />
              <Button type="primary" icon={<MailOutlined />} loading={bulkBusy} onClick={generateSeeds}>
                Generate seed invites
              </Button>
            </Space>
          </div>
        )}
      />

      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Search code, email, note…"
          allowClear
          style={{ width: 280, maxWidth: '100%' }}
          onSearch={(v) => { setPage(1); setSearch(v); }}
        />
        <Select
          value={statusFilter}
          style={{ width: 160, maxWidth: '100%' }}
          onChange={(v) => { setPage(1); setStatusFilter(v); }}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'available', label: 'Available' },
            { value: 'used', label: 'Used' },
            { value: 'seed', label: 'Seed' },
            { value: 'revoked', label: 'Revoked' },
          ]}
        />
      </Space>

      <Table
        rowKey="id"
        loading={listLoading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          total,
          pageSize: 25,
          onChange: setPage,
          showSizeChanger: false,
        }}
      />

      <Modal
        open={!!seedModal}
        title="Seed invites generated"
        onCancel={() => setSeedModal(null)}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={copyAllSeedLinks}>
            Copy all links
          </Button>,
          <Button key="ok" type="primary" onClick={() => setSeedModal(null)}>Done</Button>,
        ]}
        width={560}
      >
        <List
          size="small"
          dataSource={seedModal || []}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="c"
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => copyText(item.url)}
                >
                  Copy
                </Button>,
              ]}
            >
              <Text code>{item.code}</Text>
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{item.url}</Text>
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}
