import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { coursesApi } from '../api/courses';
import { moneyverseApi } from '../api/moneyverse';
import { gamesApi } from '../api/games';
import { useAuth } from './AuthContext';
import { ensureModelCached, syncCharacterModels } from '../utils/modelCache';
import {
  cacheKeys,
  fetchWithCache,
  invalidateCache,
  readCache,
  writeCache,
  TTL,
} from '../utils/apiCache';
import { readOnboardingCompleted, persistOnboardingCompleted, inferOnboardingCompleted } from '../utils/onboardingStore';
import {
  getPendingCompletions,
  enqueuePendingCompletion,
  dequeuePendingCompletion,
} from '../utils/pendingCompletions';
import { localDate } from '../utils/localDate';
import { getFirstName } from '../utils/displayName';
import { syncStreakNotifications, areNotificationsSupported } from '../utils/notifications';

const UserProgressContext = createContext(null);

const BADGE_META = {
  first_lesson: { label: 'First Step', icon: '🎯', ionIcon: 'flag', color: '#3DDC5F' },
  module_1:     { label: 'Budget Master', icon: '💰', ionIcon: 'wallet', color: '#FFD700' },
  module_2:     { label: 'Savings Pro', icon: '📈', ionIcon: 'trending-up', color: '#00CED1' },
  module_3:     { label: 'Credit Wise', icon: '💳', ionIcon: 'card', color: '#9B59B6' },
  module_4:     { label: 'Tax Savvy', icon: '🧾', ionIcon: 'receipt', color: '#E67E22' },
  module_5:     { label: 'Insurance Expert', icon: '🛡️', ionIcon: 'shield-checkmark', color: '#E74C3C' },
  streak_7:     { label: '7-Day Streak', icon: '🔥', ionIcon: 'flame', color: '#FF6B35' },
  streak_30:    { label: '30-Day Streak', icon: '⚡', ionIcon: 'flash', color: '#F39C12' },
  all_courses:  { label: 'Graduate', icon: '🎓', ionIcon: 'school', color: '#3DDC5F' },
};

// Maps backend emoji module icons to reliable Ionicons names
const MODULE_ION_ICON = {
  '💰': 'wallet',
  '📈': 'trending-up',
  '💳': 'card',
  '🧾': 'receipt',
  '🛡️': 'shield-checkmark',
};

export function getModuleIonIcon(module) {
  return MODULE_ION_ICON[module?.icon] || 'book';
}

// Visual identity for each gamified financial-literacy rank tier.
const RANK_META = {
  bronze:   { ionIcon: 'medal',     color: '#CD7F32', gradient: ['#C68642', '#8C5A2B'] },
  silver:   { ionIcon: 'medal',     color: '#AEB9C4', gradient: ['#CBD5DF', '#8A97A3'] },
  gold:     { ionIcon: 'trophy',    color: '#F5B72B', gradient: ['#FFD75E', '#E0A21B'] },
  platinum: { ionIcon: 'diamond',   color: '#56C8E8', gradient: ['#7FE0F0', '#3CA6C8'] },
  diamond:  { ionIcon: 'sparkles',  color: '#A66BFF', gradient: ['#C89BFF', '#7B3FF2'] },
};

export function getRankMeta(key) {
  return RANK_META[key] || RANK_META.bronze;
}

export { BADGE_META, RANK_META };

// Client-side fallback so the Daily Reward card stays visible even if a stats
// payload arrives without an embedded daily_reward (e.g. right after onboarding).
// The backend is authoritative and overwrites this on the next successful fetch.
const DEFAULT_DAILY_REWARD = {
  tiers: [5, 10, 15, 20, 30, 40, 75].map((bot_bucks, i) => ({ day: i + 1, bot_bucks })),
  current_day: 1,
  claim_amount: 5,
  can_claim: true,
  claimed_today: false,
  daily_claim_streak: 0,
};

