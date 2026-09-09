import crypto from 'node:crypto';
import fs from 'node:fs';

const KEY_ID = process.env.EXPO_ASC_KEY_ID;
const ISSUER_ID = process.env.EXPO_ASC_ISSUER_ID;
const P8_PATH = process.env.EXPO_ASC_API_KEY_PATH;
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
async function api(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${jwt}` } });
  const t = await res.text();
  return { status: res.status, json: t ? JSON.parse(t) : {} };
}

for (const id of ['com.moneybot.app', 'com.moneybot.app.widgets']) {
  const b = await api(`/bundleIds?filter[identifier]=${encodeURIComponent(id)}&include=bundleIdCapabilities&limit=5`);
  const data = b.json.data?.[0];
  console.log(`\n=== ${id} (bundleId id=${data?.id}) ===`);
  const caps = (b.json.included || []).filter((x) => x.type === 'bundleIdCapabilities');
  for (const c of caps) {
    console.log(`  cap: ${c.attributes.capabilityType}  settings=${JSON.stringify(c.attributes.settings)}`);
  }
  if (data?.id) {
    const ag = await api(`/bundleIds/${data.id}/appGroups`);
    console.log(`  appGroups relationship status=${ag.status}: ${JSON.stringify(ag.json.data || ag.json.errors || ag.json)}`);
  }
}

// Try to list all app groups on the account
const groups = await api('/appGroups?limit=50');
console.log(`\n=== /appGroups status=${groups.status} ===`);
console.log(JSON.stringify(groups.json.data || groups.json.errors || groups.json, null, 2));
