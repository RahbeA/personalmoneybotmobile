# MoneyBot web sprint prompts

Copy-paste prompts for **web** tickets from:

- June Week -5
- Aug Week -1
- Aug Week -3
- Aug Week -4

Jira project: [DEV](https://getmoneybot.atlassian.net/jira/software/projects/DEV/boards/1)

Mobile-app tickets for the same sprints live in [mobile-sprint-prompts.md](./mobile-sprint-prompts.md). Do not use this file for the Expo app.

## How to use

1. Open a **new Cursor chat** in the **correct repo** for that ticket (see surface below).
2. Copy the matching **Shared agent preamble**.
3. Copy the **one ticket prompt** you want to build.
4. Paste both into the chat and send.

Do not paste two tickets into the same chat. One ticket per chat.

---

## Which surface?

| Surface | Where the code lives | Typical tickets |
|---|---|---|
| **Admin panel** | This repo: `web/` (Vite + React + Ant Design) + `backend/adminapi/` | Hats, tips, badges, KPI, responsive admin |
| **Landing page** | Separate marketing site (getmoneybot.com). Not `web/` in this repo. | Menu, copy, App Store reviews, “Request Access”, remove AI term |
| **Student website** | Separate classroom / student panel repo. Not Expo. | Learning tab colors, YouTube iframe, chatbot personality, simulators, More menu |
| **Teacher panel** | Same classroom product as students (teacher role). | Dashboard, assignments, Google Drive/Docs/Slides, Stripe, social |
| **MoneyHub / Teachers Resource Hub** | Separate site. Staging was `https://moneyhub.rizzed.mom`. | Resource library, Get Started email bug, custom domain |

If the chat is in `moneybotmobile` and the ticket is landing / student / teacher / MoneyHub, **stop and say so**. Do not invent those UIs inside the Vite admin.

---

## Shared agent preamble — Admin panel (`web/` in this repo)

Use this for DEV-655, DEV-660, DEV-663, DEV-664, DEV-670, DEV-671, DEV-672 (and admin parts of DEV-485 / DEV-654).

```text
You are implementing a MoneyBot admin-panel feature in this repo.

Stack
- UI: Vite + React 18 + JavaScript (not TypeScript) under web/
- UI kit: Ant Design 5. Dark theme. Routes in web/src/App.jsx. Shell in web/src/components/AppLayout.jsx.
- Theme tokens: web/src/theme/tokens.js and web/src/theme/brand.css. Brand green #3DDC5F, Bot Bucks gold #F5B72B, bg #0A0A0A, surface #141414, surfaceElevated #1E1E1E, border #2A2A2A.
- API: web/src/api/client.js talks to Django /api/admin (VITE_API_BASE). Token auth. Use api.get / post / patch / postForm / del.
- Backend: Django + DRF under backend/adminapi/ (urls.py, views.py, serializers.py).

Visual / UX style (match the panel as it is now)
- Page header: .mb-page-header with Title level={3} + secondary Text + a primary Button (PlusOutlined for create).
- Cards: className="mb-brand-card". Stat tiles: className="mb-stat-card".
- Tables: Ant Table, rowKey="id", scroll={{ x: 'max-content' }}, Tags for status (green Live / default Hidden).
- Create/edit in Modal or Drawer, Form layout="vertical", App.useApp() for message/modal.
- Primary buttons are Ant type="primary" (themed green). Do not invent PuckButton — that is mobile-only.
- Icons: @ant-design/icons. Loader: Ant Spin. Empty: Ant Empty.
- Login already uses a dark green gradient + BrandLogo. Reuse BrandLogo; do not replace the wordmark.

Architecture rules
- Add a route in web/src/App.jsx AND a NAV_ITEMS entry in AppLayout.jsx. Keep the existing nav order unless the ticket is about consolidating nav.
- Register admin ViewSets on backend/adminapi/urls.py. Serializers already exist for Hat (HatAdminSerializer) and MoneyTip (MoneyTipAdminSerializer) — wire them, do not duplicate models.
- Paginate list endpoints the same way Users/Invites do (usePaginatedQuery when the list can grow).
- Keep diffs tight. No drive-by refactors, no new markdown files, no restyling the whole shell.
- Do not touch mobile/ unless the ticket truly needs a shared API field.

When you finish
- List the files you changed.
- Say how to verify: run the Vite admin, hit the new page, and check Django admin/API if you added backend.
```

---

## Shared agent preamble — Landing page

Use this for DEV-647, DEV-666, DEV-684–688, DEV-690–696, DEV-698.

```text
You are implementing a MoneyBot marketing landing-page change.

This is NOT the Expo app and NOT the Vite admin in moneybotmobile/web. Work in the landing-page repo. If this chat is only moneybotmobile, stop and say you need the landing repo.

Visual / UX style
- Match the live landing page. Do not introduce a new palette, font, or button system.
- Brand: primary green #3DDC5F / #16A34A, dark backgrounds, Bot Bucks gold only if it already appears.
- Copy is short, teen-finance, not corporate SaaS. Prefer “MoneyBot” over generic “our AI”.
- Nav, hero, and CTAs should stay consistent with existing header/footer components.
- Keep the page responsive. Do not break mobile nav.

Rules
- Make the ticket’s copy/nav/section change only. Do not redesign the whole landing page.
- Do not add fake metrics (no “serving 2500” unless product supplies a real number).
- App Store / mobile CTAs should point at the real App Store URL already used in the mobile app (APP_STORE_URL / brandCopy), not a placeholder.
- Do not rebuild Teachers Resource Hub on the landing page if the ticket is to remove or de-emphasize it — link out or drop the section.

When you finish
- List files changed.
- Say exactly which heading/button/section to look at in the browser.
```

---

## Shared agent preamble — Student website / teacher panel

Use this for DEV-260 (if still in the classroom app), DEV-485, DEV-507, DEV-514, DEV-515, DEV-575, DEV-578, DEV-649, DEV-651, DEV-652, DEV-656 (web half), DEV-658, DEV-680–683, DEV-697.

```text
You are implementing a MoneyBot student-website or teacher-panel feature.

This is NOT the Expo app and NOT the Vite admin in moneybotmobile/web. Work in the classroom / student / teacher web repo. If this chat is only moneybotmobile, stop and say you need that repo.

Product context
- Teachers run classes, assign work, and use Magic Studio (renamed from AI Studio).
- Students take lessons, games/simulators, and can chat with MoneyBot.
- Shared backend may still be Django — reuse existing APIs. Do not stand up a second payments or chat vendor if one already exists.

Visual / UX style
- Match the current student/teacher UI. Reuse existing buttons, cards, nav, and color tokens.
- Learning-tab color should be one consistent brand green, not a different hue per section.
- Copy is friendly classroom English, not admin-console jargon.
- Keep student and teacher roles separate. Do not leak teacher tools onto the student nav.

Rules
- Reuse existing lesson / assignment / class-material components. Do not clone the mobile PuckButton system onto web unless this site already uses it.
- Google Docs/Slides/Drive: respect class permissions. Fail gracefully if a file is missing.
- Keep diffs tight. One ticket. No unrelated redesign.

When you finish
- List files changed.
- Say how a teacher and/or student verifies the flow.
```

---

## Shared agent preamble — MoneyHub / Teachers Resource Hub

Use this for DEV-541, DEV-665, DEV-700 (and remaining DEV-260 polish).

```text
You are working on MoneyBot Teachers Resource Hub (MoneyHub).

This is a separate site (staging historically https://moneyhub.rizzed.mom). It is not moneybotmobile/web. If you do not have the MoneyHub repo, stop and say so (DEV-646 tracked access).

Match the existing hub: resource library for teachers (AP testing, simulators, calculators, etc.). Do not restyle the whole hub to look like the Vite admin or the Expo app.

When you finish
- List files changed.
- Say how to verify in the browser, including the Get Started / email field if relevant.
```

---

## June Week -5

### DEV-260 — Teacher Request: Free Resource Hub Tab

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-260)

