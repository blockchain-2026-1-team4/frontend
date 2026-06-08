import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EntrySchedule } from '../lib/entrySchedule';
import { scheduleDateParts, scheduleTitle } from '../lib/entrySchedule';
import { FlowBadge, PosterThumb, TicketIcon, type TicketIconName, flowShadow } from './TicketFlowKit';

export const entryColors = {
  background: '#F6F7FB',
  ink: '#0F172A',
  purple: '#534AB7',
  muted: '#64748B',
  border: '#E5E7EB',
  green: '#0F6E56',
};

export function EntryTopBar({
  eyebrow,
  title,
  back,
  onBack,
  rightIcon,
  onRight,
  rightLabel,
}: {
  eyebrow: string;
  title: string;
  back?: boolean;
  onBack?: () => void;
  rightIcon?: TicketIconName;
  onRight?: () => void;
  rightLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topbar, { paddingTop: Math.max(insets.top, 16) }]}>
      {back ? (
        <TouchableOpacity style={styles.icon} onPress={onBack} accessibilityRole="button" accessibilityLabel="뒤로가기">
          <TicketIcon name="arrowLeft" color="#475569" size={21} />
        </TouchableOpacity>
      ) : null}
      <View style={[styles.topCopy, back && styles.topCopyCentered]}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.topTitle}>{title}</Text>
      </View>
      {rightIcon ? (
        <TouchableOpacity style={styles.icon} onPress={onRight} accessibilityRole="button" accessibilityLabel={rightLabel}>
          <TicketIcon name={rightIcon} color="#475569" size={21} />
        </TouchableOpacity>
      ) : back ? <View style={styles.iconPlaceholder} /> : null}
    </View>
  );
}

export function EntryHero({
  badge,
  title,
  subtitle,
  posters = true,
  imageUrl,
}: {
  badge: string;
  title: string;
  subtitle: string;
  posters?: boolean;
  imageUrl?: string | null;
}) {
  return (
    <LinearGradient colors={['#1A1A2E', '#534AB7', '#1D9E75']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <View style={styles.heroGlow} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.78)']} style={StyleSheet.absoluteFill} />
      {posters ? (
        <View style={styles.posterRow}>
          <LinearGradient colors={['#26215C', '#534AB7', '#1D9E75']} style={styles.poster} />
          <LinearGradient colors={['#0C447C', '#185FA5', '#639922']} style={styles.poster} />
          <LinearGradient colors={['#712B13', '#D85A30', '#EF9F27']} style={styles.poster} />
        </View>
      ) : null}
      <View style={styles.heroBody}>
        <FlowBadge label={badge} glass />
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>
    </LinearGradient>
  );
}

export function EntrySectionHead({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.head}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <TouchableOpacity onPress={onAction}><Text style={styles.link}>{action}</Text></TouchableOpacity> : null}
    </View>
  );
}

