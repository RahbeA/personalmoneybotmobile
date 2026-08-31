# MoneyBot mobile app flowchart

Real navigation as of the Expo app in `mobile/`. Names match screen and component identifiers in `mobile/App.js` and `mobile/src/navigation/MainTabNavigator.js`.

## 1. Cold start → splash → auth / guest → onboarding → tabs

```mermaid
flowchart TD
  Start([App mount]) --> Cache[ensureCacheScope]
  Cache --> Providers[ThemeProvider / AuthProvider / UserProgressProvider / NotificationsProvider]
  Providers --> NameCapture[NameCapturePrompt overlay]
  Providers --> Root[RootNavigator]

  Root --> Boot{booting OR splashDone false?}
  Boot -->|yes| Splash[WelcomeSplash]
  Splash -->|ready + onDone| Root
  Boot -->|no| LoadErr{signed-in AND onboarding incomplete AND loadError?}
  LoadErr -->|yes| BootError[BootErrorScreen]
  LoadErr -->|no| Authed{user?}

  Authed -->|no| LoggedOut[Stack: Landing, Auth, Legal]
  LoggedOut --> Landing[LandingScreen]
  Landing -->|guestSignIn| Session[session set → RootNavigator re-renders]
  Landing -->|Sign in / Create account| Auth[AuthScreen]
  Landing -->|legal links| Legal[LegalDocumentScreen]

  Authed -->|yes| Gate{onboardingCompleted?}
  Gate -->|no| Onboarding[Stack.Screen Onboarding → OnboardingScreen]
  Gate -->|yes| Main[Stack.Screen Main → MainTabNavigator]
  Authed -->|yes| SignedInExtras[AuthUpgrade / MyInvites / Paywall / Legal]

  Onboarding -->|finishOnboarding| Main
  Main -->|pendingMoneyverseIntro| MoneyverseTab
  Main -->|else| HomeTab
```

`NameCapturePrompt` is not a stack route. It is a modal over the tree after onboarding when `user.name` is blank.

## 2. Invite-only signup vs returning Apple / Google

```mermaid
flowchart TD
  Auth[AuthScreen] --> Mode{mode}
  Mode -->|login| Login[email login / Apple / Google — no invite]
  Mode -->|register| InviteCheck{inviteOnlyEnabled?}

  InviteCheck -->|yes| NeedsCode[needsInvite: invite code required]
  NeedsCode -->|invalid / empty| Block[block create-account]
  NeedsCode -->|valid| Register[register + inviteCode]
  InviteCheck -->|no| Register

  Apple[handleApple] --> BackendApple[appleSignIn identityToken + optional inviteCode]
  Google[handleGoogle] --> BackendGoogle[googleSignIn idToken + optional inviteCode]
  Existing[Existing Apple/Google sign-in skips invite] --> BackendApple
  Existing --> BackendGoogle

  Register --> Session[signed-in session]
  Login --> Session
  BackendApple --> Session
  BackendGoogle --> Session
  Session --> Gate{onboardingCompleted from stats?}
  Gate -->|no| OnboardingScreen
  Gate -->|yes| MainTabNavigator

  GuestUpgrade[guest on AuthUpgrade] --> SameAuth[AuthScreen register/login]
  SameAuth --> dismissIfUpgrade[goBack if already in signed-in stack]
```

## 3. Onboarding phases

```mermaid
flowchart LR
  loading --> greet
  greet --> goals
  goals --> question
  question --> between
  between --> question
  question -->|last answer| calculating
  calculating --> reveal
  reveal --> reward
  reward --> streak
  streak --> notifications
  notifications --> character
  character -->|finishOnboarding + pendingMoneyverseIntro| MainTabNavigator
  loading -->|fetch fail| error
  calculating -->|submit fail| submitError
  error -->|Continue| finishOnboarding
  submitError -->|Try again| calculating
```

Phases live in `OnboardingScreen`. Empty quiz catalog skips `question` and submits from `goals`.

## 4. Main tabs

```mermaid
flowchart TD
  Tabs[MainTabNavigator CustomTabBar] --> HomeTab[HomeTab → HomeStackNavigator]
  Tabs --> MoneyverseTab[MoneyverseTab → MoneyverseStackNavigator]
  Tabs --> SocialTab[SocialTab → SocialStackNavigator]
  Tabs --> TutorTab[TutorTab → TutorStackNavigator]
  Tabs --> SettingsTab[SettingsTab → SettingsScreen]

  HomeTab --> Home[HomeScreen]
  MoneyverseTab --> Moneyverse[MoneyverseScreen]
  SocialTab --> Friends[FriendsScreen]
  TutorTab --> Tutor[TutorScreen]
```

`LESSON_ROUTES` in `MainTabNavigator` hides `CustomTabBar` on lesson, daily, arcade, social nested, feed compose, and Paywall screens.

## 5. Lesson completion path