Already has a staging URL (`https://moneyhub.rizzed.mom`). Do not rebuild from scratch. Use the MoneyHub preamble.

```text
Build / finish DEV-260: Free Resource Hub (MoneyHub) for teachers.

Product
- A dedicated hub (tab or standalone site) with free financial-education resources: AP testing, simulators, calculators, and similar teacher tools.
- Teachers can browse without paying. “Get Started Free” collects email.
- This is not the Expo app and not the Vite admin Characters/Courses pages.

Do this
- Inspect the live hub and the MoneyHub repo.
- Fill any missing resource categories teachers asked for (AP, simulators, calculators).
- Make nav to the hub obvious from the teacher product / landing (link out). Do not embed a half-copy inside the admin panel.
- Keep MoneyBot brand (green, dark, short copy). Do not look like a generic Notion dump.

Acceptance
- A teacher can open the hub, browse resources, and submit Get Started without a JS crash.
- Hub is still the MoneyHub site, not a new tab inside web/src/App.jsx.
```

### DEV-541 — Bug: email field closes while selecting text (Teachers Resource Hub)

Status: To-Do · blocked on hub repo access (DEV-646) · [ticket](https://getmoneybot.atlassian.net/browse/DEV-541)

Use the MoneyHub preamble.

```text
Build DEV-541: fix the Teachers Resource Hub “Get Started Free” email input.

Bug
- Click Get Started Free → email field appears with existing text.
- Selecting / highlighting that text closes the input (likely a click-outside or blur handler on the parent modal/popover).

Do this
- Find the Get Started Free control (popover, modal, or dropdown).
- Stop mousedown/click on the input from closing the overlay. Typical fix: stopPropagation on the panel, ignore blur when the relatedTarget is inside the panel, or use onOpenChange only for true outside clicks.
- Selecting, copying, and editing the email must keep the field open.
- Submit still works. Empty / invalid email still shows a friendly error.
- Do not remove the prefilled text unless product asks.

Acceptance
- I can highlight the existing email text without the field disappearing.
- I can replace it and submit.
```

---

## Aug Week -1

### DEV-420 — Ads / MoneyBot promotions

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-420)

Landing or student site. Not the Expo app. Not buying Google Ads from this ticket.

