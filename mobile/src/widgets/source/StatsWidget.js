import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  resizable,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

function StatsWidget(props, environment) {
  'widget';

  const bg = '#0E1614';
  const green = '#3DDC5F';
  const gold = '#F5B72B';
  const orange = '#FF6B35';
  const white = '#FFFFFF';
  const muted = '#9BA3A0';

  const botBucks = props.botBucks != null ? props.botBucks : 0;
  const xp = props.xp != null ? props.xp : 0;
  const streak = props.streakDays != null ? props.streakDays : 0;
  const rank = props.rank ? String(props.rank) : 'bronze';
  const rankLabel = rank.charAt(0).toUpperCase() + rank.slice(1);
  let rankColor = '#CD7F32';
  if (rank === 'gold') rankColor = gold;
  else if (rank === 'silver') rankColor = '#C0C0C0';
  else if (rank === 'platinum') rankColor = '#9FD4FF';
  else if (rank === 'diamond') rankColor = '#7DD3FC';

  const isSmall = environment.widgetFamily === 'systemSmall';
  const mascotUri = props.mascotHappy;

  function wordmark() {
    return (
      <HStack spacing={0}>
        <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle(white), lineLimit(1), fixedSize({ horizontal: true })]}>Money</Text>
        <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle(green), lineLimit(1), fixedSize({ horizontal: true })]}>Bot</Text>
      </HStack>
    );
  }

  // Small: three compact stat columns.
  if (isSmall) {
    function col(icon, color, label, value) {
      return (
        <VStack spacing={4} alignment="center" modifiers={[frame({ maxWidth: Infinity })]}>
          <Image systemName={icon} size={13} color={color} />
          <Text
            modifiers={[
              monospacedDigit(),
              font({ design: 'rounded', weight: 'bold', size: 20 }),
              foregroundStyle(white),
            ]}>
            {value}
          </Text>
          <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle(muted)]}>{label}</Text>
        </VStack>
      );
    }
    return (
      <VStack
        spacing={8}
        modifiers={[
          containerBackground(bg, 'widget'),
          padding({ all: 14 }),
          widgetURL('moneybot://home'),
        ]}>
        <HStack spacing={4}>
          {wordmark()}
          <Spacer />
          <Image systemName="medal.fill" size={11} color={rankColor} />
          <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(rankColor), lineLimit(1), fixedSize({ horizontal: true })]}>{rankLabel}</Text>
        </HStack>
        <Spacer />
        <HStack spacing={6}>
          {col('dollarsign.circle.fill', gold, 'Bucks', String(botBucks))}
          {col('bolt.fill', green, 'XP', String(xp))}
          {col('flame.fill', orange, 'Streak', String(streak))}
        </HStack>
        <Spacer />
      </VStack>
    );
  }

  // Medium: mascot + stacked stat rows.
  function row(icon, color, label, value) {
    return (
      <HStack spacing={8} alignment="center">
        <Image systemName={icon} size={18} color={color} />
        <Text
          modifiers={[
            monospacedDigit(),
            font({ design: 'rounded', weight: 'bold', size: 22 }),
            foregroundStyle(white),
          ]}>
          {value}
        </Text>
        <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(muted)]}>{label}</Text>
        <Spacer />
      </HStack>
    );
  }

  function mascot() {
    if (mascotUri) {
      return (
        <VStack modifiers={[frame({ width: 108, height: 108 })]}>
          <Image uiImage={mascotUri} modifiers={[resizable()]} />
        </VStack>
      );
    }
    return (
      <VStack modifiers={[frame({ width: 108, height: 108 })]}>
        <Image systemName="dollarsign.circle.fill" size={64} color={green} />
      </VStack>
    );
  }

  return (
    <HStack
      spacing={10}
      alignment="center"
      modifiers={[
        containerBackground(bg, 'widget'),
        padding({ all: 16 }),
        widgetURL('moneybot://home'),
      ]}>
      {mascot()}
      <Spacer />
      <VStack spacing={10} alignment="leading">
        {row('dollarsign.circle.fill', gold, 'Bot Bucks', String(botBucks))}
        {row('bolt.fill', green, 'XP', String(xp))}
        {row('flame.fill', orange, 'Streak', String(streak))}
      </VStack>
    </HStack>
  );
}

export default createWidget('StatsWidget', StatsWidget);
