# MoneyBot mobile sprint prompts

Copy-paste prompts for **mobile app** tickets from:

- June Week -5
- Aug Week -1
- Aug Week -3
- Aug Week -4

Jira project: [DEV](https://getmoneybot.atlassian.net/jira/software/projects/DEV/boards/1)

## How to use

1. Open a **new Cursor chat** in this repo.
2. Copy **Shared agent preamble** (once).
3. Copy the **one ticket prompt** you want to build.
4. Paste both into the chat and send.

Do not paste two tickets into the same chat. One ticket per chat.

These prompts are only for the **Expo mobile app** (`mobile/`) plus the Django API when the feature needs a backend. They are not for the teacher site, landing page, or MoneyHub.

---

## Shared agent preamble

```text
You are implementing a MoneyBot mobile feature in this repo.

Stack
- App: Expo SDK 56, React Native, JavaScript (not TypeScript) under mobile/
- Navigation: React Navigation tabs + native stacks in mobile/src/navigation/MainTabNavigator.js
- Theme: useTheme() from mobile/src/context/ThemeContext.js. Support dark and light. Never hardcode a one-off palette.
- Brand colors already exist: primary green #3DDC5F / #16A34A, Bot Bucks gold #F5B72B, streak orange #FF6B35. Use those.
- Backend: Django + DRF under backend/. Mobile talks to it through mobile/src/api/*.js and mobile/src/config/api.js.

Visual / UX style (match the app as it is now)
- Screens sit on LinearGradient colors.bgGradient with SafeAreaView + StatusBar.
- Page titles use BrandHeader from mobile/src/components/brand.
- Avatars use BrandAvatar. Loaders use BrandLoader. Empty states use BrandEmptyState.
- Primary taps use PuckButton (Duolingo-style raised face + darker lip that presses in). Default lip is 7. Do not invent a new button system.
- Cards / docks use colors.surfaceElevated, 1px colors.border, large radii (18–24).
- Icons: Ionicons. Type: heavy weights (700/800) for titles, letterSpacing slightly negative on big titles.
- Copy is short, friendly, and teen-finance. Reuse voice from mobile/src/constants/brandCopy.js and OnboardingScreen.js. No corporate SaaS tone.
- Guests can browse learning. Buying, equipping, friends, and similar actions go through requireAccount() from mobile/src/utils/requireAccount.js.

Architecture rules
- Reuse existing screens, contexts, and API modules. Do not add a new tab unless the ticket truly needs one.
- UserProgressContext, AuthContext, NotificationsContext are the state hubs. Do not create a parallel store.
- Cache with mobile/src/utils/apiCache.js (fetchWithCache / invalidateCache). Do not leave stale catalogs after writes.
- New media URLs from the API must be https in production.
- Follow Expo v56 docs: https://docs.expo.dev/versions/v56.0.0/
- Keep diffs tight. No drive-by refactors, no new markdown files, no unrelated UI rewrites.
- If the feature needs data, add Django models + serializers + views and wire the mobile API client. Do not fake it with only local mocks.

When you finish
- List the files you changed.
- Say how to verify in the simulator (and admin panel if you added backend).
```

---

## June Week -5

### DEV-535 — Feeds concept for the Mobile App

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-535)

```text
Build DEV-535: an Instagram-style financial education Feed in the MoneyBot Expo app.

Product
- Users can view a vertical feed of short financial-education posts (image + caption, optional link).
- Users can create a post from the app (photo from camera roll + caption).
- Posts do not go live until an admin approves them. Rejected posts never appear in the feed.
- Moderation criteria: financial-education only, safe, not sexual/harmful.
- Future automated moderation is out of scope. Ship manual admin review now.

Where to put it
- Mobile: new Feed screen. Prefer a stack screen from Social or Home, not a 6th tab, unless a tab is clearly necessary.
- Reuse BrandHeader, PuckButton, BrandEmptyState, BrandLoader, LinearGradient.
- Guest: they can view approved posts. Creating a post requires requireAccount().
- Admin: add a Feed moderation page next to existing web/src/pages (Characters, Notifications, etc.) with approve/reject, preview, author, timestamp.
- Backend: Django app or moneyverse/social models for FeedPost (author, image, caption, status=pending|approved|rejected, created_at). Authenticated list of approved posts. Create endpoint. Admin-only moderate endpoint.

Do not
- Do not clone Instagram stories, DMs, or likes in v1 unless needed for a complete feed.
- Do not bypass moderation.
- Do not restyle the rest of Social/Home.

Acceptance
- Approved posts show in the app feed.
- A newly uploaded post stays pending until an admin approves it in the control panel.
- Rejected posts disappear from the author’s pending list and never hit the public feed.
```

