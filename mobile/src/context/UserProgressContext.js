import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { coursesApi } from '../api/courses';
import { moneyverseApi } from '../api/moneyverse';
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

export function UserProgressProvider({ children }) {
  const { token, user } = useAuth();
  const [xp, setXp] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
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
  const [rank, setRank] = useState(null);
  const [badgeCatalog, setBadgeCatalog] = useState([]);
  const [dailyReward, setDailyReward] = useState(null);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const applyStats = useCallback((statsData) => {
    setXp(statsData.xp);
    setStreakDays(statsData.streak_days);
    setBadges(statsData.badges || []);
    setCompletedLessonIds(new Set(statsData.completed_lesson_ids || []));
    setLessonsCompleted(statsData.lessons_completed || 0);
    setBotBucks(statsData.bot_bucks || 0);
    setEquippedCharacter(statsData.equipped_character || null);
    const completed = inferOnboardingCompleted(statsData);
    setOnboardingCompleted(completed);
    setOnboardingScore(statsData.onboarding_score || 0);
    setOnboardingTotal(statsData.onboarding_total || 5);
    setRank(statsData.rank || null);
    if (statsData.badge_catalog) setBadgeCatalog(statsData.badge_catalog);
    if (statsData.daily_reward) setDailyReward(statsData.daily_reward);
    if (user?.id) {
      persistOnboardingCompleted(user.id, completed);
    }
  }, [user?.id]);

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

      const characterList = moneyverseData?.characters ?? charactersRef.current ?? [];
      if (moneyverseData?.characters) {
        setCharacters(moneyverseData.characters);
      }

      applyStats(statsData);
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
        setXp((prev) => prev + result.xp_earned);
        setStreakDays(result.stats.streak_days);
        setBadges(result.stats.badges || []);
        setBotBucks(result.stats.bot_bucks ?? botBucks);
        setCompletedLessonIds((prev) => new Set([...prev, lessonId]));
        setLessonsCompleted((prev) => prev + 1);
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
  async function submitOnboarding(answers) {
    if (!token) return null;
    try {
      const result = await coursesApi.submitOnboarding(token, answers);
      const stats = result.stats || {};
      let mergedStats = {
        ...stats,
        onboarding_completed: true,
        onboarding_score: result.score ?? stats.onboarding_score ?? 0,
        rank: result.rank ?? stats.rank ?? null,
      };
      if (user?.id) {
        const cached = await readCache(cacheKeys.progress(user.id), {
          freshMs: TTL.PROGRESS_STALE_MS,
          staleMs: TTL.PROGRESS_STALE_MS,
        });
        mergedStats = {
          ...(cached.data?.stats || {}),
          ...mergedStats,
        };
        applyStats(mergedStats);
        await persistOnboardingCompleted(user.id, true);
        await writeCache(cacheKeys.progress(user.id), {
          stats: mergedStats,
          modules: cached.data?.modules || [],
        });
      } else {
        applyStats(mergedStats);
      }
      return result;
    } catch (e) {
      return null;
    }
  }

  // Flip the gate so the root navigator swaps onboarding for the main app.
  function finishOnboarding() {
    setOnboardingCompleted(true);
    if (user?.id) {
      persistOnboardingCompleted(user.id, true);
    }
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
      await invalidateCache(cacheKeys.progress(user.id));
      return result;
    } catch (e) {
      return null;
    } finally {
      setClaimingDaily(false);
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
