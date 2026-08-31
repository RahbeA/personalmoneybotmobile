import { useEffect, useMemo, useState } from 'react';
import {
  Typography, Table, Button, Space, Input, Tag, Modal, Form, Select,
  Switch, App, Tooltip, TimePicker, InputNumber, Alert,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
  PlayCircleOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../api/client';

const { Text } = Typography;

const TRIGGER_META = {
  broadcast_recurring: { label: 'Recurring broadcast', color: 'blue' },
  inactive_users: { label: 'Inactive users', color: 'orange' },
  streak_at_risk: { label: 'Streak at risk', color: 'red' },
};

const WEEKDAYS = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];

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

export default function NotificationAutomationsPanel() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState(null);
  const { options: userOptions, fetching: usersFetching, search: searchUsers } = useUserSearch();

  const triggerType = Form.useWatch('trigger_type', form);
  const audience = Form.useWatch('audience', form);
  const recurrence = Form.useWatch('recurrence', form);

  async function load() {
    setLoading(true);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const data = await api.get(`/notification-automations/${q}`);
      setRows(data?.results ?? data ?? []);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (composerOpen) searchUsers('');
  }, [composerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  function openComposer(record = null) {
    setEditing(record);
    form.resetFields();
    if (record) {
      form.setFieldsValue({
        ...record,
        run_at_time: record.run_at_time ? dayjs(record.run_at_time, 'HH:mm:ss') : dayjs('18:00', 'HH:mm'),
        trigger_config_inactive_days: record.trigger_config?.inactive_days ?? 7,
        trigger_config_streak_min: record.trigger_config?.streak_min ?? 1,
      });
    } else {
      form.setFieldsValue({
        enabled: true,
        trigger_type: 'inactive_users',
        audience: 'all',
        recurrence: 'daily',
        run_at_time: dayjs('18:00', 'HH:mm'),
        run_weekday: 0,
        cooldown_days: 7,
        send_push: true,
        include_staff: false,
        trigger_config_inactive_days: 7,
        trigger_config_streak_min: 1,
        recipients: [],
      });
    }
    setComposerOpen(true);
  }

  function buildPayload(values) {
    const trigger_config = {};
    if (values.trigger_type === 'inactive_users') {
      trigger_config.inactive_days = values.trigger_config_inactive_days ?? 7;
    }
    if (values.trigger_type === 'streak_at_risk') {
      trigger_config.streak_min = values.trigger_config_streak_min ?? 1;
    }
    return {
      name: values.name.trim(),
      enabled: !!values.enabled,
      trigger_type: values.trigger_type,
      trigger_config,
      title: values.title.trim(),
      body: values.body.trim(),
      audience: values.trigger_type === 'broadcast_recurring' ? values.audience : 'all',
      recipients: values.trigger_type === 'broadcast_recurring' && values.audience === 'selected'
        ? values.recipients
        : [],
      include_staff: !!values.include_staff,
      send_push: !!values.send_push,
      recurrence: values.recurrence || 'daily',
      run_at_time: values.run_at_time?.format('HH:mm:ss') || '18:00:00',
      run_weekday: values.run_weekday ?? 0,
      cooldown_days: values.cooldown_days ?? 7,
    };
  }

  async function handleSave() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = buildPayload(values);
      if (editing?.id) {
        await api.patch(`/notification-automations/${editing.id}/`, payload);
        message.success('Automation updated');
      } else {
        await api.post('/notification-automations/', payload);
        message.success('Automation created');
      }
      setComposerOpen(false);
      load();
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(record, enabled) {
    try {
      await api.patch(`/notification-automations/${record.id}/`, { enabled });
      load();
    } catch (e) {
      message.error(e.message);
    }
  }

  function deleteAutomation(record) {
    modal.confirm({
      title: `Delete “${record.name}”?`,
      okButtonProps: { danger: true },
      okText: 'Delete',
      onOk: async () => {
        try {
          await api.del(`/notification-automations/${record.id}/`);
          message.success('Deleted');
          load();
        } catch (e) {
          message.error(e.message);
        }
      },
    });
  }

  async function previewAutomation(record) {
    try {
      const stats = await api.get(`/notification-automations/${record.id}/preview/`);
      modal.info({
        title: `Preview: ${record.name}`,
        content: (
          <div>
            <p><strong>{stats.audience_count}</strong> users match this rule.</p>
            <p><strong>{stats.eligible_count}</strong> eligible after cooldown.</p>
            {record.send_push && (
              <p><strong>{stats.users_with_push}</strong> eligible users have push registered.</p>
            )}
          </div>
        ),
      });
    } catch (e) {
      message.error(e.message);
    }
  }

  async function runNow(record) {
    modal.confirm({
      title: `Run “${record.name}” now?`,
      content: 'This bypasses the schedule and sends immediately to all eligible users.',
      okText: 'Run now',
      onOk: async () => {
        setRunningId(record.id);
        try {
          const result = await api.post(`/notification-automations/${record.id}/run/`);
          message.success(`Sent ${result.sent_count} notification(s)`);
          load();
        } catch (e) {
          message.error(e.message);
        } finally {
          setRunningId(null);
        }
      },
    });
  }

  const columns = useMemo(() => [
    {
      title: 'Name', dataIndex: 'name', ellipsis: true,
      render: (name, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.title}</Text>
        </Space>
      ),
    },
    {
      title: 'Trigger', dataIndex: 'trigger_type', width: 160,
      render: (t) => {
        const meta = TRIGGER_META[t] || { label: t, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Schedule', width: 140,
      render: (_, r) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {r.trigger_type === 'broadcast_recurring'
            ? `${r.recurrence} · ${String(r.run_at_time).slice(0, 5)} UTC`
            : `Daily · ${String(r.run_at_time).slice(0, 5)} UTC`}
        </Text>
      ),
    },
    {
      title: 'On', dataIndex: 'enabled', width: 70,
      render: (v, r) => (
        <Switch checked={v} onChange={(checked) => toggleEnabled(r, checked)} />
      ),
    },
    {
      title: 'Last run', width: 130,
      render: (_, r) => (
        r.last_run_at
          ? <Text style={{ fontSize: 12 }}>{r.last_run_count} sent · {new Date(r.last_run_at).toLocaleString()}</Text>
          : <Text type="secondary">Never</Text>
      ),
    },
    {
      title: 'Actions', width: 200, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<PlayCircleOutlined />} loading={runningId === r.id} onClick={() => runNow(r)}>
            Run
          </Button>
          <Button size="small" onClick={() => previewAutomation(r)}>Preview</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openComposer(r)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteAutomation(r)} />
        </Space>
      ),
    },
  ], [runningId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Alert
        type="info"
        showIcon
        icon={<ThunderboltOutlined />}
        style={{ marginBottom: 16 }}
        message="Automations run on a schedule via the server job: python manage.py run_notification_automations (cron every 5–15 min)."
      />
      <div className="mb-page-header" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Search automations"
            prefix={<SearchOutlined />}
            value={search}
            allowClear
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, maxWidth: '100%' }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openComposer()}>
            New automation
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 960 }}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        open={composerOpen}
        title={editing ? 'Edit automation' : 'New automation'}
        onCancel={() => setComposerOpen(false)}
        destroyOnClose
        width={600}
        okText="Save"
        confirmLoading={saving}
        onOk={handleSave}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. 7-day inactive nudge" />
          </Form.Item>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="trigger_type" label="Trigger" rules={[{ required: true }]}>
            <Select options={[
              { value: 'inactive_users', label: 'Inactive users — no lesson activity for N days' },
              { value: 'streak_at_risk', label: 'Streak at risk — has a streak but inactive today' },
              { value: 'broadcast_recurring', label: 'Recurring broadcast — send to an audience on a schedule' },
            ]} />
          </Form.Item>

          {triggerType === 'inactive_users' && (
            <Form.Item name="trigger_config_inactive_days" label="Inactive for (days)" rules={[{ required: true }]}>
              <InputNumber min={1} max={90} style={{ width: '100%' }} />
            </Form.Item>
          )}
          {triggerType === 'streak_at_risk' && (
            <Form.Item name="trigger_config_streak_min" label="Minimum streak days" rules={[{ required: true }]}>
              <InputNumber min={1} max={365} style={{ width: '100%' }} />
            </Form.Item>
          )}

          <Form.Item name="title" label="Notification title" rules={[{ required: true }, { max: 140 }]}>
            <Input showCount maxLength={140} />
          </Form.Item>
          <Form.Item name="body" label="Message" rules={[{ required: true }, { max: 280 }]}>
            <Input.TextArea rows={3} showCount maxLength={280} />
          </Form.Item>

          {triggerType === 'broadcast_recurring' && (
            <>
              <Form.Item name="audience" label="Audience" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'all', label: 'All active users' },
                  { value: 'selected', label: 'Selected users' },
                  { value: 'ios', label: 'iOS devices' },
                  { value: 'android', label: 'Android devices' },
                ]} />
              </Form.Item>
              {audience === 'selected' && (
                <Form.Item name="recipients" label="Users" rules={[{ required: true }]}>
                  <Select
                    mode="multiple"
                    filterOption={false}
                    onSearch={searchUsers}
                    loading={usersFetching}
                    options={userOptions}
                  />
                </Form.Item>
              )}
              <Form.Item name="recurrence" label="Recurrence" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                ]} />
              </Form.Item>
              {recurrence === 'weekly' && (
                <Form.Item name="run_weekday" label="Day of week" rules={[{ required: true }]}>
                  <Select options={WEEKDAYS} />
                </Form.Item>
              )}
            </>
          )}

          <Form.Item name="run_at_time" label="Run at (UTC)" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="cooldown_days" label="Per-user cooldown (days)" tooltip="Same user won't get this automation again within this window.">
            <InputNumber min={1} max={90} style={{ width: '100%' }} />
          </Form.Item>
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
    </>
  );
}
