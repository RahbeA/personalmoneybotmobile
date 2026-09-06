import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  resizable,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

function DailyRewardWidget(props, environment) {
  'widget';

  const bg = '#0E1614';
  const gold = '#F5B72B';
  const white = '#FFFFFF';
  const muted = '#9BA3A0';

  const claimAmount = props.dailyClaimAmount != null ? props.dailyClaimAmount : 5;
  const canClaim = props.dailyCanClaim !== false;
  const claimedToday = !!props.dailyClaimedToday;
  const isSmall = environment.widgetFamily === 'systemSmall';
  const imgSize = isSmall ? 60 : 124;
  const titleSize = isSmall ? 18 : 30;

  let title;
  let subtitle;
  let happy;
  if (claimedToday) {
    title = 'All set!';
    subtitle = isSmall ? 'Tomorrow' : 'See you tomorrow';
    happy = true;
  } else if (canClaim) {
    title = isSmall ? 'Check in' : 'Ready to grow?';
    subtitle = isSmall ? 'Tap to grow' : 'Tap to check in';
    happy = true;
  } else {
    title = 'Come back';
    subtitle = isSmall ? 'We miss you' : 'Your streak misses you';
    happy = false;
  }
  const mascotUri = happy ? props.mascotHappy : props.mascotSad;
  const showReward = canClaim && !claimedToday;

  function mascot() {
    if (mascotUri) {
      return (
        <VStack modifiers={[frame({ width: imgSize, height: imgSize })]}>
          <Image uiImage={mascotUri} modifiers={[resizable()]} />
        </VStack>
      );
    }
    return (
      <VStack modifiers={[frame({ width: imgSize, height: imgSize })]}>
        <Image systemName="gift.fill" size={imgSize * 0.5} color={gold} />
      </VStack>
    );
  }

  function copy() {
    return (
      <VStack spacing={6} alignment="leading">
        <Text
          modifiers={[
            font({ design: 'rounded', weight: 'bold', size: titleSize }),
            foregroundStyle(white),
            lineLimit(1),
            minimumScaleFactor(0.7),
          ]}>
          {title}
        </Text>
        <Text
          modifiers={[
            font({ size: isSmall ? 13 : 16, weight: 'medium' }),
            foregroundStyle(muted),
            lineLimit(1),
            minimumScaleFactor(0.8),
          ]}>
          {subtitle}
        </Text>
        {showReward ? (
          <HStack spacing={5}>
            <Image systemName="dollarsign.circle.fill" size={14} color={gold} />
            <Text modifiers={[monospacedDigit(), font({ design: 'rounded', weight: 'bold', size: 15 }), foregroundStyle(gold)]}>
              +{String(claimAmount)} Bot Bucks
            </Text>
          </HStack>
        ) : null}
      </VStack>
    );
  }

  if (isSmall) {
    return (
      <VStack
        spacing={4}
        alignment="center"
        modifiers={[
          containerBackground(bg, 'widget'),
          padding({ top: 14, bottom: 12, horizontal: 12 }),
          widgetURL('moneybot://home'),
        ]}>
        {copy()}
        <Spacer />
        {mascot()}
      </VStack>
    );
  }

  return (
    <HStack
      spacing={10}
      alignment="center"
      modifiers={[
        containerBackground(bg, 'widget'),
        padding({ all: 18 }),
        widgetURL('moneybot://home'),
      ]}>
      {copy()}
      <Spacer />
      {mascot()}
    </HStack>
  );
}

export default createWidget('DailyRewardWidget', DailyRewardWidget);
