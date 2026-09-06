import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
  resizable,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

function StreakWidget(props, environment) {
  'widget';

  const bg = '#0E1614';
  const green = '#3DDC5F';
  const track = 'rgba(255,255,255,0.10)';
  const white = '#FFFFFF';
  const muted = '#9BA3A0';

  const streak = props.streakDays != null ? props.streakDays : 0;
  const weekly = props.weeklyChecks != null ? props.weeklyChecks : 0;
  const active = streak > 0;
  const isSmall = environment.widgetFamily === 'systemSmall';
  const imgSize = isSmall ? 64 : 128;
  const numberSize = isSmall ? 34 : 48;
  const mascotUri = active ? props.mascotHappy : props.mascotSad;

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
        <Image systemName="flame.fill" size={imgSize * 0.6} color={green} />
      </VStack>
    );
  }

  function numberRow() {
    return (
      <HStack spacing={6} alignment="center">
        <Text
          modifiers={[
            monospacedDigit(),
            font({ design: 'rounded', weight: 'bold', size: numberSize }),
            foregroundStyle(white),
          ]}>
          {String(streak)}
        </Text>
        <Text modifiers={[font({ size: numberSize * 0.6 })]}>🔥</Text>
      </HStack>
    );
  }

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  function weekBars() {
    return (
      <HStack spacing={6} alignment="bottom">
        {dayLabels.map((d, i) => (
          <VStack key={String(i)} spacing={4} alignment="center">
            <VStack
              modifiers={[
                frame({ width: 5, height: 22 }),
                background(i < weekly ? green : track, shapes.capsule()),
              ]}
            />
            <Text modifiers={[font({ size: 9, weight: 'semibold' }), foregroundStyle(muted)]}>{d}</Text>
          </VStack>
        ))}
      </HStack>
    );
  }

  if (isSmall) {
    return (
      <VStack
        spacing={2}
        alignment="center"
        modifiers={[
          containerBackground(bg, 'widget'),
          padding({ top: 14, bottom: 12, horizontal: 12 }),
          widgetURL('moneybot://home'),
        ]}>
        {numberRow()}
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(muted)]}>day streak</Text>
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
        padding({ all: 16 }),
        widgetURL('moneybot://home'),
      ]}>
      {mascot()}
      <Spacer />
      <VStack spacing={6} alignment="leading">
        {weekBars()}
        {numberRow()}
        <Text modifiers={[font({ design: 'rounded', size: 17, weight: 'semibold' }), foregroundStyle(white)]}>
          day streak
        </Text>
        <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(muted)]}>
          This week: {String(weekly)}/7 checks
        </Text>
      </VStack>
    </HStack>
  );
}

export default createWidget('StreakWidget', StreakWidget);
