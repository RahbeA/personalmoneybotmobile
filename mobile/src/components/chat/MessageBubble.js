import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import MessageText from './MessageText';

export default function MessageBubble({ role, content }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const isUser = role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <View style={styles.botAvatar}>
          <Ionicons name="chatbubble-ellipses" size={16} color={colors.background} />
        </View>
      )}
      {isUser ? (
        <LinearGradient
          colors={[colors.primaryLight, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.bubbleUser]}
        >
          <MessageText content={content} style={[styles.text, styles.textUser]} />
        </LinearGradient>
      ) : (
        <View style={[styles.bubble, styles.bubbleAssistant]}>
          <MessageText content={content} style={[styles.text, styles.textAssistant]} />
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors, isDark) => StyleSheet.create({
  row: {
    width: '100%',
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  bubbleUser: {
    borderRadius: 22,
    borderBottomRightRadius: 6,
  },
  bubbleAssistant: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.07)' : colors.border,
    borderRadius: 22,
    borderBottomLeftRadius: 6,
  },
  text: { fontSize: 16, lineHeight: 23 },
  textUser: { color: '#0A0A0A', fontWeight: '600' },
  textAssistant: { color: colors.white, fontWeight: '500' },
});
