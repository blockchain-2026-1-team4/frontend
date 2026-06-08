import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlowHero, IconButton, TicketIcon, type TicketIconName, flowShadow } from './TicketFlowKit';
import { TextInput } from './TextInput';

export const organizerColors = {
  background: '#F6F7FB',
  ink: '#1A1A2E',
  muted: '#9CA3AF',
  purple: '#534AB7',
  border: '#E5E7EB',
  green: '#0F6E56',
};

export function OrganizerTopBar({
  eyebrow,
  title,
  leftIcon,
  leftLabel,
  onLeftPress,
  rightIcon,
  rightLabel,
  onRightPress,
}: {
  eyebrow: string;
  title: string;
  leftIcon?: TicketIconName;
  leftLabel?: string;
  onLeftPress?: () => void;
  rightIcon?: TicketIconName;
  rightLabel?: string;
  onRightPress?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 14) }]}>
      <View style={[styles.topSide, !leftIcon && styles.topSideEmpty]}>
        {leftIcon && onLeftPress ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={leftLabel} onPress={onLeftPress}>
            <IconButton><TicketIcon name={leftIcon} color={organizerColors.ink} size={20} /></IconButton>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={[styles.topCopy, leftIcon && styles.topCopyCentered]}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.topTitle}>{title}</Text>
      </View>
      <View style={[styles.topSide, styles.topSideRight]}>
        {rightIcon && onRightPress ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={rightLabel} onPress={onRightPress}>
            <IconButton><TicketIcon name={rightIcon} color={organizerColors.ink} size={20} /></IconButton>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function OrganizerHero({
  size = 'md',
  badge,
  title,
  meta,
  posters = true,
  imageUrl,
}: {
  size?: 'md' | 'lg';
  badge: string;
  title: string;
  meta: string;
  posters?: boolean;
  imageUrl?: string | null;
}) {
  return (
    <View style={styles.heroWrap}>
      <FlowHero height={size === 'lg' ? 224 : 188} badge={badge} title={title} meta={meta} posters={posters} imageUrl={imageUrl} />
    </View>
  );
}

export function OrganizerSectionHead({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} accessibilityRole="button">
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function OrganizerSearch({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchWrap}>
      <View style={styles.searchBox}>
        <TicketIcon name="search" color={organizerColors.muted} size={18} />
        <TextInput
          style={styles.searchInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          returnKeyType="search"
        />
      </View>
    </View>
  );
}

export function OrganizerFilterBar<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterWrap}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <TouchableOpacity key={item.key} style={[styles.filterPill, active && styles.filterPillActive]} onPress={() => onChange(item.key)}>
            <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export function OrganizerEmpty({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.emptyAction} onPress={onAction}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export const organizerTabStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: organizerColors.background },
  content: { paddingBottom: 108 },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(246,247,251,0.96)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: organizerColors.border,
    ...flowShadow,
  },
});

const styles = StyleSheet.create({
  topBar: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: organizerColors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topSide: { width: 48, alignItems: 'flex-start' },
  topSideEmpty: { display: 'none' },
  topSideRight: { alignItems: 'flex-end' },
  topCopy: { flex: 1, alignItems: 'flex-start' },
  topCopyCentered: { alignItems: 'center' },
  eyebrow: { color: '#938CF0', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  topTitle: { color: organizerColors.ink, fontSize: 18, fontWeight: '900', marginTop: 2, letterSpacing: -0.4 },
  heroWrap: { marginHorizontal: 16, marginVertical: 14 },
  sectionHead: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 9, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { color: organizerColors.ink, fontSize: 17, fontWeight: '900' },
  sectionSubtitle: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 3 },
  sectionAction: { color: organizerColors.purple, fontSize: 12, fontWeight: '900', paddingVertical: 4 },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 10 },
  searchBox: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: organizerColors.border, borderRadius: 17, paddingHorizontal: 13 },
  searchInput: { flex: 1, paddingVertical: 12, color: organizerColors.ink, fontSize: 13 },
  filterWrap: { paddingHorizontal: 16, paddingBottom: 12, gap: 7 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: organizerColors.border, backgroundColor: '#FFFFFF' },
  filterPillActive: { backgroundColor: organizerColors.ink, borderColor: organizerColors.ink },
  filterText: { color: '#6B7280', fontSize: 11, fontWeight: '900' },
  filterTextActive: { color: '#FFFFFF' },
  empty: { marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: organizerColors.border, padding: 28, alignItems: 'center', ...flowShadow },
  emptyTitle: { color: '#6B7280', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  emptyAction: { marginTop: 14, backgroundColor: organizerColors.ink, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11 },
  emptyActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
