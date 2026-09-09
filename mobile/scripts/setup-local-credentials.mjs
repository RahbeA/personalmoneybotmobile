// Creates a fresh Apple Distribution certificate (from a locally-generated CSR,
// so we hold the private key) and App Store provisioning profiles for both the
// main app and the widget target. Saves the cert (DER) and both
// .mobileprovision files so we can build with credentialsSource: local.
import crypto from 'node:crypto';
import fs from 'node:fs';

const KEY_ID = process.env.EXPO_ASC_KEY_ID;
const ISSUER_ID = process.env.EXPO_ASC_ISSUER_ID;
const P8_PATH = process.env.EXPO_ASC_API_KEY_PATH;
const CSR_PATH = process.env.CSR_PATH || 'credentials/dist_local.csr';

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

async function api(path, opts = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const res = await fetch(`${API}${path}`, { ...opts, headers: { ...authHeaders, ...(opts.headers || {}) } });
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (res.ok) return json;
    // Apple 500s are flaky — retry.
    if (res.status >= 500 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    throw new Error(`${res.status} ${opts.method || 'GET'} ${path}\n${JSON.stringify(json, null, 2)}`);
  }
  throw new Error(`Exhausted retries for ${path}`);
}

async function main() {
  // 1. Create a new Apple Distribution certificate from our CSR.
  const csr = fs.readFileSync(CSR_PATH, 'utf8');
  let certId;
  let certContentB64;
  try {
    const created = await api('/certificates', {
      method: 'POST',
      body: JSON.stringify({
        data: { type: 'certificates', attributes: { certificateType: 'DISTRIBUTION', csrContent: csr } },
      }),
    });
    certId = created.data.id;
    certContentB64 = created.data.attributes.certificateContent;
    console.log(`+ Created DISTRIBUTION certificate id=${certId} serial=${created.data.attributes.serialNumber} exp=${created.data.attributes.expirationDate}`);
  } catch (e) {
    console.error('Certificate creation failed. Existing certs:');
    const certs = await api('/certificates?limit=200');
    for (const c of certs.data) {
      console.error(`  - ${c.attributes.certificateType} serial=${c.attributes.serialNumber} exp=${c.attributes.expirationDate} id=${c.id}`);
    }
    throw e;
  }

  fs.writeFileSync('credentials/dist_local.cer', Buffer.from(certContentB64, 'base64'));
  console.log('  saved credentials/dist_local.cer (DER)');

  // 2. Create App Store profiles for each target referencing the new cert.
  const outNames = {
    'com.moneybot.app': 'credentials/moneybot_appstore.mobileprovision',
    'com.moneybot.app.widgets': 'credentials/moneybot_widgets_appstore.mobileprovision',
  };
  for (const identifier of BUNDLE_IDS) {
    const bidRes = await api(`/bundleIds?filter[identifier]=${encodeURIComponent(identifier)}&limit=10`);
    const bid = (bidRes.data || []).find((b) => b.attributes.identifier === identifier);
    if (!bid) throw new Error(`Bundle id ${identifier} not registered.`);

    const name = `MoneyBot ${identifier} local ${new Date().toISOString().slice(0, 16)}`;
    const created = await api('/profiles', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'profiles',
          attributes: { name, profileType: 'IOS_APP_STORE' },
          relationships: {
            bundleId: { data: { type: 'bundleIds', id: bid.id } },
            certificates: { data: [{ type: 'certificates', id: certId }] },
          },
        },
      }),
    });
    fs.writeFileSync(outNames[identifier], Buffer.from(created.data.attributes.profileContent, 'base64'));
    console.log(`+ ${identifier}: profile "${created.data.attributes.name}" -> ${outNames[identifier]}`);
  }

  console.log('\nDone.');
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
