import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  TextInput,
  Share,
  Linking,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authApi } from '../../api/auth';
import { socialApi } from '../../api/social';
import { BrandAvatar, BrandLoader, BrandEmptyState } from '../../components/brand';
import PuckButton from '../../components/PuckButton';
import { buildInviteShareMessage, APP_STORE_URL } from '../../constants/brandCopy';
import { useTabBarInset } from '../../navigation/tabBarLayout';
import { requireAccount } from '../../utils/requireAccount';
import {
  loadDeviceContacts,
  requestContactAccess,
  syncContactsWithApp,
  openContactSettings,
  ContactsNativeMissingError,
} from '../../utils/contactSync';

function formatName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function friendActionLabel(status) {
  if (status === 'accepted') return 'Friends';
  if (status === 'pending') return 'Pending';
  return 'Add';
}

export default function ContactInviteScreen({ navigation }) {
  const { token, isGuest } = useAuth();
  const { colors, isDark } = useTheme();
  const tabInset = useTabBarInset(24);
  const styles = useMemo(() => makeStyles(colors, tabInset), [colors, tabInset]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [nativeMissing, setNativeMissing] = useState(false);
  const [query, setQuery] = useState('');
  const [onApp, setOnApp] = useState([]);
  const [toInvite, setToInvite] = useState([]);
  const [invitePayload, setInvitePayload] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [contactsStarted, setContactsStarted] = useState(false);

  const loadInitial = useCallback(async () => {
    if (!token || isGuest) return;
    setLoading(true);
    try {
      const invitesRes = await authApi.getMyInvites(token).catch(() => null);
      if (invitesRes?.code) {
        setInvitePayload({ code: invitesRes.code, url: invitesRes.url });
      }
    } finally {
      setLoading(false);
    }
  }, [token, isGuest]);

  const sync = useCallback(async () => {
    if (!token || isGuest) return;
    setContactsStarted(true);
    setSyncing(true);
    setPermissionDenied(false);
    setNativeMissing(false);
    try {
      const granted = await requestContactAccess();
      if (!granted) {
        setPermissionDenied(true);
        setOnApp([]);
        setToInvite([]);
        return;
      }

      const contacts = await loadDeviceContacts();
      const { onApp: matched, toInvite: invites } = await syncContactsWithApp(token, contacts);
      setOnApp(matched);
      setToInvite(invites);
    } catch (e) {
      if (e instanceof ContactsNativeMissingError || e?.code === 'CONTACTS_NATIVE_MISSING') {
        setNativeMissing(true);
        return;
      }
      Alert.alert('Error', e.message || 'Could not sync contacts.');
    } finally {
      setSyncing(false);
    }
  }, [token, isGuest]);

  const handleShareInvite = async () => {
    if (!invitePayload?.code) {
      Alert.alert('Invite unavailable', 'Could not load your invite link. Pull to refresh and try again.');
      return;
    }
    try {
      await Share.share({
        message: buildInviteShareMessage(invitePayload),
        url: APP_STORE_URL,
      });
    } catch {
      // user dismissed
    }
  };

  useFocusEffect(useCallback(() => {
    if (isGuest) {
      requireAccount({ isGuest: true, navigation, feature: 'find friends from contacts' });
      navigation.goBack();
      return;
    }
    loadInitial();
  }, [isGuest, navigation, loadInitial]));

  const handleAddFriend = async (user) => {
    if (!requireAccount({ isGuest, navigation, feature: 'send friend requests' })) return;
    setActionId(user.user_id);
    try {
      await socialApi.sendRequest(token, user.user_id);
      setOnApp((prev) => prev.map((row) => (
        row.user_id === user.user_id ? { ...row, friendship_status: 'pending' } : row
      )));
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not send request.');
    } finally {
      setActionId(null);
    }
  };

  const handleInvite = async (contact) => {
    if (!invitePayload?.code) {
      Alert.alert('Invite unavailable', 'Could not load your invite link. Try again in a moment.');
      return;
    }
    const message = buildInviteShareMessage(invitePayload);
    const phone = contact.phones?.[0];
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      const smsUrl = Platform.select({
        ios: `sms:${digits}&body=${encodeURIComponent(message)}`,
        android: `sms:${digits}?body=${encodeURIComponent(message)}`,
      });
      if (smsUrl) {
        try {
          const canOpen = await Linking.canOpenURL(smsUrl);
          if (canOpen) {
            await Linking.openURL(smsUrl);
            return;
          }
        } catch {
          // fall through to share sheet
        }
      }
    }
    try {
      await Share.share({ message, url: APP_STORE_URL });
    } catch {
      // user dismissed
    }
  };

  const filterText = query.trim().toLowerCase();
  const filteredOnApp = useMemo(() => {
    if (!filterText) return onApp;
    return onApp.filter((u) => (u.display_name || '').toLowerCase().includes(filterText));
  }, [onApp, filterText]);

  const filteredInvite = useMemo(() => {
    if (!filterText) return toInvite;
    return toInvite.filter((c) => c.name.toLowerCase().includes(filterText));
  }, [toInvite, filterText]);

  const sections = useMemo(() => {
    const out = [];
    if (filteredOnApp.length) {
      out.push({ title: 'ON MONEYBOT', data: filteredOnApp, kind: 'onApp' });
    }
    if (filteredInvite.length) {
      out.push({ title: 'INVITE TO MONEYBOT', data: filteredInvite, kind: 'invite' });
    }
    return out;
  }, [filteredOnApp, filteredInvite]);

  const renderOnApp = (user) => {
    const busy = actionId === user.user_id;
    const isFriend = user.friendship_status === 'accepted';
    const isPending = user.friendship_status === 'pending';
    return (
      <View style={styles.row}>
        <BrandAvatar character={user.equipped_character} size={44} autoRotate={!!user.equipped_character} />
        <View style={styles.rowBody}>
          <Text style={styles.rowName} numberOfLines={1}>{formatName(user.display_name)}</Text>
          <Text style={styles.rowMeta}>Already on MoneyBot</Text>
        </View>
        <PuckButton
          color={isFriend ? colors.surfaceElevated : colors.primary}
          width={88}
          height={36}
          borderRadius={12}
          lip={3}
          disabled={isFriend || isPending || busy}
          onPress={() => handleAddFriend(user)}
        >
          {busy ? (
            <ActivityIndicator size="small" color={isFriend ? colors.textMuted : '#FFFFFF'} />
          ) : (
            <Text style={[styles.actionText, (isFriend || isPending) && styles.actionTextMuted]}>
              {friendActionLabel(user.friendship_status)}
            </Text>
          )}
        </PuckButton>
      </View>
    );
  };

  const renderInvite = (contact) => (
    <View style={styles.row}>
      <View style={styles.contactIcon}>
        <Ionicons name="person-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{contact.name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{contact.phones[0]}</Text>
      </View>
      <PuckButton
        color={colors.primary}
        width={88}
        height={36}
        borderRadius={12}
        lip={3}
        onPress={() => handleInvite(contact)}
      >
        <Text style={styles.actionText}>Invite</Text>
      </PuckButton>
    </View>
  );

  if (loading) {
    return (
      <LinearGradient colors={colors.bgGradient} style={styles.flex}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BrandLoader message="Loading contacts…" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.flex}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerBody}>
            <Text style={styles.title}>Contacts</Text>
            <Text style={styles.subtitle}>Find friends and invite people to MoneyBot</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={contactsStarted ? sync : loadInitial}
            disabled={syncing || loading}
            activeOpacity={0.85}
            accessibilityLabel="Refresh contacts"
          >
            {syncing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="refresh" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        {nativeMissing ? (
          <View style={styles.body}>
            <BrandEmptyState
              icon="build-outline"
              title="Dev build update needed"
              body="Contacts was added recently. Rebuild the iOS dev client once, then reopen the app."
            />
            <View style={styles.ctaWrap}>
              <Text style={styles.rebuildHint}>
                cd mobile{'\n'}npx expo run:ios
              </Text>
            </View>
          </View>
        ) : permissionDenied ? (
          <View style={styles.body}>
            <BrandEmptyState
              icon="people-outline"
              title="Contacts access needed"
              body="Allow contacts so MoneyBot can find friends already on the app and invite people you know."
            />
            <View style={styles.ctaWrap}>
              <PuckButton color={colors.primary} height={48} borderRadius={14} lip={4} onPress={sync}>
                <Text style={styles.ctaText}>Try again</Text>
              </PuckButton>
              <PuckButton
                color={colors.surfaceElevated}
                height={48}
                borderRadius={14}
                lip={4}
                onPress={openContactSettings}
                style={styles.secondaryCta}
              >
                <Text style={styles.secondaryCtaText}>Open Settings</Text>
              </PuckButton>
              <PuckButton
                color={colors.surfaceElevated}
                height={48}
                borderRadius={14}
                lip={4}
                onPress={handleShareInvite}
                style={styles.secondaryCta}
              >
                <Text style={styles.secondaryCtaText}>Share invite link</Text>
              </PuckButton>
            </View>
          </View>
        ) : !contactsStarted ? (
          <View style={styles.body}>
            <BrandEmptyState
              icon="people-outline"
              title="Invite friends to MoneyBot"
              body="Share your invite link, or find friends already on the app from your contacts."
            />
            <View style={styles.ctaWrap}>
              <PuckButton
                color={colors.primary}
                height={48}
                borderRadius={14}
                lip={4}
                onPress={sync}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.ctaText}>Find friends from contacts</Text>
                )}
              </PuckButton>
              <PuckButton
                color={colors.surfaceElevated}
                height={48}
                borderRadius={14}
                lip={4}
                onPress={handleShareInvite}
                style={styles.secondaryCta}
              >
                <Text style={styles.secondaryCtaText}>Share invite link</Text>
              </PuckButton>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.shareRow}>
              <PuckButton
                color={colors.primary}
                height={44}
                borderRadius={12}
                lip={3}
                onPress={handleShareInvite}
                style={styles.shareBtn}
                contentStyle={styles.shareBtnInner}
              >
                <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                <Text style={styles.shareBtnText}>Share invite link</Text>
              </PuckButton>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search contacts"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <SectionList
              sections={sections}
              keyExtractor={(item, index) => (
                item.user_id ? String(item.user_id) : `${item.id}-${index}`
              )}
              renderSectionHeader={({ section: { title } }) => (
                <Text style={styles.sectionLabel}>{title}</Text>
              )}
              renderItem={({ item, section }) => (
                section.kind === 'onApp' ? renderOnApp(item) : renderInvite(item)
              )}
              ListEmptyComponent={(
                <BrandEmptyState
                  icon="people-outline"
                  title="No contacts with phone numbers"
                  body="Add phone numbers to your contacts, or share your invite link above. On the simulator, add test contacts in the Contacts app first."
                />
              )}
              contentContainerStyle={styles.list}
              stickySectionHeadersEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (colors, tabInset) => StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, paddingBottom: tabInset },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBody: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
    padding: 0,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: tabInset,
    flexGrow: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.2,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  actionTextMuted: {
    color: colors.textSecondary,
  },
  ctaWrap: {
    paddingHorizontal: 24,
    marginTop: 8,
    gap: 10,
  },
  secondaryCta: {
    marginTop: 0,
  },
  secondaryCtaText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  shareRow: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  shareBtn: {
    width: '100%',
  },
  shareBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  rebuildHint: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