### DEV-536 — WhatsApp invite concept

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-536)

```text
Build DEV-536: WhatsApp-style contact sync + invite in the MoneyBot Expo app.

Product
- With permission, sync phone contacts.
- Split the list: already on MoneyBot vs not on MoneyBot.
- Already on MoneyBot: show as people you can add/friend (reuse socialApi + BrandAvatar).
- Not on MoneyBot: one-tap Invite that sends the existing invite share message with the user’s personal code + App Store URL from brandCopy.js / MyInvitesScreen.js.
- Prefer SMS / the system share sheet. WhatsApp if the device has it, but do not require WhatsApp.

Existing code to extend
- mobile/src/screens/MyInvitesScreen.js — invite codes and share copy
- mobile/src/screens/social/InviteFriendsScreen.js — friend picking
- mobile/src/screens/social/MyFriendsScreen.js
- backend invite models (already live)

Permissions
- expo-contacts (Expo 56). Explain why we need contacts if denied. Never crash on deny.
- Do not upload the full address book to the server. Hash/normalize phones and match only what you need.

Acceptance
- User can see which contacts are already on MoneyBot.
- Invite for a non-user opens a share/SMS sheet that includes their invite code.
- Works for guests only after requireAccount().
```

### DEV-538 — Improving Smart goals for the mobile app

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-538)

```text
Build DEV-538: iterate Smart Goals in the MoneyBot Expo app. Goals already exist — do not rebuild from scratch.

What already exists
- Goal catalog: mobile/src/constants/goals.js (emergency_fund, pay_off_debt, start_investing, budget_better, boost_credit, save_big_goal)
- Picked during OnboardingScreen.js and saved as UserStats.onboarding_goals
- Editable later in Settings
- Backend: courses/views.py saves onboarding_goals

What to ship now
- A Goals section on Profile/Settings that feels like Home cards (PuckButton, surfaceElevated, BrandHeader patterns).
- Progress: simple, honest milestones (e.g. lessons completed in that category, streak, Bot Bucks) — not a fake 0–100 bar with no data.
- Milestone nudge: reuse NotificationsContext / existing notification kinds. Do not spam. Cap frequency.
- Completion should feel rewarding (BrandToast or the existing DailyClaimCelebration energy), not a modal maze.
- Optional: one AI-suggested next goal from the user’s onboarding answers, shown as a suggestion chip they can tap to add. If you add AI, use the existing tutor/OpenAI backend, not a new vendor.

Acceptance
- User can view, add, remove goals after onboarding.
- Progress reflects real UserProgressContext / stats data.
- Visuals match Home/Settings, not a new “goals product” look.
```

---

## Aug Week -1

### DEV-423 — Re-tap tab icon scrolls to top (Instagram)

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-423)

```text
Build DEV-423: Instagram-style tab re-tap.

When the user taps the already-selected tab icon in CustomTabBar (mobile/src/navigation/MainTabNavigator.js):
- If that tab’s stack is nested (e.g. CharacterDetail, Notifications), pop to the tab root.
- If already on the tab root, scroll that screen to the top (Home, Leaderboard, Moneyverse strip, Tutor thread, Profile).

Implementation notes
- Do not unmount the tab.
- Use a small event/ref pattern (navigation emit, or a TabReselect context) so HomeScreen’s ScrollView, Leaderboard FlatList, etc. can scrollTo({ y: 0 }).
- Moneyverse: jump the FeaturedCharacter strip/index only if that is the natural “top”; do not reset purchase state.
- Keep the custom tab bar look. Do not replace it with the default React Navigation tab bar.

Acceptance
- First tap on another tab switches tabs.
- Second tap on the active tab pops nested screens, then scrolls to top.
- No flicker and no extra splash.
```