export function UserProgressProvider({ children }) {
  const { token, user } = useAuth();
  const [xp, setXp] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [lastActive, setLastActive] = useState(null);
  const [badges, setBadges] = useState([]);
  const [completedLessonIds, setCompletedLessonIds] = useState(new Set());
  // Accumulates every lesson id known completed this session. Completions are
  // permanent, so we only ever add — this lets us overlay completion onto any
  // modules payload and guarantee the roadmap never regresses a finished lesson
  // if a background fetch briefly returns a stale snapshot (root cause of the
  // "repeats the same lesson until I restart the app" bug).
  const completedIdsRef = useRef(new Set());
  const [lessonsCompleted, setLessonsCompleted] = useState(0);
  const [modules, setModules] = useState([]);
  const [botBucks, setBotBucks] = useState(0);
  const [equippedCharacter, setEquippedCharacter] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const syncGeneration = useRef(0);
  const charactersRef = useRef([]);
  const charactersFetchRef = useRef({ at: 0, promise: null });
  const CHARACTERS_TTL_MS = 5 * 60 * 1000;
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [onboardingScore, setOnboardingScore] = useState(0);
  const [onboardingTotal, setOnboardingTotal] = useState(5);
  const [onboardingGoals, setOnboardingGoals] = useState([]);
  const [rank, setRank] = useState(null);
  const [badgeCatalog, setBadgeCatalog] = useState([]);
  const [dailyReward, setDailyReward] = useState(null);
  const [streakGoal, setStreakGoal] = useState(7);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // Set right after the user finishes onboarding so the app can land them
  // on the Moneyverse tab to meet their free starter character.
  const [pendingFirstLesson, setPendingFirstLesson] = useState(false);
  const [pendingMoneyverseIntro, setPendingMoneyverseIntro] = useState(false);

  const refreshStreakNotifications = useCallback((statsData, { activeToday } = {}) => {
    if (!areNotificationsSupported() || !user) return;
    const resolvedActiveToday = activeToday ?? statsData.last_active === localDate();
    syncStreakNotifications({
      firstName: getFirstName(user),
      streakDays: statsData.streak_days ?? 0,
      activeToday: resolvedActiveToday,
    }).catch(() => {});
  }, [user]);

  // Overlay session-known completions onto a modules array so a stale server
  // snapshot can never show a finished lesson as incomplete (which would re-lock
  // the roadmap and loop the user on the same lesson).
  const overlayCompleted = useCallback((mods) => {
    if (!Array.isArray(mods)) return [];
    const done = completedIdsRef.current;
    if (done.size === 0) return mods;
    return mods.map((mod) => {
      const lessons = mod.lessons || [];
      let changed = false;
      const newLessons = lessons.map((l) => {
        if (done.has(l.id) && !l.is_completed) {
          changed = true;
          return { ...l, is_completed: true };
        }
        return l;
      });
      if (!changed) return mod;
      const completedCount = newLessons.filter((l) => l.is_completed).length;
      return {
        ...mod,
        lessons: newLessons,
        completed_lesson_count: Math.max(mod.completed_lesson_count || 0, completedCount),
      };
    });
  }, []);

  const applyStats = useCallback((statsData, gen = null, { syncGate = true } = {}) => {
    // Drop results from a superseded fetch so a slow/stale stats response can't
    // clobber fresher values (e.g. a just-incremented streak from completeLesson
    // or a newer background refresh). See DEV-460.
    if (gen !== null && gen !== syncGeneration.current) return;
    setXp(statsData.xp);
    setStreakDays(statsData.streak_days);
    setLastActive(statsData.last_active ?? null);
    setBadges(statsData.badges || []);
    // Union with the session set — completions only accumulate, so a stale
    // stats payload can never un-complete a lesson we already know is done.
    const merged = new Set([
      ...completedIdsRef.current,
      ...(statsData.completed_lesson_ids || []),
    ]);
    completedIdsRef.current = merged;
    setCompletedLessonIds(merged);
    setLessonsCompleted(Math.max(statsData.lessons_completed || 0, merged.size));
    setBotBucks(statsData.bot_bucks || 0);
    setEquippedCharacter(statsData.equipped_character || null);
    const completed = inferOnboardingCompleted(statsData);
    setOnboardingScore(statsData.onboarding_score || 0);
    setOnboardingTotal(statsData.onboarding_total || 5);
    if (Array.isArray(statsData.onboarding_goals)) {
      setOnboardingGoals(statsData.onboarding_goals);
    }
    setRank(statsData.rank || null);
    if (statsData.badge_catalog) setBadgeCatalog(statsData.badge_catalog);
    // Always keep a daily_reward object so the card never disappears (DEV-459).
    setDailyReward(statsData.daily_reward || DEFAULT_DAILY_REWARD);
    if (typeof statsData.streak_goal === 'number' && statsData.streak_goal > 0) {
      setStreakGoal(statsData.streak_goal);
    }
    // `syncGate` lets submitOnboarding record a completed baseline WITHOUT
    // flipping the navigation gate, so the rank reveal can play first.
    if (syncGate) {
      setOnboardingCompleted(completed);
      if (user?.id) {
        persistOnboardingCompleted(user.id, completed);
      }
    }
    refreshStreakNotifications(statsData);
  }, [user?.id, refreshStreakNotifications]);

  const getBadgeMeta = useCallback((key) => {
    const fromCatalog = badgeCatalog.find((b) => b.key === key);
    if (fromCatalog) {
      return {
        ...fromCatalog,
        label: fromCatalog.name,
        ionIcon: fromCatalog.ion_icon,
        color: fromCatalog.accent_color,
      };
    }
    return BADGE_META[key] || { key, label: key, ionIcon: 'ribbon', color: '#3DDC5F' };
  }, [badgeCatalog]);

  const loadCharacters = useCallback(async ({ force = false } = {}) => {
    if (!token || !user?.id) return null;

    const now = Date.now();
    if (!force && charactersFetchRef.current.at && now - charactersFetchRef.current.at < CHARACTERS_TTL_MS) {
      return null;
    }
    if (!force && charactersFetchRef.current.promise) {
      return charactersFetchRef.current.promise;
    }

    const charKey = cacheKeys.characters(user.id);

    const promise = (async () => {
      if (!force) {
        const cached = await readCache(charKey, {
          freshMs: TTL.CHARACTERS_FRESH_MS,
          staleMs: TTL.CHARACTERS_STALE_MS,
        });
        if (cached.data?.characters?.length) {
          charactersRef.current = cached.data.characters;
          setCharacters(cached.data.characters);
          if (typeof cached.data.bot_bucks === 'number') setBotBucks(cached.data.bot_bucks);
          charactersFetchRef.current.at = Date.now();
        }
      }

      const { data } = await fetchWithCache(
        charKey,
        () => moneyverseApi.getCharacters(token),
        {
          freshMs: TTL.CHARACTERS_FRESH_MS,
          staleMs: TTL.CHARACTERS_STALE_MS,
          force,
        },
      );

      const list = data.characters || [];
      charactersRef.current = list;
      charactersFetchRef.current.at = Date.now();
      setCharacters(list);
      return data;
    })().finally(() => {
      if (charactersFetchRef.current.promise === promise) {
        charactersFetchRef.current.promise = null;
      }
    });

    charactersFetchRef.current.promise = promise;
    return promise;
  }, [token, user?.id]);

  const fetchData = useCallback(async ({ refreshModels = false, background = false, showLoading = false } = {}) => {
    if (!token || !user?.id) {
      setLoading(false);
      return;
    }
    if (!background) {
      setLoadError(null);
    }
    if (showLoading) {
      setLoading(true);
    }
    const syncId = ++syncGeneration.current;
    try {
      const [statsData, modulesData, moneyverseData] = await Promise.all([
        coursesApi.getStats(token),
        coursesApi.getModules(token),
        loadCharacters({ force: refreshModels }).catch(() => null),
      ]);

      // A newer fetch started while this one was in flight — discard these
      // results so we don't overwrite fresher state or cache with stale data.
      if (syncId !== syncGeneration.current) {
        return;
      }

      const characterList = moneyverseData?.characters ?? charactersRef.current ?? [];
      if (moneyverseData?.characters) {
        setCharacters(moneyverseData.characters);
      }

      applyStats(statsData, syncId);
      // applyStats just refreshed completedIdsRef, so overlay reflects the
      // freshest known completions and can't regress the roadmap.
      const mergedModules = overlayCompleted(Array.isArray(modulesData) ? modulesData : []);
      setModules(mergedModules);

      await writeCache(cacheKeys.progress(user.id), {
        stats: statsData,
        modules: mergedModules,
      });

      const priorityUrl = statsData.equipped_character?.model_url;
      if (priorityUrl) {
        try {
          await ensureModelCached(priorityUrl);
        } catch (e) {
          // logged inside modelCache
        }
      }

      if (syncId === syncGeneration.current) {
        syncCharacterModels(characterList, {
          forceRefresh: refreshModels,
          priorityUrls: priorityUrl ? [priorityUrl] : [],
        }).catch(() => {});
      }
    } catch (e) {
      if (!background) {
        setLoadError(e.message || 'Could not load your progress.');
      }
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[MoneyBot] Progress fetch failed:', e.message, e.status);
      }
    } finally {
      setLoading(false);
    }
  }, [token, user?.id, loadCharacters, applyStats, overlayCompleted]);

  const hydrateFromCache = useCallback(async (userId) => {
    const cached = await readCache(cacheKeys.progress(userId), {
      freshMs: TTL.PROGRESS_STALE_MS,
      staleMs: TTL.PROGRESS_STALE_MS,
    });
    if (!cached.data?.stats) {
      return { hydrated: false, onboardingCompleted: false };
    }

    applyStats(cached.data.stats);
    setModules(overlayCompleted(Array.isArray(cached.data.modules) ? cached.data.modules : []));

    const charCached = await readCache(cacheKeys.characters(userId), {
      freshMs: TTL.CHARACTERS_STALE_MS,
      staleMs: TTL.CHARACTERS_STALE_MS,
    });
    if (charCached.data?.characters?.length) {
      charactersRef.current = charCached.data.characters;
      setCharacters(charCached.data.characters);
      if (typeof charCached.data.bot_bucks === 'number') {
        setBotBucks(charCached.data.bot_bucks);
      }
    }

    return {
      hydrated: true,
      onboardingCompleted: inferOnboardingCompleted(cached.data.stats),
    };
  }, [applyStats, overlayCompleted]);

  const refreshCharacterCache = useCallback(async (forceRefresh = false) => {
    if (!token) return;
    setCharactersLoading(true);
    try {
      const data = await loadCharacters({ force: forceRefresh });
      const characterList = data?.characters ?? charactersRef.current ?? [];
      if (data && typeof data.bot_bucks === 'number') setBotBucks(data.bot_bucks);
      const priorityUrl = equippedCharacter?.model_url;
      await syncCharacterModels(characterList, {
        forceRefresh: forceRefresh,
        priorityUrls: priorityUrl ? [priorityUrl] : [],
      });
    } catch (e) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[MoneyBot] Character cache refresh failed:', e.message);
      }
    } finally {
      setCharactersLoading(false);
    }
  }, [token, equippedCharacter?.model_url, loadCharacters]);

  useEffect(() => {
    if (user?.id) {
      setLoading(true);
      // New session for this user — start the completed-lesson overlay empty so
      // a previous account's completions can't leak in; hydrate/fetch repopulate.
      completedIdsRef.current = new Set();
      let cancelled = false;
      (async () => {
        const storedCompleted = await readOnboardingCompleted(user.id);
        if (cancelled) return;
        if (storedCompleted) {
          setOnboardingCompleted(true);
        }

        const { hydrated, onboardingCompleted: cachedCompleted } = await hydrateFromCache(user.id);
        if (cancelled) return;

        const knownCompleted = storedCompleted || cachedCompleted;
        if (knownCompleted) {
          setLoading(false);
        }

        await fetchData({ background: knownCompleted || hydrated });
        if (cancelled) return;
        // Retry any completions that failed to reach the server last session so
        // a killed/offline app still catches up (and never re-locks the lesson).
        flushPendingCompletions().catch(() => {});
      })();
      return () => { cancelled = true; };
    }
    setOnboardingCompleted(false);
    setRank(null);
    setCharacters([]);
    charactersRef.current = [];
    charactersFetchRef.current = { at: 0, promise: null };
    setLoading(false);
  }, [user?.id, fetchData, hydrateFromCache]);

  function invalidateCharactersMetadata() {
    charactersFetchRef.current = { at: 0, promise: null };
  }

  function markLessonCompletedLocally(lessonId) {
    if (completedIdsRef.current.has(lessonId)) {
      // Still re-apply the overlay in case a stale modules snapshot re-locked it.
      setModules((prev) => overlayCompleted(prev));
      return;
    }
    completedIdsRef.current = new Set([...completedIdsRef.current, lessonId]);
    setCompletedLessonIds(new Set(completedIdsRef.current));
    setModules((prev) => overlayCompleted(prev));
  }

  // Fold the server's authoritative completion list into the session set so the
  // roadmap reconciles straight from the /complete/ response — no dependence on
  // a follow-up GET that might still be serving a stale snapshot.
  function mergeCompletedIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const before = completedIdsRef.current;
    const merged = new Set([...before, ...ids]);
    if (merged.size === before.size) return;
    completedIdsRef.current = merged;
    setCompletedLessonIds(merged);
    setModules((prev) => overlayCompleted(prev));
  }

  // A 4xx (except throttling/timeout) is a permanent failure for THIS request —
  // retrying it forever would be pointless, so we stop queueing/retrying it.
  function isPermanentCompletionError(status) {
    return typeof status === 'number' && status >= 400 && status < 500
      && status !== 408 && status !== 429;
  }

  // Retry any completions whose POST previously failed (offline / dropped
  // response). Runs on boot and on refresh so the server always catches up.
  const flushPendingCompletions = useCallback(async () => {
    if (!token || !user?.id) return;
    const pending = await getPendingCompletions(user.id);
    if (!pending.length) return;
    let changed = false;
    for (const entry of pending) {
      try {
        const result = await coursesApi.completeLesson(token, entry.lessonId, entry.mistakes || 0);
        markLessonCompletedLocally(entry.lessonId);
        mergeCompletedIds(result.completed_lesson_ids);
        await dequeuePendingCompletion(user.id, entry.lessonId);
        changed = true;
      } catch (e) {
        if (isPermanentCompletionError(e?.status)) {
          // Give up on this one so it can't wedge the queue.
          await dequeuePendingCompletion(user.id, entry.lessonId);
          changed = true;
        }
        // else: transient — leave it queued for the next flush.
      }
    }
    if (changed) {
      await invalidateCache(cacheKeys.progress(user.id));
    }
  }, [token, user?.id, overlayCompleted]);

  async function completeLesson(lessonId, mistakes = 0) {
    if (!token || !user?.id) return null;
    const clientDate = localDate();
    // Advance the roadmap instantly and permanently BEFORE the network call, so
    // a slow or failed request can never leave a finished lesson looking
    // incomplete. The overlay is permanent for the session and self-heals
    // against stale fetches (root cause of the "says I didn't finish it until I
    // restart the app" bug).
    markLessonCompletedLocally(lessonId);
    try {
      const result = await coursesApi.completeLesson(token, lessonId, mistakes);
      // Succeeded — clear any earlier failed attempt for this same lesson.
      await dequeuePendingCompletion(user.id, lessonId);
      if (!result.already_completed) {
        // Invalidate any in-flight stats fetch so its (pre-completion) response
        // can't land after us and revert the streak we just earned (DEV-460).
        syncGeneration.current += 1;
        setXp((prev) => prev + (result.xp_earned || 0));
        if (result.stats) {
          setStreakDays(result.stats.streak_days);
          setBadges(result.stats.badges || []);
          setBotBucks(result.stats.bot_bucks ?? botBucks);
          refreshStreakNotifications(result.stats, { activeToday: true });
        }
        setLastActive(localDate());
        setLessonsCompleted((prev) => prev + 1);
      }
      // Reconcile from the authoritative server list in THIS response.
      mergeCompletedIds(result.completed_lesson_ids);
      // Always reconcile with the server so a drifted client self-heals.
      await invalidateCache(cacheKeys.progress(user.id));
      await fetchData({ background: true });
      return result;
    } catch (e) {
      // The POST failed (offline / dropped response). Keep the optimistic mark
      // and persist a retry so the server still records the completion — even
      // across an app kill. A permanent 4xx (e.g. lesson removed) isn't queued.
      if (!isPermanentCompletionError(e?.status)) {
        await enqueuePendingCompletion(user.id, { lessonId, mistakes, clientDate });
      }
      // Return a truthy result so the celebration screen still shows success;
      // fallbacks supply the displayed XP/Bot Bucks.
      return { already_completed: false, pending: true };
    }
  }

  async function purchaseCharacter(characterId) {
    if (!token || !user?.id) return null;
    const result = await moneyverseApi.purchaseCharacter(token, characterId);
    if (typeof result.bot_bucks === 'number') {
      setBotBucks(result.bot_bucks);
    }
    if (result.character?.model_url) {
      ensureModelCached(result.character.model_url).catch(() => {});
    }
    await invalidateCache(cacheKeys.progress(user.id));
    await invalidateCache(cacheKeys.characters(user.id));
    charactersFetchRef.current = { at: 0, promise: null };
    return result;
  }

  async function equipCharacter(characterId) {
    if (!token || !user?.id) return null;
    const result = await moneyverseApi.equipCharacter(token, characterId);
    const next = result.character || null;
    setEquippedCharacter(next);
    if (next?.model_url) {
      ensureModelCached(next.model_url).catch(() => {});
    }
    await invalidateCache(cacheKeys.progress(user.id));
    return result;
  }

  async function claimStarterCharacter() {
    if (!token || !user?.id) return null;
    try {
      const result = await moneyverseApi.claimStarter(token);
      if (typeof result.bot_bucks === 'number') {
        setBotBucks(result.bot_bucks);
      }
      const next = result.character || null;
      if (next) {
        setEquippedCharacter(next);
        if (next.model_url) {
          ensureModelCached(next.model_url).catch(() => {});
        }
      }
      await invalidateCache(cacheKeys.progress(user.id));
      await invalidateCache(cacheKeys.characters(user.id));
      charactersFetchRef.current = { at: 0, promise: null };
      return result;
    } catch (e) {
      console.log('[claimStarterCharacter] failed:', e?.message || e);
      return null;
    }
  }

  // Submit the assessment and store the result, but DON'T flip the navigation
  // gate yet so the onboarding screen can show the rank reveal first.
  async function submitOnboarding(answers, goals = []) {
    if (!token) return null;
    try {
      const result = await coursesApi.submitOnboarding(token, answers, goals);
      const stats = result.stats || {};
      let mergedStats = {
        ...stats,
        onboarding_completed: true,
        onboarding_score: result.score ?? stats.onboarding_score ?? 0,
        onboarding_goals: goals,
        rank: result.rank ?? stats.rank ?? null,
      };
      // syncGate:false — update XP/rank/etc. now but DON'T flip the navigation
      // gate yet, so the onboarding screen can show the rank reveal first.
      if (user?.id) {
        const cached = await readCache(cacheKeys.progress(user.id), {
          freshMs: TTL.PROGRESS_STALE_MS,
          staleMs: TTL.PROGRESS_STALE_MS,
        });
        mergedStats = {
          ...(cached.data?.stats || {}),
          ...mergedStats,
        };
        applyStats(mergedStats, null, { syncGate: false });
        await writeCache(cacheKeys.progress(user.id), {
          stats: mergedStats,
          modules: cached.data?.modules || [],
        });
      } else {
        applyStats(mergedStats, null, { syncGate: false });
      }
      return result;
    } catch (e) {
      return null;
    }
  }

  // Update the user's selected goals from Settings (post-onboarding edit).
  async function updateGoals(goals = []) {
    if (!token) return null;
    const previous = onboardingGoals;
    setOnboardingGoals(goals); // optimistic
    try {
      const result = await coursesApi.updateGoals(token, goals);
      const saved = result.onboarding_goals || goals;
      setOnboardingGoals(saved);
      if (user?.id) {
        await invalidateCache(cacheKeys.progress(user.id));
      }
      return saved;
    } catch (e) {
      setOnboardingGoals(previous); // revert on failure
      throw e;
    }
  }

  // Flip the gate so the root navigator swaps onboarding for the main app,
  // and land the user on the Moneyverse tab to meet their free starter character.
  function finishOnboarding() {
    setPendingMoneyverseIntro(true);
    setPendingFirstLesson(false);
    setOnboardingCompleted(true);
    if (user?.id) {
      persistOnboardingCompleted(user.id, true);
    }
  }

  function clearPendingFirstLesson() {
    setPendingFirstLesson(false);
  }

  function clearPendingMoneyverseIntro() {
    setPendingMoneyverseIntro(false);
  }

  function isLessonCompleted(lessonId) {
    return completedLessonIds.has(lessonId);
  }

  async function claimDailyReward({ streakGoal: nextGoal } = {}) {
    if (!token || !user?.id || claimingDaily) return null;
    setClaimingDaily(true);
    try {
      const result = await coursesApi.claimDailyReward(token, { streakGoal: nextGoal });
      if (typeof result.bot_bucks === 'number') setBotBucks(result.bot_bucks);
      if (result.daily_reward) setDailyReward(result.daily_reward);
      if (result.badges) setBadges(result.badges);
      if (typeof result.stats?.streak_days === 'number') setStreakDays(result.stats.streak_days);
      const goal = result.streak_goal ?? result.stats?.streak_goal;
      if (typeof goal === 'number') setStreakGoal(goal);
      await invalidateCache(cacheKeys.progress(user.id));
      return result;
    } catch (e) {
      return null;
    } finally {
      setClaimingDaily(false);
    }
  }

  async function startArcadeGame(gameKey) {
    if (!token || !user?.id) return null;
    try {
      const result = await gamesApi.startGame(token, gameKey);
      if (typeof result.bot_bucks === 'number') setBotBucks(result.bot_bucks);
      await invalidateCache(cacheKeys.progress(user.id));
      return result;
    } catch (e) {
      throw e;
    }
  }

  async function finishArcadeGame(gameKey, sessionId, score) {
    if (!token || !user?.id) return null;
    try {
      const result = await gamesApi.finishGame(token, gameKey, sessionId, score);
      if (typeof result.bot_bucks === 'number') setBotBucks(result.bot_bucks);
      if (typeof result.xp_earned === 'number' && result.xp_earned > 0) {
        setXp((prev) => prev + result.xp_earned);
      }
      if (result.stats?.badges) setBadges(result.stats.badges);
      await invalidateCache(cacheKeys.progress(user.id));
      return result;
    } catch (e) {
      return null;
    }
  }

  // XP level system: each level requires 200 XP
  const XP_PER_LEVEL = 200;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInCurrentLevel = xp % XP_PER_LEVEL;
  const xpProgress = xpInCurrentLevel / XP_PER_LEVEL;

  const refresh = useCallback(async (opts = {}) => {
    // Opportunistically drain any queued completions on every manual/focus
    // refresh so a transient failure self-heals without an app restart.
    await flushPendingCompletions();
    return fetchData({ background: false, ...opts });
  }, [fetchData, flushPendingCompletions]);

  return (
    <UserProgressContext.Provider
      value={{
        xp,
        streakDays,
        lastActive,
        badges,
        completedLessonIds,
        lessonsCompleted,
        modules,
        botBucks,
        equippedCharacter,
        characters,
        charactersLoading,
        onboardingCompleted,
        onboardingScore,
        onboardingTotal,
        onboardingGoals,
        updateGoals,
        pendingFirstLesson,
        clearPendingFirstLesson,
        pendingMoneyverseIntro,
        clearPendingMoneyverseIntro,
        rank,
        badgeCatalog,
        dailyReward,
        streakGoal,
        claimingDaily,
        getBadgeMeta,
        loading,
        loadError,
        level,
        xpInCurrentLevel,
        xpProgress,
        XP_PER_LEVEL,
        completeLesson,
        submitOnboarding,
        finishOnboarding,
        purchaseCharacter,
        equipCharacter,
        claimStarterCharacter,
        claimDailyReward,
        startArcadeGame,
        finishArcadeGame,
        isLessonCompleted,
        refresh,
        refreshCharacterCache,
        invalidateCharactersMetadata,
      }}
    >
      {children}
    </UserProgressContext.Provider>
  );
}

export function useUserProgress() {
  const ctx = useContext(UserProgressContext);
  if (!ctx) throw new Error('useUserProgress must be used within UserProgressProvider');
  return ctx;
}
