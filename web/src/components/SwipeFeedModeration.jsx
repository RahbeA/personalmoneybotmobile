import { useCallback, useRef, useState } from 'react';
import { Button, Typography } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { resolveMediaUrl } from '../utils/media';

const { Text } = Typography;

const SWIPE_THRESHOLD = 110;

function SwipeFeedCard({ post, onDecision, busy, stacked }) {
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const startX = useRef(null);
  const dragging = useRef(false);

  const rotation = Math.max(-14, Math.min(14, offset / 14));
  const approveOpacity = Math.min(1, Math.max(0, offset / SWIPE_THRESHOLD));
  const rejectOpacity = Math.min(1, Math.max(0, -offset / SWIPE_THRESHOLD));

  const finish = useCallback(async (action) => {
    if (busy || animating) return;
    setAnimating(true);
    setOffset(action === 'approve' ? 520 : -520);
    try {
      await onDecision(post, action);
    } finally {
      setAnimating(false);
      setOffset(0);
    }
  }, [animating, busy, onDecision, post]);

  function onPointerDown(e) {
    if (busy || animating || stacked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    dragging.current = true;
  }

  function onPointerMove(e) {
    if (!dragging.current || stacked) return;
    setOffset(e.clientX - startX.current);
  }

  function onPointerUp() {
    if (!dragging.current || stacked) return;
    dragging.current = false;
    if (offset > SWIPE_THRESHOLD) {
      finish('approve');
    } else if (offset < -SWIPE_THRESHOLD) {
      finish('reject');
    } else {
      setOffset(0);
    }
  }

  function onPointerCancel() {
    dragging.current = false;
    if (!animating) setOffset(0);
  }

  return (
    <div
      className={`mb-feed-swipe-card${stacked ? ' mb-feed-swipe-card--stacked' : ''}`}
      style={{
        transform: stacked
          ? 'scale(0.96) translateY(10px)'
          : `translateX(${offset}px) rotate(${rotation}deg)`,
        transition: dragging.current ? 'none' : 'transform 0.28s ease',
        zIndex: stacked ? 1 : 2,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {!stacked && (
        <>
          <div className="mb-feed-swipe-overlay mb-feed-swipe-overlay--approve" style={{ opacity: approveOpacity }}>
            <CheckOutlined /> Approve
          </div>
          <div className="mb-feed-swipe-overlay mb-feed-swipe-overlay--reject" style={{ opacity: rejectOpacity }}>
            <CloseOutlined /> Reject
          </div>
        </>
      )}

      <div className="mb-feed-swipe-image-wrap">
        {post.image ? (
          <img src={resolveMediaUrl(post.image)} alt="" className="mb-feed-swipe-image" draggable={false} />
        ) : (
          <div className="mb-feed-swipe-image mb-feed-swipe-image--empty">No image</div>
        )}
      </div>

      <div className="mb-feed-swipe-body">
        <Text className="mb-feed-swipe-caption">{post.caption || '(no caption)'}</Text>
        <Text type="secondary" className="mb-feed-swipe-meta">
          {post.author_email}
          {post.created_at ? ` · ${new Date(post.created_at).toLocaleString()}` : ''}
        </Text>
      </div>
    </div>
  );
}

export default function SwipeFeedModeration({ posts, onDecision, busy }) {
  const active = posts[0];
  const next = posts[1];

  if (!active) {
    return (
      <div className="mb-feed-swipe-empty">
        <Text type="secondary">No pending posts — you're all caught up.</Text>
      </div>
    );
  }

  return (
    <div className="mb-feed-swipe-shell">
      <Text type="secondary" className="mb-feed-swipe-hint">
        Swipe right to approve, left to reject. {posts.length} pending.
      </Text>

      <div className="mb-feed-swipe-stage">
        {next ? <SwipeFeedCard post={next} stacked onDecision={onDecision} busy={busy} /> : null}
        <SwipeFeedCard post={active} onDecision={onDecision} busy={busy} />
      </div>

      <div className="mb-feed-swipe-actions">
        <Button
          danger
          size="large"
          icon={<CloseOutlined />}
          disabled={busy}
          onClick={() => onDecision(active, 'reject')}
        >
          Reject
        </Button>
        <Button
          type="primary"
          size="large"
          icon={<CheckOutlined />}
          disabled={busy}
          onClick={() => onDecision(active, 'approve')}
        >
          Approve
        </Button>
      </div>
    </div>
  );
}
