import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import { hashPhone } from './phoneHash';
import { socialApi } from '../api/social';

const MATCH_BATCH = 200;
const CONTACT_PAGE_SIZE = 500;
const OWN_PHONE_KEY = 'moneybot:ownPhoneHash';

export class ContactsNativeMissingError extends Error {
  constructor() {
    super('Contacts requires a dev build rebuild. Run: cd mobile && npx expo run:ios');
    this.code = 'CONTACTS_NATIVE_MISSING';
    this.name = 'ContactsNativeMissingError';
  }
}

function isContactsUnavailable(error) {
  return error?.code === 'ERR_UNAVAILABLE'
    || /UnavailabilityError|expo-contacts/i.test(error?.message || '');
}

export async function requestContactAccess() {
  if (!Contacts.getPermissionsAsync || !Contacts.requestPermissionsAsync) {
    throw new ContactsNativeMissingError();
  }
  try {
    const existing = await Contacts.getPermissionsAsync();
    if (existing.status === 'granted') return true;
    if (existing.status === 'denied' && !existing.canAskAgain) {
      return false;
    }
    const { status } = await Contacts.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    if (isContactsUnavailable(e)) throw new ContactsNativeMissingError();
    throw e;
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
  if (!Contacts.Contact?.getAllDetails) {
    throw new ContactsNativeMissingError();
  }

  const contacts = [];
  const seenIds = new Set();
  let offset = 0;

  while (true) {
    let batch;
    try {
      batch = await Contacts.Contact.getAllDetails(
        [
          Contacts.ContactField.PHONES,
          Contacts.ContactField.GIVEN_NAME,
          Contacts.ContactField.FAMILY_NAME,
          Contacts.ContactField.FULL_NAME,
        ],
        {
          limit: CONTACT_PAGE_SIZE,
          offset,
          sortOrder: Contacts.ContactsSortOrder.GivenName,
        },
      );
    } catch (e) {
      if (isContactsUnavailable(e)) throw new ContactsNativeMissingError();
      throw e;
    }

    if (!batch.length) break;

    for (const row of batch) {
      const id = String(row.id);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const phones = (row.phones || []).map((p) => p.number).filter(Boolean);
      if (!phones.length) continue;
      const name = (row.fullName || [row.givenName, row.familyName].filter(Boolean).join(' ')).trim() || 'Contact';
      contacts.push({ id, name, phones });
    }

    if (batch.length < CONTACT_PAGE_SIZE) break;
    offset += CONTACT_PAGE_SIZE;
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
