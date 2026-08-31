# Sprint backend contract

Shared API for the June Week -5 / Aug Week mobile tickets. **Do not invent new UserStats fields, Feed/Hat/Tip models, or duplicate endpoints.** Read this before writing mobile UI.

## UserStats (already on `GET /api/courses/stats/`)

| Field | Type | Tickets |
|---|---|---|
| `is_premium` | bool | DEV-576, DEV-594 |
| `chat_personality` | `chill` \| `coach` \| `funny` \| `teacher` (default `chill`) | DEV-656 |
| `equipped_hat` | hat object or `null` | DEV-579 |
| `equipped_character` | character object or `null` | existing |
| `money_tip` | `{id, body, category}` or `null` | DEV-660, DEV-661 |
| `onboarding_goals` | string[] | DEV-538, DEV-661 |

Mobile hub: `useUserProgress()` exposes `isPremium`, `chatPersonality`, `equippedHat`, `moneyTip`, `updatePersonality`, `purchaseHat`, `equipHat`.

Premium for local testing: admin Users → Adjust → Premium.

## Characters / hats

- `GET /api/moneyverse/characters/` includes `is_premium` per character.
- `POST /api/moneyverse/characters/:id/purchase/` returns **403** `{code: "premium_required"}` if the item is premium and the user is not.
- `GET /api/moneyverse/hats/`
- `POST /api/moneyverse/hats/:id/purchase/`
- `POST /api/moneyverse/equip-hat/` body `{hat_id}` or `{hat_id: null}` to unequip.

Clients: `moneyverseApi.getHats / purchaseHat / equipHat`. Cache key `cacheKeys.hats(userId)`.

Hats are 2D `preview_image` overlays on `BrandAvatar` / shop cards. Do not require 3D hat meshes.

## Personality + tips

- `PATCH /api/courses/personality/` `{chat_personality}`
- `GET /api/courses/money-tip/` `{tip}` (also embedded on stats as `money_tip`)
- Tip categories: `general | budget | investing | credit | saving | stocks`
- Goal keys already used in onboarding map to categories in `backend/courses/tips.py`.

Admin: control panel **Money Tips**, **Hats**, **Feed**.

## Feed (DEV-535)

- `GET /api/social/feed/` approved posts only
- `POST /api/social/feed/` multipart `image` + `caption` + optional `link` → status `pending`
- `GET /api/social/feed/mine/` author’s posts including pending/rejected
- Admin: `/feed/` approve / reject

`socialApi.getFeed / getMyFeed / createFeedPost(token, formData)`. `apiRequest` already sends FormData as multipart (do not set JSON Content-Type).

Do not add likes, stories, or DMs.

## Contacts (DEV-536)

Never upload raw phone numbers.

1. Hash with `mobile/src/utils/phoneHash.js` (`hashPhone` / `hashPhones`) — SHA-256 of E.164.
2. `POST /api/social/contacts/register/` `{phone_hash}` for the signed-in user.
3. `POST /api/social/contacts/match/` `{hashes: [...]}` max 200.

Matches reuse `serialize_user_brief` + `friendship_status`. Invite non-matches with existing invite share copy (`MyInvitesScreen` / `brandCopy.js`).

## Already shipped — do not rebuild

Invites, GLB cache, leaderboard, AI chat screens, splash, Moneyverse previews, Home+Learn merge, lesson completion, `PuckButton`, Daily Puzzle label, `FriendNudge` (one per friend per day), unique `DailyChallenge` per date.

Nudge: `POST /api/social/users/:id/nudge/` already exists. Polish UX only.

## Premium paywall (DEV-576 / DEV-594)

There is **no RevenueCat wiring yet**. Use `isPremium` from stats. Admin grant is enough for v1. If you add a Paywall screen, stub the purchase CTA and do not invent a second `is_premium` flag.

Premium shop items must check `item.is_premium && !isPremium` and show the paywall / `premium_required` error.

## Badges

Admin metrics now include `hats_owned` and `friends_count`. Do not add parallel local badge lists; use `badgeCatalog` from stats.

## File ownership for parallel agents

Do **not** edit these files (parent owns the contract):

- `backend/courses/models.py`, `backend/moneyverse/models.py`, `backend/social/models.py`, `backend/accounts/models.py`
- `backend/courses/views.py`, `backend/courses/tips.py`, `backend/courses/badges.py`
- `backend/moneyverse/views.py`, `backend/social/views.py` (feed/contacts already exist)
- `mobile/src/context/UserProgressContext.js`
- `mobile/src/api/courses.js`, `mobile/src/api/moneyverse.js`, `mobile/src/api/social.js`, `mobile/src/api/client.js`
- `docs/sprint-backend-contract.md`

If you need a new Django field, stop and say so. Do not add it yourself.

## Style

Expo 56, JavaScript (not TypeScript), `useTheme()`, `PuckButton`, `BrandHeader` / `BrandAvatar` / `BrandLoader` / `BrandEmptyState`, `requireAccount()` for guests, `apiCache.js`. No extra tabs unless the ticket truly needs one. No drive-by refactors. No new markdown files.
