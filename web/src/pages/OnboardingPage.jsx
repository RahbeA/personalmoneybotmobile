import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Table, Button, Space, Modal, Form, Input, InputNumber,
  Checkbox, Card, App, Tag, Alert,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../api/client';

const { Title } = Typography;

export default function OnboardingPage() {
  const { message, modal } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.get('/onboarding-questions/'));
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  function openModal(record) {
    const initial = record
      ? { ...record, options: record.options?.length ? record.options : [{ key: 'a', text: '', is_correct: false }] }
      : {
          order: rows.length,
          emoji: '💡',
          options: [
            { key: 'a', text: '', is_correct: true },
            { key: 'b', text: '', is_correct: false },
          ],
        };
    setEditing(record || {});
    form.setFieldsValue(initial);
  }

  async function save() {
    const values = await form.validateFields();
    const correctCount = (values.options || []).filter((o) => o.is_correct).length;
    if (correctCount !== 1) {
      message.error('Mark exactly one option as correct.');
      return;
    }
    try {
      if (editing.id) await api.patch(`/onboarding-questions/${editing.id}/`, values);
      else await api.post('/onboarding-questions/', values);
      message.success('Saved');
      setEditing(null);
      load();
    } catch (e) {
      message.error(e.message);
    }
  }

  function remove(record) {
    modal.confirm({
      title: `Delete "${record.topic}"?`,
      content: record.prompt,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.del(`/onboarding-questions/${record.id}/`);
          message.success('Deleted');
          load();
        } catch (e) {
          message.error(e.message);
        }
      },
    });
  }

  const columns = [
    { title: '#', dataIndex: 'order', width: 50 },
    { title: 'Emoji', dataIndex: 'emoji', width: 70 },
    { title: 'Topic', dataIndex: 'topic', width: 180 },
    { title: 'Prompt', dataIndex: 'prompt' },
    {
      title: 'Options', dataIndex: 'options', width: 90,
      render: (o) => o?.length || 0,
    },
    {
      title: 'Actions', width: 110, render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(r)} />
        </Space>
      ),
    },
  ];

  return (
    <Card className="mb-brand-card">
      <div className="mb-page-header">
        <Title level={4} style={{ margin: 0 }}>Onboarding Questions</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>Add Question</Button>
      </div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="These are the financial-literacy questions shown to new users. Mark exactly one option as correct per question. The slug must stay stable once users have answered."
      />
      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} scroll={{ x: 'max-content' }} />

      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit Question' : 'New Question'}
        onCancel={() => setEditing(null)}
        onOk={save}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Space style={{ width: '100%' }} align="start" wrap>
            <Form.Item name="slug" label="Slug (stable id)" rules={[{ required: true }]}>
              <Input placeholder="interest" disabled={!!editing?.id} />
            </Form.Item>
            <Form.Item name="emoji" label="Emoji">
              <Input style={{ width: 80 }} />
            </Form.Item>
            <Form.Item name="order" label="Order">
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Form.Item name="topic" label="Topic" rules={[{ required: true }]}>
            <Input placeholder="Compound Interest" />
          </Form.Item>
          <Form.Item name="vibe" label="Vibe (friendly framing line)">
            <Input />
          </Form.Item>
          <Form.Item name="prompt" label="Prompt" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Typography.Text strong>Options</Typography.Text>
          <Form.List name="options">
            {(fields, { add, remove }) => (
              <div style={{ marginTop: 8 }}>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item
                      {...rest}
                      name={[name, 'key']}
                      rules={[{ required: true, message: 'Key' }]}
                      style={{ marginBottom: 0, width: 70 }}
                    >
                      <Input placeholder="a" />
                    </Form.Item>
                    <Form.Item
                      {...rest}
                      name={[name, 'text']}
                      rules={[{ required: true, message: 'Option text required' }]}
                      style={{ marginBottom: 0, width: 360 }}
                    >
                      <Input placeholder="Option text" />
                    </Form.Item>
                    <Form.Item
                      {...rest}
                      name={[name, 'is_correct']}
                      valuePropName="checked"
                      style={{ marginBottom: 0 }}
                    >
                      <Checkbox>Correct</Checkbox>
                    </Form.Item>
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ key: '', text: '', is_correct: false })} icon={<PlusOutlined />} block>
                  Add Option
                </Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>
    </Card>
  );
}