```mermaid
flowchart TD
  Home[HomeScreen] -->|handleLessonPress / Continue| Intro[LessonIntroScreen]
  Intro -->|replace| Flow[QuestionFlowScreen]
  Flow -->|replace| Complete[LessonCompleteScreen]
  Complete -->|completeLesson| Result{new_badge? module_complete?}

  Result -->|new badge| Reveal[BadgeRevealScreen mode earned]
  Reveal -->|next MoneyChat| Chat[MoneyChatScreen]
  Reveal -->|next Home| Home
  Result -->|module complete, no badge nav| Chat
  Result -->|else| Home

  Chat -->|replace| ModDone[ModuleCompleteScreen]
  ModDone -->|badge tap| RevealView[BadgeRevealScreen mode view]
  ModDone -->|continue| Home
```

Registered on `HomeStackNavigator` with those names: `LessonIntro`, `QuestionFlow`, `LessonComplete`, `MoneyChat`, `ModuleComplete`, `BadgeReveal`.

## 6. Daily puzzle

```mermaid
flowchart TD
  Home[HomeScreen Daily Puzzle puck] -->|navigate DailyBlitz| Daily[DailyBlitzScreen]
  Daily --> Phases[loading → intro → playing → result / error]
  Daily -->|DailyLeaderboard| Board[DailyLeaderboardScreen]
  Phases -->|rounds| Estimate[EstimateRound]
  Phases --> Higher[HigherLowerRound]
  Phases --> Sequence[SequenceRound]
  Phases --> DailyResult
```

Tab bar is hidden while `DailyBlitz` / `DailyLeaderboard` is focused.

## 7. Moneyverse purchase / equip + paywall

```mermaid
flowchart TD
  MV[MoneyverseScreen] -->|character card| Detail[CharacterDetailScreen]
  MV -->|openHats| Hats[HatsScreen]
  MV -->|openPaywall| Paywall[PaywallScreen]

  Detail -->|requireAccount if guest| AuthUpgrade[root AuthUpgrade]
  Detail -->|purchaseCharacter| Buy{item.is_premium && !isPremium?}
  Buy -->|yes / 403 premium_required| Paywall
  Buy -->|Bot Bucks| Owned[is_owned]
  Detail -->|equipCharacter| Equipped[equippedCharacter on stats]

  Hats --> Paywall
  RootPaywall[root stack Paywall] -.-> Paywall
```

`Paywall` is registered on the root stack (`App.js`), `HomeStackNavigator`, and `MoneyverseStackNavigator`. `openPaywall(navigation)` walks parents until it finds a `Paywall` route. Purchase CTA on `PaywallScreen` is a stub (no RevenueCat).

## 8. Social, invites, feed

```mermaid
flowchart TD
  Friends[FriendsScreen SocialTab root] --> Feed[FeedScreen]
  Friends --> ContactInvite[ContactInviteScreen]
  Friends --> FriendRequests[FriendRequestsScreen]
  Friends --> MyFriends[MyFriendsScreen]
  Friends --> Groups[GroupsScreen]

  Groups --> CreateGroup[CreateGroupScreen]
  CreateGroup -->|replace| GroupDetail[GroupDetailScreen]
  Groups --> GroupDetail
  GroupDetail --> InviteFriends[InviteFriendsScreen]
  GroupDetail --> GroupLeaderboard[GroupLeaderboardScreen]
  GroupDetail --> CreateChallenge[CreateChallengeScreen]
  CreateChallenge -->|replace| ChallengeLeaderboard[ChallengeLeaderboardScreen]

  Feed --> ComposeFeed[ComposeFeedScreen]
  Notifications[NotificationsScreen] --> FriendRequests
  Notifications --> MyFriends
  Notifications --> RootInvites[root MyInvites]

  Settings[SettingsScreen] -->|getParent navigate| RootInvites
  Settings -->|guest| AuthUpgrade[AuthUpgrade AuthScreen]
```

`MyInvitesScreen` is a **root** stack screen (`App.js`), not inside `SocialStackNavigator`. Group invites use `InviteFriendsScreen` on the social stack.

## 9. Home stack extras

`HomeStackNavigator` also registers (even if Home does not always deep-link them): `Leaderboard`, `Arcade`, `BudgetBlitz`, `InflationDodge`, `CreditClimb`, `ScamSpotter`, `DailyBlitz`, `DailyLeaderboard`, `BadgeReveal`, `Paywall`.

Arcade games are nested under `Arcade` / the named game screens on the Home stack. Tutor is `TutorStackNavigator` → `TutorScreen` only.

## 10. Badge preview

```mermaid
flowchart LR
  HomeChips[HomeScreen catalog badges] -->|navigate BadgeReveal mode view| Reveal[BadgeRevealScreen]
  Reveal -->|locked| HowTo[How to earn from catalog description + metric]
  Reveal -->|earned / lesson award| Unlocked[confetti + Nice]
```

Locked Home chips already navigate to `BadgeReveal`. Earn rules come from `badgeCatalog` (`description`, `metric`, `threshold`, `module_id`). Backend evaluators include `hats_owned` and `friends_count`. A `module_completed` badge with no `module_id` cannot be earned until admin assigns a module.