### DEV-571 — Unlock all the Badges on the Mobile App

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-571)

```text
Build DEV-571: every badge in the catalog must be earnable and visible on mobile.

What already exists
- HomeScreen shows badgeCatalog (locked at 0.35 opacity) and earned badges
- BadgeRevealScreen, BadgeIcon
- Backend badge catalog + evaluate_and_award in courses/badges.py
- Admin can manage badges on the web panel

Do this
- Audit backend badge rules vs what the app actually does (lessons, streaks, daily reward, money chat, friends, characters).
- Any catalog badge with no evaluator is a bug: add a real unlock condition or hide it from the mobile catalog.
- Locked badges should still be tappable and open BadgeReveal in locked/preview mode with a plain-language “How to earn” line.
- Do NOT secretly grant every badge to every user. “Unlock all” means all badges are achievable, not cheated.

Acceptance
- Home badge row shows the full catalog.
- Completing the documented action awards that badge without an app restart (same optimistic overlay pattern as lesson completion).
- Locked vs earned is obvious.
```

### DEV-573 — Nudge to a friend on Mobile App

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-573)

```text
Build DEV-573: polish friend nudge on mobile.

What already exists
- MyFriendsScreen and UserProfileSheet already send a nudge push (“will get a push to hop back on MoneyBot”).
- Backend social service + notifications.

Do this
- Make nudge a first-class, obvious action (PuckButton, not a buried alert-only flow).
- Copy should sound like MoneyBot, include the sender’s first name, and deep-link into the app (Friends / Home) when the friend taps the push.
- Rate-limit: one nudge per friend per day. Show a disabled/cooldown state instead of an error dump.
- Guests: requireAccount().
- Reuse NotificationsContext and existing push registration. Do not add a second push pipeline.

Acceptance
- From Friends and from a profile sheet I can nudge.
- Friend receives a push (or in-app notification if push is off).
- Second nudge the same day is blocked with friendly UI.
```

### DEV-574 — Sharing App to a different social Media platform

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-574)

```text
Build DEV-574: share MoneyBot to other social apps from mobile.

What already exists
- MyInvitesScreen share message (invite code + App Store URL, message-only so iMessage keeps the code)
- APP_STORE_URL in mobile/src/constants/brandCopy.js

Do this
- Add a Share MoneyBot action on Profile and on My Invites.
- Use the system Share sheet (React Native Share / Expo Sharing) so the user can pick Messages, WhatsApp, Instagram, Snapchat, etc.
- Keep the current copy pattern: invite code stays in the message body. Do not pass a separate url field that strips the code in iMessage.
- Optional extras: share streak or a badge image only if you can do it with existing assets and PuckButton UI. Do not block the ticket on custom Instagram stories.

Acceptance
- Share sheet opens from Profile and My Invites.
- Shared text includes the user’s invite code and the App Store link.
- No crash if the user dismisses the sheet.
```

### DEV-576 — Differentiating Free vs Premium features

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-576)

```text
Build DEV-576: clearly separate Free vs Premium in the MoneyBot Expo app. Do not implement payments here (that is DEV-594). Ship the gating + UI.

Proposed split (adjust only if product already decided otherwise)
- Free: lessons, daily puzzle, daily reward, starter character, invite, basic tutor.
- Premium: extra Moneyverse characters / hats, extra tutor personalities (DEV-656), advanced games, or an ad-free flag. Pick a small real set that already exists in the app. Do not invent five new premium products.

UI
- A compact Premium badge / lock on gated cards (Moneyverse detail, Tutor, Arcade).
- Locked tap opens a bottom sheet or BrandEmptyState-style panel: what they get + a single PuckButton CTA (“Coming soon” or “Upgrade” placeholder that you can later hook to RevenueCat).
- Guest vs free vs premium must not be confused. Guests still use requireAccount() first.

Backend
- Add a simple is_premium (or plan) on User/UserStats. Default false. Admin can toggle it so you can QA.
- Mobile reads it from getStats and caches it with the existing progress cache (invalidate on change).

Acceptance
- A free user sees locks on the gated surfaces.
- An admin-flagged premium user does not.
- No Stripe/RevenueCat work in this ticket.
```

