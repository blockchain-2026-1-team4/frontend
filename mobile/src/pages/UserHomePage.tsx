import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { accountStatusMessage, errorMessage } from '../lib/account';
import { clearAccessToken, getAccessToken } from '../lib/auth';
import { backendApi } from '../lib/backend';
import { resolveImageUrl } from '../lib/config';
import { showDialog } from '../lib/dialog';
import { hasOrganizerAccess } from '../lib/roles';
import {
  formatEventCategory,
  formatNextRoundLabel,
  getNextRoundTime,
  isEventListedNow,
  userSortRank,
  weiToEth,
} from '../lib/ticketDisplay';
import type { EventSummary, UserProfile } from '../types/api';

type Role = 'USER' | 'ORGANIZER';
type IconName = 'ticket' | 'building' | 'search' | 'grid' | 'mic' | 'music' | 'trophy' | 'photo' | 'shield' | 'speaker';

type MockFeaturedEvent = {
  title: string;
  date: string;
  price: string;
  badge: string;
  colors: string[];
};

type MockRecommendedEvent = {
  category: string;
  status: string;
  title: string;
  meta: string;
  price: string;
  posterTitle: string;
  colors: string[];
};

const CATEGORIES = [
  { id: 'ALL', label: '전체', icon: 'grid' },
  { id: 'CONCERT', label: '공연', icon: 'mic' },
  { id: 'FESTIVAL', label: '페스티벌', icon: 'music' },
  { id: 'SPORTS', label: '스포츠', icon: 'trophy' },
  { id: 'EXHIBITION', label: '전시', icon: 'photo' },
] as const;

const MOCK_FEATURED_EVENTS: MockFeaturedEvent[] = [
  { title: '개그콘서트 스페셜', date: '6.28 · KBS 홀', price: '0.10 ETH~', badge: 'D-3', colors: ['#712B13', '#D85A30', '#EF9F27'] },
  { title: '봄 인디 콘서트', date: '6.20 · 홍대 클럽 FF', price: '0.05 ETH~', badge: 'HOT', colors: ['#26215C', '#534AB7', '#1D9E75'] },
  { title: 'KT vs 두산', date: '6.14 · 수원', price: '0.05 ETH~', badge: 'NEW', colors: ['#0C447C', '#185FA5', '#639922'] },
];

const MOCK_RECOMMENDED_EVENTS: MockRecommendedEvent[] = [
  {
    category: '스포츠',
    status: '예매 가능',
    title: 'KT 위즈 vs 두산 베어스 · KBO 정규시즌',
    meta: '수원 케이티위즈파크\n2026.06.14 19:00',
    price: '0.05 ETH~',
    posterTitle: 'KT vs 두산\nKBO',
    colors: ['#0C447C', '#185FA5', '#639922'],
  },
  {
    category: '공연',
    status: '예매 가능',
    title: '2026 봄 인디 콘서트 · 2회차',
    meta: '홍대 클럽 FF\n2026.06.20 20:00',
    price: '0.05 ETH~',
    posterTitle: '봄 인디\n콘서트',
    colors: ['#26215C', '#534AB7', '#1D9E75'],
  },
];

const Gradient = LinearGradient as unknown as React.ComponentType<any>;

