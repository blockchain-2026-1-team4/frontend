import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { accountStatusMessage, errorMessage, routeForEntry } from '../lib/account';
import { clearAccessToken, getAccessToken } from '../lib/auth';
import { backendApi } from '../lib/backend';
import { resolveImageUrl } from '../lib/config';
import { hasOrganizerAccess } from '../lib/roles';
import { formatEventCategory, formatNextRoundLabel, getNextRoundTime, getUserEventDisplayStatus, userSortRank, weiToEth } from '../lib/ticketDisplay';
import type { EventSummary, UserProfile } from '../types/api';

type IconName = 'grid' | 'mic' | 'music' | 'laptop' | 'trophy' | 'photo' | 'sparkles' | 'arrow' | 'calendar' | 'wallet';

const CATEGORIES = [
  { id: 'ALL', label: '전체', icon: 'grid', bg: '#1A1A2E', color: '#FFFFFF' },
  { id: 'CONCERT', label: '공연', icon: 'mic', bg: '#EEEDFE', color: '#534AB7' },
  { id: 'FESTIVAL', label: '페스티벌', icon: 'music', bg: '#E1F5EE', color: '#0F6E56' },
  { id: 'CONFERENCE', label: '컨퍼런스', icon: 'laptop', bg: '#E6F1FB', color: '#185FA5' },
  { id: 'SPORTS', label: '스포츠', icon: 'trophy', bg: '#FAEEDA', color: '#854F0B' },
  { id: 'EXHIBITION', label: '전시', icon: 'photo', bg: '#FAECE7', color: '#993C1D' },
] as const;

const HERO_POSTERS = [
  { category: '공연', title: '봄 인디\n콘서트', date: '6.13 홍대 라이브 FF', badge: 'HOT', colors: ['#26215C', '#534AB7', '#1D9E75'] },
  { category: '페스티벌', title: 'NEON\nRAVE 2026', date: '7.4 올림픽공원', colors: ['#0C447C', '#185FA5', '#639922'] },
  { category: '공연', title: '개그콘서트\n스페셜', date: '6.28 KBS 홀', badge: '마감임박', colors: ['#712B13', '#D85A30', '#EF9F27'] },
  { category: '컨퍼런스', title: 'Seoul\nDevFest', date: '8.2 코엑스', colors: ['#2C2C2A', '#5F5E5A', '#534AB7'] },
];

const MOCK_DEADLINES = [
  { title: '개그콘서트 스페셜', date: '6.28 KBS 홀', price: '0.1 ETH', badge: 'D-3', colors: ['#712B13', '#D85A30', '#EF9F27'] },
  { title: '봄 인디 콘서트 1회차', date: '6.13 홍대 라이브 FF', price: '0.2 ETH', badge: 'D-7', colors: ['#26215C', '#534AB7'] },
  { title: '서울 재즈 페스티벌', date: '6.20 올림픽공원', price: '0.35 ETH', badge: 'D-14', colors: ['#085041', '#1D9E75'] },
];

const MOCK_RECOMMENDED = [
  { category: '페스티벌', title: 'NEON RAVE 2026', meta: '7.4 · 올림픽공원 KSPO DOME', price: '0.5 ETH~', hot: true, colors: ['#0C447C', '#185FA5', '#639922'] },
  { category: '컨퍼런스', title: 'Seoul DevFest 2026', meta: '8.2 · 코엑스 B홀', price: '무료', colors: ['#2C2C2A', '#5F5E5A', '#534AB7'] },
  { category: '공연', title: '서울 재즈 페스티벌', meta: '6.20 · 올림픽공원 야외무대', price: '0.35 ETH~', colors: ['#04342C', '#0F6E56', '#5DCAA5'] },
];