### DEV-579 — Add Hats to the ItemShop

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-579)

```text
Build DEV-579: hats in the Moneyverse item shop on mobile.

Moneyverse today
- Characters only: Character model, preview_image, FeaturedCharacter, CharacterDetailScreen, purchase/equip via moneyverse API.
- Admin Characters page + GLB preview pipeline.

Do this
- Treat hats as cosmetic items, not full characters. New model (Hat or Item): name, price, preview image, optional GLB, is_active, order.
- User can own/equip one hat. Equipped hat is visible on BrandAvatar / character poster if you can do it cleanly (image overlay is OK for v1; do not block on 3D hat rigging).
- Shop UI: extend MoneyverseScreen / FeaturedCharacter with a Hats filter or a second strip. Same rarity/price/PuckButton language as characters.
- Admin: simple CRUD on the web panel (image upload is enough for v1). DEV-663 (hats in admin) is related — implement the minimum admin needed to stock hats.

Acceptance
- User can buy a hat with Bot Bucks and equip it.
- Equipped hat shows on Profile avatar and Home header avatar.
- Guest cannot buy (requireAccount).
```

### DEV-594 — Mobile App Monetization

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-594)

```text
Build DEV-594: in-app purchases for the MoneyBot Expo app via RevenueCat. Coordinate with existing Stripe-on-web plans but do not replace Stripe for the teacher site.

Scope
- Expo 56 + RevenueCat (react-native-purchases). iOS first (App Store). Android hook is OK if cheap.
- One premium subscription (monthly) that flips the same is_premium flag used by DEV-576. If DEV-576 is not done, add that flag here.
- Restore purchases on Profile.
- Server must verify entitlements. Do not trust the client boolean alone. Webhook or RevenueCat REST check from Django.

UI
- Paywall as a screen or sheet using BrandHeader, PuckButton, existing gold/green. No generic RevenueCat default UI.
- Entry points: Profile, locked Moneyverse/Tutor CTAs.

Do not
- Do not put real product IDs in git if they are secrets; use env / extra in app.json.
- Do not mix Bot Bucks IAP and subscription in v1 unless already decided. Subscription only.

Acceptance
- Sandbox purchase upgrades the account.
- Restore works.
- Backend stats/me reports is_premium after purchase.
```

### DEV-604 — Onboarding Issues

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-604)

The Jira description is only a screenshot. Inspect the live flow and fix real bugs.

```text
Build DEV-604: fix onboarding bugs in the MoneyBot Expo app.

Current flow lives in mobile/src/screens/OnboardingScreen.js
Phases include greet, goals, questions, calculating, reveal, reward, streak, notifications, character.
It uses MoneyBotGuide, TypewriterText, BrandAvatar, GOALS, notification permission helpers, then claimStarterCharacter.

Do this
1. Run through onboarding on iOS simulator as a brand-new user (invite code if required).
2. Fix anything broken: stuck phases, buttons under the home indicator, keyboard covering inputs, notification permission skipped/crash, starter character not granting, “continue” not advancing, copy overflow, light-theme contrast.
3. NameCapturePrompt / display name should work (DEV-505 is already Done — don’t regress it).
4. After onboarding, user should land on Home with pendingMoneyverseIntro / starter equipped, matching the existing 1.0.5 behavior.
5. Keep the chill MoneyBot voice. Do not redesign the whole onboarding.

Acceptance
- A new user can finish onboarding without a dead end.
- Starter character is owned + equipped.
- Notification pref screens don’t crash if permission is denied.
- List the bugs you found and fixed.
```

---

## Aug Week -3

### DEV-653 — Setup PostHog for the Mobile (Analytics)

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-653)

```text
Build DEV-653: PostHog analytics on the MoneyBot Expo app.

Use posthog-react-native (Expo 56 compatible). Init once at app root (mobile/App.js) after privacy constraints.

Events (minimum)
- app_opened
- signup_succeeded / login_succeeded (include method: apple|google|email, not PII beyond distinct id)
- onboarding_completed
- lesson_started / lesson_completed
- daily_puzzle_completed
- character_purchased / character_equipped
- invite_shared
- paywall_viewed (if present)

Rules
- Identify with the backend user id after login. Reset on logout.
- Guests: anonymous id only.
- Do not send message bodies, invite codes, emails, or GLB URLs.
- API key from env / app config extra, not hardcoded if it is a secret.
- Autocapture is optional; prefer explicit events so the dashboard stays clean.

Acceptance
- A lesson complete in the simulator shows up in PostHog.
- Logout clears identity.
```

