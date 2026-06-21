import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Button, Modal, Form, Input, InputNumber, Select, Switch,
  Upload, App, Table, Alert, Space, Tag, Collapse,
} from 'antd';
import { PlusOutlined, UploadOutlined, CopyOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { BADGE_METRICS, ION_ICON_OPTIONS, fillBadgePrompt } from '../constants/badgePrompt';

const { Title, Text, Paragraph } = Typography;

function normFile(e) {
  return Array.isArray(e) ? e : e?.fileList;
}

export default function BadgesPage() {
  const { message, modal } = App.useApp();
  const [rows, setRows] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [badges, mods] = await Promise.all([
        api.get('/badges/'),
        api.get('/modules/'),
      ]);
      setRows(Array.isArray(badges) ? badges : badges.results ?? []);
      setModules(Array.isArray(mods) ? mods : mods.results ?? []);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  function openModal(record) {
    setEditing(record || {});
    form.setFieldsValue(
      record
        ? { ...record, icon: [] }
        : {
            metric: 'lessons_completed',
            threshold: 1,
            accent_color: '#3DDC5F',
            ion_icon: 'ribbon',
            order: rows.length,
            is_active: true,
            icon: [],
          },
    );
  }

  async function save() {
    const values = await form.validateFields();
    const fd = new FormData();
    ['key', 'name', 'description', 'metric', 'threshold', 'accent_color', 'ion_icon', 'order'].forEach((k) => {
      if (values[k] !== undefined && values[k] !== null) fd.append(k, values[k]);
    });
    fd.append('is_active', values.is_active ? 'true' : 'false');
    if (values.module) fd.append('module', values.module);
    const iconFile = values.icon?.[0]?.originFileObj;
    if (iconFile) fd.append('icon', iconFile);

    setSaving(true);
    try {
      if (editing.id) await api.patchForm(`/badges/${editing.id}/`, fd);
      else await api.postForm('/badges/', fd);
      message.success('Saved');
      setEditing(null);
      load();
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  function remove(record) {
    modal.confirm({
      title: `Delete badge "${record.name}"?`,
      okButtonProps: { danger: true },
      onOk: async () => {
        await api.delete(`/badges/${record.id}/`);
        message.success('Deleted');
        load();
      },
    });
  }

  function copyPrompt() {
    const v = form.getFieldsValue();
    const text = fillBadgePrompt({
      name: v.name,
      description: v.description,
      metric: v.metric,
      threshold: v.threshold,
      accentColor: v.accent_color,
    });
    navigator.clipboard.writeText(text);
    message.success('AI prompt copied');
  }

  const columns = [
    { title: 'Order', dataIndex: 'order', width: 70 },
    { title: 'Key', dataIndex: 'key', render: (k) => <Text code>{k}</Text> },
    { title: 'Name', dataIndex: 'name' },
    {
      title: 'Metric',
      dataIndex: 'metric',
      render: (m, r) => (
        <span>{m} ≥ {r.threshold}{r.module ? ` (mod ${r.module})` : ''}</span>
      ),
    },
    {
      title: 'Icon',
      dataIndex: 'icon_url',
      render: (url, r) => (
        url
          ? <img src={url} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          : <Tag>{r.ion_icon}</Tag>
      ),
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      render: (v) => (v ? <Tag color="green">Live</Tag> : <Tag>Hidden</Tag>),
    },
    {
      title: '',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => openModal(r)}>Edit</Button>
          <Button size="small" danger onClick={() => remove(r)}>Delete</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Badges</Title>
          <Text type="secondary">Configure achievement badges and upload AI-generated icons.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>New badge</Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Badge metrics are evaluated automatically when users complete lessons, claim daily rewards, or purchase characters."
      />

      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} />

      <Modal
        title={editing?.id ? 'Edit badge' : 'New badge'}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={save}
        confirmLoading={saving}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="key" label="Key (slug)" rules={[{ required: true }]}>
            <Input placeholder="first_lesson" disabled={!!editing?.id} />
          </Form.Item>
          <Form.Item name="name" label="Display name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="metric" label="Metric" rules={[{ required: true }]}>
            <Select options={BADGE_METRICS} />
          </Form.Item>
          <Form.Item name="threshold" label="Threshold" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(p, c) => p.metric !== c.metric}>
            {({ getFieldValue }) => (
              getFieldValue('metric') === 'module_completed' ? (
                <Form.Item name="module" label="Module" rules={[{ required: true }]}>
                  <Select
                    options={modules.map((m) => ({ value: m.id, label: m.title }))}
                    placeholder="Select module"
                  />
                </Form.Item>
              ) : null
            )}
          </Form.Item>
          <Form.Item name="accent_color" label="Accent color">
            <Input type="color" style={{ width: 80, height: 36, padding: 2 }} />
          </Form.Item>
          <Form.Item name="ion_icon" label="Fallback Ion icon (mobile)">
            <Select options={ION_ICON_OPTIONS.map((i) => ({ value: i, label: i }))} />
          </Form.Item>
          <Form.Item name="order" label="Sort order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="icon" label="Icon image (256×256 PNG)" valuePropName="fileList" getValueFromEvent={normFile}>
            <Upload beforeUpload={() => false} maxCount={1} accept="image/png,image/webp,image/jpeg">
              <Button icon={<UploadOutlined />}>Upload icon</Button>
            </Upload>
          </Form.Item>
          <Collapse
            items={[{
              key: 'prompt',
              label: 'AI icon generation prompt',
              children: (
                <>
                  <Paragraph type="secondary" style={{ fontSize: 12 }}>
                    Generate a 256×256 transparent PNG, then upload above. Click copy to fill in the current form values.
                  </Paragraph>
                  <Button icon={<CopyOutlined />} onClick={copyPrompt}>Copy prompt</Button>
                </>
              ),
            }]}
          />
        </Form>
      </Modal>
    </div>
  );
}
