import { Card, Tag, Typography, Space, Button, Tooltip } from 'antd';
import {
  EditOutlined, DeleteOutlined, EyeOutlined, ThunderboltOutlined,
  StarFilled, StarOutlined,
} from '@ant-design/icons';
import CharacterModelViewer from './CharacterModelViewer';
import { brand } from '../theme/tokens';

const { Text, Paragraph } = Typography;

const RARITY_META = {
  common: { label: 'Common', color: '#9AA4B2' },
  rare: { label: 'Rare', color: '#3B9EE3' },
  epic: { label: 'Epic', color: '#9B59B6' },
  legendary: { label: 'Legendary', color: '#F5B72B' },
};

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// GLBs over ~1.5 MB are heavy for the mobile grid — flag them for slimming.
const HEAVY_GLB_BYTES = 1.5 * 1024 * 1024;

export default function CharacterGridCard({
  character,
  onView,
  onEdit,
  onDelete,
  onOptimize,
  onSetStarter,
  optimizing,
}) {
  const rarity = RARITY_META[character.rarity] || RARITY_META.common;
  const accent = character.accent_color || brand.primary;
  const sizeLabel = formatBytes(character.model_file_size);
  const isHeavy = character.model_file_size != null
    && character.model_file_size > HEAVY_GLB_BYTES;

  return (
    <Card
      hoverable
      className="mb-character-card"
      styles={{
        body: { padding: 0 },
      }}
      onClick={() => onView(character)}
      style={{
        background: brand.surface,
        border: `1px solid ${character.is_active ? `${accent}44` : brand.border}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div className="mb-character-viewport" style={{ borderBottom: `1px solid ${brand.border}` }}>
        <CharacterModelViewer
          modelUrl={character.model_file}
          posterUrl={character.preview_image}
          accentColor={accent}
          autoRotate
          lazy
        />
        {!character.is_active && (
          <Tag
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              margin: 0,
              zIndex: 2,
            }}
          >
            Hidden
          </Tag>
        )}
        {character.is_starter && (
          <Tag
            icon={<StarFilled />}
            color="gold"
            style={{
              position: 'absolute',
              top: character.is_active ? 10 : 40,
              left: 10,
              margin: 0,
              border: 'none',
              zIndex: 2,
            }}
          >
            Starter
          </Tag>
        )}
        <Tag
          color={rarity.color}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            margin: 0,
            border: 'none',
            zIndex: 2,
          }}
        >
          {rarity.label}
        </Tag>
        {sizeLabel ? (
          <Tooltip title={isHeavy ? 'Heavy model — hit Slim to shrink it' : 'GLB file size'}>
            <Tag
              color={isHeavy ? 'volcano' : undefined}
              style={{
                position: 'absolute',
                bottom: 10,
                left: 10,
                margin: 0,
                border: 'none',
                zIndex: 2,
                fontVariantNumeric: 'tabular-nums',
                background: isHeavy ? undefined : 'rgba(0,0,0,0.55)',
                color: isHeavy ? undefined : '#fff',
              }}
            >
              {sizeLabel}
            </Tag>
          </Tooltip>
        ) : null}
      </div>

      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <Text strong style={{ color: brand.textPrimary, fontSize: 16, display: 'block' }} ellipsis>
              {character.name}
            </Text>
            <Space size={6} style={{ marginTop: 6 }}>
              <Tag style={{ margin: 0, background: `${brand.botBucks}22`, color: brand.botBucks, border: 'none' }}>
                {character.price} BB
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>#{character.order}</Text>
            </Space>
          </div>
        </div>

        {character.description ? (
          <Paragraph
            type="secondary"
            ellipsis={{ rows: 2 }}
            style={{ margin: '10px 0 0', fontSize: 13, color: brand.textSecondary }}
          >
            {character.description}
          </Paragraph>
        ) : null}

        <Space
          size={8}
          wrap
          style={{ marginTop: 14, width: '100%' }}
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip title="View 3D">
            <Button size="small" icon={<EyeOutlined />} onClick={() => onView(character)}>
              View
            </Button>
          </Tooltip>
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(character)}>
            Edit
          </Button>
          <Tooltip title={character.is_starter ? 'Gifted to new accounts' : 'Gift this to new accounts'}>
            <Button
              size="small"
              type={character.is_starter ? 'primary' : 'default'}
              icon={character.is_starter ? <StarFilled /> : <StarOutlined />}
              disabled={character.is_starter}
              onClick={() => onSetStarter?.(character)}
            >
              {character.is_starter ? 'Starter' : 'Starter'}
            </Button>
          </Tooltip>
          <Tooltip title={
            character.model_optimized
              ? 'Already slimmed'
              : 'Strip unused skin + simplify mesh for mobile'
          }
          >
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              loading={optimizing}
              disabled={character.model_optimized}
              onClick={() => onOptimize?.(character)}
            >
              {character.model_optimized ? 'Slimmed' : 'Slim'}
            </Button>
          </Tooltip>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(character)} />
        </Space>
      </div>
    </Card>
  );
}
