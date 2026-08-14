import { useEffect, useMemo, useState } from 'react';
import {
  Typography, Table, Button, Space, Input, Card, Tag, Modal, Form, Select,
  Switch, App, Tooltip, Alert, Descriptions,
} from 'antd';
import {
  SearchOutlined, SendOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
  TeamOutlined, AppleOutlined, AndroidOutlined, GlobalOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import { usePaginatedQuery } from '../hooks/usePaginatedQuery';

const { Title, Text } = Typography;

const AUDIENCE_META = {
  all: { label: 'All users', color: 'green', icon: <GlobalOutlined /> },
  selected: { label: 'Selected users', color: 'blue', icon: <TeamOutlined /> },
  ios: { label: 'iOS devices', color: 'default', icon: <AppleOutlined /> },
  android: { label: 'Android devices', color: 'lime', icon: <AndroidOutlined /> },
};

const STATUS_COLORS = {
  draft: 'default',
  sending: 'processing',
  sent: 'success',
  failed: 'error',
};

function useUserSearch() {
  const [options, setOptions] = useState([]);
  const [fetching, setFetching] = useState(false);

  async function search(term) {
    setFetching(true);
    try {
      const q = term ? `&search=${encodeURIComponent(term)}` : '';
      const data = await api.get(`/users/?page_size=20&staff=false${q}`);
      const users = data?.results ?? [];
      setOptions(users.map((u) => ({
        label: u.name ? `${u.name} — ${u.email}` : u.email,
        value: u.id,
      })));
    } catch {
      setOptions([]);
    } finally {
      setFetching(false);
    }
  }

  return { options, fetching, search };
}

export default function NotificationsPage() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState(null); // campaign being edited, or null for new
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const { options: userOptions, fetching: usersFetching, search: searchUsers } = useUserSearch();

  const {
    results, loading, search, setSearch, pagination, refresh,
  } = usePaginatedQuery('/notifications/');

  const audience = Form.useWatch('audience', form);

  useEffect(() => {
    if (composerOpen) searchUsers('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerOpen]);

  function openComposer(campaign = null) {
    setEditing(campaign);
    form.resetFields();
    if (campaign) {
      form.setFieldsValue({
        title: campaign.title,
        body: campaign.body,
        audience: campaign.audience,
        recipients: campaign.recipients,
        include_staff: campaign.include_staff,
        send_push: campaign.send_push,
      });
    } else {
      form.setFieldsValue({
        audience: 'all',
        include_staff: false,
        send_push: true,
        recipients: [],
      });
    }
    setComposerOpen(true);
  }

  async function saveCampaign(values) {
    const payload = {
      title: values.title.trim(),
      body: values.body.trim(),
      audience: values.audience,
      recipients: values.audience === 'selected' ? values.recipients : [],
      include_staff: !!values.include_staff,
      send_push: !!values.send_push,
    };
    if (editing) {
      return api.patch(`/notifications/${editing.id}/`, payload);
    }
    return api.post('/notifications/', payload);
  }

  async function handleSaveDraft() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await saveCampaign(values);
      message.success(editing ? 'Draft updated' : 'Draft saved');
      setComposerOpen(false);
      refresh();
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    const values = await form.validateFields();
    setSaving(true);
    let campaign;
    try {
      campaign = await saveCampaign(values);
    } catch (e) {
      message.error(e.message);
      setSaving(false);
      return;
    }

    // Preview the audience so the admin confirms the real reach before delivery.
    let previewText = '';
    let previewStats = null;
    try {
      previewStats = await api.get(`/notifications/${campaign.id}/preview/`);
      const pushBit = campaign.send_push
        ? ` ${previewStats.users_with_push.toLocaleString()} of them have a registered push device (${previewStats.device_tokens} token${previewStats.device_tokens === 1 ? '' : 's'}).`
        : ' OS push is disabled for this campaign (in-app only).';
      previewText = `This will create in-app notifications for ${previewStats.count.toLocaleString()} user${previewStats.count === 1 ? '' : 's'}.${pushBit}`;
      if (campaign.send_push && previewStats.users_with_push === 0) {
        previewText += ' Warning: nobody in this audience has a push token — the send will fail until devices register.';
      }
    } catch {
      previewText = 'Audience preview unavailable — the campaign will still send to the selected audience.';
    }
    setSaving(false);

    modal.confirm({
      title: `Send “${campaign.title}”?`,
      content: previewText,
      okText: 'Send now',
      okButtonProps: {
        type: 'primary',
        icon: <SendOutlined />,
        danger: !!(campaign.send_push && previewStats && previewStats.users_with_push === 0),
      },
      onOk: async () => {
        try {
          const sent = await api.post(`/notifications/${campaign.id}/send/`);
          if (sent.send_push) {
            message.success(
              `Delivered: ${sent.target_count} in-app · ${sent.push_count} Expo push accepted.`,
            );
          } else {
            message.success(`Delivered ${sent.target_count} in-app notification(s) (push off).`);
          }
          setComposerOpen(false);
          refresh();
        } catch (e) {
          message.error(e.message);
          refresh();
        }
      },
      onCancel: () => {
        // Campaign stays as a draft; make sure the table reflects it.
        refresh();
      },
    });
  }

  async function sendExisting(record) {
    let previewText = '';
    let previewStats = null;
    try {
      previewStats = await api.get(`/notifications/${record.id}/preview/`);
      const pushBit = record.send_push
        ? ` ${previewStats.users_with_push.toLocaleString()} have a registered push device.`
        : ' OS push is off (in-app only).';
      previewText = `This will notify ${previewStats.count.toLocaleString()} user${previewStats.count === 1 ? '' : 's'}.${pushBit}`;
      if (record.send_push && previewStats.users_with_push === 0) {
        previewText += ' Warning: no push tokens — send will fail.';
      }
    } catch {
      previewText = 'Audience preview unavailable.';
    }
    modal.confirm({
      title: `Send “${record.title}”?`,
      content: previewText,
      okText: 'Send now',
      okButtonProps: {
        type: 'primary',
        icon: <SendOutlined />,
        danger: !!(record.send_push && previewStats && previewStats.users_with_push === 0),
      },
      onOk: async () => {
        setSendingId(record.id);
        try {
          const sent = await api.post(`/notifications/${record.id}/send/`);
          if (sent.send_push) {
            message.success(
              `Delivered: ${sent.target_count} in-app · ${sent.push_count} Expo push accepted.`,
            );
          } else {
            message.success(`Delivered ${sent.target_count} in-app notification(s) (push off).`);
          }
        } catch (e) {
          message.error(e.message);
        } finally {
          setSendingId(null);
          refresh();
        }
      },
    });
  }

  function deleteDraft(record) {
    modal.confirm({
      title: `Delete draft “${record.title}”?`,
      content: 'This draft has not been sent. Deleting it cannot be undone.',
      okButtonProps: { danger: true },
      okText: 'Delete',
      onOk: async () => {
        try {
          await api.del(`/notifications/${record.id}/`);
          message.success('Draft deleted');
          refresh();
        } catch (e) {
          message.error(e.message);
        }
      },
    });
  }

  const columns = useMemo(() => [
    {
      title: 'Title', dataIndex: 'title', ellipsis: true,
      render: (title, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{title}</Text>
          <Text type="secondary" style={{ fontSize: 12 }} ellipsis>{r.body}</Text>
        </Space>
      ),
    },
    {
      title: 'Audience', dataIndex: 'audience', width: 160,
      render: (a, r) => {
        const meta = AUDIENCE_META[a] || AUDIENCE_META.all;
        const label = a === 'selected'
          ? `${meta.label} (${r.recipients?.length ?? 0})`
          : meta.label;
        return <Tag color={meta.color} icon={meta.icon}>{label}</Tag>;
      },
    },
    {
      title: 'Push', dataIndex: 'send_push', width: 70,
      render: (v) => (v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>),
    },
    {
      title: 'Status', dataIndex: 'status', width: 100,
      render: (s, r) => (
        <Tooltip title={s === 'failed' ? r.error_message : undefined}>
          <Tag color={STATUS_COLORS[s]}>{s}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Reach', width: 110,
      render: (_, r) => (r.status === 'sent'
        ? <Text>{r.target_count} users · {r.push_count} push</Text>
        : <Text type="secondary">—</Text>),
    },
    {
      title: 'Created', dataIndex: 'created_at', width: 150,
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: 'Actions', width: 190, fixed: 'right',
      render: (_, r) => {
        const editable = r.status === 'draft' || r.status === 'failed';
        return (
          <Space>
            {editable && (
              <>
                <Button
                  size="small"
                  type="primary"
                  icon={<SendOutlined />}
                  loading={sendingId === r.id}
                  onClick={() => sendExisting(r)}
                >
                  Send
                </Button>
                <Button size="small" icon={<EditOutlined />} onClick={() => openComposer(r)} />
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteDraft(r)} />
              </>
            )}
          </Space>
        );
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [sendingId]);

  return (
    <Card className="mb-brand-card">
      <div className="mb-page-header">
        <Title level={4} className="mb-page-title">Notifications</Title>
        <Space wrap>
          <Input
            placeholder="Search campaigns"
            prefix={<SearchOutlined />}
            value={search}
            allowClear
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, maxWidth: '100%' }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openComposer()}>
            New notification
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={results}
        columns={columns}
        pagination={pagination}
        scroll={{ x: 1000 }}
        expandable={{
          expandedRowRender: (r) => (
            <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Body" span={2}>{r.body}</Descriptions.Item>
              {r.audience === 'selected' && (
                <Descriptions.Item label="Recipients" span={2}>
                  {r.recipient_emails?.length ? r.recipient_emails.join(', ') : '—'}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Includes staff">{r.include_staff ? 'Yes' : 'No'}</Descriptions.Item>
              <Descriptions.Item label="Created by">{r.created_by_email || '—'}</Descriptions.Item>
              {r.sent_at && (
                <Descriptions.Item label="Sent at" span={2}>
                  {new Date(r.sent_at).toLocaleString()}
                </Descriptions.Item>
              )}
              {r.error_message && (
                <Descriptions.Item label="Error" span={2}>
                  <Text type="danger">{r.error_message}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          ),
        }}
      />

      <Modal
        open={composerOpen}
        title={editing ? 'Edit notification' : 'New notification'}
        onCancel={() => setComposerOpen(false)}
        destroyOnClose
        width={560}
        footer={[
          <Button key="cancel" onClick={() => setComposerOpen(false)}>Cancel</Button>,
          <Button key="draft" onClick={handleSaveDraft} loading={saving}>Save draft</Button>,
          <Button key="send" type="primary" icon={<SendOutlined />} onClick={handleSend} loading={saving}>
            Send
          </Button>,
        ]}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Users get an in-app notification. If push is enabled, registered devices also get an OS push."
        />
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Title is required' }, { max: 140 }]}
          >
            <Input placeholder="e.g. New lessons just dropped!" showCount maxLength={140} />
          </Form.Item>
          <Form.Item
            name="body"
            label="Message"
            rules={[{ required: true, message: 'Message is required' }, { max: 280 }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="What do you want to tell your users?"
              showCount
              maxLength={280}
            />
          </Form.Item>
          <Form.Item name="audience" label="Send to" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'all', label: 'All active users' },
                { value: 'selected', label: 'Selected users' },
                { value: 'ios', label: 'Users with an iOS device' },
                { value: 'android', label: 'Users with an Android device' },
              ]}
            />
          </Form.Item>
          {audience === 'selected' && (
            <Form.Item
              name="recipients"
              label="Users"
              rules={[{ required: true, message: 'Pick at least one user' }]}
            >
              <Select
                mode="multiple"
                placeholder="Search users by email or name"
                filterOption={false}
                onSearch={searchUsers}
                loading={usersFetching}
                options={userOptions}
                notFoundContent={usersFetching ? 'Searching…' : 'No users found'}
              />
            </Form.Item>
          )}
          <Space size="large">
            <Form.Item name="send_push" label="OS push" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
            <Form.Item name="include_staff" label="Include admins" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Card>
  );
}
