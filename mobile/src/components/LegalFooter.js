import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

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
        <TouchableOpacity
          style={styles.linkHit}
          onPress={() => openLegal('terms')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="link"
          accessibilityLabel="Terms of Service"
        >
          <Text style={styles.link}>Terms of Service</Text>
        </TouchableOpacity>
        <Text style={styles.separator}>·</Text>
        <TouchableOpacity
          style={styles.linkHit}
          onPress={() => openLegal('privacy')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="link"
          accessibilityLabel="Privacy Policy"
        >
          <Text style={styles.link}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>
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
  linkHit: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
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
});