function Icon({ name, color = '#534AB7', size = 20 }: { name: IconName; color?: string; size?: number }) {
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'grid' ? <><Rect {...common} x={4} y={4} width={6} height={6} rx={1.5} /><Rect {...common} x={14} y={4} width={6} height={6} rx={1.5} /><Rect {...common} x={4} y={14} width={6} height={6} rx={1.5} /><Rect {...common} x={14} y={14} width={6} height={6} rx={1.5} /></> : null}
      {name === 'mic' ? <><Path {...common} d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><Path {...common} d="M19 11a7 7 0 0 1-14 0m7 7v3m-4 0h8" /></> : null}
      {name === 'music' ? <><Path {...common} d="M9 18V5l11-2v13" /><Circle {...common} cx={6} cy={18} r={3} /><Circle {...common} cx={17} cy={16} r={3} /></> : null}
      {name === 'laptop' ? <><Rect {...common} x={4} y={5} width={16} height={11} rx={2} /><Path {...common} d="M2 20h20" /></> : null}
      {name === 'trophy' ? <><Path {...common} d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><Path {...common} d="M5 5H3v2a4 4 0 0 0 4 4m12-6h2v2a4 4 0 0 1-4 4" /></> : null}
      {name === 'photo' ? <><Rect {...common} x={3} y={5} width={18} height={14} rx={2} /><Circle {...common} cx={8.5} cy={10} r={1.5} /><Path {...common} d="m21 15-5-5L5 19" /></> : null}
      {name === 'sparkles' ? <><Path {...common} d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" /><Path {...common} d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></> : null}
      {name === 'arrow' ? <Path {...common} d="M5 12h14m-7-7 7 7-7 7" /> : null}
      {name === 'calendar' ? <><Rect {...common} x={4} y={5} width={16} height={15} rx={2.5} /><Path {...common} d="M8 3v4m8-4v4M4 10h16" /></> : null}
      {name === 'wallet' ? <><Path {...common} d="M4 7h16v12H4zM4 7l3-3h10l3 3" /><Path {...common} d="M16 13h4" /></> : null}
    </Svg>
  );
}

function GradientPoster({ colors, children, style }: { colors: string[]; children?: React.ReactNode; style?: any }) {
  return (
    <View style={[style, { backgroundColor: colors[0] }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors[1] ?? colors[0], opacity: 0.72 }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors[2] ?? colors[1] ?? colors[0], opacity: 0.28 }]} />
      {children}
    </View>
  );
}

function eventName(event: EventSummary) {
  return event.name || event.title || '이벤트';
}

function eventPoster(event: EventSummary) {
  return resolveImageUrl((event as EventSummary & { imageUrl?: string }).imageUrl);
}

