import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashPhone } from './phoneHash';
import { socialApi } from '../api/social';

const MATCH_BATCH = 200;
const CONTACT_PAGE_SIZE = 100;
const OWN_PHONE_KEY = 'moneybot:ownPhoneHash';

export class ContactsNativeMissingError extends Error {
  constructor() {
    super('Contacts is unavailable in this build. Update the app from the App Store.');
    this.code = 'CONTACTS_NATIVE_MISSING';
    this.name = 'ContactsNativeMissingError';
  }
}

let contactsModulePromise;

async function getContactsModule() {
  if (!contactsModulePromise) {
    contactsModulePromise = import('expo-contacts/legacy').catch(() => {
      contactsModulePromise = null;
      throw new ContactsNativeMissingError();
    });
  }
  return contactsModulePromise;
}

function hasContactsAccess(permission) {
  if (!permission) return false;
  if (permission.status === 'granted') return true;
  if (permission.accessPrivileges === 'limited') return true;
  return false;
}

export async function requestContactAccess() {
  const Contacts = await getContactsModule();
  if (!Contacts.getPermissionsAsync || !Contacts.requestPermissionsAsync) {
    throw new ContactsNativeMissingError();
  }
  try {
    const existing = await Contacts.getPermissionsAsync();
    if (hasContactsAccess(existing)) return true;
    if (existing.status === 'denied' && !existing.canAskAgain) {
      return false;
    }
    const requested = await Contacts.requestPermissionsAsync();
    return hasContactsAccess(requested);
  } catch (e) {
    if (e instanceof ContactsNativeMissingError) throw e;
    throw new ContactsNativeMissingError();
  }
}

export async function openContactSettings() {
  try {
    await Linking.openSettings();
  } catch {
    // no-op
  }
}

export async function loadDeviceContacts() {
  const Contacts = await getContactsModule();
  if (!Contacts.getContactsAsync) {
    throw new ContactsNativeMissingError();
  }

  const contacts = [];
  const seenIds = new Set();
  let pageOffset = 0;

  while (true) {
    let data = [];
    let hasNextPage = false;
    try {
      const page = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
        ],
        pageSize: CONTACT_PAGE_SIZE,
        pageOffset,
      });
      data = page.data || [];
      hasNextPage = !!page.hasNextPage;
    } catch {
      break;
    }

    if (!data.length) break;

    for (const row of data) {
      const id = String(row.id);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const phones = (row.phoneNumbers || []).map((p) => p.number).filter(Boolean);
      if (!phones.length) continue;
      const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || 'Contact';
      contacts.push({ id, name, phones });
    }

    if (!hasNextPage) break;
    pageOffset += CONTACT_PAGE_SIZE;
  }

  contacts.sort((a, b) => a.name.localeCompare(b.name));
  return contacts;
}

export async function indexContactHashes(contacts) {
  const hashToContactIds = new Map();
  for (const contact of contacts) {
    for (const phone of contact.phones) {
      const digest = await hashPhone(phone);
      if (!digest) continue;
      if (!hashToContactIds.has(digest)) hashToContactIds.set(digest, new Set());
      hashToContactIds.get(digest).add(contact.id);
    }
  }
  return {
    hashToContactIds,
    hashes: [...hashToContactIds.keys()],
  };
}

async function matchHashBatches(token, hashes) {
  const matched = [];
  for (let i = 0; i < hashes.length; i += MATCH_BATCH) {
    const batch = hashes.slice(i, i + MATCH_BATCH);
    const res = await socialApi.matchContacts(token, batch);
    matched.push(...(res.results || []));
  }
  return matched;
}

export async function syncContactsWithApp(token, contacts) {
  const { hashToContactIds, hashes } = await indexContactHashes(contacts);
  const onApp = hashes.length ? await matchHashBatches(token, hashes) : [];

  const matchedContactIds = new Set();
  for (const user of onApp) {
    const ids = hashToContactIds.get(user.phone_hash);
    if (!ids) continue;
    ids.forEach((id) => matchedContactIds.add(id));
  }

  const toInvite = contacts.filter((contact) => !matchedContactIds.has(contact.id));
  return { onApp, toInvite };
}

export async function getStoredOwnPhoneHash() {
  try {
    return await AsyncStorage.getItem(OWN_PHONE_KEY);
  } catch {
    return null;
  }
}

export async function registerOwnPhoneHash(token, rawPhone) {
  const digest = await hashPhone(rawPhone);
  if (!digest) {
    throw new Error('Enter a valid phone number.');
  }
  await socialApi.registerPhoneHash(token, digest);
  await AsyncStorage.setItem(OWN_PHONE_KEY, digest);
  return digest;
}
