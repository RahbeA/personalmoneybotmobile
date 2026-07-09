import React from 'react';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const GROUP_ICON_OPTIONS = [
  { key: 'people', icon: 'people' },
  { key: 'trophy', icon: 'trophy' },
  { key: 'cash', icon: 'cash' },
  { key: 'flag', icon: 'flag' },
  { key: 'flame', icon: 'flame' },
  { key: 'star', icon: 'star' },
  { key: 'rocket', icon: 'rocket' },
  { key: 'fitness', icon: 'fitness' },
];

const ICON_BY_KEY = Object.fromEntries(GROUP_ICON_OPTIONS.map((o) => [o.key, o.icon]));

export function GroupIcon({ iconKey, size = 24, color = '#FFFFFF' }) {
  const name = ICON_BY_KEY[iconKey] || 'people';
  if (ICON_BY_KEY[iconKey]) {
    return <Ionicons name={name} size={size} color={color} />;
  }
  return <Text style={{ fontSize: size, lineHeight: size + 4 }}>{iconKey}</Text>;
}

export function isGroupIconKey(value) {
  return Boolean(value && ICON_BY_KEY[value]);
}