export function EntrySummary({ items }: { items: { label: string; value: number }[] }) {
  return (
    <View style={styles.summary}>
      {items.map((item) => (
        <View key={item.label} style={styles.stat}>
          <Text style={styles.statNumber}>{item.value.toLocaleString()}</Text>
          <Text style={styles.statLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function EntryEventCard({
  schedule,
  meta,
  actionLabel = '관리',
  onPress,
  imageUrl,
}: {
  schedule: EntrySchedule;
  meta: string;
  actionLabel?: string;
  onPress: () => void;
  imageUrl?: string | null;
}) {
  const date = scheduleDateParts(schedule);
  return (
    <View style={styles.eventCard}>
      {imageUrl ? (
        <PosterThumb imageUrl={imageUrl} title={scheduleTitle(schedule)} style={styles.date} />
      ) : (
        <View style={styles.date}>
          <Text style={styles.dateMonth}>{date.month}</Text>
          <Text style={styles.dateDay}>{date.day}</Text>
        </View>
      )}
      <View style={styles.eventMain}>
        <Text style={styles.eventTitle} numberOfLines={2}>{scheduleTitle(schedule)}</Text>
        <Text style={styles.eventMeta}>{meta}</Text>
      </View>
      <TouchableOpacity style={styles.action} onPress={onPress}>
        <Text style={styles.actionText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function EntryEmpty({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {action ? <TouchableOpacity style={styles.darkButton} onPress={onAction}><Text style={styles.darkButtonText}>{action}</Text></TouchableOpacity> : null}
    </View>
  );
}

export const entryStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: entryColors.background },
  content: { paddingBottom: 108 },
  section: { paddingHorizontal: 12, paddingBottom: 14 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: entryColors.border, borderRadius: 24, ...flowShadow },
  primaryButton: { height: 52, borderRadius: 18, overflow: 'hidden' },
  primaryGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  outlineButton: { height: 52, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D8D4FF', alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: entryColors.purple, fontSize: 15, fontWeight: '900' },
  center: { flex: 1, backgroundColor: entryColors.background, alignItems: 'center', justifyContent: 'center' },
  centerText: { marginTop: 12, color: entryColors.muted, fontSize: 13, fontWeight: '800' },
});

const styles = StyleSheet.create({
  topbar: { minHeight: 78, backgroundColor: 'rgba(246,247,251,0.94)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.72)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  icon: { width: 40, height: 40, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', ...flowShadow },
  iconPlaceholder: { width: 40, height: 40 },
  topCopy: { flex: 1, alignItems: 'flex-start' },
  topCopyCentered: { alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#938CF0', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
  topTitle: { fontSize: 22, fontWeight: '900', color: entryColors.ink, letterSpacing: -0.6 },
  hero: { height: 188, marginHorizontal: 12, marginTop: 16, marginBottom: 14, borderRadius: 26, overflow: 'hidden', shadowColor: '#534AB7', shadowOpacity: 0.24, shadowRadius: 22, shadowOffset: { width: 0, height: 20 }, elevation: 5 },
  heroGlow: { position: 'absolute', right: 15, top: -45, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.13)' },
  posterRow: { position: 'absolute', right: -14, top: 22, flexDirection: 'row', gap: 10, opacity: 0.78, transform: [{ rotate: '8deg' }], zIndex: 1 },
  poster: { width: 60, height: 88, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  heroBody: { position: 'absolute', left: 18, right: 18, bottom: 17, zIndex: 2 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', lineHeight: 28, letterSpacing: -0.8, marginTop: 10, marginBottom: 7 },
  heroSubtitle: { color: 'rgba(255,255,255,0.74)', fontSize: 11, lineHeight: 16.5, fontWeight: '700' },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 },
  headTitle: { fontSize: 18, fontWeight: '900', color: entryColors.ink },
  headSubtitle: { fontSize: 11, color: entryColors.muted, marginTop: 3 },
  link: { fontSize: 12, fontWeight: '900', color: entryColors.purple, padding: 3 },
  summary: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: entryColors.border, borderRadius: 20, paddingVertical: 13, paddingHorizontal: 8, alignItems: 'center', shadowColor: '#0F172A', shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 1 },
  statNumber: { fontSize: 20, fontWeight: '900', color: entryColors.purple },
  statLabel: { fontSize: 9, color: entryColors.muted, fontWeight: '800', marginTop: 3 },
  eventCard: { padding: 13, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: entryColors.border, borderRadius: 24, ...flowShadow },
  date: { width: 54, height: 60, borderRadius: 18, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dateMonth: { color: entryColors.purple, fontSize: 9, fontWeight: '900' },
  dateDay: { color: entryColors.purple, fontSize: 18, fontWeight: '900' },
  eventMain: { flex: 1, minWidth: 0 },
  eventTitle: { color: entryColors.ink, fontSize: 14, fontWeight: '900', lineHeight: 18, marginBottom: 4 },
  eventMeta: { color: entryColors.muted, fontSize: 11, lineHeight: 16 },
  action: { height: 36, borderRadius: 14, borderWidth: 1.5, borderColor: '#D8D4FF', backgroundColor: '#FFFFFF', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: entryColors.purple, fontSize: 11, fontWeight: '900' },
  empty: { paddingHorizontal: 18, paddingVertical: 28, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: entryColors.border, borderRadius: 24, ...flowShadow },
  emptyTitle: { fontSize: 14, fontWeight: '900', color: '#475569', marginBottom: 12, textAlign: 'center' },
  darkButton: { height: 42, borderRadius: 15, backgroundColor: '#1A1A2E', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  darkButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
