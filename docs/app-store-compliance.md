# App Store Compliance Checklist

Use this checklist when submitting MoneyBot to the Apple App Store to avoid common rejections.

## Before You Submit

### 1. Host legal pages on your website

Upload the HTML files in `docs/legal/` to getmoneybot.com:

- `https://getmoneybot.com/privacy` ← `privacy-policy.html`
- `https://getmoneybot.com/terms` ← `terms-of-service.html`

Apple requires a **publicly accessible Privacy Policy URL** in App Store Connect.

### 2. App Store Connect metadata

| Field | Value |
|-------|-------|
| Privacy Policy URL | `https://getmoneybot.com/privacy` |
| Support URL | `https://getmoneybot.com` |
| Support email | `kahlil@getmoneybot.com` |

### 3. Privacy Nutrition Labels (App Store Connect)

Declare the following data types collected by MoneyBot:

| Category | Data types | Purpose | Linked to user? |
|----------|-----------|---------|-----------------|
| Contact Info | Email address, Name | App functionality, Account management | Yes |
| User Content | Other user content (chat messages) | App functionality | Yes |
| Identifiers | User ID | App functionality | Yes |
| Usage Data | Product interaction (course progress, XP) | App functionality | Yes |

**Not collected:** location, contacts, photos, browsing history, financial info, health data, advertising data.

**Third-party data sharing:** OpenAI receives chat messages for AI features. Google/Apple receive auth data when users choose those sign-in methods.

### 4. Sign in with Apple (Guideline 4.8)

Because MoneyBot offers Google Sign-In, **Sign in with Apple is required on iOS**. This is implemented in the app. Before submitting:

1. In [Apple Developer](https://developer.apple.com), enable **Sign in with Apple** capability for App ID `com.moneybot.app`.
2. Rebuild the iOS app after enabling: `cd mobile && npx expo run:ios`
3. Test Sign in with Apple on a real device or simulator signed into iCloud.

### 5. Account deletion (Guideline 5.1.1)

Already implemented: **Settings → Delete Account** permanently removes the user and all associated data.

### 6. Age rating

MoneyBot is educational content for ages **13+**. Set the App Store age rating accordingly (likely 4+ or 9+ depending on questionnaire answers — no mature content).

### 7. Export compliance

MoneyBot uses standard HTTPS encryption only. In App Store Connect, answer **No** to "Does your app use encryption?" (or Yes with exempt status for standard TLS).

### 8. AI / educational disclaimer

Review notes for App Review (optional but helpful):

> MoneyBot is a financial literacy education app. AI Tutor and Money Chat provide general educational information only — not personalized financial advice. Users must accept Terms of Service acknowledging this at registration.

## In-App (already implemented)

- [x] Privacy Policy (Settings + Auth + Landing)
- [x] Terms of Service (Settings + Auth + Landing)
- [x] Terms acceptance checkbox on registration
- [x] Contact email displayed (`kahlil@getmoneybot.com`)
- [x] Sign in with Apple on iOS
- [x] Delete Account in Settings
- [x] iOS Privacy Manifest (`UserDefaults` for theme preference)

## Backend setup

Ensure production `.env` includes:

```
APPLE_CLIENT_IDS=com.moneybot.app
```

Run migrations after pulling:

```bash
cd backend && python manage.py migrate
```

## Rebuild required

Sign in with Apple and the privacy manifest require a **native rebuild**, not Expo Go:

```bash
cd mobile
npx expo install expo-apple-authentication
npx expo run:ios
```

Then archive and upload via Xcode or EAS Build for App Store submission.