### DEV-654 — Notifications Management — Not Working

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-654)

```text
Build DEV-654: make mobile notifications actually work end-to-end.

What already exists
- mobile/src/context/NotificationsContext.js (poll + Expo push token register)
- mobile/src/utils/notifications.js (daily/streak local schedules, rotating copy)
- mobile/src/screens/social/NotificationsScreen.js
- Onboarding + Settings permission prefs
- Admin Notifications campaigns on the web panel
- backend social/push.py

Do this
1. Trace a campaign from admin → backend → Expo push → device → in-app list → tap navigation.
2. Fix the break (token not saved, guests skipped incorrectly, iOS permission, Android channel, payload missing data, tap handler, unread badge).
3. Settings must let the user toggle daily / streak / product notifications and actually cancel/reschedule via syncNotificationSchedule.
4. In-app NotificationsScreen should show admin campaigns and social events, mark read, and deep-link.

Acceptance
- Sending a test campaign from the control panel appears on a logged-in iOS device/simulator with push allowed.
- Toggling a pref off stops that local reminder.
- Denied permission does not crash and explains how to enable in iOS Settings.
```

### DEV-656 — Making chatbot sound like a human (Mobile)

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-656)

```text
Build DEV-656 for the Expo app (Tutor + Money Chat). Student website is out of scope unless you need a shared backend prompt.

Product
- MoneyBot can speak in presets: Coach (uplifting), Funny, Straight-up teacher, Chill friend (default, current voice).
- User picks a personality on Tutor (and Money Chat uses the same preference).
- Better formatting in bubbles: short paragraphs, bold key terms, lists when it helps. Reuse MessageBubble / MessageText; don’t dump markdown garbage.

Backend
- Persist personality on UserStats or a small preference endpoint.
- Pass it into the existing OpenAI system prompt in backend AI views. Do not add a second model provider.
- Keep answers accurate for teen personal finance. Funny ≠ wrong.

UI
- Preset chips or a PuckButton sheet on TutorScreen. Match chat UI already in mobile/src/components/chat/.

Acceptance
- Switching to Funny changes subsequent replies.
- Preference survives app restart.
- Default remains the current chill MoneyBot voice.
```

### DEV-657 — ProgressBar using Animations

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-657)

```text
Build DEV-657: animated progress in the MoneyBot Expo app.

Where progress already appears
- Home stats / streak
- LessonRoadmap / lesson nodes
- QuestionFlowScreen (question index)
- DailyBlitz rounds
- Onboarding phases

Do this
- Add a shared animated bar (or enhance an existing one) using Animated / native driver where possible.
- Fill should animate on change, not jump. Use brand green. Track on colors.surface / border.
- Apply it to QuestionFlow (questions remaining) and at least one of: daily puzzle, onboarding, module progress.
- Keep motion small. This app already got a “reduce 3D by 2px” ticket — no bouncing 400ms circus.

Acceptance
- Advancing a question visibly fills the bar.
- Light and dark themes both work.
```

### DEV-660 — Money Tips should be accessed from the admin panel

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-660)

```text
Build DEV-660: Home “Today’s Tip” is admin-managed, not hardcoded.

Today
- HomeScreen getDailyTip() rotates a local DAILY_TIPS array by day of week.

Do this
- Backend model MoneyTip: body, optional category, is_active, order, optional start/end date.
- Admin web page to add/edit/activate tips (same Ant Design panel style as Characters/Notifications).
- Public/authenticated GET that returns today’s tip (stable for the local calendar date — use the same localDate idea as daily rewards).
- Mobile: fetch in UserProgressContext or HomeScreen via a small api module, cache with apiCache (long TTL + pull-to-refresh). Fallback to a single baked-in tip if the API fails.

Acceptance
- Changing the tip in the control panel and pulling to refresh Home shows the new copy.
- Inactive tips never show.
```