```text
Build DEV-420: in-product / landing promotions for MoneyBot (the mobile app).

Product
- Surface the iOS app on the landing page and/or student website with a clear promotional block.
- CTA: App Store (real URL) and/or “Request Access” if invite-only.
- Optional small banner in the student panel: “Get MoneyBot on iPhone” that dismisses and stays dismissed (localStorage).

Do this
- Reuse existing landing sections/cards. One promo module, not a pop-up ad network.
- Screenshot or phone mock already on the landing page is enough art. Do not generate random ads.
- Do not implement third-party ad serving (AdMob, Google Ads campaigns).

Acceptance
- Promo is visible, on-brand, and links to a real store or request-access flow.
- Dismissible student banner does not come back every page load.
```

### DEV-485 — Stripe Payments

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-485)

Teacher / web billing. Mobile IAP is DEV-594 (RevenueCat) — do not replace that.

```text
Build DEV-485: Stripe checkout for MoneyBot web (teacher site / classroom), not iOS IAP.

Product
- Teachers (or schools) can pay on the web with Stripe Checkout or Payment Element.
- Success flips a plan/is_premium (or seat count) on the account the teacher panel already uses.
- Coordinate with the is_premium flag used by mobile DEV-576 if it is the same User. Do not create a second boolean.

Backend
- Stripe Customer + Checkout Session (or Billing Portal for manage-subscription).
- Webhook on checkout.session.completed / customer.subscription.updated. Verify signature.
- Secrets in env, never git.

UI
- Pricing / upgrade page in the teacher panel matching that site’s buttons and layout.
- Success and cancel return URLs.
- Admin Vite panel (moneybotmobile/web): optional read-only plan badge on UsersPage. A staff toggle for is_premium is OK for QA.

Do not
- Do not put RevenueCat in this ticket.
- Do not charge Bot Bucks through Stripe in v1 unless product already decided that.

Acceptance
- Test-mode card completes and the teacher account shows paid.
- Webhook is required; client-only “success” is not enough.
```

### DEV-507 — YouTube iframe on the student side (Coursera-style)

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-507)

Iframe already works; remaining work is the flow. Student-website preamble.

```text
Build DEV-507: Coursera-style video-then-questions on the student website.

What already works
- YouTube iframe in class/lesson materials.

What to ship now
1. First screen of a video lesson is the video only (no questions beside it).
2. After the student finishes (or taps Continue after watching), go to assignments/questions on the next screen.
3. On a wrong answer, show “Recap the video” that returns to the iframe (same lesson). Time-stamped recap is out of scope.
4. Teacher still attaches the YouTube URL the way they do today.

Do not rebuild the whole lesson player. Do not port Expo QuestionFlow.

Acceptance
- Student cannot see the question list on the same screen as the first video view.
- Recap returns to the video without losing the lesson.
```

### DEV-514 — Google Docs mini preview + open-in-Docs

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-514)

QA / finish ticket. Teacher/student class materials.

```text
Finish DEV-514: Google Docs in class materials.

Validate and fix anything broken:
- Docs show a readable mini preview in the class material card.
- Class members see a clear “Open in Google Docs” button that opens the correct file.
- Preview is responsive and does not blow out the card.
- Permissions: class users only. Missing/unavailable files fail gracefully (empty state + message), no white screen.

Do not switch Docs to “external only” — that is DEV-515 for Slides.

Acceptance
- Preview + open-in-Docs both work for a class member.
- A broken URL does not crash the materials list.
```

### DEV-515 — Google Slides open externally

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-515)

```text
Finish DEV-515: Google Slides class materials open in Google Slides, not an in-page mini player.

Do this
- Slides no longer render in the mini in-page display.
- Users see a clear link/button: open in Google Slides.
- Class permissions still apply. Non-class users do not get the file.
- Docs preview (DEV-514) must keep working. Do not break other material types.

Acceptance
- Clicking slides leaves the app (or a new tab) into Google Slides.
- The materials list layout stays stable.
```

### DEV-575 — Social features for teachers

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-575)

Teacher panel. Mobile friends/nudge is a different ticket (DEV-573).

```text
Build DEV-575: light social for teachers on the teacher panel.

Product (v1, keep small)
- Teachers can see other teachers in their school/org (or a simple “teacher directory” if org already exists).
- Share a class invite / join code the same way students already join classes.
- Optional: a class-level “nudge inactive students” using existing notification/email if that pipeline exists. Do not build a second push stack.

Do not
- Do not clone the Expo Friends / WhatsApp contact sync into the teacher site.
- Do not add a public teacher social network.

UI
- One page or a section on the teacher dashboard. Match Magic Studio / dashboard cards.

Acceptance
- A teacher can copy a class join link/code.
- If directory ships, it only shows teachers they should see, not every user in the DB.
```

### DEV-578 — PostHog ChatBot (website)

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-578)

Website companion to mobile analytics (DEV-653). Not the MoneyBot tutor.

```text
Build DEV-578: PostHog on the MoneyBot website (landing and/or student site).

Do this
- Init PostHog JS on the web properties that do not already have it.
- Identify logged-in teachers/students with the backend user id. Reset on logout.
- Optional: enable PostHog surveys / the small feedback widget if the project already uses PostHog surveys — that is the “chatbot”. Do not replace MoneyBot tutor with PostHog AI.

Events (minimum)
- page_view (if not autocaptured)
- signup_succeeded / login_succeeded
- assignment_opened / lesson_completed (student)
- checkout_started (if Stripe exists)

Rules
- No emails, class names, or document contents in properties.
- API key from env.

Acceptance
- A page load and a login show up in PostHog.
- Logout clears identity.
```

