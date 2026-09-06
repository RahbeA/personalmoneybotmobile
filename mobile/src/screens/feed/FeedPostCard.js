import React, { useMemo, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Share, Platform, ActionSheetIOS, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BrandAvatar } from '../../components/brand';
import { useTheme } from '../../context/ThemeContext';
import { formatDisplayName, timeAgo, safeHttpsUrl, STATUS_LABELS } from './feedHelpers';

const LIKE_COLOR = '#FF3B5C';

export default function FeedPostCard({
  post,
  compact = false,
  showStatus = false,
  showUpvote = false,
  showActions = false,
  showStats = false,
  onOpenLink,
  onToggleUpvote,
  upvoteDisabled = false,
  onToggleBookmark,
  bookmarkDisabled = false,
  onSaveImage,
  onDelete,
  canDelete = false,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const imageUrl = safeHttpsUrl(post?.image_url);
  const linkUrl = safeHttpsUrl(post?.link);
  const author = post?.author || {};
  const isPrivate = post?.visibility === 'private';
  const statusColor = post?.status === 'rejected'
    ? colors.error
    : post?.status === 'approved'
      ? colors.primary
      : colors.botBucks;
  const statusLabel = STATUS_LABELS[post?.status] || STATUS_LABELS.pending;
  const upvoteCount = post?.upvote_count ?? 0;
  const bookmarkCount = post?.bookmark_count ?? 0;
  const hasUpvoted = !!post?.has_upvoted;
  const hasBookmarked = !!post?.has_bookmarked;
  const showActionRow = !!onToggleUpvote || !!onToggleBookmark;

  const handleShare = useCallback(async () => {
    const message = [post?.caption, linkUrl].filter(Boolean).join('\n\n');
    try {
      await Share.share({
        message: message || 'Check out this money tip on MoneyBot',
        ...(linkUrl ? { url: linkUrl } : imageUrl ? { url: imageUrl } : {}),
      });
    } catch {
      // user dismissed the share sheet
    }
  }, [post?.caption, linkUrl, imageUrl]);

  const menuOptions = useMemo(() => {
    const opts = [];
    if (imageUrl && onSaveImage) {
      opts.push({ label: 'Save photo', onPress: () => onSaveImage(post) });
    }
    opts.push({ label: 'Share', onPress: handleShare });
    if (linkUrl && onOpenLink) {
      opts.push({ label: 'Open link', onPress: () => onOpenLink(linkUrl) });
    }
    if (canDelete && onDelete) {
      opts.push({ label: 'Delete', destructive: true, onPress: () => onDelete(post) });
    }
    return opts;
  }, [imageUrl, onSaveImage, handleShare, linkUrl, onOpenLink, canDelete, onDelete, post]);

  const openMenu = useCallback(() => {
    if (!menuOptions.length) return;
    if (Platform.OS === 'ios') {
      const labels = menuOptions.map((o) => o.label);
      const destructiveIndex = menuOptions.findIndex((o) => o.destructive);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...labels, 'Cancel'],
          cancelButtonIndex: labels.length,
          ...(destructiveIndex >= 0 ? { destructiveButtonIndex: destructiveIndex } : {}),
        },
        (i) => { if (i >= 0 && i < menuOptions.length) menuOptions[i].onPress(); },
      );
    } else {
      Alert.alert('Post options', undefined, [
        ...menuOptions.map((o) => ({
          text: o.label,
          style: o.destructive ? 'destructive' : 'default',
          onPress: o.onPress,
        })),
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [menuOptions]);

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
            {upvoteCount > 0 ? (
              <View style={styles.compactUpvote}>
                <Ionicons name="heart" size={12} color={colors.textMuted} />
                <Text style={styles.compactUpvoteText}>{upvoteCount}</Text>
              </View>
            ) : null}
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
        {isPrivate ? (
          <View style={[styles.statusChip, { backgroundColor: `${colors.textSecondary}22` }]}>
            <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>Private</Text>
          </View>
        ) : showStatus ? (
          <View style={[styles.statusChip, { backgroundColor: `${statusColor}22` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        ) : null}
        {menuOptions.length ? (
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={openMenu}
            hitSlop={10}
            activeOpacity={0.7}
            accessibilityLabel="Post options"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
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

      {showActionRow ? (
        <View style={styles.actionRow}>
          {onToggleUpvote ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onToggleUpvote(post)}
              disabled={upvoteDisabled}
              hitSlop={8}
              activeOpacity={0.7}
              accessibilityLabel={hasUpvoted ? 'Unlike post' : 'Like post'}
            >
              <Ionicons
                name={hasUpvoted ? 'heart' : 'heart-outline'}
                size={26}
                color={hasUpvoted ? LIKE_COLOR : colors.textSecondary}
              />
              {upvoteCount > 0 ? (
                <Text style={[styles.actionCount, hasUpvoted && { color: LIKE_COLOR }]}>{upvoteCount}</Text>
              ) : null}
            </TouchableOpacity>
          ) : null}

          {onToggleBookmark ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onToggleBookmark(post)}
              disabled={bookmarkDisabled}
              hitSlop={8}
              activeOpacity={0.7}
              accessibilityLabel={hasBookmarked ? 'Remove from MoneyVault' : 'Save to MoneyVault'}
            >
              <Ionicons
                name={hasBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={23}
                color={hasBookmarked ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          ) : null}

          <View style={styles.actionSpacer} />
        </View>
      ) : showStats ? (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="heart" size={18} color={LIKE_COLOR} />
            <Text style={styles.statCount}>{upvoteCount}</Text>
            <Text style={styles.statLabel}>{upvoteCount === 1 ? 'like' : 'likes'}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="bookmark" size={17} color={colors.primary} />
            <Text style={styles.statCount}>{bookmarkCount}</Text>
            <Text style={styles.statLabel}>{bookmarkCount === 1 ? 'save' : 'saves'}</Text>
          </View>
        </View>
      ) : upvoteCount > 0 ? (
        <View style={styles.actionRow}>
          <View style={styles.actionBtn}>
            <Ionicons name="heart" size={20} color={colors.textMuted} />
            <Text style={styles.upvoteCountStatic}>{upvoteCount}</Text>
          </View>
        </View>
      ) : null}

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
  menuBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: 4,
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    lineHeight: 21,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  actionSpacer: {
    flex: 1,
  },
  actionCount: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  upvoteCountStatic: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statCount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 4,
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
  compactUpvote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  compactUpvoteText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
