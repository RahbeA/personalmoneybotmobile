import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { coursesApi } from '../api/courses';
import { moneyverseApi } from '../api/moneyverse';
import { useAuth } from './AuthContext';

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
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [onboardingScore, setOnboardingScore] = useState(0);
  const [onboardingTotal, setOnboardingTotal] = useState(5);
  const [rank, setRank] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const dataPromise = Promise.all([
        coursesApi.getStats(token),
        coursesApi.getModules(token),
      ]);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Progress fetch timed out')), 8000);
      });
      const [statsData, modulesData] = await Promise.race([dataPromise, timeoutPromise]);
      setXp(statsData.xp);
      setStreakDays(statsData.streak_days);
      setBadges(statsData.badges || []);
      setCompletedLessonIds(new Set(statsData.completed_lesson_ids || []));
      setLessonsCompleted(statsData.lessons_completed || 0);
      setBotBucks(statsData.bot_bucks || 0);
      setEquippedCharacter(statsData.equipped_character || null);
      setOnboardingCompleted(!!statsData.onboarding_completed);
      setOnboardingScore(statsData.onboarding_score || 0);
      setOnboardingTotal(statsData.onboarding_total || 5);
      setRank(statsData.rank || null);
      setModules(modulesData);
    } catch (e) {
      // fail silently — offline or server not running
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      // Gate the app on a fresh fetch whenever the signed-in user changes, so
      // onboarding state can't leak from a previous account.
      setLoading(true);
      fetchData();
    } else {
      setOnboardingCompleted(false);
      setRank(null);
      setLoading(false);
    }
  }, [user, fetchData]);

  async function completeLesson(lessonId, mistakes = 0) {
    if (!token) return null;
    try {
      const result = await coursesApi.completeLesson(token, lessonId, mistakes);
      if (!result.already_completed) {
        setXp((prev) => prev + result.xp_earned);
        setStreakDays(result.stats.streak_days);
        setBadges(result.stats.badges || []);
        setBotBucks(result.stats.bot_bucks ?? botBucks);
        setCompletedLessonIds((prev) => new Set([...prev, lessonId]));
        setLessonsCompleted((prev) => prev + 1);
        await fetchData();
      }
      return result;
    } catch (e) {
      return null;
    }
  }

  async function purchaseCharacter(characterId) {
    if (!token) return null;
    const result = await moneyverseApi.purchaseCharacter(token, characterId);
    if (typeof result.bot_bucks === 'number') {
      setBotBucks(result.bot_bucks);
    }
    return result;
  }

  async function equipCharacter(characterId) {
    if (!token) return null;
    const result = await moneyverseApi.equipCharacter(token, characterId);
    setEquippedCharacter(result.character || null);
    return result;
  }

  // Submit the assessment and store the result, but DON'T flip the navigation
  // gate yet so the onboarding screen can show the rank reveal first.
  async function submitOnboarding(answers) {
    if (!token) return null;
    try {
      const result = await coursesApi.submitOnboarding(token, answers);
      const stats = result.stats || {};
      setOnboardingScore(result.score ?? stats.onboarding_score ?? 0);
      setOnboardingTotal(result.total ?? stats.onboarding_total ?? onboardingTotal);
      setRank(result.rank || stats.rank || null);
      return result;
    } catch (e) {
      return null;
    }
  }

  // Flip the gate so the root navigator swaps onboarding for the main app.
  function finishOnboarding() {
    setOnboardingCompleted(true);
  }

  function isLessonCompleted(lessonId) {
    return completedLessonIds.has(lessonId);
  }

  // XP level system: each level requires 200 XP
  const XP_PER_LEVEL = 200;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInCurrentLevel = xp % XP_PER_LEVEL;
  const xpProgress = xpInCurrentLevel / XP_PER_LEVEL;

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
        onboardingCompleted,
        onboardingScore,
        onboardingTotal,
        rank,
        loading,
        level,
        xpInCurrentLevel,
        xpProgress,
        XP_PER_LEVEL,
        completeLesson,
        submitOnboarding,
        finishOnboarding,
        purchaseCharacter,
        equipCharacter,
        isLessonCompleted,
        refresh: fetchData,
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
