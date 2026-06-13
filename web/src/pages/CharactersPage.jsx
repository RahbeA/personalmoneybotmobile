import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Typography, Button, Modal, Form, Input, InputNumber,
  Select, Switch, Upload, App, Drawer, Empty, Spin, Segmented, Row, Col,
} from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import CharacterGridCard from '../components/CharacterGridCard';
import CharacterModelViewer from '../components/CharacterModelViewer';
import { brand } from '../theme/tokens';

const { Title, Text, Paragraph } = Typography;

const RARITY = [
  { value: 'common', label: 'Common', color: 'default' },
  { value: 'rare', label: 'Rare', color: 'blue' },
  { value: 'epic', label: 'Epic', color: 'purple' },
  { value: 'legendary', label: 'Legendary', color: 'gold' },
];

function normFile(e) {
  return Array.isArray(e) ? e : e?.fileList;
}

export default function CharactersPage() {
  const { message, modal } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/characters/');
      setRows(Array.isArray(data) ? data : data.results ?? []);
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter((c) => {
        if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false;
        if (activeFilter === 'live' && !c.is_active) return false;
        if (activeFilter === 'hidden' && c.is_active) return false;
        if (!term) return true;
        return (
          c.name?.toLowerCase().includes(term)
          || c.description?.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id);
  }, [rows, search, rarityFilter, activeFilter]);

  function openModal(record) {
    setEditing(record || {});
    form.setFieldsValue(
      record
        ? { ...record, model_file: [], preview_image: [] }
        : {
            price: 100,
            rarity: 'common',
            accent_color: '#3DDC5F',
            order: rows.length,
            is_active: true,
            model_file: [],
            preview_image: [],
          },
    );
  }

  async function save() {
    const values = await form.validateFields();
    const fd = new FormData();
    ['name', 'description', 'price', 'rarity', 'accent_color', 'order'].forEach((k) => {
      if (values[k] !== undefined && values[k] !== null) fd.append(k, values[k]);
    });
    fd.append('is_active', values.is_active ? 'true' : 'false');

    const modelFile = values.model_file?.[0]?.originFileObj;
    const previewFile = values.preview_image?.[0]?.originFileObj;
    if (modelFile) fd.append('model_file', modelFile);
    if (previewFile) fd.append('preview_image', previewFile);

    if (!editing.id && !modelFile) {
      message.error('A .glb model file is required.');
      return;
    }

    setSaving(true);
    try {
      if (editing.id) await api.patchForm(`/characters/${editing.id}/`, fd);
      else await api.postForm('/characters/', fd);
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
      title: `Delete "${record.name}"?`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.del(`/characters/${record.id}/`);
          message.success('Deleted');
          if (viewing?.id === record.id) setViewing(null);
          load();
        } catch (e) {
          message.error(e.message);
        }
      },
    });
  }

  return (
    <div>
      <div className="mb-page-header">
        <div>
          <Title level={4} className="mb-page-title">Characters</Title>
          <Text style={{ color: brand.textSecondary }}>
            {filtered.length} of {rows.length} · drag to rotate in detail view
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
          Add Character
        </Button>
      </div>

      <div className="mb-character-toolbar">
        <Input
          placeholder="Search characters…"
          value={search}
          allowClear
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <Select
          value={rarityFilter}
          onChange={setRarityFilter}
          style={{ width: 140 }}
          options={[
            { value: 'all', label: 'All rarities' },
            ...RARITY.map((r) => ({ value: r.value, label: r.label })),
          ]}
        />
        <Segmented
          value={activeFilter}
          onChange={setActiveFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'live', label: 'Live' },
            { value: 'hidden', label: 'Hidden' },
          ]}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : filtered.length === 0 ? (
        <Empty
          description="No characters match your filters"
          style={{ padding: 60 }}
        >
          <Button type="primary" onClick={() => openModal(null)}>Add Character</Button>
        </Empty>
      ) : (
        <div className="mb-character-grid">
          {filtered.map((character) => (
            <CharacterGridCard
              key={character.id}
              character={character}
              onView={setViewing}
              onEdit={openModal}
              onDelete={remove}
            />
          ))}
        </div>
      )}

      {/* Full-size 3D preview drawer */}
      <Drawer
        open={!!viewing}
        onClose={() => setViewing(null)}
        width={Math.min(560, window.innerWidth - 24)}
        title={viewing?.name}
        styles={{ body: { paddingTop: 0 } }}
        extra={(
          <Button size="small" onClick={() => { openModal(viewing); setViewing(null); }}>
            Edit
          </Button>
        )}
      >
        {viewing ? (
          <>
            <div className="mb-character-detail-viewer">
              <CharacterModelViewer
                modelUrl={viewing.model_file}
                posterUrl={viewing.preview_image}
                accentColor={viewing.accent_color}
                autoRotate={false}
                interactive
                lazy={false}
              />
            </div>
            <Row gutter={[12, 8]} style={{ marginTop: 16 }}>
              <Col span={12}><Text type="secondary">Price</Text><br /><Text strong>{viewing.price} Bot Bucks</Text></Col>
              <Col span={12}><Text type="secondary">Rarity</Text><br /><Text strong style={{ textTransform: 'capitalize' }}>{viewing.rarity}</Text></Col>
              <Col span={12}><Text type="secondary">Status</Text><br /><Text strong>{viewing.is_active ? 'Live in shop' : 'Hidden'}</Text></Col>
              <Col span={12}><Text type="secondary">Sort order</Text><br /><Text strong>#{viewing.order}</Text></Col>
            </Row>
            {viewing.description ? (
              <Paragraph style={{ marginTop: 16, color: brand.textSecondary }}>{viewing.description}</Paragraph>
            ) : null}
          </>
        ) : null}
      </Drawer>

      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit Character' : 'New Character'}
        onCancel={() => setEditing(null)}
        onOk={save}
        confirmLoading={saving}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Form.Item name="price" label="Price (Bot Bucks)">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="rarity" label="Rarity">
              <Select options={RARITY} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="order" label="Order">
              <InputNumber min={0} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Form.Item name="accent_color" label="Accent color (hex)">
              <Input style={{ width: 140 }} placeholder="#3DDC5F" />
            </Form.Item>
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Form.Item
            name="model_file"
            label={editing?.id ? '3D model (.glb) — leave empty to keep current' : '3D model (.glb)'}
            valuePropName="fileList"
            getValueFromEvent={normFile}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept=".glb,.gltf">
              <Button icon={<UploadOutlined />}>Select .glb</Button>
            </Upload>
          </Form.Item>
          <Form.Item
            name="preview_image"
            label="Preview image (optional poster)"
            valuePropName="fileList"
            getValueFromEvent={normFile}
          >
            <Upload beforeUpload={() => false} maxCount={1} accept="image/*" listType="picture">
              <Button icon={<UploadOutlined />}>Select image</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