---

## Aug Week -3

### DEV-647 — App Store review screenshots on the website

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-647)

Landing preamble.

```text
Build DEV-647: show real App Store reviews on the MoneyBot landing page.

Product
- A reviews / social-proof section with screenshots (or quoted cards) of actual App Store reviews.
- Use real assets the team provides, or export from App Store Connect / public listing. Do not invent 5-star quotes.
- Place it where testimonials already would go (below hero or near “Get MoneyBot”). Match existing card radii and type.

Do not scrape Apple in production at request time. Static images or curated copy in the repo is fine.

Acceptance
- Section looks native to the landing page on desktop and mobile.
- Images are compressed; no layout shift from huge PNGs.
```

### DEV-649 — Google Drive auth on the teacher panel

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-649)

Pairs with DEV-514 / DEV-515.

```text
Build DEV-649: connect Google Drive from the teacher panel.

Product
- Teacher clicks Connect Google Drive, OAuth, then can attach Docs/Slides from Drive into class materials.
- Store refresh tokens server-side, encrypted or in the existing secrets pattern. Never in localStorage.
- Disconnect Drive must work.
- Class attach still respects DEV-514 (Docs preview) and DEV-515 (Slides external).

If Drive pickers already exist but auth is flaky: fix scopes, token refresh, and the connected/disconnected UI. Do not add a second OAuth app.

Acceptance
- A teacher can connect, pick a Doc, and students in the class can open it.
- After token expiry, reconnect is a button, not a 500.
```

### DEV-651 — Teacher dashboard design upgrades

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-651)

```text
Build DEV-651: upgrade the teacher dashboard UI without a product rewrite.

Do this
1. Audit the current teacher home/dashboard.
2. Make it scannable: classes, assignments needing grading, upcoming, student progress — cards in the existing design system.
3. Hierarchy: one page title, a few stat tiles, then lists. Empty states with a single CTA (“Create assignment”).
4. Fix obvious spacing/alignment/contrast issues. Align with DEV-681 energy (buttons not floating wrong) if that panel shares CSS.

Do not
- Do not clone the Vite admin Dashboard (mb-stat-card) unless this site is already Ant Design dark.
- Do not add investor KPIs here (that is DEV-672).

Acceptance
- Dashboard is usable at 1280px and 768px.
- Primary actions are obvious. No duplicate competing headers.
```

### DEV-652 — Make assigning work easy

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-652)

```text
Build DEV-652: shorten the teacher “assign assignment” flow.

Today teachers have too many steps. Target flow:
1. Pick class (or default to the class they are in).
2. Pick existing lesson/module/material OR create quickly.
3. Due date (optional).
4. Assign. Done.

Do this
- One modal or one page wizard, max 2 steps. Reuse existing assignment APIs.
- Sensible defaults (this class, due Friday) so it is 2 clicks for the common case.
- Success toast + the assignment appears on the class list without a full reload if the app already refetches.

Acceptance
- A teacher can assign existing work in under 30 seconds.
- Students in that class see it.
```

### DEV-655 — Admin panel responsive on a phone

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-655)

Admin preamble. AppLayout already has a Drawer under 991px. Finish the pages.

```text
Build DEV-655: make the Vite admin (web/) usable on a phone.

Already done
- AppLayout.jsx: Drawer nav when (max-width: 991px), hamburger, BrandLogo in the header.

Still broken (fix these)
- Tables: keep scroll={{ x: 'max-content' }}. Do not clip actions off-screen without horizontal scroll.
- Page headers: .mb-page-header already wraps. Ensure primary buttons don’t overflow.
- Modals/Drawers: full width on small screens (width: '100%' / maxWidth).
- Characters grid: mb-character-grid already auto-fills; check the GLB viewer height on a phone.
- LoginPage: already padded with safe-area. Verify keyboard doesn’t cover Submit.
- Hide or collapse dense toolbars (Characters slim-all / preview-all) behind a “More” on mobile.

Do not restyle the desktop sider. Do not install a new UI kit.

Acceptance
- I can open Courses, Users, Notifications, Characters on an iPhone-width viewport, complete a simple edit, and not lose the nav.
```

### DEV-656 — Chatbot personalities (student website half)

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-656)

Mobile half is in mobile-sprint-prompts.md. This prompt is **student website only**. Shared backend is OK.

```text
Build DEV-656 for the student website tutor/chat (not Expo).

Product
- Presets: Coach, Funny, Straight-up teacher, Chill friend (default).
- Student picks a personality; replies change. Preference persists on the user (same UserStats field as mobile if you add it — chat_personality).
- Better bubble formatting: short paragraphs, lists. Keep answers accurate teen-finance. Funny ≠ wrong.

Backend
- Reuse the existing OpenAI tutor endpoint. Pass personality in the system prompt. One provider.

UI
- Chips or a small picker on the student chat page, matching that site’s components.

Acceptance
- Switching to Funny changes the next reply.
- Preference survives refresh.
- Default remains chill MoneyBot.
```

### DEV-658 — Website testing

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-658)

