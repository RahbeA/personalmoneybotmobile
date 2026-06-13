import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Table, Button, Space, Modal, Form, Input, InputNumber,
  Select, Breadcrumb, Card, Checkbox, App, Tag, Empty,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RightOutlined } from '@ant-design/icons';
import { api } from '../api/client';

const { Title } = Typography;

const QUESTION_TYPES = [
  { value: 'true_false', label: 'True / False' },
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'select_all', label: 'Select All That Apply' },
];

export default function CoursesPage() {
  const { message, modal } = App.useApp();
  const [module, setModule] = useState(null);
  const [lesson, setLesson] = useState(null);

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <a onClick={() => { setModule(null); setLesson(null); }}>Modules</a> },
          ...(module ? [{ title: lesson ? <a onClick={() => setLesson(null)}>{module.title}</a> : module.title }] : []),
          ...(lesson ? [{ title: lesson.title }] : []),
        ]}
      />

      {!module && <ModulesView message={message} modal={modal} onOpen={setModule} />}
      {module && !lesson && (
        <LessonsView message={message} modal={modal} module={module} onOpen={setLesson} />
      )}
      {module && lesson && (
        <QuestionsView message={message} modal={modal} lesson={lesson} />
      )}
    </div>
  );
}

// --- Modules ----------------------------------------------------------------

function ModulesView({ message, modal, onOpen }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.get('/modules/'));
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  function openModal(record) {
    setEditing(record || {});
    form.setFieldsValue(record || { order: rows.length, icon: '📘' });
  }

  async function save() {
    const values = await form.validateFields();
    try {
      if (editing.id) await api.patch(`/modules/${editing.id}/`, values);
      else await api.post('/modules/', values);
      message.success('Saved');
      setEditing(null);
      load();
    } catch (e) {
      message.error(e.message);
    }
  }

  function remove(record) {
    modal.confirm({
      title: `Delete "${record.title}"?`,
      content: 'This also deletes its lessons, questions, and answers.',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.del(`/modules/${record.id}/`);
          message.success('Deleted');
          load();
        } catch (e) {
          message.error(e.message);
        }
      },
    });
  }

  const columns = [
    { title: '#', dataIndex: 'order', width: 60 },
    { title: 'Icon', dataIndex: 'icon', width: 70 },
    { title: 'Title', dataIndex: 'title' },
    { title: 'Lessons', dataIndex: 'lesson_count', width: 90 },
    {
      title: 'Actions', width: 200, render: (_, r) => (
        <Space>
          <Button size="small" icon={<RightOutlined />} onClick={() => onOpen(r)}>Open</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(r)} />
        </Space>
      ),
    },
  ];

  return (
    <Card className="mb-brand-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Modules</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>Add Module</Button>
      </div>
      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} />

      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit Module' : 'New Module'}
        onCancel={() => setEditing(null)}
        onOk={save}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space>
            <Form.Item name="icon" label="Icon (emoji)" rules={[{ required: true }]}>
              <Input style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="order" label="Order">
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Form.Item
            name="money_chat_criteria"
            label="Money Chat criteria (one per line, optional)"
          >
            <Input.TextArea rows={3} placeholder="One checkpoint per line" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

// --- Lessons ----------------------------------------------------------------

function LessonsView({ message, modal, module, onOpen }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.get(`/lessons/?module=${module.id}`));
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [message, module.id]);

  useEffect(() => { load(); }, [load]);

  function openModal(record) {
    setEditing(record || {});
    form.setFieldsValue(record || { order: rows.length });
  }

  async function save() {
    const values = await form.validateFields();
    try {
      if (editing.id) await api.patch(`/lessons/${editing.id}/`, values);
      else await api.post('/lessons/', { ...values, module: module.id });
      message.success('Saved');
      setEditing(null);
      load();
    } catch (e) {
      message.error(e.message);
    }
  }

  function remove(record) {
    modal.confirm({
      title: `Delete "${record.title}"?`,
      content: 'This also deletes its questions and answers.',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.del(`/lessons/${record.id}/`);
          message.success('Deleted');
          load();
        } catch (e) {
          message.error(e.message);
        }
      },
    });
  }

  const columns = [
    { title: '#', dataIndex: 'order', width: 60 },
    { title: 'Title', dataIndex: 'title' },
    { title: 'Questions', dataIndex: 'question_count', width: 100 },
    {
      title: 'Actions', width: 200, render: (_, r) => (
        <Space>
          <Button size="small" icon={<RightOutlined />} onClick={() => onOpen(r)}>Open</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(r)} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(r)} />
        </Space>
      ),
    },
  ];

  return (
    <Card className="mb-brand-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Lessons</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>Add Lesson</Button>
      </div>
      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} />

      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit Lesson' : 'New Lesson'}
        onCancel={() => setEditing(null)}
        onOk={save}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="order" label="Order">
            <InputNumber min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

// --- Questions + Answers ----------------------------------------------------

function QuestionsView({ message, modal, lesson }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.get(`/questions/?lesson=${lesson.id}`));
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [message, lesson.id]);

  useEffect(() => { load(); }, [load]);

  function openModal(record) {
    const initial = record
      ? { ...record, answers: record.answers?.length ? record.answers : [{ text: '', is_correct: false }] }
      : { question_type: 'mcq', order: rows.length, answers: [{ text: '', is_correct: false }] };
    setEditing(record || {});
    form.setFieldsValue(initial);
  }

  async function save() {
    const values = await form.validateFields();
    const payload = { ...values, lesson: lesson.id };
    try {
      if (editing.id) await api.patch(`/questions/${editing.id}/`, payload);
      else await api.post('/questions/', payload);
      message.success('Saved');
      setEditing(null);
      load();
    } catch (e) {
      message.error(e.message);
    }
  }

  function remove(record) {
    modal.confirm({
      title: 'Delete this question?',
      content: record.prompt,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.del(`/questions/${record.id}/`);
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
    {
      title: 'Type', dataIndex: 'question_type', width: 130,
      render: (t) => <Tag>{QUESTION_TYPES.find((q) => q.value === t)?.label || t}</Tag>,
    },
    { title: 'Prompt', dataIndex: 'prompt' },
    { title: 'Answers', dataIndex: 'answers', width: 90, render: (a) => a?.length || 0 },
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Questions</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>Add Question</Button>
      </div>
      {rows.length === 0 && !loading ? (
        <Empty description="No questions yet" />
      ) : (
        <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} />
      )}

      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit Question' : 'New Question'}
        onCancel={() => setEditing(null)}
        onOk={save}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Space style={{ width: '100%' }} align="start">
            <Form.Item name="question_type" label="Type" rules={[{ required: true }]}>
              <Select options={QUESTION_TYPES} style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="order" label="Order">
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Form.Item name="prompt" label="Prompt" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="explanation" label="Explanation (shown after answering)">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Typography.Text strong>Answers</Typography.Text>
          <Form.List name="answers">
            {(fields, { add, remove }) => (
              <div style={{ marginTop: 8 }}>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item
                      {...rest}
                      name={[name, 'text']}
                      rules={[{ required: true, message: 'Answer text required' }]}
                      style={{ marginBottom: 0, width: 420 }}
                    >
                      <Input placeholder="Answer text" />
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
                <Button type="dashed" onClick={() => add({ text: '', is_correct: false })} icon={<PlusOutlined />} block>
                  Add Answer
                </Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>
    </Card>
  );
}
