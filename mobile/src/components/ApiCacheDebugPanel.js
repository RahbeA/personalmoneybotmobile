import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  isApiCacheDebugEnabled,
  getCacheReport,
  clearAllApiCache,
} from '../utils/apiCache';
import { useUserProgress } from '../context/UserProgressContext';

export default function ApiCacheDebugPanel({ colors, styles: parentStyles }) {
  const { refresh } = useUserProgress();
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);

  const styles = makeStyles(colors);

  const loadReport = useCallback(async () => {
    setBusy(true);
    try {
      const next = await getCacheReport();
      setReport(next);
      // eslint-disable-next-line no-console
      console.log('[ApiCache] report', next);
    } finally {
      setBusy(false);
    }
  }, []);

  if (!isApiCacheDebugEnabled) return null;

  const statLine = report
    ? `Hits — mem ${report.stats.memoryHit} · disk ${report.stats.storageHit} · miss ${report.stats.miss} · writes ${report.stats.write}`
    : 'Tap refresh to load API cache stats';

  return (
    <View style={parentStyles.section}>
      <Text style={parentStyles.sectionTitle}>API cache (debug)</Text>
      <View style={styles.panel}>
        <Text style={styles.hint}>
          Logs print as `[ApiCache] READ ← source | key`. Backend responses include
          X-Cache-Status: HIT|MISS when Redis is enabled.
        </Text>

        <Text style={styles.stat}>{statLine}</Text>
        {report && (
          <Text style={styles.stat}>
            Memory keys: {report.memoryKeys.length} · AsyncStorage keys: {report.storageKeyCount}
          </Text>
        )}

        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={loadReport} disabled={busy}>
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={styles.btnText}>{busy ? 'Loading…' : 'Refresh stats'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnDanger]}
            onPress={() => {
              Alert.alert(
                'Clear API cache?',
                'Removes cached stats, lessons, leaderboard, and tutor lists from this device.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                      await clearAllApiCache();
                      await loadReport();
                    },
                  },
                ],
              );
            }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error || '#E74C3C'} />
            <Text style={[styles.btnText, { color: colors.error || '#E74C3C' }]}>Clear cache</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.btnFull}
          onPress={() => refresh({ refreshModels: false })}
        >
          <Text style={styles.btnText}>Force refresh progress from network</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    panel: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    hint: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    stat: {
      fontSize: 12,
      fontFamily: 'Menlo',
      color: colors.textSecondary,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
    },
    btn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    btnDanger: {
      borderColor: colors.error || '#E74C3C',
    },
    btnFull: {
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.primaryTint,
    },
    btnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}