function Icon({ name, color = '#534AB7', size = 22 }: { name: IconName; color?: string; size?: number }) {
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'ticket' ? (
        <>
          <Path {...common} d="M4 8a3 3 0 0 1 0 6v3h16v-3a3 3 0 0 1 0-6V5H4v3Z" />
          <Path {...common} d="M9 9h.01M9 13h.01M13 11h5" />
        </>
      ) : null}
      {name === 'building' ? (
        <>
          <Path {...common} d="M4 21V7l8-4 8 4v14" />
          <Path {...common} d="M9 21v-6h6v6M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01" />
        </>
      ) : null}
      {name === 'search' ? (
        <>
          <Circle {...common} cx={11} cy={11} r={6} />
          <Path {...common} d="m16 16 4 4" />
        </>
      ) : null}
      {name === 'grid' ? (
        <>
          <Rect {...common} x={4} y={4} width={6} height={6} rx={1.5} />
          <Rect {...common} x={14} y={4} width={6} height={6} rx={1.5} />
          <Rect {...common} x={4} y={14} width={6} height={6} rx={1.5} />
          <Rect {...common} x={14} y={14} width={6} height={6} rx={1.5} />
        </>
      ) : null}
      {name === 'mic' ? (
        <>
          <Path {...common} d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
          <Path {...common} d="M19 11a7 7 0 0 1-14 0m7 7v3m-4 0h8" />
        </>
      ) : null}
      {name === 'music' ? (
        <>
          <Path {...common} d="M9 18V5l11-2v13" />
          <Circle {...common} cx={6} cy={18} r={3} />
          <Circle {...common} cx={17} cy={16} r={3} />
        </>
      ) : null}
      {name === 'trophy' ? (
        <>
          <Path {...common} d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
          <Path {...common} d="M5 5H3v2a4 4 0 0 0 4 4m12-6h2v2a4 4 0 0 1-4 4" />
        </>
      ) : null}
      {name === 'photo' ? (
        <>
          <Rect {...common} x={3} y={5} width={18} height={14} rx={2} />
          <Circle {...common} cx={8.5} cy={10} r={1.5} />
          <Path {...common} d="m21 15-5-5L5 19" />
        </>
      ) : null}
      {name === 'shield' ? (
        <>
          <Path {...common} d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />
          <Path {...common} d="m8.5 12 2.2 2.2 4.8-5" />
        </>
      ) : null}
      {name === 'speaker' ? (
        <>
          <Path {...common} d="M4 13h3l8 5V6L7 11H4v2Z" />
          <Path {...common} d="M18 9a5 5 0 0 1 0 6M20.5 6.5a9 9 0 0 1 0 11" />
        </>
      ) : null}
    </Svg>
  );
}

function GradientPoster({ colors, children, style }: { colors: string[]; children?: React.ReactNode; style?: any }) {
  return (
    <Gradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      {children}
    </Gradient>
  );
}

function eventName(event: EventSummary) {
  return event.name || event.title || '이벤트';
}

function eventPoster(event: EventSummary) {
  return resolveImageUrl(event.imageUrl);
}

function eventPrice(event: EventSummary) {
  const value = weiToEth(event.ticketPriceWei);
  return value === '-' ? '가격 정보 없음' : `${value}~`;
}

function isLiveEvent(item: EventSummary | MockFeaturedEvent | MockRecommendedEvent): item is EventSummary {
  return typeof (item as EventSummary).id === 'string';
}

