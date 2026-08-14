import { useState } from 'react';
import {
  Typography, Table, Button, Space, Input, Card, Tag, Modal,
  Form, Switch, App, Alert,
} from 'antd';
import { PlusOutlined, SearchOutlined, StopOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';

const { Title } = Typography;

export default function AdminAccessPage() {
  const { message, modal } = App.useApp();
  const { user: me } = useAuth();
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const {
    results,
    loading,
    search,
    setSearch,
    pagination,
    refresh,
  } = usePaginatedQuery('/staff/');

  const canManage = me?.is_superuser;

  function openCreate() {
    form.resetFields();
    setCreating(true);
  }

  async function saveCreate() {
    const values = await form.validateFields();
    try {
      await api.post('/staff/', {
        email: values.email.trim().toLowerCase(),
        password: values.password,
        name: values.name || '',
      });
      message.success('Admin access granted');
      setCreating(false);
      refresh();
    } catch (e) {
      message.error(e.message);
    }
  }

  function revoke(record) {
    modal.confirm({
      title: `Revoke access for ${record.email}?`,
      content: 'They will no longer be able to sign in to the control panel. Their app account is kept.',
      okButtonProps: { danger: true },
      okText: 'Revoke access',
      onOk: async () => {
        try {
          await api.post(`/staff/${record.id}/revoke/`);
          message.success('Access revoked');
          refresh();
        } catch (e) {
          message.error(e.message);
        }
      },
    });
  }

  async function toggleActive(record, checked) {
    try {
      await api.patch(`/staff/${record.id}/`, { is_active: checked });
      message.success(checked ? 'Account activated' : 'Account deactivated');
      refresh();
    } catch (e) {
      message.error(e.message);
    }
  }

  const columns = [
    { title: 'Email', dataIndex: 'email', ellipsis: true },
    { title: 'Name', dataIndex: 'name', width: 160, render: (n) => n || '—' },
    {
      title: 'Role', width: 120,
      render: (_, r) => (
        r.is_superuser
          ? <Tag color="gold">Superuser</Tag>
          : <Tag color="green">Staff</Tag>
      ),
    },
    {
      title: 'Active', dataIndex: 'is_active', width: 90,
      render: (active, r) => (
        <Switch
          checked={active}
          size="small"
          disabled={!canManage || r.id === me?.id}
          onChange={(checked) => toggleActive(r, checked)}
        />
      ),
    },
    {
      title: 'Joined', dataIndex: 'date_joined', width: 170,
      render: (d) => new Date(d).toLocaleString(),
    },
    {
      title: 'Actions', width: 130,
      render: (_, r) => (
        canManage && r.id !== me?.id ? (
          <Button
            size="small"
            danger
            icon={<StopOutlined />}
            onClick={() => revoke(r)}
          >
            Revoke
          </Button>
        ) : null
      ),
    },
  ];

  return (
    <Card className="mb-brand-card">
      <div className="mb-page-header">
        <Title level={4} className="mb-page-title">Admin Access</Title>
        <Space wrap>
          <Input
            placeholder="Search by email or name"
            prefix={<SearchOutlined />}
            value={search}
            allowClear
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260, maxWidth: '100%' }}
          />
          {canManage ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Grant access
            </Button>
          ) : null}
        </Space>
      </div>

      {!canManage ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="View only"
          description="Only superusers can grant or revoke control panel access. Contact a superuser to add or remove admins."
        />
      ) : (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Who can sign in here"
          description="Staff users can access this panel. Grant access to existing app users by email, or create a dedicated admin account with a password."
        />
      )}

      <Table
        rowKey="id"
        loading={loading}
        dataSource={results}
        columns={columns}
        pagination={pagination}
        scroll={{ x: 800 }}
      />

      <Modal
        open={creating}
        title="Grant control panel access"
        onCancel={() => setCreating(false)}
        onOk={saveCreate}
        destroyOnClose
        okText="Grant access"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email' }]}
            extra="If this email already has an app account, staff access is added to it."
          >
            <Input placeholder="admin@example.com" />
          </Form.Item>
          <Form.Item name="name" label="Display name (optional)">
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            extra="Required for new accounts. Optional when granting access to an existing user."
          >
            <Input.Password placeholder="Min 8 characters for new accounts" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