This is a QA pass, not a feature. Still paste as one chat so the agent files bugs/fixes.

```text
Build DEV-658: smoke-test MoneyBot web properties and fix blockers you find.

Scope
- Landing page
- Student website (learn, games/simulators, chat, profile)
- Teacher panel (dashboard, assign, materials)
- Vite admin at web/ if this repo is in the workspace (login, dashboard, one CRUD page)

Do this
1. Walk the critical paths. List bugs with URL + steps.
2. Fix only high-severity issues you can reproduce (crash, unusable nav, broken auth, buttons that do nothing).
3. Do not start a visual redesign.

Acceptance
- A markdown list of what you tested, what you fixed, and what is still open (file Jira keys if you have them).
- No drive-by refactors.
```

### DEV-660 — Money Tips from the admin panel

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-660)

Admin preamble. Backend model MoneyTip already exists (`courses.models.MoneyTip`). Serializers exist. **No admin ViewSet or web page yet.**

```text
Build DEV-660: CRUD for Home “Today’s Tip” in the Vite admin.

Backend (already partly there)
- Model: MoneyTip (body, category, is_active, order) in backend/courses/models.py
- MoneyTipAdminSerializer in backend/adminapi/serializers.py
- Wire a ModelViewSet and register router.register('money-tips', ...) in backend/adminapi/urls.py

Admin UI
- New page web/src/pages/MoneyTipsPage.jsx cloned in spirit from BadgesPage / DailyRewardsPage.
- Route + NAV_ITEMS (Gift or Bulb icon). Place near Daily Rewards.
- Table: order, category tag, body, Live/Hidden, edit/delete.
- Modal: body (max 280), category select (general/budget/investing/credit/saving/stocks), order, is_active.
- mb-page-header, type="primary" create button.

Mobile Home already plans to consume this (DEV-660 in the mobile prompts). If the public GET for today’s tip is missing, add it on the mobile API. Inactive tips never show.

Acceptance
- I can add a tip in the admin, toggle it off, and it disappears from the public today’s-tip endpoint.
```

### DEV-663 — Hats in the admin panel

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-663)

Admin preamble. `Hat` model and `HatAdminSerializer` exist. **No ViewSet, url, or page yet.** Related mobile shop is DEV-579.

```text
Build DEV-663: hats CRUD on the Vite admin (minimum needed to stock the shop).

Backend
- Model already: moneyverse.models.Hat (name, description, price, preview_image, accent_color, order, is_active, is_premium)
- HatAdminSerializer already in adminapi/serializers.py
- Add HatViewSet (IsAdminUser) and router.register('hats', ...)

Admin UI
- HatsPage modeled on CharactersPage but simpler: image + fields, no GLB pipeline unless hats already have models.
- Grid of cards (CharacterGridCard-style or Table if faster). Preview image, price, premium switch, active switch.
- Route + NAV_ITEMS next to Characters (SkinOutlined or a hat icon).
- Image upload via postForm/patchForm like badges/characters.

Acceptance
- Admin can create a hat with image and price, list it, deactivate it.
- Deactivated hats should not appear on the mobile catalog endpoint (check moneyverse views).
```

### DEV-664 — Website badges onto the mobile admin catalog

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-664)

Admin already has BadgesPage. This ticket is catalog parity, not a blank page.

```text
Build DEV-664: every badge that exists on the student website must be manage-able on the mobile Vite admin Badges page.

Do this
1. Inventory badges on the student website (names, how they unlock).
2. Compare to backend Badge rows + web/src/pages/BadgesPage.js metrics in courses.models.Badge.METRIC_CHOICES.
3. Create missing badges in admin (or a data migration) with real metrics/thresholds. Reuse existing metrics (lessons_completed, streak_days, friends_count, etc.). Add a metric only if the website badge cannot map.
4. Icons: upload PNGs or ion_icon fallback. Use the existing “AI icon generation prompt” collapse — do not build a new icon studio.
5. Do not secretly award all badges (that is the opposite of DEV-571).

Acceptance
- BadgesPage lists the full set.
- Each row has a metric + threshold that evaluate_and_award can run.
- No duplicate keys.
```

### DEV-665 — Domain for MoneyHub

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-665)

Ops + hub. Pair with DEV-700 if it is the same property.

```text
Build DEV-665: put MoneyHub on a real MoneyBot domain.

Context
- Staging has been https://moneyhub.rizzed.mom which is not shippable.
- Teachers Resource Hub also has DEV-700 (domain). Confirm with product whether these are one site or two. If one site, one domain.

Do this
- Pick the production host product wants (e.g. hub.getmoneybot.com or moneyhub.getmoneybot.com).
- DNS + TLS + redirects from the joke domain.
- Update landing-page links that still point at rizzed.mom (DEV-698 may remove the landing section entirely — still fix remaining links).

If you cannot access DNS, document the exact records and stop. Do not fake a domain in frontend only.

Acceptance
- Hub loads on the new domain over HTTPS.
- Old URL redirects.
```

### DEV-666 — Delete the “AI” term from the landing page

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-666)

Landing preamble. Related later tickets (DEV-686, DEV-692, DEV-695) rephrase AI copy — do this first so later tickets are not fighting leftover “AI” headlines.

