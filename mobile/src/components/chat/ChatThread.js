import React, { useEffect, useMemo, useState } from 'react';
import {
  View, FlatList, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, useWindowDimensions,
} from 'react-native';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import ChatComposer from './ChatComposer';
import { useTheme } from '../../context/ThemeContext';

// `messages` is chronological (oldest first). The list is inverted so the
// newest message sits at the bottom and the view auto-sticks to the latest.
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
  character = null,
  composerStyle = null,
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // iPad (and iPhone apps running in iPad compatibility mode) often fail
  // KeyboardAvoidingView padding — especially with undocked keyboards. We
  // detect a tablet-sized viewport and pad the composer from the keyboard
  // frame height instead.
  const isTabletLayout = Platform.OS === 'ios' && (Platform.isPad || width >= 768);

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e?.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const data = useMemo(() => {
    const newestFirst = [...messages].reverse();
    if (sending) {
      return [{ id: '__typing__', type: 'typing' }, ...newestFirst];
    }
    return newestFirst;
  }, [messages, sending]);

  function renderItem({ item }) {
    if (item.type === 'typing') return <TypingIndicator character={character} />;
    return <MessageBubble role={item.role} content={item.content} character={character} />;
  }

  const isEmpty = data.length === 0;

  const listPadding = useMemo(
    () => [styles.listContent, { paddingBottom: 8 }],
    [styles.listContent],
  );

  // Phone: KAV lifts the composer; drop the tab-bar inset while typing.
  // Tablet: skip KAV and pad by the reported keyboard height so the input
  // stays above the docked keyboard on iPad Air (Guideline 4).
  const composerBottomPad = keyboardVisible
    ? (isTabletLayout ? Math.max(keyboardHeight, 0) : 0)
    : bottomInset;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' && !isTabletLayout ? 'padding' : undefined}
      keyboardVerticalOffset={isTabletLayout ? 0 : keyboardVerticalOffset}
    >
      <View style={styles.flex}>
        {isEmpty && emptyComponent ? (
          <View style={styles.emptyWrap}>{emptyComponent}</View>
        ) : (
          <FlatList
            data={data}
            inverted
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={listPadding}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          />
        )}
        {footer}
      </View>
      {onSend && (
        <View style={[{ paddingBottom: composerBottomPad }, composerStyle]}>
          <ChatComposer
            onSend={onSend}
            disabled={composerDisabled}
            placeholder={placeholder}
            embedded={!!composerStyle}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingVertical: 12 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
});
