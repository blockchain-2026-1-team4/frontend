import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TicketIconName =
  | 'arrowLeft'
  | 'search'
  | 'dots'
  | 'info'
  | 'help'
  | 'shield'
  | 'qr'
  | 'ticket'
  | 'refresh'
  | 'alert'
  | 'wallet'
  | 'clock'
  | 'calendar'
  | 'map'
  | 'list'
  | 'chevron'
  | 'check'
  | 'seat'
  | 'tag'
  | 'user'
  | 'settings'
  | 'bell'
  | 'plus'
  | 'adjustments'
  | 'userCheck';

export const flowShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 10 },
  elevation: 2,
};

const HERO_COLORS = ['#1A1A2E', '#534AB7', '#1D9E75'] as const;
const POSTER_COLORS = [
  ['#26215C', '#534AB7', '#1D9E75'],
  ['#0C447C', '#185FA5', '#639922'],
  ['#712B13', '#D85A30', '#EF9F27'],
] as const;

export function TicketIcon({ name, color = '#64748B', size = 20 }: { name: TicketIconName; color?: string; size?: number }) {
  const common = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  if (name === 'arrowLeft') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M15 18l-6-6 6-6" {...common} /></Svg>;
  if (name === 'search') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="11" cy="11" r="7" {...common} /><Path d="M20 20l-3.5-3.5" {...common} /></Svg>;
  if (name === 'dots') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="5" cy="12" r="1" {...common} /><Circle cx="12" cy="12" r="1" {...common} /><Circle cx="19" cy="12" r="1" {...common} /></Svg>;
  if (name === 'info') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="9" {...common} /><Path d="M12 11v5M12 8h.01" {...common} /></Svg>;
  if (name === 'help') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="9" {...common} /><Path d="M9.5 9a2.6 2.6 0 115 1.2c-.9.6-1.5 1.1-1.5 2.3M12 17h.01" {...common} /></Svg>;
  if (name === 'shield') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3zM9 12l2 2 4-5" {...common} /></Svg>;
  if (name === 'qr') return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="4" y="4" width="6" height="6" rx="1" {...common} /><Rect x="14" y="4" width="6" height="6" rx="1" {...common} /><Rect x="4" y="14" width="6" height="6" rx="1" {...common} /><Path d="M14 14h2v2h-2zM18 14h2v6h-6v-2h4z" {...common} /></Svg>;
  if (name === 'ticket') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M5 6h14v4a2 2 0 000 4v4H5v-4a2 2 0 000-4V6zM9 8v8" {...common} /></Svg>;
  if (name === 'refresh') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M20 11a8 8 0 00-14.2-4.9L4 8M4 4v4h4M4 13a8 8 0 0014.2 4.9L20 16M16 16h4v4" {...common} /></Svg>;
  if (name === 'alert') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="9" {...common} /><Path d="M12 7v6M12 17h.01" {...common} /></Svg>;
  if (name === 'wallet') return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="3" y="6" width="18" height="14" rx="3" {...common} /><Path d="M16 12h5v5h-5a2.5 2.5 0 010-5zM3 9h18" {...common} /></Svg>;
  if (name === 'clock') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="9" {...common} /><Path d="M12 7v5l3 2" {...common} /></Svg>;
  if (name === 'calendar') return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="4" y="5" width="16" height="15" rx="2" {...common} /><Path d="M8 3v4M16 3v4M4 10h16" {...common} /></Svg>;
  if (name === 'map') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 21s7-4.4 7-11a7 7 0 10-14 0c0 6.6 7 11 7 11z" {...common} /><Circle cx="12" cy="10" r="2.5" {...common} /></Svg>;
  if (name === 'list') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" {...common} /></Svg>;
  if (name === 'check') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M5 12l4 4L19 6" {...common} /></Svg>;
  if (name === 'seat') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M7 11V6a3 3 0 016 0v5M6 11h10a3 3 0 013 3v5H5v-5a3 3 0 013-3zM8 19v2M16 19v2" {...common} /></Svg>;
  if (name === 'tag') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M4 12V5h7l9 9-7 7-9-9zM8 8h.01" {...common} /></Svg>;
  if (name === 'user') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="8" r="4" {...common} /><Path d="M4.5 21a7.5 7.5 0 0115 0" {...common} /></Svg>;
  if (name === 'settings') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 00-2.1.5l-.1.2h-4l-.1-.2a1.7 1.7 0 00-2.1-.5l-.2.1-2-3.4.1-.1a1.7 1.7 0 00.3-1.9l-.1-.2-2-1.2v-3.2l2-1.2.1-.2a1.7 1.7 0 00-.3-1.9L7 7l2-3.4.2.1a1.7 1.7 0 002.1-.5l.1-.2h4l.1.2a1.7 1.7 0 002.1.5l.2-.1 2 3.4-.1.1a1.7 1.7 0 00-.3 1.9l.1.2 2 1.2v3.2l-2 1.2-.1.2z" {...common} /></Svg>;
  if (name === 'bell') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M18 16v-5a6 6 0 00-12 0v5l-2 2h16l-2-2zM9.5 20a2.5 2.5 0 005 0" {...common} /></Svg>;
  if (name === 'plus') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 5v14M5 12h14" {...common} /></Svg>;
  if (name === 'adjustments') return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M4 7h10M18 7h2M4 17h3M11 17h9M14 5v4M7 15v4" {...common} /></Svg>;
  if (name === 'userCheck') return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="9" cy="8" r="4" {...common} /><Path d="M2.5 21a6.5 6.5 0 0113 0M16 11l2 2 4-5" {...common} /></Svg>;
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M9 18l6-6-6-6" {...common} /></Svg>;
}

