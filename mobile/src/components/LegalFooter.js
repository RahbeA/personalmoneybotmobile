import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { LEGAL } from '../constants/legal';

export default function LegalFooter({ style, centered = true }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  function openLegal(document) {
    navigation.navigate('Legal', { document });
  }

  return (
    <View style={[styles.container, centered && styles.centered, style]}>
      <View style={styles.linksRow}>
        <TouchableOpacity onPress={() => openLegal('terms')} hitSlop={8}>
          <Text style={styles.link}>Terms of Service</Text>
        </TouchableOpacity>
        <Text style={styles.separator}>·</Text>
        <TouchableOpacity onPress={() => openLegal('privacy')} hitSlop={8}>
          <Text style={styles.link}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.contact}>Contact: {LEGAL.contactEmail}</Text>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: { gap: 6 },
  centered: { alignItems: 'center' },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  link: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  separator: {
    fontSize: 12,
    color: colors.textMuted,
  },
  contact: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
