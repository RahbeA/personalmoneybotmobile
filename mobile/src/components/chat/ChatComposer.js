import React, { useState, useMemo } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
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
        blurOnSubmit={false}
        returnKeyType="default"
        textAlignVertical="center"
      />
      <TouchableOpacity
        style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
        onPress={handleSend}
        disabled={!canSend}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Send message"
      >
        <Ionicons name="arrow-up" size={20} color={canSend ? colors.background : colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (colors, embedded) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: embedded ? 10 : 12,
    paddingVertical: embedded ? 8 : 10,
    gap: 10,
    borderTopWidth: embedded ? 0 : 1,
    borderTopColor: colors.border,
    backgroundColor: embedded ? 'transparent' : colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: 22,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 1,
  },
});
