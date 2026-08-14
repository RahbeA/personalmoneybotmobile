import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Table, Button, Space, Modal, Form, Input, InputNumber,
  Select, Breadcrumb, Card, Checkbox, App, Tag, Empty,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RightOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import {
  QUESTION_TYPES,
  recordToFormValues,
  formValuesToPayload,
} from '../utils/questionTypes';

const { Title } = Typography;

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
      <div className="mb-page-header">
        <Title level={4} style={{ margin: 0 }}>Modules</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>Add Module</Button>
      </div>
      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} scroll={{ x: 'max-content' }} />

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
      <div className="mb-page-header">
        <Title level={4} style={{ margin: 0 }}>Lessons</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>Add Lesson</Button>
      </div>
      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} scroll={{ x: 'max-content' }} />

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
    setEditing(record || {});
    form.setFieldsValue(recordToFormValues(record, rows.length));
  }

  async function save() {
    const values = await form.validateFields();
    const payload = { ...formValuesToPayload(values), lesson: lesson.id };
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
      <div className="mb-page-header">
        <Title level={4} style={{ margin: 0 }}>Questions</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>Add Question</Button>
      </div>
      {rows.length === 0 && !loading ? (
        <Empty description="No questions yet" />
      ) : (
        <Table rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={false} scroll={{ x: 'max-content' }} />
      )}

      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit Question' : 'New Question'}
        onCancel={() => setEditing(null)}
        onOk={save}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Space style={{ width: '100%' }} align="start" wrap>
            <Form.Item name="question_type" label="Type" rules={[{ required: true }]}>
              <Select
                options={QUESTION_TYPES}
                style={{ width: 240 }}
                onChange={() => {
                  const t = form.getFieldValue('question_type');
                  if (t === 'match') {
                    form.setFieldsValue({
                      pairs: [{ left: '', right: '' }],
                      distractors: [],
                      answers: undefined,
                      blanks: undefined,
                    });
                  } else if (t === 'fill_blank') {
                    form.setFieldsValue({
                      blanks: [{ text: '' }],
                      distractors: [],
                      answers: undefined,
                      pairs: undefined,
                    });
                  } else {
                    form.setFieldsValue({
                      answers: [{ text: '', is_correct: false }],
                      pairs: undefined,
                      blanks: undefined,
                      distractors: undefined,
                    });
                  }
                }}
              />
            </Form.Item>
            <Form.Item name="order" label="Order">
              <InputNumber min={0} />
            </Form.Item>
          </Space>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.question_type !== cur.question_type}>
            {({ getFieldValue }) => {
              const qType = getFieldValue('question_type');
              return (
                <>
                  <Form.Item
                    name="prompt"
                    label={qType === 'fill_blank' ? 'Sentence (use one ___ for the blank)' : 'Prompt'}
                    rules={[{ required: true }]}
                    extra={
                      qType === 'fill_blank'
                        ? 'Example: A ___ helps you track spending.'
                        : qType === 'match'
                          ? 'Short instruction shown above the matching rows.'
                          : undefined
                    }
                  >
                    <Input.TextArea rows={qType === 'fill_blank' ? 3 : 2} />
                  </Form.Item>
                  <Form.Item name="explanation" label="Explanation (shown after answering)">
                    <Input.TextArea rows={2} />
                  </Form.Item>

                  {(qType === 'mcq' || qType === 'select_all' || qType === 'true_false') && (
                    <StandardAnswersEditor />
                  )}
                  {qType === 'match' && <MatchAnswersEditor />}
                  {qType === 'fill_blank' && <FillBlankAnswersEditor />}
                </>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

function StandardAnswersEditor() {
  return (
    <>
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
    </>
  );
}

function MatchAnswersEditor() {
  return (
    <>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        Add each correct pair (left → right). Extra words below become decoys in the word bank.
      </Typography.Paragraph>
      <Typography.Text strong>Correct pairs</Typography.Text>
      <Form.List name="pairs">
        {(fields, { add, remove }) => (
          <div style={{ marginTop: 8, marginBottom: 16 }}>
            {fields.map(({ key, name, ...rest }) => (
              <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                <Form.Item
                  {...rest}
                  name={[name, 'left']}
                  rules={[{ required: true, message: 'Left item required' }]}
                  style={{ marginBottom: 0, width: 200 }}
                >
                  <Input placeholder="Left (e.g. Budget)" />
                </Form.Item>
                <span style={{ color: '#888' }}>→</span>
                <Form.Item
                  {...rest}
                  name={[name, 'right']}
                  rules={[{ required: true, message: 'Match required' }]}
                  style={{ marginBottom: 0, width: 220 }}
                >
                  <Input placeholder="Right (e.g. Spending plan)" />
                </Form.Item>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
              </Space>
            ))}
            <Button type="dashed" onClick={() => add({ left: '', right: '' })} icon={<PlusOutlined />} block>
              Add pair
            </Button>
          </div>
        )}
      </Form.List>

      <Typography.Text strong>Extra word-bank decoys (optional)</Typography.Text>
      <Form.List name="distractors">
        {(fields, { add, remove }) => (
          <div style={{ marginTop: 8 }}>
            {fields.map(({ key, name, ...rest }) => (
              <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                <Form.Item
                  {...rest}
                  name={[name, 'text']}
                  rules={[{ required: true, message: 'Word required' }]}
                  style={{ marginBottom: 0, width: 440 }}
                >
                  <Input placeholder="Decoy word" />
                </Form.Item>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
              </Space>
            ))}
            <Button type="dashed" onClick={() => add({ text: '' })} icon={<PlusOutlined />} block>
              Add decoy
            </Button>
          </div>
        )}
      </Form.List>
    </>
  );
}

function FillBlankAnswersEditor() {
  return (
    <>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        One correct word fills the blank. Add decoys to populate the word bank — learners tap to answer.
      </Typography.Paragraph>
      <Form.Item
        name={['blanks', 0, 'text']}
        label="Correct word"
        rules={[{ required: true, message: 'Correct word required' }]}
      >
        <Input placeholder="e.g. budget" style={{ maxWidth: 440 }} />
      </Form.Item>

      <Typography.Text strong>Word-bank decoys (optional)</Typography.Text>
      <Form.List name="distractors">
        {(fields, { add, remove }) => (
          <div style={{ marginTop: 8 }}>
            {fields.map(({ key, name, ...rest }) => (
              <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                <Form.Item
                  {...rest}
                  name={[name, 'text']}
                  rules={[{ required: true, message: 'Word required' }]}
                  style={{ marginBottom: 0, width: 440 }}
                >
                  <Input placeholder="Decoy word" />
                </Form.Item>
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
              </Space>
            ))}
            <Button type="dashed" onClick={() => add({ text: '' })} icon={<PlusOutlined />} block>
              Add decoy
            </Button>
          </div>
        )}
      </Form.List>
    </>
  );
}
