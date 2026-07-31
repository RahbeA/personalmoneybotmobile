import React, { useState, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function ChatComposer({
  onSend,
  disabled,
  placeholder = 'Message...',
  embedded = false,
  leadingAccessory = null,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, embedded), [colors, embedded]);
  const [text, setText] = useState('');

  const canSend = text.trim().length > 0 && !disabled;

  function handleSend() {
    const value = text.trim();
    if (!value || disabled) return;
    setText('');
    onSend(value);
  }

  return (
    <View style={styles.container}>
      {leadingAccessory}
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={1000}
      />
      <TouchableOpacity
        style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
        onPress={handleSend}
        disabled={!canSend}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-up" size={20} color={colors.background} />
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (colors, embedded) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: embedded ? 8 : 12,
    paddingVertical: embedded ? 6 : 8,
    gap: 8,
    borderTopWidth: embedded ? 0 : 1,
    borderTopColor: colors.border,
    backgroundColor: embedded ? 'transparent' : colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.white,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.textMuted, opacity: 0.5 },
});
