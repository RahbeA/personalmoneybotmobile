import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandAvatar } from '../../components/brand';
import { useTheme } from '../../context/ThemeContext';
import { formatDisplayName, timeAgo, safeHttpsUrl, STATUS_LABELS } from './feedHelpers';

export default function FeedPostCard({ post, compact = false, showStatus = false, onOpenLink }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const imageUrl = safeHttpsUrl(post?.image_url);
  const linkUrl = safeHttpsUrl(post?.link);
  const author = post?.author || {};
  const statusColor = post?.status === 'rejected'
    ? colors.error
    : post?.status === 'approved'
      ? colors.primary
      : colors.botBucks;
  const statusLabel = STATUS_LABELS[post?.status] || STATUS_LABELS.pending;

  if (compact) {
    return (
      <View style={styles.compactCard}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.compactImage} resizeMode="cover" />
        ) : (
          <View style={[styles.compactImage, styles.imageFallback]}>
            <Ionicons name="image-outline" size={22} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.compactBody}>
          <Text style={styles.compactCaption} numberOfLines={2}>{post?.caption}</Text>
          <View style={styles.compactMeta}>
            {showStatus ? (
              <View style={[styles.statusChip, { backgroundColor: `${statusColor}22` }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            ) : null}
            <Text style={styles.time}>{timeAgo(post?.created_at)}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.authorRow}>
        <BrandAvatar
          character={author.equipped_character}
          size={40}
          autoRotate={!!author.equipped_character}
        />
        <View style={styles.authorBody}>
          <Text style={styles.authorName} numberOfLines={1}>
            {formatDisplayName(author.display_name)}
          </Text>
          <Text style={styles.time}>{timeAgo(post?.created_at)}</Text>
        </View>
        {showStatus ? (
          <View style={[styles.statusChip, { backgroundColor: `${statusColor}22` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        ) : null}
      </View>

      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imageFallback]}>
          <Ionicons name="image-outline" size={36} color={colors.textMuted} />
        </View>
      )}

      {!!post?.caption && <Text style={styles.caption}>{post.caption}</Text>}

      {linkUrl && onOpenLink ? (
        <TouchableOpacity
          style={styles.linkChip}
          onPress={() => onOpenLink(linkUrl)}
          activeOpacity={0.85}
        >
          <Ionicons name="link-outline" size={16} color={colors.primary} />
          <Text style={styles.linkText} numberOfLines={1}>{linkUrl.replace(/^https?:\/\//i, '')}</Text>
          <Ionicons name="open-outline" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  authorBody: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.2,
  },
  time: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: colors.surface,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    lineHeight: 21,
  },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 14,
    marginTop: -4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primaryTintStrong,
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },
  compactImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  compactBody: {
    flex: 1,
    minWidth: 0,
  },
  compactCaption: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    lineHeight: 19,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
});
