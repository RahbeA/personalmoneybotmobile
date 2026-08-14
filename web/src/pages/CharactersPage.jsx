import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Typography, Button, Modal, Form, Input, InputNumber,
  Select, Switch, Upload, App, Drawer, Empty, Spin, Segmented, Row, Col, Alert, Space,
} from 'antd';
import {
  PlusOutlined, UploadOutlined, ThunderboltOutlined, DownloadOutlined,
  StarFilled, StarOutlined, CameraOutlined,
} from '@ant-design/icons';
import { api, getToken } from '../api/client';
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

const API_BASE = import.meta.env.VITE_API_BASE || '/api/admin';

function normFile(e) {
  return Array.isArray(e) ? e : e?.fileList;
}

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatOptimizeSummary(stats) {
  if (!stats) return '';
  const before = formatBytes(stats.bytesBefore);
  const after = formatBytes(stats.bytesAfter);
  const pct = stats.savedPct != null ? `${stats.savedPct}%` : '';
  const tris = (stats.trisBefore != null && stats.trisAfter != null)
    ? ` · ${stats.trisBefore.toLocaleString()} → ${stats.trisAfter.toLocaleString()} tris`
    : '';
  const skin = stats.strippedSkin ? ' · stripped unused skin' : '';
  return `${before} → ${after}${pct ? ` (−${pct})` : ''}${tris}${skin}`;
}

