// Creates an App Store provisioning profile for the widget (and, if missing,
// the main app) via the App Store Connect API, referencing the account's
// active Apple Distribution certificate. This lets EAS build the widget target
// without needing interactive/cookie auth to create the profile itself.
import crypto from 'node:crypto';
import fs from 'node:fs';

const KEY_ID = process.env.EXPO_ASC_KEY_ID;
const ISSUER_ID = process.env.EXPO_ASC_ISSUER_ID;
const P8_PATH = process.env.EXPO_ASC_API_KEY_PATH;

const BUNDLE_IDS = ['com.moneybot.app', 'com.moneybot.app.widgets'];
const API = 'https://api.appstoreconnect.apple.com/v1';

function makeJwt() {
  const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' };
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const key = fs.readFileSync(P8_PATH, 'utf8');
  const sig = crypto.sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${sig.toString('base64url')}`;
}

const jwt = makeJwt();
const authHeaders = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...authHeaders, ...(opts.headers || {}) } });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${res.status} ${path}\n${JSON.stringify(json, null, 2)}`);
  }
  return json;
}

function normSerial(s) {
  return String(s || '').toUpperCase().replace(/^0+/, '');
}

async function main() {
  // 1. Find the active (non-expired) distribution certificate.
  const certs = await api('/certificates?limit=200');
  const now = Date.now();
  const distCerts = certs.data.filter((c) => {
    const t = c.attributes.certificateType;
    return (t === 'DISTRIBUTION' || t === 'IOS_DISTRIBUTION');
  });
  const active = distCerts
    .filter((c) => new Date(c.attributes.expirationDate).getTime() > now)
    .sort((a, b) => new Date(b.attributes.expirationDate) - new Date(a.attributes.expirationDate));

  console.log('Distribution certificates found:');
  for (const c of distCerts) {
    console.log(`  - ${c.attributes.certificateType} serial=${c.attributes.serialNumber} exp=${c.attributes.expirationDate} name="${c.attributes.name}" id=${c.id}`);
  }
  if (!active.length) throw new Error('No active (non-expired) distribution certificate found.');
  const cert = active[0];
  console.log(`\nUsing certificate: serial=${cert.attributes.serialNumber} exp=${cert.attributes.expirationDate} id=${cert.id}\n`);

  for (const identifier of BUNDLE_IDS) {
    // 2. Resolve the bundle id resource.
    const bidRes = await api(`/bundleIds?filter[identifier]=${encodeURIComponent(identifier)}&limit=10`);
    const bid = (bidRes.data || []).find((b) => b.attributes.identifier === identifier);
    if (!bid) {
      console.log(`!! Bundle id ${identifier} not registered on the portal — skipping.`);
      continue;
    }

    // 3. Check for an existing, valid App Store profile for this bundle id.
    const existing = await api(`/profiles?filter[profileType]=IOS_APP_STORE&limit=200&include=bundleId`);
    const match = (existing.data || []).find((p) => {
      const rel = p.relationships?.bundleId?.data?.id;
      return rel === bid.id
        && p.attributes.profileState === 'ACTIVE'
        && new Date(p.attributes.expirationDate).getTime() > now;
    });
    if (match) {
      console.log(`= ${identifier}: existing ACTIVE App Store profile "${match.attributes.name}" (id=${match.id}) — leaving as is.`);
      continue;
    }

    // 4. Create a fresh App Store profile referencing the active cert.
    const name = `MoneyBot ${identifier} AppStore ${new Date().toISOString().slice(0, 16)}`;
    const body = {
      data: {
        type: 'profiles',
        attributes: { name, profileType: 'IOS_APP_STORE' },
        relationships: {
          bundleId: { data: { type: 'bundleIds', id: bid.id } },
          certificates: { data: [{ type: 'certificates', id: cert.id }] },
        },
      },
    };
    const created = await api('/profiles', { method: 'POST', body: JSON.stringify(body) });
    console.log(`+ ${identifier}: created App Store profile "${created.data.attributes.name}" (id=${created.data.id})`);
  }

  console.log('\nDone. Provisioning profiles are ready on the Apple portal.');
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
