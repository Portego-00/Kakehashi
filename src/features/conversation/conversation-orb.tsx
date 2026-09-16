import React, { memo, useEffect, useId } from 'react';
import { View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useConversationTheme } from './conversation-theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
function orbPath(phase: number, energy: number) {
  'worklet';
  const points = Array.from({ length: 12 }, (_, index) => {
    const angle = index / 12 * Math.PI * 2;
    const wave = Math.sin(angle * 3 + phase) * 0.021 + Math.cos(angle * 2 - phase * 0.7) * (0.012 + energy * 0.025);
    const radius = 240 * (0.47 + wave);
    return { x: 140 + Math.cos(angle) * radius, y: 140 + Math.sin(angle) * radius };
  });
  let path = `M ${(points[11].x + points[0].x) / 2} ${(points[11].y + points[0].y) / 2}`;
  for (let index = 0; index < 12; index++) {
    const next = points[(index + 1) % 12];
    path += ` Q ${points[index].x} ${points[index].y} ${(points[index].x + next.x) / 2} ${(points[index].y + next.y) / 2}`;
  }
  return `${path} Z`;
}

/** Same twelve-point, audio-reactive outline as Mural, rendered on the UI thread. */
export const ConversationOrb = memo(function ConversationOrb({ size = 270, energy = 0, listening = false, active = true }: { size?: number; energy?: number; listening?: boolean; active?: boolean }) {
  const { orb } = useConversationTheme();
  const id = useId().replace(/:/g, '');
  const reduceMotion = useReducedMotion();
  const phase = useSharedValue(0);
  const level = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || !active) { cancelAnimation(phase); return; }
    phase.value = withRepeat(withTiming(Math.PI * 20, { duration: 87266, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(phase);
  }, [active, phase, reduceMotion]);
  useEffect(() => { level.value = withTiming(reduceMotion ? 0 : Math.min(1, Math.max(0, energy)), { duration: 100 }); }, [energy, level, reduceMotion]);
  const shape = useAnimatedProps(() => ({ d: orbPath(phase.value, level.value) }));
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: reduceMotion ? 0 : Math.sin(phase.value * 1.25) * 3 }, { scale: 1 + level.value * 0.045 }, { rotate: `${Math.sin(phase.value * 0.5) * 3}deg` }] }));
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View style={[{ width: size, height: size }, motion]}>
      <Svg width="100%" height="100%" viewBox="0 0 280 280">
        <Defs>
          <ClipPath id={`${id}shape`}><AnimatedPath animatedProps={shape} /></ClipPath>
          <RadialGradient id={`${id}base`} cx="0.25" cy="0.05" rx="1" ry="1"><Stop offset="0" stopColor={orb.baseLight} /><Stop offset="0.5" stopColor={orb.baseMid} /><Stop offset="1" stopColor={orb.baseDeep} /></RadialGradient>
          <RadialGradient id={`${id}lilac`} cx="1" cy="0.45" rx="0.95" ry="0.9"><Stop offset="0" stopColor={orb.secondary} stopOpacity="0.95" /><Stop offset="0.7" stopColor={orb.secondarySoft} stopOpacity="0.3" /><Stop offset="1" stopColor={orb.secondarySoft} stopOpacity="0" /></RadialGradient>
          <RadialGradient id={`${id}orange`} cx="0.18" cy="0.62" rx="0.8" ry="0.65"><Stop offset="0" stopColor={orb.accent} /><Stop offset="1" stopColor={orb.accent} stopOpacity="0" /></RadialGradient>
          <RadialGradient id={`${id}light`} cx="0.3" cy="0" rx="0.65" ry="0.48"><Stop offset="0" stopColor={orb.highlight} /><Stop offset="1" stopColor={orb.highlight} stopOpacity="0" /></RadialGradient>
          <RadialGradient id={`${id}satellite`} cx="0" cy="0" rx="1" ry="1"><Stop offset="0" stopColor={orb.satelliteLight} /><Stop offset="0.55" stopColor={orb.satelliteMid} /><Stop offset="1" stopColor={orb.satelliteDeep} /></RadialGradient>
          <RadialGradient id={`${id}shadow`}><Stop offset="0" stopColor={orb.shadow} stopOpacity="0.2" /><Stop offset="1" stopColor={orb.shadow} stopOpacity="0" /></RadialGradient>
        </Defs>
        <Ellipse cx="140" cy="259" rx="86" ry="14" fill={`url(#${id}shadow)`} />
        <Circle cx="140" cy="140" r="123" fill="none" stroke={orb.ring} strokeOpacity={listening ? 0.18 : 0} />
        <Circle cx="140" cy="140" r="132" fill="none" stroke={orb.ring} strokeOpacity={listening ? 0.1 : 0} />
        <G clipPath={`url(#${id}shape)`}>
          <Rect x="20" y="20" width="240" height="240" fill={`url(#${id}base)`} />
          <Rect x="20" y="20" width="240" height="240" fill={`url(#${id}lilac)`} />
          <Rect x="20" y="20" width="240" height="240" fill={`url(#${id}orange)`} />
          <Rect x="20" y="20" width="240" height="240" fill={`url(#${id}light)`} />
        </G>
        <Circle cx="270" cy="79" r="6" fill={`url(#${id}satellite)`} />
        <Circle cx="8" cy="201" r="3.5" fill={orb.satelliteMid} />
      </Svg>
    </Animated.View>
  </View>;
});