export default function CharactersPage() {
  const { message, modal } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [optimizingId, setOptimizingId] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);
  const [toolBusy, setToolBusy] = useState(false);
  const [toolStats, setToolStats] = useState(null);
  const [slimAll, setSlimAll] = useState(null); // { done, total } while running
  const [previewAll, setPreviewAll] = useState(null); // { done, total } while running
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

  // Backend flags slimmed models (filename carries _opt) — single source of truth.
  const unslimmed = useMemo(
    () => rows.filter((c) => c.model_file && !c.model_optimized),
    [rows],
  );

  const missingPreview = useMemo(
    () => rows.filter((c) => c.model_file && !c.preview_image),
    [rows],
  );

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
        ? {
            ...record,
            model_file: [],
            preview_image: [],
            optimize: true,
          }
        : {
            price: 100,
            rarity: 'common',
            accent_color: '#3DDC5F',
            order: rows.length,
            is_active: true,
            is_starter: false,
            model_file: [],
            preview_image: [],
            optimize: true,
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
    fd.append('is_starter', values.is_starter ? 'true' : 'false');

    const modelFile = values.model_file?.[0]?.originFileObj;
    const previewFile = values.preview_image?.[0]?.originFileObj;
    if (modelFile) {
      fd.append('model_file', modelFile);
      fd.append('optimize', values.optimize ? 'true' : 'false');
    }
    if (previewFile) fd.append('preview_image', previewFile);

    if (!editing.id && !modelFile) {
      message.error('A .glb model file is required.');
      return;
    }

    setSaving(true);
    try {
      const result = editing.id
        ? await api.patchForm(`/characters/${editing.id}/`, fd)
        : await api.postForm('/characters/', fd);
      if (result?.optimize) {
        message.success(`Saved · ${formatOptimizeSummary(result.optimize)}`);
      } else {
        message.success('Saved');
      }
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

  function optimizeCharacter(record) {
    modal.confirm({
      title: `Slim "${record.name}" model?`,
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>
            Strips unused skinning (if no animations) and simplifies the mesh for mobile.
            The character&apos;s .glb is replaced in place — no re-upload needed.
          </p>
          <Text type="secondary">Typical cut: ~60–80% smaller file.</Text>
        </div>
      ),
      okText: 'Slim model',
      onOk: async () => {
        setOptimizingId(record.id);
        try {
          const result = await api.post(`/characters/${record.id}/optimize/`, {});
          const stats = result?.optimize;
          message.success(stats ? `Slimmed · ${formatOptimizeSummary(stats)}` : 'Model slimmed');
          if (viewing?.id === record.id && result?.character) {
            setViewing(result.character);
          }
          load();
        } catch (e) {
          message.error(e.message);
          throw e;
        } finally {
          setOptimizingId(null);
        }
      },
    });
  }

  function generatePreview(record) {
    const hasPreview = !!record.preview_image;
    modal.confirm({
      title: hasPreview ? `Re-generate preview for "${record.name}"?` : `Generate preview for "${record.name}"?`,
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>
            Renders a PNG still from the character&apos;s GLB with headless Chromium
            and saves it as the shop preview image used by the mobile app.
          </p>
          <Text type="secondary">
            {hasPreview ? 'This will replace the current preview image.' : 'Takes a few seconds per character.'}
          </Text>
        </div>
      ),
      okText: hasPreview ? 'Re-generate' : 'Generate preview',
      onOk: async () => {
        setPreviewingId(record.id);
        try {
          const result = await api.post(`/characters/${record.id}/generate-preview/`, {
            force: hasPreview,
          });
          const bytes = result?.preview?.bytesOut;
          message.success(
            bytes
              ? `Preview saved · ${formatBytes(bytes)}`
              : 'Preview saved',
          );
          if (viewing?.id === record.id && result?.character) {
            setViewing(result.character);
          }
          load();
        } catch (e) {
          message.error(e.message);
          throw e;
        } finally {
          setPreviewingId(null);
        }
      },
    });
  }

  async function setStarter(record) {
    if (record.is_starter) return;
    try {
      await api.patch(`/characters/${record.id}/`, { is_starter: true });
      message.success(`"${record.name}" is now gifted to new accounts`);
      if (viewing?.id === record.id) setViewing({ ...viewing, is_starter: true });
      load();
    } catch (e) {
      message.error(e.message);
    }
  }

  function slimAllModels() {
    const targets = unslimmed;
    if (!targets.length) return;
    modal.confirm({
      title: `Slim all ${targets.length} models?`,
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>
            Runs the slimmer on every character that hasn&apos;t been optimized yet.
            Each .glb is replaced in place — already-slimmed models are skipped.
          </p>
          <Text type="secondary">Runs one at a time so the server stays responsive.</Text>
        </div>
      ),
      okText: `Slim ${targets.length}`,
      onOk: async () => {
        setSlimAll({ done: 0, total: targets.length });
        let totalBefore = 0;
        let totalAfter = 0;
        let failed = 0;
        for (let i = 0; i < targets.length; i += 1) {
          const c = targets[i];
          try {
            // eslint-disable-next-line no-await-in-loop
            const result = await api.post(`/characters/${c.id}/optimize/`, {});
            if (result?.optimize) {
              totalBefore += result.optimize.bytesBefore || 0;
              totalAfter += result.optimize.bytesAfter || 0;
            }
          } catch {
            failed += 1;
          }
          setSlimAll({ done: i + 1, total: targets.length });
        }
        setSlimAll(null);
        const saved = Math.max(0, totalBefore - totalAfter);
        const savedPct = totalBefore ? Math.round((saved / totalBefore) * 100) : 0;
        if (failed) {
          message.warning(`Slimmed ${targets.length - failed}/${targets.length} · ${failed} failed`);
        } else {
          message.success(
            `Slimmed ${targets.length} models · saved ${formatBytes(saved)}${savedPct ? ` (−${savedPct}%)` : ''}`,
          );
        }
        load();
      },
    });
  }

  function generateAllMissingPreviews() {
    const targets = missingPreview;
    if (!targets.length) return;
    modal.confirm({
      title: `Generate ${targets.length} missing previews?`,
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>
            Renders a PNG still from each character GLB that doesn&apos;t have a
            preview image yet, and uploads it automatically.
          </p>
          <Text type="secondary">
            Requires Node + the tools/glb-preview package on the server. Runs one at a time.
          </Text>
        </div>
      ),
      okText: `Generate ${targets.length}`,
      onOk: async () => {
        setPreviewAll({ done: 0, total: targets.length });
        let ok = 0;
        let failed = 0;
        for (let i = 0; i < targets.length; i += 1) {
          const c = targets[i];
          try {
            // eslint-disable-next-line no-await-in-loop
            await api.post(`/characters/${c.id}/generate-preview/`, { force: false });
            ok += 1;
          } catch {
            failed += 1;
          }
          setPreviewAll({ done: i + 1, total: targets.length });
        }
        setPreviewAll(null);
        if (failed) {
          message.warning(`Generated ${ok}/${targets.length} · ${failed} failed`);
        } else {
          message.success(`Generated ${ok} preview images`);
        }
        load();
      },
    });
  }

  async function downloadOptimizedGlb(file) {
    if (!file) return;
    setToolBusy(true);
    setToolStats(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('download', 'true');
      const response = await fetch(`${API_BASE}/glb/optimize/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${getToken()}`,
        },
        body: fd,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail || 'Optimize failed');
      }
      const blob = await response.blob();
      const before = Number(response.headers.get('X-Optimize-Bytes-Before') || 0);
      const after = Number(response.headers.get('X-Optimize-Bytes-After') || 0);
      const savedPct = Number(response.headers.get('X-Optimize-Saved-Pct') || 0);
      setToolStats({ bytesBefore: before, bytesAfter: after, savedPct });

      const stem = (file.name || 'model').replace(/\.(glb|gltf)$/i, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${stem}_opt.glb`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`Downloaded ${stem}_opt.glb · ${formatBytes(before)} → ${formatBytes(after)}`);
    } catch (e) {
      message.error(e.message);
    } finally {
      setToolBusy(false);
    }
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
        <Space wrap>
          {(unslimmed.length > 0 || slimAll) && (
            <Button
              icon={<ThunderboltOutlined />}
              loading={!!slimAll}
              onClick={slimAllModels}
            >
              {slimAll
                ? `Slimming ${slimAll.done}/${slimAll.total}…`
                : `Slim all (${unslimmed.length})`}
            </Button>
          )}
          {(missingPreview.length > 0 || previewAll) && (
            <Button
              icon={<CameraOutlined />}
              loading={!!previewAll}
              onClick={generateAllMissingPreviews}
            >
              {previewAll
                ? `Previews ${previewAll.done}/${previewAll.total}…`
                : `Generate previews (${missingPreview.length})`}
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
            Add Character
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<ThunderboltOutlined />}
        style={{ marginBottom: 16 }}
        message="GLB slimmer"
        description={(
          <div>
            <Paragraph style={{ marginBottom: 10, color: brand.textSecondary }}>
              Drop a heavy .glb to download a cleaned lightweight copy, or hit
              {' '}
              <Text strong>Slim</Text>
              {' '}
              on any character to replace its model in place.
            </Paragraph>
            <Upload
              accept=".glb,.gltf"
              showUploadList={false}
              beforeUpload={(file) => {
                downloadOptimizedGlb(file);
                return false;
              }}
            >
              <Button icon={<DownloadOutlined />} loading={toolBusy}>
                Upload GLB → download slimmed
              </Button>
            </Upload>
            {toolStats ? (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">{formatOptimizeSummary(toolStats)}</Text>
              </div>
            ) : null}
          </div>
        )}
      />

      <div className="mb-character-toolbar">
        <Input
          placeholder="Search characters…"
          value={search}
          allowClear
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280, maxWidth: '100%' }}
        />
        <Select
          value={rarityFilter}
          onChange={setRarityFilter}
          style={{ width: 140, maxWidth: '100%' }}
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
              onOptimize={optimizeCharacter}
              onGeneratePreview={generatePreview}
              onSetStarter={setStarter}
              optimizing={optimizingId === character.id}
              generatingPreview={previewingId === character.id}
            />
          ))}
        </div>
      )}

      <Drawer
        open={!!viewing}
        onClose={() => setViewing(null)}
        width="min(560px, calc(100vw - 16px))"
        title={viewing?.name}
        styles={{ body: { paddingTop: 0 } }}
        extra={(
          <Space wrap>
            <Button
              size="small"
              type={viewing?.is_starter ? 'primary' : 'default'}
              icon={viewing?.is_starter ? <StarFilled /> : <StarOutlined />}
              disabled={!!viewing?.is_starter}
              onClick={() => viewing && setStarter(viewing)}
            >
              Starter
            </Button>
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              loading={optimizingId === viewing?.id}
              disabled={!!viewing?.model_optimized}
              onClick={() => viewing && optimizeCharacter(viewing)}
            >
              {viewing?.model_optimized ? 'Slimmed' : 'Slim'}
            </Button>
            <Button
              size="small"
              icon={<CameraOutlined />}
              loading={previewingId === viewing?.id}
              onClick={() => viewing && generatePreview(viewing)}
            >
              {viewing?.preview_image ? 'Re-preview' : 'Preview'}
            </Button>
            <Button size="small" onClick={() => { openModal(viewing); setViewing(null); }}>
              Edit
            </Button>
          </Space>
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
              <Col span={12}><Text type="secondary">Model size</Text><br /><Text strong>{formatBytes(viewing.model_file_size)}</Text></Col>
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
            <Form.Item
              name="is_starter"
              label="Starter (gifted at signup)"
              valuePropName="checked"
              extra="New accounts receive & equip this character. Only one starter allowed."
            >
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
            name="optimize"
            label="Slim GLB on upload"
            valuePropName="checked"
            extra="Strips unused skinning + simplifies mesh before saving. Leave on for mobile."
          >
            <Switch />
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
