import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import BrandAvatar from '../brand/BrandAvatar';
import MessageText from './MessageText';

export default function MessageBubble({ role, content, character }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isUser = role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <BrandAvatar character={character} size={28} style={styles.avatar} logoSize={18} />
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <MessageText
          content={content}
          style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  row: { width: '100%', marginVertical: 4, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  avatar: { marginBottom: 2 },
  bubble: {
    maxWidth: '72%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },
  bubbleAssistant: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  text: { fontSize: 15, lineHeight: 21 },
  textUser: { color: colors.background, fontWeight: '500' },
  textAssistant: { color: colors.white },
});
