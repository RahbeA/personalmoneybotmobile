import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Button, Modal, Form, Input, InputNumber, Select, Switch,
  App, Table, Space,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from '../api/client';

const { Title, Text } = Typography;

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'budget', label: 'Budget' },
  { value: 'investing', label: 'Investing' },
  { value: 'credit', label: 'Credit' },
  { value: 'saving', label: 'Saving' },
  { value: 'stocks', label: 'Stocks' },
];

export default function TipsPage() {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/tips/');
      setRows(Array.isArray(data) ? data : data.results ?? []);
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
        ? { ...record }
        : { category: 'general', is_active: true, order: rows.length, body: '' },
    );
  }

  async function save() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing.id) await api.patch(`/tips/${editing.id}/`, values);
      else await api.post('/tips/', values);
      message.success('Saved');
      setEditing(null);
      load();
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(record) {
    try {
      await api.del(`/tips/${record.id}/`);
      message.success('Deleted');
      load();
    } catch (e) {
      message.error(e.message);
    }
  }

  const columns = [
    { title: 'Tip', dataIndex: 'body', ellipsis: true },
    { title: 'Category', dataIndex: 'category', width: 120 },
    { title: 'Order', dataIndex: 'order', width: 80 },
    {
      title: 'Active',
      dataIndex: 'is_active',
      width: 90,
      render: (v) => (v ? 'Yes' : 'No'),
    },
    {
      title: '',
      width: 160,
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
      <div className="mb-page-header">
        <div>
          <Title level={4} className="mb-page-title">Money tips</Title>
          <Text type="secondary">Home “Today’s tip” lines. Category is used to match onboarding goals.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
          Add tip
        </Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} />
      <Modal
        open={editing !== null}
        title={editing?.id ? 'Edit tip' : 'New tip'}
        onCancel={() => setEditing(null)}
        onOk={save}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="body" label="Body" rules={[{ required: true }]}>
            <Input.TextArea rows={3} maxLength={280} showCount />
          </Form.Item>
          <Form.Item name="category" label="Category">
            <Select options={CATEGORIES} />
          </Form.Item>
          <Form.Item name="order" label="Order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