### DEV-661 — Auto Money Tips based on user interest

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-661)

Depends on DEV-660 (admin tips + categories). If 660 is not done, implement 660 first in this chat, then 661.

```text
Build DEV-661: pick today’s tip from categories that match the user’s interests.

Signals already on the user
- onboarding_goals (budget_better, start_investing, etc.)
- onboarding_answers / score
- Recent lesson/module titles if cheap to query

Do this
- Tip categories like budget, investing, credit, saving, stocks, general.
- Selection: prefer a category matching goals; otherwise general; rotate so they don’t see the same tip two days in a row (store last_tip_id on UserStats or a small through table).
- Optional later: LLM-generated tips. For v1, only select among admin-authored tips. Do not hallucinate live market advice.

Mobile
- Same Home card. No extra UI besides maybe a tiny category tag in the existing tip eyebrow.

Acceptance
- A user with “Start investing” gets investing tips when any are active.
- A user with no goals still gets a general tip.
```

### DEV-667 — Unique puzzles every day

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-667)

Related: DEV-678 already labeled the Home tile “Daily Puzzle”. Do not relitigate that.

```text
Build DEV-667: Daily Puzzle content must be unique per calendar day.

Today
- Home tile navigates to DailyBlitzScreen
- mobile/src/screens/daily/* rounds: estimate, higher_lower, sequence
- backend daily app + dailyApi

Do this
- Each local calendar date maps to a distinct puzzle (seed or stored DailyPuzzle row). Two users on the same date get the same puzzle. Tomorrow is different.
- Do not reuse yesterday’s numbers/prompt.
- Keep the three round types unless you add a 4th that still fits the existing HUD / DailyResult.
- Leaderboard stays date-scoped as it is now.
- Admin optional: view today’s puzzle. Not required if a deterministic seed is solid.

Acceptance
- Completing today’s puzzle, then changing the device date (or waiting) yields different questions.
- Two accounts on the same day get the same questions.
- Home tile still says Daily Puzzle and uses PuckButton.
```

### DEV-669 — MoneyBot Guide flying avatar (Mobile App)

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-669)

DEV-531 was the website version (Done). This ticket is mobile-only.

```text
Build DEV-669: a persistent MoneyBot guide on mobile that can help from anywhere.

What already exists
- MoneyBotGuide.js is an in-flow narrator (avatar PNG + typewriter bubble) used in onboarding/lessons — keep that.
- assets/moneybot-guide.png
- TutorScreen is full chat.

Do this
- A small floating guide button (equipped BrandAvatar if available, else guide PNG) on main tabs only (hide on lessons, paywalls, onboarding).
- Tap opens a compact sheet: “What do you need?” with 3–5 contextual shortcuts based on current route (Home → continue lesson / daily puzzle, Moneyverse → shop help, Social → invites/friends, Profile → settings).
- Optional: one-tap to Tutor with a prefilled “Explain this screen” prompt.
- Must not block the tab bar or JUMP HERE. Draggable is nice-to-have, not required.
- Respect reduced motion; a slow bob is enough. This is not a Clippy that auto-talks every visit.
- Persist “hint seen” so it doesn’t re-explain every launch.

Acceptance
- Visible on Home/Moneyverse/Social/Tutor/Profile roots.
- Hidden during QuestionFlow / DailyBlitz / onboarding.
- Shortcuts navigate correctly.
```

### DEV-673 — Reduce 3D button effects and animations by 2px

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-673)

```text
Build DEV-673: flatten MoneyBot mobile 3D pucks by 2px.

Source of truth
- mobile/src/components/PuckButton.js — default lip = 7. Drop default to 5.
- Audit every PuckButton call site that passes a custom lip (HomeScreen, LessonRoadmap, DailyRewardCard, FeaturedCharacter, etc.) and subtract 2, minimum 3 so they still press in.
- Any translateY / glow radius / JUMP HERE offset tied to the 3D lip should shrink by 2 as well so it doesn’t look like a floating sticker.
- Do not replace PuckButton with flat TouchableOpacity.
- Do not restyle non-button cards “while you’re here”.

Acceptance
- Buttons still look raised and depress on press.
- Home roadmap, Continue, Daily Puzzle, daily reward claim, and settings actions all use the smaller lip.
- Light and dark both look correct.
```

