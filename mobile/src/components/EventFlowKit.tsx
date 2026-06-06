import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlowBadge, FlowHero, IconButton, TicketIcon, type TicketIconName, flowShadow } from './TicketFlowKit';
import { organizerColors } from './OrganizerTabKit';
import { TextInput } from './TextInput';

export function EventFlowTopBar({
  eyebrow,
  title,
  badge,
  badgeTone = 'green',
  onBack,
}: {
  eyebrow: string;
  title: string;
  badge: string;
  badgeTone?: 'green' | 'purple' | 'gray' | 'red' | 'yellow';
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 14) }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" onPress={onBack}>
        <IconButton><TicketIcon name="arrowLeft" color="#475569" size={20} /></IconButton>
      </TouchableOpacity>
      <View style={styles.topCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.badgeSlot}><FlowBadge label={badge} tone={badgeTone} /></View>
    </View>
  );
}

export function EventFlowHero({
  size = 'md',
  height,
  badge,
  title,
  meta,
  posters = false,
}: {
  size?: 'md' | 'lg';
  height?: number;
  badge: string;
  title: string;
  meta: string;
  posters?: boolean;
}) {
  return (
    <View style={styles.heroWrap}>
      <FlowHero height={height ?? (size === 'lg' ? 240 : 188)} badge={badge} title={title} meta={meta} posters={posters} />
    </View>
  );
}

export function EventFlowSectionHead({ title, subtitle, actionLabel, onAction }: { title: string; subtitle: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      {actionLabel && onAction ? <TouchableOpacity onPress={onAction}><Text style={styles.sectionAction}>{actionLabel}</Text></TouchableOpacity> : null}
    </View>
  );
}

export function EventFlowMenuRow({
  icon,
  iconTone = 'purple',
  title,
  subtitle,
  last = false,
  onPress,
}: {
  icon: TicketIconName;
  iconTone?: 'purple' | 'green' | 'red';
  title: string;
  subtitle: string;
  last?: boolean;
  onPress: () => void;
}) {
  const tones = {
    purple: { bg: '#EEEDFE', color: '#534AB7' },
    green: { bg: '#DCFCE7', color: '#0F6E56' },
    red: { bg: '#FEE2E2', color: '#DC2626' },
  };
  const tone = tones[iconTone];
  return (
    <TouchableOpacity style={[styles.menuRow, last && styles.menuRowLast]} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: tone.bg }]}><TicketIcon name={icon} color={tone.color} size={19} /></View>
      <View style={styles.menuCopy}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <TicketIcon name="chevron" color="#B4B2A9" size={18} />
    </TouchableOpacity>
  );
}

export function EventFlowNotice({ tone, title, subtitle }: { tone: 'orange' | 'red' | 'green'; title: string; subtitle: string }) {
  const tones = {
    orange: { bg: '#FFF7ED', border: '#FED7AA', color: '#A16207', icon: 'alert' as const },
    red: { bg: '#FFF1F2', border: '#FECDD3', color: '#DC2626', icon: 'alert' as const },
    green: { bg: '#F0FDF4', border: '#BBF7D0', color: '#0F6E56', icon: 'check' as const },
  };
  const selected = tones[tone];
  return (
    <View style={[styles.notice, { backgroundColor: selected.bg, borderColor: selected.border }]}>
      <TicketIcon name={selected.icon} color={selected.color} size={18} />
      <View style={styles.noticeCopy}>
        <Text style={[styles.noticeTitle, { color: selected.color }]}>{title}</Text>
        <Text style={styles.noticeSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

export function EventFormGroup({
  icon,
  label,
  helper,
  value,
  onChangeText,
  placeholder,
  required = true,
  multiline = false,
  count,
  invalid = false,
  inputStyle,
  children,
}: {
  icon: TicketIconName;
  label: string;
  helper: string;
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  count?: string;
  invalid?: boolean;
  inputStyle?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.formGroup, invalid && styles.formGroupInvalid]}>
      <View style={styles.formGroupHead}>
        <View style={styles.fieldIcon}><TicketIcon name={icon} color="#534AB7" size={17} /></View>
        <View style={styles.formGroupBody}>
          <Text style={styles.fieldLabel}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
          {children ?? (
            <TextInput
              style={[styles.formInput, multiline && styles.formTextarea, inputStyle]}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              multiline={multiline}
              maxLength={multiline ? 500 : undefined}
            />
          )}
        </View>
      </View>
      <View style={styles.formMeta}>
        <Text style={styles.formHelper}>{helper}</Text>
        {count ? <Text style={styles.formCount}>{count}</Text> : null}
      </View>
    </View>
  );
}

export function EventCategorySummary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.selectSummary} onPress={onPress}>
      <View style={styles.selectValue}>
        <Text style={styles.selectValueText}>{label}</Text>
        <Text style={styles.selectPill}>선택됨</Text>
      </View>
      <TicketIcon name="chevron" color="#64748B" size={18} />
    </TouchableOpacity>
  );
}

export const eventFlowStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: organizerColors.background },
  content: { paddingBottom: 116 },
  section: { paddingHorizontal: 16, paddingBottom: 14 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24 },
});

const styles = StyleSheet.create({
  topBar: { minHeight: 76, paddingHorizontal: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(246,247,251,0.96)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.72)' },
  topCopy: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  eyebrow: { color: '#938CF0', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  title: { color: '#0F172A', fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  badgeSlot: { width: 74, alignItems: 'flex-end' },
  heroWrap: { marginHorizontal: 16, marginVertical: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  sectionSubtitle: { color: '#64748B', fontSize: 11, marginTop: 3 },
  sectionAction: { color: '#534AB7', fontSize: 12, fontWeight: '900' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  menuRowLast: { borderBottomWidth: 0 },
  menuIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  menuCopy: { flex: 1, minWidth: 0 },
  menuTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900', marginBottom: 3 },
  menuSubtitle: { color: '#64748B', fontSize: 10, lineHeight: 14 },
  notice: { marginBottom: 12, padding: 12, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeCopy: { flex: 1 },
  noticeTitle: { fontSize: 12, fontWeight: '900', marginBottom: 2 },
  noticeSubtitle: { color: '#64748B', fontSize: 10, lineHeight: 15 },
  formGroup: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 22, padding: 14, marginBottom: 12, ...flowShadow },
  formGroupInvalid: { borderColor: '#DC2626', backgroundColor: '#FFF7F7' },
  formGroupHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  fieldIcon: { width: 30, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEEDFE', flexShrink: 0 },
  formGroupBody: { flex: 1, minWidth: 0 },
  fieldLabel: { color: '#26364F', fontSize: 12, fontWeight: '900', marginBottom: 5 },
  required: { color: '#DC2626' },
  formInput: { height: 34, paddingVertical: 0, paddingHorizontal: 0, color: '#0F172A', fontSize: 15, fontWeight: '900', backgroundColor: 'transparent', borderWidth: 0 },
  formTextarea: { height: 128, textAlignVertical: 'top', fontSize: 14, lineHeight: 22, fontWeight: '500', paddingTop: 2 },
  formMeta: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 7 },
  formHelper: { flex: 1, color: '#94A3B8', fontSize: 10, lineHeight: 15 },
  formCount: { color: '#94A3B8', fontSize: 10 },
  selectSummary: { height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectValueText: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  selectPill: { color: '#534AB7', fontSize: 10, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', backgroundColor: '#EEEDFE' },
});
