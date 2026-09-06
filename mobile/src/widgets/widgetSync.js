import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { widgetsDirectory } from 'expo-widgets';

import StreakWidget from './StreakWidget';
import StatsWidget from './StatsWidget';
import DailyRewardWidget from './DailyRewardWidget';

const WIDGETS = [StreakWidget, StatsWidget, DailyRewardWidget];

// Widgets render in a separate process and can't read the app sandbox, so the
// mascot art must live in the shared App Group container (widgetsDirectory).
// We copy the bundled PNGs there once, then pass file:// paths through props.
const MASCOTS = [
  { key: 'mascotHappy', file: 'mascot-happy.png', module: require('../../assets/widgets/mascot-happy.png') },
  { key: 'mascotSad', file: 'mascot-sad.png', module: require('../../assets/widgets/mascot-sad.png') },
];

let cachedMascotPaths = null;

async function ensureMascotAssets() {
  if (Platform.OS !== 'ios' || !widgetsDirectory) return {};
  if (cachedMascotPaths) return cachedMascotPaths;

  const dir = widgetsDirectory.endsWith('/') ? widgetsDirectory : `${widgetsDirectory}/`;
  const paths = {};

  for (const mascot of MASCOTS) {
    try {
      const asset = Asset.fromModule(mascot.module);
      await asset.downloadAsync();
      const from = asset.localUri || asset.uri;
      const to = `${dir}${mascot.file}`;
      // Re-copy each launch so updated art ships without a stale cache.
      await FileSystem.copyAsync({ from, to }).catch(async () => {
        await FileSystem.deleteAsync(to, { idempotent: true });
        await FileSystem.copyAsync({ from, to });
      });
      paths[mascot.key] = to;
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(`[MoneyBot] Mascot copy failed (${mascot.file}):`, err?.message ?? err);
      }
    }
  }

  cachedMascotPaths = paths;
  return paths;
}

function buildWidgetProps(statsData, mascots) {
  const daily = statsData?.daily_reward ?? {};
  return {
    streakDays: statsData?.streak_days ?? 0,
    botBucks: statsData?.bot_bucks ?? 0,
    xp: statsData?.xp ?? 0,
    rank: statsData?.rank ?? 'bronze',
    weeklyChecks: statsData?.weekly_checks ?? 0,
    dailyClaimAmount: daily.claim_amount ?? 5,
    dailyCanClaim: daily.can_claim !== false,
    dailyClaimedToday: !!daily.claimed_today,
    dailyDay: daily.current_day ?? 1,
    ...mascots,
  };
}

const GUEST_PROPS = {
  streakDays: 0,
  botBucks: 0,
  xp: 0,
  rank: 'bronze',
  weeklyChecks: 0,
  dailyClaimAmount: 5,
  dailyCanClaim: true,
  dailyClaimedToday: false,
  dailyDay: 1,
};

function pushWidgetUpdate(widget, props) {
  widget.updateSnapshot(props);
  widget.reload();
}

export async function syncHomeScreenWidgets(statsData = null) {
  if (Platform.OS !== 'ios') return;

  try {
    const mascots = await ensureMascotAssets();
    const props = buildWidgetProps(statsData, mascots);
    WIDGETS.forEach((widget) => pushWidgetUpdate(widget, props));
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[MoneyBot] Widget sync failed:', err?.message ?? err);
    }
  }
}

export async function resetHomeScreenWidgets() {
  if (Platform.OS !== 'ios') return;

  try {
    const mascots = await ensureMascotAssets();
    WIDGETS.forEach((widget) => pushWidgetUpdate(widget, { ...GUEST_PROPS, ...mascots }));
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[MoneyBot] Widget bootstrap failed:', err?.message ?? err);
    }
  }
}