export default function UserHomePage({ navigation }: any) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORIES)[number]['id']>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [startingRole, setStartingRole] = useState<Role | null>(null);
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
      .then((data) => {
        if (mounted) setEvents(data.items ?? []);
      })
      .catch(() => {
        if (mounted) setEvents([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const visibleEvents = useMemo(() => {
    const filtered = selectedCategory === 'ALL' ? events : events.filter((event) => event.category === selectedCategory);
    return filtered
      .filter((event) => isEventListedNow(event))
      .sort((left, right) => {
        const rankDiff = userSortRank(left) - userSortRank(right);
        if (rankDiff !== 0) return rankDiff;
        return getNextRoundTime(left) - getNextRoundTime(right);
      });
  }, [events, selectedCategory]);

  const featuredEvents = visibleEvents.slice(0, 3);
  const recommendedEvents = visibleEvents.slice(0, 2);

  const openExplore = (params?: { query?: string; category?: string }) => {
    navigation.navigate('EventList', {
      query: params?.query,
      category: params?.category ?? (selectedCategory === 'ALL' ? undefined : selectedCategory),
    });
  };

  const submitSearch = () => {
    openExplore({ query: searchQuery.trim() || undefined });
  };

  const startWithWallet = async (role: Role) => {
    setStartingRole(role);
    try {
      const token = await getAccessToken();
      if (!token) {
        navigation.navigate('Auth', { initialRole: role });
        return;
      }

      const nextProfile = await backendApi.getMe();
      const statusMessage = accountStatusMessage(nextProfile.status);
      if (statusMessage) {
        Alert.alert('계정 사용 불가', statusMessage);
        return;
      }
      if (role === 'ORGANIZER' && !hasOrganizerAccess(nextProfile.roles)) {
        navigation.navigate('Organizer');
        return;
      }
      navigation.navigate(role === 'ORGANIZER' ? 'Organizer' : 'EventList');
    } catch (error: any) {
      Alert.alert('세션 확인 실패', errorMessage(error, '다시 로그인해주세요.'));
      navigation.navigate('Auth', { initialRole: role });
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
    if (event?.id) {
      navigation.navigate('EventDetail', { eventId: event.id });
      return;
    }
    openExplore();
  };

  const openTrustPopup = () => {
    showDialog('블록체인 검증 티켓', '구매와 양도 이력이 지갑 주소 기준으로 기록되어 위조 티켓 위험을 줄입니다.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>
      <View style={styles.topbar}>
        <View style={styles.logo}>
          <View style={styles.logoMark}>
            <Icon name="ticket" color="#A89CF7" size={20} />
          </View>
          <Text style={styles.logoText}>Trust<Text style={styles.logoAccent}>Ticket</Text></Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={() => void startWithWallet('ORGANIZER')} disabled={startingRole !== null}>
            <Text style={styles.topLink}>주최자</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.loginChip} onPress={() => void handleLoginButton()} disabled={startingRole !== null}>
            <Text style={styles.loginChipText}>{startingRole === 'USER' ? '연결 중' : profile ? '로그아웃' : '로그인'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.hero}>
        <Gradient colors={['#1A1A2E', '#534AB7', '#1D9E75']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.heroGloss} />
        <Gradient colors={['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.78)']} style={StyleSheet.absoluteFill} />
        <View style={styles.posterRow} pointerEvents="none">
          <GradientPoster colors={['#26215C', '#534AB7', '#1D9E75']} style={styles.miniPoster} />
          <GradientPoster colors={['#0C447C', '#185FA5', '#639922']} style={styles.miniPoster} />
          <GradientPoster colors={['#712B13', '#D85A30', '#EF9F27']} style={styles.miniPoster} />
        </View>
        <View style={styles.heroBody}>
          <Text style={styles.eyebrow}>Blockchain Ticketing</Text>
          <Text style={styles.heroTitle}>위변조 없는{'\n'}티켓의 시작</Text>
          <Text style={styles.heroSub}>지갑 하나로 예매하고, QR로 입장하고, 투명하게 리셀하세요.</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.roleGrid}>
          <TouchableOpacity style={[styles.card, styles.roleCard]} onPress={() => void startWithWallet('USER')} disabled={startingRole !== null}>
            <View style={styles.roleIcon}>
              <Icon name="ticket" color="#1e1e20" />
            </View>
            <Text style={styles.roleTitle}>티켓 예매</Text>
            <Text style={styles.roleSub}>공연과 스포츠 티켓을 지갑으로 예매합니다.</Text>
            <Text style={styles.roleAction}>{profile ? '이벤트 탐색' : '사용자로 시작'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.card, styles.roleCard, styles.roleDark]} onPress={() => void startWithWallet('ORGANIZER')} disabled={startingRole !== null}>
            <View style={[styles.roleIcon, styles.roleDarkIcon]}>
              <Icon name="building" color="#A89CF7" />
            </View>
            <Text style={[styles.roleTitle, styles.roleDarkTitle]}>이벤트 운영</Text>
            <Text style={[styles.roleSub, styles.roleDarkSub]}>등록, 발행, 체크인을 한 곳에서 관리합니다.</Text>
            <Text style={styles.roleDarkAction}>주최자로 시작</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.searchCard}>
          <Icon name="search" color="#94A3B8" size={20} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="이벤트명, 장소, 아티스트 검색"
            placeholderTextColor="#94A3B8"
            returnKeyType="search"
            onSubmitEditing={submitSearch}
            style={styles.searchInput}
          />
          <TouchableOpacity style={styles.searchButton} onPress={submitSearch}>
            <Text style={styles.searchButtonText}>검색</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category.id;
            return (
              <TouchableOpacity key={category.id} style={styles.category} onPress={() => setSelectedCategory(category.id)}>
                <View style={[styles.categoryIcon, active && styles.categoryIconActive]}>
                  <Icon name={category.icon as IconName} color={active ? '#FFFFFF' : '#64748B'} size={20} />
                </View>
                <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{category.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.section, styles.head]}>
        <View>
          <Text style={styles.headTitle}>마감 임박</Text>
          <Text style={styles.headSub}>놓치기 쉬운 인기 티켓</Text>
        </View>
        <TouchableOpacity onPress={() => openExplore()}>
          <Text style={styles.more}>전체 보기</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featured}>
        {(featuredEvents.length ? featuredEvents : MOCK_FEATURED_EVENTS).map((item, index) => {
          const live = isLiveEvent(item) ? item : null;
          const mock = live ? null : item as MockFeaturedEvent;
          const posterUrl = live ? eventPoster(live) : null;
          return (
            <TouchableOpacity key={live?.id ?? mock?.title} style={styles.featuredCard} onPress={() => openEvent(live ?? undefined)}>
              <View style={styles.featuredImage}>
                {posterUrl ? (
                  <Image source={{ uri: posterUrl }} style={styles.coverImage} resizeMode="cover" />
                ) : (
                  <GradientPoster colors={mock?.colors ?? MOCK_FEATURED_EVENTS[index % MOCK_FEATURED_EVENTS.length].colors} style={styles.coverImage} />
                )}
                <View style={styles.featuredShade} />
                <Text style={styles.featuredBadge}>{mock?.badge ?? (index === 0 ? 'HOT' : 'NEW')}</Text>
              </View>
              <View style={styles.featuredBody}>
                <Text style={styles.featuredName} numberOfLines={2}>{live ? eventName(live) : mock?.title}</Text>
                <Text style={styles.featuredDate} numberOfLines={1}>{live ? formatNextRoundLabel(live) : mock?.date}</Text>
                <Text style={styles.featuredPrice}>{live ? eventPrice(live) : mock?.price}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.section}>
        <TouchableOpacity style={styles.trustBanner} onPress={openTrustPopup}>
          <View style={styles.trustIcon}>
            <Icon name="shield" color="#A89CF7" />
          </View>
          <View style={styles.trustCopy}>
            <Text style={styles.trustTitle}>블록체인 검증 티켓</Text>
            <Text style={styles.trustSub}>구매와 양도 이력이 지갑 주소 기준으로 기록되어 위조 티켓 위험을 줄입니다.</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={[styles.section, styles.head]}>
        <View>
          <Text style={styles.headTitle}>추천 이벤트</Text>
          <Text style={styles.headSub}>예매 가능한 이벤트 우선</Text>
        </View>
        <TouchableOpacity onPress={() => openExplore()}>
          <Text style={styles.more}>탐색</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.eventList}>
          {loading ? <ActivityIndicator color="#534AB7" style={styles.loader} /> : null}
          {(recommendedEvents.length ? recommendedEvents : MOCK_RECOMMENDED_EVENTS).map((item, index) => {
            const live = isLiveEvent(item) ? item : null;
            const mock = live ? null : item as MockRecommendedEvent;
            const posterUrl = live ? eventPoster(live) : null;
            return (
              <TouchableOpacity key={live?.id ?? mock?.title} style={styles.eventCard} onPress={() => openEvent(live ?? undefined)}>
                <View style={styles.eventPoster}>
                  {posterUrl ? (
                    <Image source={{ uri: posterUrl }} style={styles.coverImage} resizeMode="cover" />
                  ) : (
                    <GradientPoster colors={mock?.colors ?? MOCK_RECOMMENDED_EVENTS[index % MOCK_RECOMMENDED_EVENTS.length].colors} style={styles.coverImage} />
                  )}
                  <View style={styles.posterShade} />
                  <Text style={styles.posterText}>{live ? eventName(live) : mock?.posterTitle}</Text>
                </View>
                <View style={styles.eventInfo}>
                  <View style={styles.eventTop}>
                    <Text style={styles.badge}>{live ? formatEventCategory(live.category) : mock?.category}</Text>
                    <Text style={styles.greenBadge}>{live ? '예매 가능' : mock?.status}</Text>
                  </View>
                  <Text style={styles.eventName} numberOfLines={2}>{live ? eventName(live) : mock?.title}</Text>
                  <Text style={styles.eventMeta} numberOfLines={2}>{live ? `${live.venue || '-'}\n${formatNextRoundLabel(live)}` : mock?.meta}</Text>
                  <View style={styles.eventFoot}>
                    <Text style={styles.price}>{live ? eventPrice(live) : mock?.price}</Text>
                    <Text style={styles.go}>상세 보기</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.organizerCard} onPress={() => void startWithWallet('ORGANIZER')} disabled={startingRole !== null}>
          <View style={styles.orgIcon}>
            <Icon name="speaker" color="#534AB7" />
          </View>
          <View style={styles.orgCopy}>
            <Text style={styles.orgTitle}>이벤트를 직접 운영하시나요?</Text>
            <Text style={styles.orgSub}>주최자 계정으로 이벤트 등록, 티켓 발행, 체크인을 관리할 수 있습니다.</Text>
          </View>
          <Text style={styles.orgAction}>{startingRole === 'ORGANIZER' ? '확인' : '시작'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.055,
  shadowRadius: 30,
  elevation: 2,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  content: {
    paddingBottom: 96,
  },
  topbar: {
    backgroundColor: 'rgba(246,247,251,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    zIndex: 40,
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#1A1A2E',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
  },
  logoAccent: {
    color: '#534AB7',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topLink: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
  },
  loginChip: {
    backgroundColor: '#EEEDFE',
    borderWidth: 1,
    borderColor: '#D8D4FF',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  loginChipText: {
    color: '#534AB7',
    fontSize: 11,
    fontWeight: '900',
  },
  hero: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 14,
    minHeight: 210,
    borderRadius: 30,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#534AB7',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.3,
    shadowRadius: 46,
    elevation: 8,
  },
  heroGloss: {
    position: 'absolute',
    left: -50,
    top: -20,
    width: 220,
    height: 140,
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ rotate: '-22deg' }],
  },
  posterRow: {
    position: 'absolute',
    right: -18,
    top: 22,
    flexDirection: 'row',
    gap: 8,
    opacity: 0.78,
    transform: [{ rotate: '8deg' }],
    zIndex: 1,
  },
  miniPoster: {
    width: 64,
    height: 94,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 3,
  },
  heroBody: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    zIndex: 2,
  },
  eyebrow: {
    color: '#A89CF7',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 34,
    marginBottom: 9,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    lineHeight: 19,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    ...cardShadow,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  roleCard: {
    flex: 1,
    minHeight: 134,
    padding: 15,
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  roleTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  roleSub: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 10,
  },
  roleAction: {
    color: '#534AB7',
    fontSize: 12,
    fontWeight: '900',
  },
  roleDark: {
    backgroundColor: '#1A1A2E',
    borderColor: '#1A1A2E',
  },
  roleDarkIcon: {
    backgroundColor: 'rgba(168,156,247,0.18)',
  },
  roleDarkTitle: {
    color: '#FFFFFF',
  },
  roleDarkSub: {
    color: 'rgba(255,255,255,0.55)',
  },
  roleDarkAction: {
    color: '#A89CF7',
    fontSize: 12,
    fontWeight: '900',
  },
  searchCard: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 13,
    paddingRight: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: '#0F172A',
    fontSize: 13,
    paddingVertical: 0,
  },
  searchButton: {
    backgroundColor: '#534AB7',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  categories: {
    gap: 10,
  },
  category: {
    width: 62,
    alignItems: 'center',
    flexShrink: 0,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 1,
  },
  categoryIconActive: {
    backgroundColor: '#1A1A2E',
  },
  categoryLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
  },
  categoryLabelActive: {
    color: '#1A1A2E',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  headTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
  },
  headSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 3,
  },
  more: {
    color: '#534AB7',
    fontSize: 12,
    fontWeight: '900',
  },
  featured: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  featuredCard: {
    width: 156,
    flexShrink: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 23,
    overflow: 'hidden',
    ...cardShadow,
  },
  featuredImage: {
    height: 114,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  featuredShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  featuredBadge: {
    position: 'absolute',
    left: 9,
    bottom: 9,
    backgroundColor: '#E24B4A',
    color: '#FFFFFF',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: '900',
  },
  featuredBody: {
    padding: 10,
  },
  featuredName: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 17,
    marginBottom: 4,
  },
  featuredDate: {
    color: '#64748B',
    fontSize: 10,
  },
  featuredPrice: {
    color: '#534AB7',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 7,
  },
  trustBanner: {
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  trustIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: 'rgba(168,156,247,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  trustCopy: {
    flex: 1,
    minWidth: 0,
  },
  trustTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  trustSub: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    lineHeight: 17,
  },
  eventList: {
    gap: 12,
  },
  loader: {
    paddingVertical: 8,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    ...cardShadow,
  },
  eventPoster: {
    width: 88,
    height: 116,
    borderRadius: 18,
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
  },
  posterShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  posterText: {
    position: 'absolute',
    left: 9,
    right: 9,
    bottom: 9,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
  eventInfo: {
    flex: 1,
    minWidth: 0,
  },
  eventTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 7,
  },
  badge: {
    backgroundColor: '#EEEDFE',
    color: '#534AB7',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: '900',
  },
  greenBadge: {
    backgroundColor: '#DCFCE7',
    color: '#0F6E56',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: '900',
  },
  eventName: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 19,
    marginBottom: 7,
  },
  eventMeta: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 17,
  },
  eventFoot: {
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
    flex: 1,
  },
  go: {
    color: '#534AB7',
    fontSize: 12,
    fontWeight: '900',
  },
  organizerCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    ...cardShadow,
  },
  orgIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  orgCopy: {
    flex: 1,
    minWidth: 0,
  },
  orgTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  orgSub: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 17,
  },
  orgAction: {
    color: '#534AB7',
    fontSize: 12,
    fontWeight: '900',
  },
});
