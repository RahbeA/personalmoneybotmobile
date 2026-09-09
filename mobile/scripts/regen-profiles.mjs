// Regenerates App Store provisioning profiles for both targets against our
// existing local distribution certificate. Run this AFTER App Groups has been
// enabled + assigned on the bundle IDs in the Developer portal so the fresh
// profiles include the com.apple.security.application-groups entitlement.
import crypto from 'node:crypto';
import fs from 'node:fs';

const KEY_ID = process.env.EXPO_ASC_KEY_ID;
const ISSUER_ID = process.env.EXPO_ASC_ISSUER_ID;
const P8_PATH = process.env.EXPO_ASC_API_KEY_PATH;
const CERT_ID = process.env.CERT_ID; // our local cert (dist_local.p12)

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

async function api(path, opts = {}, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const res = await fetch(`${API}${path}`, { ...opts, headers: { ...authHeaders, ...(opts.headers || {}) } });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (res.ok) return json;
    if (res.status >= 500 && attempt < retries) { await new Promise((r) => setTimeout(r, 3000)); continue; }
    throw new Error(`${res.status} ${opts.method || 'GET'} ${path}\n${JSON.stringify(json, null, 2)}`);
  }
  throw new Error(`Exhausted retries for ${path}`);
}

async function main() {
  if (!CERT_ID) throw new Error('Set CERT_ID env to the local distribution certificate id.');

  const outNames = {
    'com.moneybot.app': 'credentials/moneybot_appstore.mobileprovision',
    'com.moneybot.app.widgets': 'credentials/moneybot_widgets_appstore.mobileprovision',
  };

  for (const identifier of BUNDLE_IDS) {
    // Exact-match the bundle id resource.
    const bidRes = await api(`/bundleIds?filter[identifier]=${encodeURIComponent(identifier)}&include=bundleIdCapabilities&limit=20`);
    const bid = (bidRes.data || []).find((b) => b.attributes.identifier === identifier);
    if (!bid) throw new Error(`Bundle id ${identifier} not found (exact match).`);

    const caps = (bidRes.included || []).filter((x) => x.type === 'bundleIdCapabilities')
      .map((c) => c.attributes.capabilityType);
    const hasAppGroups = caps.includes('APP_GROUPS');
    console.log(`${identifier} (id=${bid.id}) caps=[${caps.join(', ')}] appGroups=${hasAppGroups ? 'YES' : 'NO'}`);
    if (!hasAppGroups) {
      throw new Error(`APP_GROUPS is NOT enabled on ${identifier}. Enable + assign group.com.moneybot.app in the Developer portal first.`);
    }

    // Delete any prior profiles for this bundle id so names don't collide and
    // stale ones don't get picked up.
    const existing = await api(`/profiles?filter[profileType]=IOS_APP_STORE&limit=200&include=bundleId`);
    for (const p of existing.data || []) {
      if (p.relationships?.bundleId?.data?.id === bid.id) {
        try { await api(`/profiles/${p.id}`, { method: 'DELETE' }); console.log(`  deleted old profile ${p.attributes.name}`); } catch (e) { console.log(`  (could not delete ${p.id}: ${e.message.split('\n')[0]})`); }
      }
    }

    const name = `MoneyBot ${identifier} AG ${new Date().toISOString().slice(0, 16)}`;
    const created = await api('/profiles', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'profiles',
          attributes: { name, profileType: 'IOS_APP_STORE' },
          relationships: {
            bundleId: { data: { type: 'bundleIds', id: bid.id } },
            certificates: { data: [{ type: 'certificates', id: CERT_ID }] },
          },
        },
      }),
    });
    fs.writeFileSync(outNames[identifier], Buffer.from(created.data.attributes.profileContent, 'base64'));
    console.log(`+ ${identifier}: profile "${created.data.attributes.name}" -> ${outNames[identifier]}`);
  }
  console.log('\nProfiles regenerated with App Groups entitlement.');
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
