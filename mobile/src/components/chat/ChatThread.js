import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, FlatList, Keyboard, Platform, StyleSheet, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import ChatComposer from './ChatComposer';
import { useTheme } from '../../context/ThemeContext';

export default function ChatThread({
  messages = [],
  sending = false,
  onSend,
  composerDisabled = false,
  placeholder,
  keyboardVerticalOffset = 0,
  bottomInset = 0,
  footer = null,
  emptyComponent = null,
  composerStyle = null,
  composerLeading = null,
  composerAccessory = null,
  onKeyboardVisibleChange,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listRef = useRef(null);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isTabletLayout = Platform.OS === 'ios' && (Platform.isPad || width >= 768);

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e?.endCoordinates?.height || 0);
      onKeyboardVisibleChange?.(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      onKeyboardVisibleChange?.(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [onKeyboardVisibleChange]);

  const data = useMemo(() => {
    const newestFirst = [...messages].reverse();
    if (sending) {
      return [{ id: '__typing__', type: 'typing' }, ...newestFirst];
    }
    return newestFirst;
  }, [messages, sending]);

  const isEmpty = messages.length === 0 && !sending;

  useEffect(() => {
    if (isEmpty || !listRef.current) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  }, [messages.length, sending, isEmpty]);

  const bottomPad = useMemo(() => {
    if (keyboardVisible) {
      const lift = Math.max(0, keyboardHeight - insets.bottom);
      return isTabletLayout ? lift : lift;
    }
    return bottomInset;
  }, [keyboardVisible, keyboardHeight, insets.bottom, bottomInset, isTabletLayout]);

  function renderItem({ item }) {
    if (item.type === 'typing') return <TypingIndicator />;
    return <MessageBubble role={item.role} content={item.content} />;
  }

  const listPadding = useMemo(
    () => [styles.listContent, { paddingTop: 12, paddingBottom: 8 }],
    [styles.listContent],
  );

  const keyboardDismiss = Platform.OS === 'ios' ? 'interactive' : 'on-drag';

  return (
    <View style={styles.flex}>
      <View style={styles.flex}>
        {isEmpty && emptyComponent ? (
          <View style={styles.emptyWrap}>{emptyComponent}</View>
        ) : (
          <FlatList
            ref={listRef}
            data={data}
            inverted
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={listPadding}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={keyboardDismiss}
            showsVerticalScrollIndicator={false}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 24,
            }}
          />
        )}
        {footer}
      </View>

      {onSend && (
        <View style={[styles.composerDock, { paddingBottom: bottomPad }]}>
          {composerAccessory}
          <View style={composerStyle}>
            <ChatComposer
              onSend={onSend}
              disabled={composerDisabled}
              placeholder={placeholder}
              embedded={!!composerStyle}
              leadingAccessory={composerLeading}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  listContent: { paddingHorizontal: 16 },
  emptyWrap: { flex: 1, minHeight: 0 },
  composerDock: {
    backgroundColor: 'transparent',
  },
});
