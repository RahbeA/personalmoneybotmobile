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
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // Set right after the user finishes onboarding so the app can drop them
  // straight into their first lesson instead of the Home tab.
  const [pendingFirstLesson, setPendingFirstLesson] = useState(false);

  const refreshStreakNotifications = useCallback((statsData, { activeToday } = {}) => {
    if (!areNotificationsSupported() || !user) return;
    const resolvedActiveToday = activeToday ?? statsData.last_active === localDate();
    syncStreakNotifications({
      firstName: getFirstName(user),
      streakDays: statsData.streak_days ?? 0,
      activeToday: resolvedActiveToday,
    }).catch(() => {});
  }, [user]);

  const applyStats = useCallback((statsData, gen = null, { syncGate = true } = {}) => {
    // Drop results from a superseded fetch so a slow/stale stats response can't
    // clobber fresher values (e.g. a just-incremented streak from completeLesson
    // or a newer background refresh). See DEV-460.
    if (gen !== null && gen !== syncGeneration.current) return;
    setXp(statsData.xp);
    setStreakDays(statsData.streak_days);
    setLastActive(statsData.last_active ?? null);
    setBadges(statsData.badges || []);
    setCompletedLessonIds(new Set(statsData.completed_lesson_ids || []));
    setLessonsCompleted(statsData.lessons_completed || 0);
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
      setModules(Array.isArray(modulesData) ? modulesData : []);

      await writeCache(cacheKeys.progress(user.id), {
        stats: statsData,
        modules: Array.isArray(modulesData) ? modulesData : [],
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
  }, [token, user?.id, loadCharacters, applyStats]);

  const hydrateFromCache = useCallback(async (userId) => {
    const cached = await readCache(cacheKeys.progress(userId), {
      freshMs: TTL.PROGRESS_STALE_MS,
      staleMs: TTL.PROGRESS_STALE_MS,
    });
    if (!cached.data?.stats) {
      return { hydrated: false, onboardingCompleted: false };
    }

    applyStats(cached.data.stats);
    setModules(Array.isArray(cached.data.modules) ? cached.data.modules : []);

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
  }, [applyStats]);

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

  async function completeLesson(lessonId, mistakes = 0) {
    if (!token || !user?.id) return null;
    try {
      const result = await coursesApi.completeLesson(token, lessonId, mistakes);
      if (!result.already_completed) {
        // Invalidate any in-flight stats fetch so its (pre-completion) response
        // can't land after us and revert the streak we just earned (DEV-460).
        syncGeneration.current += 1;
        setXp((prev) => prev + result.xp_earned);
        setStreakDays(result.stats.streak_days);
        setLastActive(localDate());
        setBadges(result.stats.badges || []);
        setBotBucks(result.stats.bot_bucks ?? botBucks);
        setCompletedLessonIds((prev) => new Set([...prev, lessonId]));
        setLessonsCompleted((prev) => prev + 1);
        refreshStreakNotifications(result.stats, { activeToday: true });
        await invalidateCache(cacheKeys.progress(user.id));
        await fetchData();
      }
      return result;
    } catch (e) {
      return null;
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
  // and flag that the user should land in their first lesson immediately.
  function finishOnboarding() {
    setPendingFirstLesson(true);
    setOnboardingCompleted(true);
    if (user?.id) {
      persistOnboardingCompleted(user.id, true);
    }
  }

  function clearPendingFirstLesson() {
    setPendingFirstLesson(false);
  }

  function isLessonCompleted(lessonId) {
    return completedLessonIds.has(lessonId);
  }

  async function claimDailyReward() {
    if (!token || !user?.id || claimingDaily) return null;
    setClaimingDaily(true);
    try {
      const result = await coursesApi.claimDailyReward(token);
      if (typeof result.bot_bucks === 'number') setBotBucks(result.bot_bucks);
      if (result.daily_reward) setDailyReward(result.daily_reward);
      if (result.badges) setBadges(result.badges);
      if (typeof result.stats?.streak_days === 'number') setStreakDays(result.stats.streak_days);
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

  const refresh = useCallback((opts = {}) => fetchData({ background: false, ...opts }), [fetchData]);

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
        rank,
        badgeCatalog,
        dailyReward,
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