export default function UserHomePage({ navigation }: any) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [startingRole, setStartingRole] = useState<'USER' | 'ORGANIZER' | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const loadProfile = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setProfile(null);
      return;
    }
    setProfile(await backendApi.getMe().catch(() => null));
  }, []);

  useFocusEffect(useCallback(() => { void loadProfile(); }, [loadProfile]));

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    backendApi.getEvents({ size: 30 })
      .then((data) => { if (mounted) setEvents(data.items ?? []); })
      .catch(() => { if (mounted) setEvents([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const visibleEvents = useMemo(() => {
    const filtered = selectedCategory === 'ALL' ? events : events.filter((event) => event.category === selectedCategory);
    return filtered
      .filter((event) => getUserEventDisplayStatus(event) !== null)
      .sort((left, right) => {
        const rankDiff = userSortRank(left) - userSortRank(right);
        if (rankDiff !== 0) return rankDiff;
        return getNextRoundTime(left) - getNextRoundTime(right);
      });
  }, [events, selectedCategory]);

  const recommended = visibleEvents.slice(0, 5);
  const deadlineEvents = visibleEvents.slice(0, 3);

  const startWithWallet = async (role: 'USER' | 'ORGANIZER') => {
    setStartingRole(role);
    try {
      const token = await getAccessToken();
      if (!token) {
        navigation.navigate('Auth', { initialRole: role, walletMode: true });
        return;
      }

      const profile = await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        Alert.alert('계정 사용 불가', statusMessage);
        return;
      }
      if (role === 'ORGANIZER' && !hasOrganizerAccess(profile.roles)) {
        navigation.navigate('Organizer');
        return;
      }
      navigation.navigate(routeForEntry(profile, role));
    } catch (error: any) {
      Alert.alert('세션 확인 실패', errorMessage(error, '다시 로그인해주세요.'));
      navigation.navigate('Auth', { initialRole: role, walletMode: true });
    } finally {
      setStartingRole(null);
    }
  };

  const handleLoginButton = async () => {
    if (!profile) {
      await startWithWallet('USER');
      return;
    }
    await clearAccessToken();
    setProfile(null);
  };

  const openEvent = (event?: EventSummary) => {
    if (event?.id) navigation.navigate('EventDetail', { eventId: event.id });
    else navigation.navigate('EventList', { category: selectedCategory === 'ALL' ? undefined : selectedCategory });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} stickyHeaderIndices={[0]}>
      <View style={styles.topbar}>
        <Text style={styles.logo}>Trust<Text style={styles.logoAccent}>Ticket</Text></Text>
        <View style={styles.topbarRight}>
          <TouchableOpacity onPress={() => void startWithWallet('ORGANIZER')} disabled={startingRole !== null}>
            <Text style={styles.organizerLink}>주최자</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.loginButton} onPress={() => void handleLoginButton()} disabled={startingRole !== null}>
            <Text style={styles.loginButtonText}>{startingRole === 'USER' ? '연결 중' : profile ? '로그아웃' : '로그인'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>블록체인 티켓 예매</Text>
        <Text style={styles.heroTitle}>위조 없는{'\n'}티켓의 시작</Text>
        <Text style={styles.heroSub}>지갑 하나로 예매하고, 투명하게 리셀까지.</Text>
        <View style={styles.heroButtons}>
          <TouchableOpacity style={styles.heroPrimary} onPress={() => void startWithWallet('USER')} disabled={startingRole !== null}>
            {startingRole === 'USER' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.heroPrimaryText}>지갑으로 시작하기</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.heroSecondary} onPress={() => navigation.navigate('EventList')}>
            <Icon name="calendar" color="rgba(255,255,255,0.75)" size={14} />
            <Text style={styles.heroSecondaryText}>이벤트 둘러보기</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posterStrip}>
          {HERO_POSTERS.map((poster) => (
            <TouchableOpacity key={poster.title} style={styles.posterCard} onPress={() => navigation.navigate('EventList')}>
              <GradientPoster colors={poster.colors} style={styles.posterBg}>
                <View style={styles.posterShade} />
                {poster.badge ? <Text style={styles.posterBadge}>{poster.badge}</Text> : null}
                <View style={styles.posterInfo}>
                  <Text style={styles.posterCategory}>{poster.category}</Text>
                  <Text style={styles.posterName}>{poster.title}</Text>
                  <Text style={styles.posterDate}>{poster.date}</Text>
                </View>
              </GradientPoster>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category.id;
            return (
              <TouchableOpacity key={category.id} style={styles.categoryChip} onPress={() => setSelectedCategory(category.id)}>
                <View style={[styles.categoryIcon, { backgroundColor: active ? '#1A1A2E' : category.bg }]}>
                  <Icon name={category.icon as IconName} color={active ? '#FFFFFF' : category.color} />
                </View>
                <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{category.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.promoBanner} onPress={() => navigation.navigate('EventList')}>
        <View style={styles.promoIcon}><Icon name="sparkles" color="#A89CF7" size={18} /></View>
        <View style={styles.promoCopy}>
          <Text style={styles.promoTitle}>첫 예매 수수료 0%</Text>
          <Text style={styles.promoSub}>지갑 연결 후 첫 티켓 구매 시 적용</Text>
        </View>
        <Icon name="arrow" color="rgba(255,255,255,0.42)" size={18} />
      </TouchableOpacity>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>마감 임박</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deadlineList}>
        {(deadlineEvents.length ? deadlineEvents : MOCK_DEADLINES).map((item, index) => {
          const live = 'id' in item ? item as EventSummary : null;
          const mock = !live ? item as (typeof MOCK_DEADLINES)[number] : null;
          return (
            <TouchableOpacity key={live?.id ?? mock?.title} style={styles.deadlineCard} onPress={() => openEvent(live ?? undefined)}>
              {live && eventPoster(live) ? (
                <Image source={{ uri: eventPoster(live)! }} style={styles.deadlineImage} resizeMode="cover" />
              ) : (
                <GradientPoster colors={mock?.colors ?? HERO_POSTERS[index % HERO_POSTERS.length].colors} style={styles.deadlineImage} />
              )}
              <View style={styles.deadlineShade} />
              <Text style={styles.deadlineBadge}>{mock?.badge ?? `D-${index + 3}`}</Text>
              <View style={styles.deadlineBody}>
                <Text style={styles.deadlineName} numberOfLines={2}>{live ? eventName(live) : mock?.title}</Text>
                <Text style={styles.deadlineDate} numberOfLines={1}>{live ? formatNextRoundLabel(live) : mock?.date}</Text>
                <Text style={styles.deadlinePrice}>{live ? (weiToEth(live.ticketPriceWei) === '-' ? '가격 정보 없음' : weiToEth(live.ticketPriceWei)) : mock?.price}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.organizerBanner}>
        <Text style={styles.popupClose}>×</Text>
        <Text style={styles.popupEyebrow}>주최자 모드</Text>
        <Text style={styles.popupTitle}>이벤트를 직접{'\n'}등록해보세요.</Text>
        <Text style={styles.popupSub}>티켓 발행부터 체크인 운영까지{'\n'}한 곳에서 관리할 수 있습니다.</Text>
        <TouchableOpacity style={styles.popupButton} onPress={() => void startWithWallet('ORGANIZER')}>
          <Text style={styles.popupButtonText}>{startingRole === 'ORGANIZER' ? '확인 중...' : '주최자로 시작하기'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>추천 이벤트</Text>
      </View>
      <View style={styles.eventList}>
        {loading ? <ActivityIndicator color="#534AB7" style={styles.loader} /> : null}
        {(recommended.length ? recommended : MOCK_RECOMMENDED).map((item, index) => {
          const live = 'id' in item ? item as EventSummary : null;
          const mock = !live ? item as (typeof MOCK_RECOMMENDED)[number] : null;
          return (
            <TouchableOpacity key={live?.id ?? mock?.title} style={styles.eventCard} onPress={() => openEvent(live ?? undefined)}>
              <View style={styles.eventThumb}>
                {live && eventPoster(live) ? (
                  <Image source={{ uri: eventPoster(live)! }} style={styles.eventThumbImage} resizeMode="cover" />
                ) : (
                  <GradientPoster colors={mock?.colors ?? HERO_POSTERS[index % HERO_POSTERS.length].colors} style={styles.eventThumbImage} />
                )}
                {(mock?.hot || index === 0) ? <Text style={styles.eventHot}>HOT</Text> : null}
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventCategory}>{live ? formatEventCategory(live.category) : mock?.category}</Text>
                <Text style={styles.eventName} numberOfLines={2}>{live ? eventName(live) : mock?.title}</Text>
                <Text style={styles.eventMeta} numberOfLines={1}>{live ? `${formatNextRoundLabel(live)} · ${live.venue || '-'}` : mock?.meta}</Text>
                <Text style={styles.eventPrice}>{live ? (weiToEth(live.ticketPriceWei) === '-' ? '가격 정보 없음' : `${weiToEth(live.ticketPriceWei)}`) : mock?.price}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { paddingBottom: 96 },
  topbar: { minHeight: 50, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.94)', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { color: '#1A1A2E', fontSize: 13, fontWeight: '900' },
  logoAccent: { color: '#534AB7' },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  organizerLink: { color: '#6B7280', fontSize: 11, fontWeight: '800', paddingVertical: 6 },
  loginButton: { borderWidth: 0.5, borderColor: '#CECBF6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  loginButtonText: { color: '#534AB7', fontSize: 11, fontWeight: '800' },
  hero: { backgroundColor: '#1A1A2E', paddingTop: 20, overflow: 'hidden' },
  heroEyebrow: { marginHorizontal: 16, color: '#A89CF7', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  heroTitle: { marginHorizontal: 16, color: '#FFFFFF', fontSize: 26, fontWeight: '900', lineHeight: 31, marginBottom: 6 },
  heroSub: { marginHorizontal: 16, color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 19, marginBottom: 18 },
  heroButtons: { marginHorizontal: 16, flexDirection: 'row', gap: 8, marginBottom: 20 },
  heroPrimary: { flex: 1, minHeight: 41, borderRadius: 10, backgroundColor: '#534AB7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  heroPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  heroSecondary: { minHeight: 41, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, flexDirection: 'row', gap: 5 },
  heroSecondaryText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '800' },
  posterStrip: { paddingLeft: 14, paddingRight: 16, paddingBottom: 20, gap: 8 },
  posterCard: { width: 110, height: 150, borderRadius: 12, overflow: 'hidden' },
  posterBg: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  posterShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.24)' },
  posterBadge: { position: 'absolute', top: 7, right: 7, backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF', fontSize: 8, fontWeight: '800', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  posterInfo: { position: 'absolute', left: 8, right: 8, bottom: 8 },
  posterCategory: { color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  posterName: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', lineHeight: 14 },
  posterDate: { color: 'rgba(255,255,255,0.6)', fontSize: 9, marginTop: 2 },
  section: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  categoryScroll: { gap: 8, paddingBottom: 4 },
  categoryChip: { alignItems: 'center', gap: 4 },
  categoryIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { color: '#6B7280', fontSize: 10, fontWeight: '800' },
  categoryLabelActive: { color: '#1A1A2E' },
  promoBanner: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#534AB7', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  promoIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  promoCopy: { flex: 1, minWidth: 0 },
  promoTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  promoSub: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  sectionTitle: { color: '#1A1A2E', fontSize: 13, fontWeight: '900' },
  deadlineList: { paddingHorizontal: 16, paddingBottom: 4, gap: 10 },
  deadlineCard: { width: 150, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 12, overflow: 'hidden' },
  deadlineImage: { height: 90, width: '100%' },
  deadlineShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 90, backgroundColor: 'rgba(0,0,0,0.18)' },
  deadlineBadge: { position: 'absolute', top: 68, left: 7, backgroundColor: '#E24B4A', color: '#FFFFFF', fontSize: 8, fontWeight: '800', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  deadlineBody: { paddingHorizontal: 9, paddingVertical: 8 },
  deadlineName: { color: '#1A1A2E', fontSize: 11, fontWeight: '900', lineHeight: 14, marginBottom: 2 },
  deadlineDate: { color: '#9CA3AF', fontSize: 9 },
  deadlinePrice: { color: '#534AB7', fontSize: 11, fontWeight: '900', marginTop: 4 },
  organizerBanner: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#1A1A2E', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  popupClose: { position: 'absolute', top: 10, right: 12, color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '800' },
  popupEyebrow: { color: '#A89CF7', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 },
  popupTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', lineHeight: 19, marginBottom: 4 },
  popupSub: { color: 'rgba(255,255,255,0.5)', fontSize: 10, lineHeight: 15, marginBottom: 12 },
  popupButton: { backgroundColor: '#534AB7', borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  popupButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  eventList: { paddingHorizontal: 16, gap: 10 },
  loader: { paddingVertical: 10 },
  eventCard: { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 14, padding: 10, flexDirection: 'row', gap: 10 },
  eventThumb: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden' },
  eventThumbImage: { width: 72, height: 72 },
  eventHot: { position: 'absolute', top: 5, right: 5, backgroundColor: '#E24B4A', color: '#FFFFFF', fontSize: 8, fontWeight: '800', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, overflow: 'hidden' },
  eventInfo: { flex: 1, minWidth: 0 },
  eventCategory: { color: '#9CA3AF', fontSize: 9, fontWeight: '800', letterSpacing: 0.4, marginBottom: 2 },
  eventName: { color: '#1A1A2E', fontSize: 12, fontWeight: '900', lineHeight: 16, marginBottom: 3 },
  eventMeta: { color: '#9CA3AF', fontSize: 10 },
  eventPrice: { color: '#534AB7', fontSize: 11, fontWeight: '900', marginTop: 4 },
});