```text
Build DEV-666: remove generic “AI” wording from the MoneyBot landing page.

Do this
- Search the landing copy for AI / A.I. / artificial intelligence.
- Replace with MoneyBot / coach / personalized learning language already used on the site.
- Do not delete the product (tutor, Magic Studio). Rename in the visitor-facing UI only.
- Footer, meta title, OG tags, alt text too.

Acceptance
- Visible landing headings and hero do not say “AI” unless product explicitly kept one line (check DEV-686). Prefer zero.
- No broken layout from shorter/longer strings.
```

### DEV-670 — Mobile compatibility for the mobile-app admin panel

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-670)

Overlap with DEV-655. If 655 is not done, do 655 in this chat then the leftover below.

```text
Build DEV-670: phone-usable Vite admin for the people who run the Expo app.

Focus on the mobile-app operator pages (not teacher classroom):
- Dashboard, Courses, Onboarding, Characters, Badges, Daily Rewards, Users, Invites, Notifications

Do this
- Complete DEV-655 layout work if missing.
- Touch targets ≥ 44px on header hamburger and row actions.
- Notifications composer and Invites bulk modal usable in portrait.
- Character 3D preview: if model-viewer is too heavy on iOS Safari, show preview_image first and load 3D behind a tap.

Acceptance
- An admin can send a test notification and toggle a badge from a 390px-wide browser.
```

### DEV-671 — Admin KPIs (DAU, referrals, active time)

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-671)

Admin preamble. Extend existing Dashboard + stats_summary.

```text
Build DEV-671: operator KPIs on the Vite admin Dashboard.

Ticket asks for
- Daily Active Users
- Referrals
- Daily active time

Backend
- Extend backend/adminapi/views.py stats_summary (already returns users, content, engagement, economy, signups_by_day).
- DAU: count of users with last_active == today (UserStats.last_active is already used for active_last_7_days).
- Referrals: use existing invite redemption / referral models (accounts invite rewards). Last 7 days + all-time is enough.
- Daily active time: only if you already store sessions. If you do not, ship DAU + referrals now and a honest “session duration not tracked yet” on the third tile — do not fake minutes.

Frontend
- web/src/pages/Dashboard.jsx StatCards. Same mb-stat-card, green prefixes, Row/Col xs=12 md=6.
- Optional 7-day DAU bar next to the existing signups bars.

Acceptance
- Dashboard shows DAU and referrals from real queries.
- Numbers change when a user is active today / redeems an invite (or you document how to QA).
```

### DEV-672 — Growth dashboard for investors

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-672)

Admin preamble. Can share APIs with DEV-671. Different audience: weekly growth, not operator clutter.

```text
Build DEV-672: a Growth view in the Vite admin for investor KPIs.

Metrics (use real data only)
- Signups (already have 7-day; add 30-day)
- DAU / WAU if last_active exists
- Invite funnel: codes issued vs redeemed
- Lesson completions (engagement.lessons_completed already in summary)
- Optional: D1/D7 return if cheap from last_active / date_joined

UI
- New route /growth or a second tab on Dashboard. NAV_ITEMS label “Growth”.
- mb-stat-card tiles + one or two simple bars like Dashboard signups_by_day. No Chart.js unless already in package.json (it is not — stay with Ant Progress / CSS bars).
- Restrict to staff (already true for the whole admin).

Do not build a public investor site.

Acceptance
- /growth loads for an admin and shows only computed stats, no placeholder “42%”.
```

---

## Aug Week -4

Most of this sprint is landing page + student panel. DEV-689 (mobile flowchart) is in the mobile prompts file.

Tickets in **Testing** may already be on a branch. Use the prompt to verify and finish, or to rebuild if QA bounced them.

### Student panel

### DEV-680 — Remove duplicate buttons from the students panel

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-680)

```text
Build DEV-680: remove duplicate actions on the student website.

Do this
1. Find screens with two buttons that do the same thing (example: two “Start”, two “Continue”, stacked CTAs in the learning tab or games).
2. Keep one primary CTA in the existing button style. Delete or demote the duplicate.
3. Do not remove unique actions (e.g. Profile vs Sign out — that is DEV-683).

Acceptance
- No student screen shows two identical primary buttons for one action.
- Layout does not leave a hole (spacing still matches sibling pages).
```

### DEV-681 — Align the “Bagan feature report” button (student panel)

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-681)

Jira title is likely “Begin feature report” (typo).

```text
Build DEV-681: fix alignment of the feature-report button on the student panel.

Do this
- Find the feature report / feedback control (Bagan → Begin).
- Align it with the surrounding buttons/cards (same height, padding, radius, and row).
- Match the learning-tab / More-menu button styles. No one-off color.

Acceptance
- Button sits on the same baseline/grid as neighbors on desktop and mobile.
```

### DEV-682 — Learning tab color constant across sections

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-682)

```text
Build DEV-682: one color system on the student Learning tab.

Do this
- Audit Learning sections (modules, lessons, games, simulators). Replace one-off greens/blues with the tab’s existing brand tokens.
- Active vs completed vs locked should still be distinct (opacity or a single accent), not a rainbow.
- Do not restyle the whole student app.

Acceptance
- Every Learning subsection uses the same primary accent.
- Contrast still works on the background.
```

### DEV-683 — Profile and Sign out inside More

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-683)

