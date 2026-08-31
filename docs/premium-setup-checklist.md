# MoneyBot Premium — setup checklist (for leadership)

Send this to whoever owns **Apple Developer**, **App Store Connect**, and billing. The engineering team needs these items before in-app subscriptions go live.

**App:** MoneyBot iOS (`com.moneybot.app`)  
**What users buy:** MoneyBot Premium (unlocks extra characters, Tutor voices, premium shop items)  
**How we charge:** Apple In-App Subscription → **RevenueCat** (middle layer) → our backend

---

## What you need to do (in order)

### 1. Apple Developer Program

| Item | What to provide |
|---|---|
| **Apple Developer account** | Active enrollment ($99/year) at [developer.apple.com](https://developer.apple.com) |
| **Team name + Team ID** | Settings → Membership → **Team ID** (10 characters, e.g. `AB12CD34EF`) |
| **App Store Connect access** | Invite engineering with **Admin** or **App Manager** on the MoneyBot app |

---

### 2. App Store Connect — subscription products

Create **two auto-renewable subscriptions** in App Store Connect → MoneyBot → **Subscriptions**.

| Product | Suggested product ID | Suggested price (US) | Notes |
|---|---|---|---|
| Monthly Premium | `moneybot_premium_monthly` | **$6.99 / month** | Standard tier |
| Yearly Premium | `moneybot_premium_yearly` | **$39.99 / year** | Best value (~$3.33/mo) |

Also create a **Subscription Group** (e.g. `MoneyBot Premium`) and put both products in it.

**Send us:**
- Exact **Product IDs** (if different from above)
- Screenshot or export showing both products **Ready to Submit**
- **Subscription Group ID** name

**Apple requirements (non-technical):**
- App must have **Privacy Policy** and **Terms** URLs (we already host these)
- Subscriptions need a **review screenshot** and short description in App Store Connect
- A **Sandbox tester** Apple ID for QA (App Store Connect → Users and Access → Sandbox)

---

### 3. RevenueCat account (subscription backend)

Sign up at [app.revenuecat.com](https://app.revenuecat.com) (free tier is fine to start).

**Send us:**

| Credential | Where to find it | Who uses it |
|---|---|---|
| **RevenueCat Public iOS SDK Key** | Project → API keys → **Apple (public)** | Mobile app (safe in app config) |
| **RevenueCat Secret API Key** | Same page → **Secret** | Backend only — **never email in plain text; use 1Password / secure share** |
| **Webhook authorization secret** | Project → Integrations → Webhooks | Backend verifies purchase events |

**Configure in RevenueCat dashboard:**
1. **Apps** → add iOS app with bundle ID `com.moneybot.app`
2. Link **App Store Connect** (RevenueCat walks through Shared Secret / App Store Connect API key)
3. **Products** → import the two subscription product IDs from step 2
4. **Entitlements** → create entitlement named exactly: **`premium`**
5. Attach both products to the `premium` entitlement
6. **Offerings** → create default offering (e.g. `default`) with **Monthly** and **Annual** packages

**Send us:**
- Confirmation that entitlement is named **`premium`**
- Default **Offering ID** (usually `default`)

---

### 4. App Store Connect API key (for RevenueCat ↔ Apple)

RevenueCat needs read access to validate receipts.

In App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API**:

| Item | Notes |
|---|---|
| **Issuer ID** | UUID at top of API keys page |
| **Key ID** | When you generate a key |
| **Private key (.p8 file)** | Download once — store securely; give to whoever sets up RevenueCat |

Role: **App Manager** or **Admin** on the key is typical.

---

### 5. Paid Applications Agreement & banking

Subscriptions **will not work** until this is complete in App Store Connect:

- [ ] **Paid Applications Agreement** signed (Agreements, Tax, and Banking)
- [ ] **Bank account** and **tax forms** on file

Check: App Store Connect → **Business** → agreements show **Active**.

---

### 6. What engineering will configure (you do not need to do this)

Once you send the items above, dev will:

1. Add RevenueCat iOS key to `mobile/.env` as `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
2. Add RevenueCat webhook on our Django backend to set `is_premium` on the user after Apple confirms payment
3. Ship a new iOS build through TestFlight, then App Store
4. Test with a **Sandbox Apple ID** before real money

---

## Copy-paste email template for your boss

```
Subject: MoneyBot Premium — credentials needed for App Store subscriptions

We’re ready to turn on MoneyBot Premium (in-app subscription). I need the following:

1. Apple Developer
   - Confirm our Apple Developer Program is active
   - Team ID: ___________
   - App Store Connect login with permission to manage Subscriptions for MoneyBot

2. App Store Connect — create two subscriptions in one group:
   - moneybot_premium_monthly — $6.99/month
   - moneybot_premium_yearly — $39.99/year
   Send back the final Product IDs when created.

3. RevenueCat (app.revenuecat.com)
   - Create a project for MoneyBot iOS (bundle com.moneybot.app)
   - Create entitlement named: premium
   - Send engineering the Public iOS SDK key (secure channel)
   - Send engineering the Secret API key + webhook secret (1Password only)

4. App Store Connect API key for RevenueCat (.p8 + Key ID + Issuer ID)

5. Confirm Paid Applications Agreement + banking/tax are Active in App Store Connect

6. Create one Sandbox tester Apple ID for testing before launch

Timeline: once we have items 2–4, engineering can wire this in ~1–2 days and TestFlight QA can start.
```

---

## Optional (Android later)

| Item | Notes |
|---|---|
| Google Play Console account | One-time $25 |
| Play subscription product IDs | Mirror monthly/yearly |
| RevenueCat **Android public key** | `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` |

iOS first is fine; Android can follow the same pattern.

---

## FAQ

**Do we need Stripe for the mobile app?**  
No. iOS subscriptions go through Apple. Stripe on the website is separate (teacher billing).

**Why RevenueCat?**  
Apple receipt validation, restore purchases, and webhooks are painful to build by hand. RevenueCat handles that and tells our server when someone is Premium.

**What if we only have Apple credentials but not RevenueCat yet?**  
The paywall shows “coming soon” until the RevenueCat public key is in place. Admin can still toggle Premium on a user for QA.

**How do we test without charging real money?**  
Use a Sandbox Apple ID in TestFlight or Xcode. Purchases are fake but behave like production.

---

## Checklist summary

- [ ] Apple Developer Program active  
- [ ] Two subscription products created in App Store Connect  
- [ ] Paid Applications Agreement + banking active  
- [ ] RevenueCat project with `premium` entitlement  
- [ ] Public iOS SDK key → engineering  
- [ ] Secret key + webhook secret → engineering (secure)  
- [ ] App Store Connect API key linked in RevenueCat  
- [ ] Sandbox tester account for QA  

When all boxes are checked, send credentials to the dev team and reference Jira **DEV-594**.
