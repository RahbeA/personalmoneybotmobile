import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { LEGAL, LEGAL_DOCUMENTS } from '../constants/legal';

export default function LegalDocumentScreen({ route, navigation }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const docId = route?.params?.document || 'privacy';
  const document = LEGAL_DOCUMENTS[docId] || LEGAL_DOCUMENTS.privacy;

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {document.title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.updated}>Last updated: {LEGAL.lastUpdated}</Text>

          {document.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}

          <View style={styles.contactBox}>
            <Text style={styles.contactTitle}>Questions?</Text>
            <Text style={styles.contactBody}>
              Contact us at {LEGAL.contactEmail}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  updated: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 20,
    textAlign: 'center',
  },
  section: { marginBottom: 22 },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  contactBox: {
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 4,
  },
  contactBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