```text
Build DEV-683: Profile and Sign out live under the student panel More menu.

Do this
- Add Profile and Sign out to More (or equivalent overflow nav). Reuse existing profile route and logout.
- Remove leftover duplicate Profile/Sign out from the old place if that is what created DEV-680 duplicates.
- Confirm sign-out clears session and returns to the student login.

Acceptance
- More → Profile opens the profile page.
- More → Sign out signs out.
- Those two actions are not also sitting as extra header buttons.
```

### DEV-697 — Back arrows on the simulator

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-697)

```text
Build DEV-697: back navigation on MoneyBot simulators (student site / MoneyHub, whichever hosts them).

Do this
- Each simulator screen has a back control (arrow) that returns to the simulators list or previous step — not the browser back button only.
- Match existing icon buttons on that site. Do not trap the user with no escape.
- Preserve sim state only if the product already did; otherwise back = leave is OK.

Acceptance
- From inside a simulator I can tap back to the list without the browser chrome.
```

### Landing page

### DEV-684 — “Learn more” for MoneyBot mobile on the landing page

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-684)

```text
Build DEV-684: landing page button “Learn more” for MoneyBot mobile.

Do this
- Add (or finish) a Learn more CTA that goes to a mobile-app section or page on the landing site (features, App Store, screenshots).
- Match existing primary/secondary button styles. Label: Learn more.
- Do not point at the Vite admin or Expo deep links.

Acceptance
- Button is visible in the hero or mobile section and scrolls/navigates to real mobile-app content.
```

### DEV-685 — Remove “serving 2500” from the landing page

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-685)

```text
Build DEV-685: delete the “serving 2500” (or similar) metric from the landing page.

Do this
- Search for 2500 / 2,500 / “serving”. Remove that claim.
- Rebalance the stats row so the layout does not look like a missing tile (drop the item, don’t leave “—”).

Acceptance
- The number is gone from the visible page and from meta/OG if it was there.
```

### DEV-686 — Update “AI powered learning” text on the landing page

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-686)

```text
Build DEV-686: replace “AI powered learning” landing copy.

Do this
- Find that heading/body.
- Rewrite to MoneyBot / personalized learning voice (aligned with DEV-666: avoid “AI” if possible). Example direction: “Personalized learning that actually sticks” — match surrounding tone, don’t paste this literally if the page already has a better line.
- Keep length similar so the hero doesn’t wrap badly.

Acceptance
- Old string is gone.
- New string matches nearby headlines.
```

### DEV-687 — MoneyBot mobile in the landing menu bar

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-687)

```text
Build DEV-687: add MoneyBot Mobile to the landing page menu.

Do this
- Nav item that jumps to the mobile section or /mobile.
- Same font/weight/hover as existing items (Shop, etc.).
- Mobile hamburger must include it too.

Acceptance
- Desktop and mobile nav both have it and it goes to the right place.
```

### DEV-688 — MoneyBot shop in the landing menu bar

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-688)

```text
Build DEV-688: add MoneyBot Shop to the landing page menu.

Do this
- Nav item to the existing merch/shop (DEV-359 shipped a merch page).
- Do not build a new store. Link what exists (or hide the item if shop is down — do not 404).
- Align with DEV-687 styling.

Acceptance
- Shop is in desktop + hamburger nav and opens the merch page.
```

### DEV-690 — Get MoneyBot → Request Access

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-690)

```text
Build DEV-690: rename/replace “Get MoneyBot” with “Request Access” on the landing page.

Do this
- Primary CTA that used to say Get MoneyBot should say Request Access (invite-only).
- Click opens the existing request/waitlist/email form, not a fake App Store if they still need an invite.
- If they already have the app, a secondary “Download on the App Store” can remain in the mobile section.

Acceptance
- Hero/header CTA copy is Request Access and the form works.
```

### DEV-691 — Remove the Explore Feature button

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-691)

```text
Build DEV-691: remove “Explore Feature” (or Explore Features) from the landing page.

Do this
- Delete the button. Do not leave an empty column. Nearby CTA (Request Access / Learn more) should remain.

Acceptance
- String is gone. Hero still has one clear primary action.
```

### DEV-692 — Advanced Learning → AI-powered PL (screenshot)

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-692)

Jira is a screenshot of a heading. Align with DEV-666 (less “AI” unless this ticket explicitly wants those words).

```text
Build DEV-692: update the “Advanced Learning” landing block to the new heading from the Jira screenshot.

Do this
- Open the ticket screenshot on DEV-692 and match the new title/subtitle exactly if product wrote it.
- If the screenshot is “AI powered personalized learning”, use that line only here — still scan for extra “AI” leftover from DEV-666.
- Swap any accompanying image if the ticket shows a new crop. Do not invent a new section.

Acceptance
- Heading matches the screenshot. Layout still aligns with the section grid.
```

### DEV-693 — “Powered by advanced technology” update

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-693)

```text
Build DEV-693: update the “Powered by advanced technology” landing copy.

Do this
- Find that heading (or close variant).
- Replace with current MoneyBot positioning (personalized, standards-aligned, coach — not a generic tech slogan). Keep parallel structure with neighboring feature tiles.
- No new icons unless the section already uses a set.

Acceptance
- Old slogan is gone. Tile still matches siblings.
```

