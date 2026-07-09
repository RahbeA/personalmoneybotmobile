import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { socialApi } from '../../api/social';
import { BrandAvatar, BrandLoader, BrandEmptyState } from '../../components/brand';
import { useTabBarInset } from '../../navigation/tabBarLayout';

function formatName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function UserRow({ user, styles, subtitle, rightSlot }) {
  return (
    <View style={styles.userRow}>
      <BrandAvatar character={user.equipped_character} size={44} autoRotate={!!user.equipped_character} />
      <View style={styles.userBody}>
        <Text style={styles.userName} numberOfLines={1}>{formatName(user.display_name)}</Text>
        {subtitle ? <Text style={styles.userSub}>{subtitle}</Text> : null}
      </View>
      {rightSlot}
    </View>
  );
}

export default function FriendRequestsScreen({ navigation }) {
  const { token } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tabInset = useTabBarInset(24);

  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await socialApi.getRequests(token);
      setIncoming(res.incoming || []);
      setOutgoing(res.outgoing || []);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not load requests.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const handleAccept = async (requestId) => {
    setActionId(requestId);
    try {
      await socialApi.acceptRequest(token, requestId);
      await load();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not accept request.');
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (requestId) => {
    setActionId(requestId);
    try {
      await socialApi.declineRequest(token, requestId);
      await load();
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not decline request.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.gradient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Friend Requests</Text>
          <View style={styles.backBtn} />
        </View>

        {loading ? (
          <BrandLoader message="Loading requests…" />
        ) : (
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: tabInset }]}>
            {incoming.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>INCOMING</Text>
                {incoming.map((req) => (
                  <UserRow
                    key={req.id}
                    user={req.user}
                    styles={styles}
                    subtitle="Wants to be friends"
                    rightSlot={(
                      <View style={styles.requestActions}>
                        <TouchableOpacity
                          style={styles.acceptBtn}
                          onPress={() => handleAccept(req.id)}
                          disabled={actionId === req.id}
                        >
                          <Ionicons name="checkmark" size={18} color={colors.background} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.declineBtn}
                          onPress={() => handleDecline(req.id)}
                          disabled={actionId === req.id}
                        >
                          <Ionicons name="close" size={18} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    )}
                  />
                ))}
              </>
            )}
            {outgoing.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>SENT</Text>
                {outgoing.map((req) => (
                  <UserRow
                    key={req.id}
                    user={req.user}
                    styles={styles}
                    subtitle="Pending"
                    rightSlot={<Text style={styles.pendingLabel}>Waiting</Text>}
                  />
                ))}
              </>
            )}
            {incoming.length === 0 && outgoing.length === 0 && (
              <BrandEmptyState
                title="No pending requests"
                body="When someone sends you a request, it will show up here."
              />
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: colors.white, letterSpacing: -0.3 },
  list: { paddingHorizontal: 20, paddingTop: 4 },
  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: colors.textSecondary,
    letterSpacing: 0.6, marginBottom: 8, marginTop: 8,
  },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surfaceElevated, borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  userBody: { flex: 1, minWidth: 0 },
  userName: { fontSize: 15, fontWeight: '700', color: colors.white },
  userSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pendingLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  declineBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
});
