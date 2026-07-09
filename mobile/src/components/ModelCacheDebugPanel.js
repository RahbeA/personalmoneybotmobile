import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  isModelCacheDebugEnabled,
  getModelCacheReport,
  clearModelCache,
} from '../utils/modelCache';
import { useUserProgress } from '../context/UserProgressContext';

export default function ModelCacheDebugPanel({ colors, styles: parentStyles }) {
  const { characters, equippedCharacter, refreshCharacterCache, invalidateCharactersMetadata } = useUserProgress();
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);

  const styles = makeStyles(colors);

  const loadReport = useCallback(async () => {
    setBusy(true);
    try {
      const next = await getModelCacheReport();
      setReport(next);
      // eslint-disable-next-line no-console
      console.log('[ModelCache] report', next);
    } finally {
      setBusy(false);
    }
  }, []);

  if (!isModelCacheDebugEnabled) return null;

  const statLine = report
    ? `Models — mem ${report.stats.model.memory} · disk ${report.stats.model.disk} · net ${report.stats.model.network} · err ${report.stats.model.error}`
    : 'Tap refresh to load cache stats';

  const syncLine = report?.stats?.sync?.lastRunAt
    ? `Last sync: ${report.stats.sync.ok}/${report.stats.sync.total} ok (${report.stats.sync.lastDurationMs}ms)`
    : 'No sync yet';

  return (
    <View style={parentStyles.section}>
      <Text style={parentStyles.sectionTitle}>Model cache (debug)</Text>
      <View style={styles.panel}>
        <Text style={styles.hint}>
          Logs print as `[ModelCache] CATEGORY ← source | message`. Enable on TestFlight with
          {' '}EXPO_PUBLIC_MODEL_CACHE_DEBUG=1. Each tester caches on-device — Railway is only hit once per model per phone.
        </Text>

        <Text style={styles.stat}>{statLine}</Text>
        <Text style={styles.stat}>{syncLine}</Text>
        {report?.disk ? (
          <Text style={styles.stat}>
            Disk: {report.disk.modelCount} models ({report.disk.totalBytes}) · script: {report.disk.scriptSource || 'unknown'}
          </Text>
        ) : null}

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.btn} onPress={loadReport} disabled={busy}>
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={styles.btnText}>{busy ? 'Loading…' : 'Refresh report'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btn}
            onPress={async () => {
              setBusy(true);
              try {
                await refreshCharacterCache(true);
                await loadReport();
                Alert.alert('Sync done', 'Check Metro / Xcode console for [ModelCache] SYNC logs.');
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            <Ionicons name="cloud-download" size={16} color={colors.primary} />
            <Text style={styles.btnText}>Force re-sync</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.btn, styles.btnDanger]}
          onPress={() => {
            Alert.alert('Clear model cache?', 'Deletes all cached .glb files on this device.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Clear',
                style: 'destructive',
                onPress: async () => {
                  await clearModelCache();
                  invalidateCharactersMetadata();
                  await refreshCharacterCache(true);
                  await loadReport();
                  Alert.alert(
                    'Cache cleared',
                    'Relaunch or open Moneyverse — logs should show MODEL ← network for each .glb.',
                  );
                },
              },
            ]);
          }}
        >
          <Ionicons name="trash" size={16} color={colors.error} />
          <Text style={[styles.btnText, { color: colors.error }]}>Clear local cache</Text>
        </TouchableOpacity>

        {report?.recentLogs?.length ? (
          <ScrollView style={styles.logBox} nestedScrollEnabled>
            {report.recentLogs.slice().reverse().map((entry, i) => (
              <Text key={`${entry.ts}-${i}`} style={styles.logLine}>
                {new Date(entry.ts).toLocaleTimeString()} · {entry.category} ← {entry.source} · {entry.message}
              </Text>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  panel: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  stat: {
    fontSize: 12,
    fontFamily: 'Menlo',
    color: colors.textMuted,
  },
  btnRow: {
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDanger: {
    flex: 0,
    alignSelf: 'stretch',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  logBox: {
    maxHeight: 160,
    marginTop: 4,
    padding: 8,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  logLine: {
    fontSize: 10,
    lineHeight: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
});