### DEV-694 — AI Assistant section → MoneyBot chat screenshot

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-694)

Jira notes: Instant personalized Feedback; Dynamic games and sims; Natural language Q&A support and accessibility.

```text
Build DEV-694: replace the generic “AI Assistant” landing block with a real MoneyBot chat screenshot and the three benefit lines from the ticket.

Copy
1. Instant personalized feedback
2. Dynamic and engaging games and sims
3. Natural language Q&A support and accessibility

Do this
- Use a real chat UI screenshot (from the app or student tutor). Not a stock robot illustration.
- Keep the section’s existing grid/typography. Rename “AI Assistant” to MoneyBot (or Chat with MoneyBot).

Acceptance
- Screenshot is the MoneyBot chat. Three lines are present and readable on mobile.
```

### DEV-695 — “Our AI” → “MoneyBot adapts”

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-695)

```text
Build DEV-695: replace “Our AI …” landing copy with “MoneyBot adapts” (see ticket screenshot).

Do this
- Match the screenshot heading/body as closely as the layout allows.
- Same section, no new animation.

Acceptance
- “Our AI” is gone. “MoneyBot adapts” (or the screenshot’s exact phrase) is live.
```

### DEV-696 — Kentucky → USA national standards

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-696)

```text
Build DEV-696: landing-page standards copy should say USA / national standards, not Kentucky-only.

Do this
- Find Kentucky / KY standards claims (screenshot on the ticket).
- Broaden to U.S. national / widely used personal-finance standards language the site already uses elsewhere. Do not invent a false “approved in all 50 states” claim.
- Update logos/badges in that section if they are Kentucky-specific.

Acceptance
- Visible standards section is national-U.S., not Kentucky-only.
```

### DEV-698 — Remove Teachers Resource Hub section on the landing page

Status: Testing · [ticket](https://getmoneybot.atlassian.net/browse/DEV-698)

Hub itself stays (DEV-260 / DEV-700). Remove it from marketing.

```text
Build DEV-698: remove the Teachers Resource Hub section from the landing page.

Do this
- Delete that section/block from the landing page. Remove nav items that only existed for it.
- Do not delete the MoneyHub site. Teachers can still get the URL from product/sales.
- Fix footer links that 404.

Acceptance
- Landing page has no Resource Hub section.
- Rest of the page spacing is intact.
```

### DEV-700 — Domain for Teachers Resource Hub

Status: To-Do · [ticket](https://getmoneybot.atlassian.net/browse/DEV-700)

Ops. Coordinate with DEV-665.

```text
Build DEV-700: production domain for Teachers Resource Hub.

Do this
- Confirm whether this is the same site as MoneyHub (DEV-665). If yes, one domain, close the duplicate ticket in the PR description.
- DNS + HTTPS + redirect from any staging host.
- Update remaining official links (not the landing section removed in DEV-698).

Acceptance
- Hub loads on the chosen getmoneybot (or agreed) domain over HTTPS.
```

---

## Already shipped — do not rebuild

These were in the same sprints and are **Done**. Reference only.

| Sprint | Ticket | Surface | What shipped |
|---|---|---|---|
| June Week -5 | [DEV-470](https://getmoneybot.atlassian.net/browse/DEV-470) | Teacher | Content creation on teacher side |
| June Week -5 | [DEV-527](https://getmoneybot.atlassian.net/browse/DEV-527) | Admin | PostHog on admin |
| June Week -5 | [DEV-528](https://getmoneybot.atlassian.net/browse/DEV-528) | Admin | Consolidated admin sidebar/panel |
| June Week -5 | [DEV-531](https://getmoneybot.atlassian.net/browse/DEV-531) | Website | Flying avatar (mobile version is DEV-669) |
| June Week -5 | [DEV-532](https://getmoneybot.atlassian.net/browse/DEV-532) | Teacher | AI Studio → Magic Studio |
| June Week -5 | [DEV-539](https://getmoneybot.atlassian.net/browse/DEV-539) | MoneyHub | Migrated to Railway |
| June Week -5 | [DEV-540](https://getmoneybot.atlassian.net/browse/DEV-540) | MoneyHub | Teachers resource hub URL change |
| June Week -5 | [DEV-542](https://getmoneybot.atlassian.net/browse/DEV-542) | Teacher | Max class capacity |
| Aug Week -1 | [DEV-359](https://getmoneybot.atlassian.net/browse/DEV-359) | Landing | Merch page |
| Aug Week -1 | [DEV-474](https://getmoneybot.atlassian.net/browse/DEV-474) | Web | Content & curriculum |
| Aug Week -1 | [DEV-477](https://getmoneybot.atlassian.net/browse/DEV-477) | Web | Simulators |
| Aug Week -1 | [DEV-577](https://getmoneybot.atlassian.net/browse/DEV-577) | Web | Demo account flow |

June Week -5 mobile tickets (DEV-529/530/533/534/535/536/537/538) and Aug mobile tickets are in [mobile-sprint-prompts.md](./mobile-sprint-prompts.md).

Skipped here on purpose (not web product UI): DEV-572 email, DEV-587–593 security/architecture, DEV-597–602 docs, Stripe-on-iOS (DEV-594), Expo-only tickets.