---

## Aug Week -4

Most Aug Week -4 tickets are landing page / student website, not the Expo app. The only mobile-app ticket in that sprint:

### DEV-689 — Create a flow chart for the Mobile App

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-689)

```text
Build DEV-689: a flowchart of the MoneyBot Expo app as it exists today. Do not implement a new product feature.

Read the real navigation and auth flow:
- mobile/App.js
- mobile/src/navigation/MainTabNavigator.js
- AuthScreen, OnboardingScreen, HomeScreen, Moneyverse, Social/Leaderboard, Tutor, Settings
- Lesson stack: LessonIntro → QuestionFlow → LessonComplete → ModuleComplete → MoneyChat → BadgeReveal
- DailyBlitz, Arcade games, invites, friends, groups

Deliver a mermaid flowchart (and optionally drop it in docs/ if I already have docs/) covering:
1. Cold start → splash → auth/guest → onboarding gate → tabs
2. Lesson completion path
3. Invite-only signup vs returning Apple/Google
4. Moneyverse purchase/equip
5. Daily puzzle

Keep names matching actual screen/component identifiers so engineers can use it.
```

---

## Already shipped — do not rebuild

These were in the same sprints but are **Done**. Use them as reference, not as new work.

| Sprint | Ticket | What shipped |
|---|---|---|
| June Week -5 | [DEV-534](https://getmoneybot.atlassian.net/browse/DEV-534) | Invite / access codes |
| June Week -5 | [DEV-533](https://getmoneybot.atlassian.net/browse/DEV-533) | Invite rewards |
| June Week -5 | [DEV-530](https://getmoneybot.atlassian.net/browse/DEV-530) / [DEV-529](https://getmoneybot.atlassian.net/browse/DEV-529) | Signup → Moneyverse / starter character |
| June Week -5 | [DEV-537](https://getmoneybot.atlassian.net/browse/DEV-537) | Personalized notifications (Zomato-style) — marked Done |
| June Week -5 | [DEV-531](https://getmoneybot.atlassian.net/browse/DEV-531) | Flying avatar on **website** (mobile version is DEV-669) |
| Aug Week -1 | [DEV-595](https://getmoneybot.atlassian.net/browse/DEV-595) | GLB loading |
| Aug Week -1 | [DEV-596](https://getmoneybot.atlassian.net/browse/DEV-596) | Mobile API/model cache |
| Aug Week -1 | [DEV-505](https://getmoneybot.atlassian.net/browse/DEV-505) | Edit name |
| Aug Week -1 | [DEV-581](https://getmoneybot.atlassian.net/browse/DEV-581) | Leaderboard |
| Aug Week -1 | [DEV-603](https://getmoneybot.atlassian.net/browse/DEV-603) | AI chat |
| Aug Week -1 | [DEV-580](https://getmoneybot.atlassian.net/browse/DEV-580) | Item shop preview |
| Aug Week -3 | [DEV-659](https://getmoneybot.atlassian.net/browse/DEV-659) | Welcome splash |
| Aug Week -3 | [DEV-662](https://getmoneybot.atlassian.net/browse/DEV-662) | Moneyverse featured preview |
| Aug Week -3 | [DEV-668](https://getmoneybot.atlassian.net/browse/DEV-668) | Home + Learn merged |
| Aug Week -3 | [DEV-674](https://getmoneybot.atlassian.net/browse/DEV-674) | Lesson completion sticking |
| Aug Week -3 | [DEV-675](https://getmoneybot.atlassian.net/browse/DEV-675) | Invite-only signup + share |
| Aug Week -3 | [DEV-676](https://getmoneybot.atlassian.net/browse/DEV-676) | Existing Apple/Google skip invite |
| Aug Week -3 | [DEV-677](https://getmoneybot.atlassian.net/browse/DEV-677) | Puck buttons + JUMP HERE |
| Aug Week -3 | [DEV-678](https://getmoneybot.atlassian.net/browse/DEV-678) | “Daily Puzzle” label |

Aug Week -4 tickets DEV-680–698 / DEV-700 are **website / student panel / landing page**, not the Expo app.