export function IconButton({ children }: { children: React.ReactNode }) {
  return <View style={kitStyles.iconButton}>{children}</View>;
}

export function FlowBadge({
  label,
  tone = 'purple',
  glass = false,
}: {
  label: string;
  tone?: 'green' | 'purple' | 'gray' | 'red' | 'yellow';
  glass?: boolean;
}) {
  return <Text style={[kitStyles.badge, glass && kitStyles.badgeGlass, !glass && badgeToneStyles[tone]]}>{label}</Text>;
}

export function PosterArt({ title, variant = 0, style }: { title: string; variant?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={POSTER_COLORS[variant % POSTER_COLORS.length] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[kitStyles.poster, style]}>
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.68)']} style={StyleSheet.absoluteFill} />
      <Text style={kitStyles.posterText} numberOfLines={3}>{title}</Text>
    </LinearGradient>
  );
}

export function PosterRow() {
  return (
    <View style={kitStyles.posterRow}>
      <LinearGradient colors={POSTER_COLORS[0] as any} style={kitStyles.miniPoster} />
      <LinearGradient colors={POSTER_COLORS[1] as any} style={kitStyles.miniPoster} />
      <LinearGradient colors={POSTER_COLORS[2] as any} style={kitStyles.miniPoster} />
    </View>
  );
}

export function FlowHero({
  height,
  badge,
  title,
  meta,
  style,
  posters = true,
}: {
  height: number;
  badge: string;
  title: string;
  meta: string;
  style?: StyleProp<ViewStyle>;
  posters?: boolean;
}) {
  return (
    <LinearGradient colors={HERO_COLORS as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[kitStyles.hero, { height }, style]}>
      {posters ? <PosterRow /> : null}
      <View style={kitStyles.heroDim} />
      <View style={kitStyles.heroBody}>
        <FlowBadge label={badge} glass />
        <Text style={kitStyles.heroTitle}>{title}</Text>
        <Text style={kitStyles.heroMeta}>{meta}</Text>
      </View>
    </LinearGradient>
  );
}

const kitStyles = StyleSheet.create({
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...flowShadow,
  },
  badge: {
    fontSize: 10,
    fontWeight: '900',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  badge_green: { backgroundColor: '#DCFCE7', color: '#0F6E56' },
  badge_purple: { backgroundColor: '#EEEDFE', color: '#534AB7' },
  badge_gray: { backgroundColor: '#F1F5F9', color: '#64748B' },
  badge_red: { backgroundColor: '#FEE2E2', color: '#DC2626' },
  badge_yellow: { backgroundColor: '#FFF7ED', color: '#D97706' },
  badgeGlass: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    alignSelf: 'flex-start',
  },
  poster: { width: 84, height: 112, borderRadius: 18, position: 'relative', overflow: 'hidden', flexShrink: 0 },
  posterText: { position: 'absolute', left: 9, right: 9, bottom: 9, zIndex: 2, color: '#FFFFFF', fontSize: 11, fontWeight: '900', lineHeight: 14 },
  posterRow: { position: 'absolute', right: -10, top: 20, flexDirection: 'row', gap: 8, transform: [{ rotate: '8deg' }], opacity: 0.74, zIndex: 1 },
  miniPoster: { width: 58, height: 84, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  hero: { borderRadius: 28, position: 'relative', overflow: 'hidden', ...flowShadow },
  heroDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  heroBody: { position: 'absolute', left: 17, right: 17, bottom: 17, zIndex: 2 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', lineHeight: 28, letterSpacing: 0, marginTop: 9, marginBottom: 6 },
  heroMeta: { fontSize: 11, color: 'rgba(255,255,255,0.72)', lineHeight: 17, fontWeight: '700' },
});

const badgeToneStyles = {
  green: kitStyles.badge_green,
  purple: kitStyles.badge_purple,
  gray: kitStyles.badge_gray,
  red: kitStyles.badge_red,
  yellow: kitStyles.badge_yellow,
};
