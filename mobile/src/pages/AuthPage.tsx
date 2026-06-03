import { useAccount, useAppKit, useProvider } from '@reown/appkit-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TextInput } from '../components/TextInput';
import { accountStatusMessage, errorMessage, routeForEntry } from '../lib/account';
import { backendApi } from '../lib/backend';
import { config } from '../lib/config';

type AuthRole = 'USER' | 'ORGANIZER';
type WalletStep = 'idle' | 'signing' | 'signed';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }, chainId?: string) => Promise<unknown>;
};

const CONNECT_TIMEOUT_MS = 20 * 1000;
const SIGN_TIMEOUT_MS = 5 * 60 * 1000;
const isWalletConnectConfigured = Boolean(config.reownProjectId);
const Gradient = LinearGradient as unknown as React.ComponentType<any>;

function AppIcon({ name, color = '#534AB7', size = 20 }: { name: 'back' | 'wallet' | 'check' | 'shield'; color?: string; size?: number }) {
  const common = { fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'back' ? <Path {...common} d="M19 12H5m7 7-7-7 7-7" /> : null}
      {name === 'wallet' ? (
        <>
          <Path {...common} d="M4 7h16v12H4zM4 7l3-3h10l3 3" />
          <Path {...common} d="M16 13h4" />
        </>
      ) : null}
      {name === 'check' ? <Path {...common} d="m5 12 4 4L19 6" /> : null}
      {name === 'shield' ? (
        <>
          <Path {...common} d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />
          <Path {...common} d="m8.5 12 2.2 2.2 4.8-5" />
        </>
      ) : null}
    </Svg>
  );
}

function getEthereumProvider() {
  if (Platform.OS !== 'web') return null;
  const global = globalThis as typeof globalThis & {
    ethereum?: EthereumProvider;
    window?: { ethereum?: EthereumProvider };
  };
  return global.ethereum ?? global.window?.ethereum ?? null;
}

function toHexMessage(message: string) {
  const bytes = new TextEncoder().encode(message);
  return `0x${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function requestPersonalSign(provider: EthereumProvider, message: string, address: string, caipChain?: string) {
  const hexMessage = toHexMessage(message);
  const sign = async () => provider.request({ method: 'personal_sign', params: [hexMessage, address] }, caipChain);
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('서명 요청 시간이 초과되었습니다.')), SIGN_TIMEOUT_MS);
  });
  const signature = await Promise.race([sign(), timeout]);
  if (typeof signature !== 'string' || !signature.trim()) throw new Error('서명이 완료되지 않았습니다.');
  return signature;
}

function walletMessage(error: any, fallback: string) {
  if (error?.code === 4001) return '지갑 요청이 거절되었습니다.';
  if (error?.code === -32002) return '지갑에 이미 처리 중인 요청이 있습니다. 지갑 앱을 확인해주세요.';
  const raw = typeof error?.message === 'string' ? error.message : '';
  return raw.trim() || fallback;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms));
  return Promise.race([promise, timeout]) as Promise<T>;
}

function compactWallet(address?: string) {
  const value = address?.trim();
  if (!value) return '';
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-7)}`;
}

async function openWalletApp() {
  try {
    if (await Linking.canOpenURL('metamask://').catch(() => false)) {
      await Linking.openURL('metamask://');
      return;
    }
  } catch {}
  Alert.alert('지갑 앱을 열 수 없습니다', 'MetaMask 앱에서 대기 중인 서명 요청을 확인해주세요.');
}

function authCopy(isOrganizer: boolean, isLogin: boolean, isSigning: boolean) {
  if (isSigning) {
    return {
      eyebrow: 'Wallet Signature',
      title: isOrganizer ? '주최자 서명 대기' : '서명 승인 대기',
      heroBadge: 'MetaMask 확인',
      heroTitle: '지갑 앱에서\n서명을 승인해 주세요.',
      heroMeta: isOrganizer ? '승인 후 운영 권한 확인 단계로 이동합니다.' : '승인 후 Trust Ticket으로 돌아오면 로그인이 완료됩니다.',
    };
  }

  if (isOrganizer) {
    return isLogin
      ? {
          eyebrow: 'Organizer',
          title: '주최자 로그인',
          heroBadge: '운영 시작',
          heroTitle: '지갑을 연결해\n이벤트를 운영하세요.',
          heroMeta: '이벤트 등록, 티켓 발행, 체크인 관리를 시작합니다.',
        }
      : {
          eyebrow: 'Organizer',
          title: '주최자 회원가입',
          heroBadge: '승인 신청 준비',
          heroTitle: '주최자 계정을\n먼저 생성하세요.',
          heroMeta: '가입 후 관리자 승인 신청을 진행합니다.',
        };
  }

  return isLogin
    ? {
        eyebrow: 'User Account',
        title: '사용자 로그인',
        heroBadge: '로그인',
        heroTitle: '지갑을 연결해\n내 티켓으로 이동하세요.',
        heroMeta: '예매 내역과 QR 입장권은 연결된 지갑 기준으로 표시됩니다.',
      }
    : {
        eyebrow: 'User Account',
        title: '사용자 회원가입',
        heroBadge: '회원가입',
        heroTitle: '이름과 지갑으로\n새 계정을 만드세요.',
        heroMeta: '가입 후 바로 이벤트 예매와 내 티켓 관리를 시작할 수 있습니다.',
      };
}

export default function AuthPage({ navigation, route }: any) {
  const initialRole = (route?.params?.initialRole ?? 'USER') as AuthRole;
  const [role, setRole] = useState<AuthRole>(initialRole);
  const [isLogin, setIsLogin] = useState(route?.params?.mode !== 'signup');
  const [displayName, setDisplayName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletRequestMessage, setWalletRequestMessage] = useState('');
  const [walletStep, setWalletStep] = useState<WalletStep>('idle');
  const [loading, setLoading] = useState(false);
  const [pendingWalletLogin, setPendingWalletLogin] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const walletCompletionRef = useRef(false);

  const { open } = useAppKit();
  const { address: appKitAddress, isConnected } = useAccount();
  const { provider, providerType } = useProvider();

  const isOrganizer = role === 'ORGANIZER';
  const isSigning = walletStep === 'signing';
  const copy = authCopy(isOrganizer, isLogin, isSigning);

  const resetWalletUi = () => {
    setWalletStep('idle');
    setWalletRequestMessage('');
    setWalletAddress('');
    setFeedback(null);
  };

  const switchMode = (nextLogin: boolean) => {
    if (loading || isSigning) return;
    setIsLogin(nextLogin);
    resetWalletUi();
  };

  const switchRole = (nextRole: AuthRole) => {
    if (loading || isSigning) return;
    setRole(nextRole);
    setIsLogin(true);
    setDisplayName('');
    resetWalletUi();
  };

  const completeWalletAuth = async (walletProvider: EthereumProvider, address: string) => {
    setLoading(true);
    setFeedback(null);
    try {
      const nonce = await backendApi.issueWalletNonce({ walletAddress: address });
      setWalletAddress(nonce.walletAddress);
      setWalletRequestMessage(nonce.message);
      setWalletStep('signing');

      const accounts = (walletProvider as any)?.session?.namespaces?.eip155?.accounts as string[] | undefined;
      const sessionChainId = accounts?.[0]?.split(':')?.[1];
      const signature = await requestPersonalSign(walletProvider, nonce.message, nonce.walletAddress, sessionChainId ? `eip155:${sessionChainId}` : undefined);
      setWalletStep('signed');

      const result = await backendApi.loginWallet({ walletAddress: nonce.walletAddress, nonce: nonce.nonce, signature });
      if (!isLogin && !result.isNewUser) {
        const message = '이미 가입된 지갑 주소입니다. 로그인 탭을 이용해주세요.';
        setFeedback({ type: 'error', message });
        Alert.alert('회원가입 불가', message);
        setWalletStep('idle');
        return;
      }

      const profile = !isLogin && displayName.trim()
        ? await backendApi.updateMe({ displayName: displayName.trim() })
        : result.user ?? await backendApi.getMe();

      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        setFeedback({ type: 'error', message: statusMessage });
        Alert.alert('로그인 실패', statusMessage);
        setWalletStep('idle');
        return;
      }

      navigation.replace(role === 'ORGANIZER' ? 'Organizer' : routeForEntry(profile, role));
    } catch (error: any) {
      const message = error?.response
        ? errorMessage(error, '지갑 인증에 실패했습니다.')
        : walletMessage(error, '지갑 인증에 실패했습니다.');
      setFeedback({ type: 'error', message });
      setWalletStep('idle');
      Alert.alert(isLogin ? '지갑 로그인 실패' : '지갑 회원가입 실패', message);
    } finally {
      setPendingWalletLogin(false);
      setLoading(false);
    }
  };

  const startWalletAuth = async () => {
    if (loading) return;
    if (!isLogin && !displayName.trim()) {
      const message = '표시 이름을 입력해주세요.';
      setFeedback({ type: 'error', message });
      Alert.alert('입력 필요', message);
      return;
    }

    resetWalletUi();
    if (Platform.OS === 'web') {
      const injectedProvider = getEthereumProvider();
      if (!injectedProvider) {
        setFeedback({ type: 'error', message: '브라우저 지갑을 찾을 수 없습니다. MetaMask 같은 Web3 지갑을 설치해주세요.' });
        return;
      }
      setLoading(true);
      setFeedback({
        type: 'success',
        message: 'MetaMask 연결 요청을 보냈습니다. 팝업이 보이지 않으면 Chrome 오른쪽 위 MetaMask 아이콘을 열어 승인해 주세요.',
      });
      try {
        const rawAccounts = await withTimeout(
          injectedProvider.request({ method: 'eth_requestAccounts' }),
          CONNECT_TIMEOUT_MS,
          'MetaMask 연결 요청이 아직 승인되지 않았습니다. Chrome 오른쪽 위 MetaMask 아이콘을 열어 대기 중인 요청을 승인한 뒤 다시 시도해 주세요.',
        );
        const address = (Array.isArray(rawAccounts) ? rawAccounts : []).find((item): item is string => typeof item === 'string');
        if (!address) throw new Error('연결된 지갑 주소를 가져오지 못했습니다.');
        setWalletAddress(address);
        await completeWalletAuth(injectedProvider, address);
      } catch (error: any) {
        setLoading(false);
        setFeedback({ type: 'error', message: walletMessage(error, '지갑 연결에 실패했습니다.') });
      }
      return;
    }

    if (!isWalletConnectConfigured) {
      setFeedback({ type: 'error', message: 'WalletConnect Project ID가 설정되지 않았습니다.' });
      return;
    }
    setPendingWalletLogin(true);
    open({ view: 'Connect' });
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!pendingWalletLogin || !isConnected || !appKitAddress || !provider || providerType !== 'eip155') return;
    if (loading || walletCompletionRef.current) return;

    const accounts = (provider as any)?.session?.namespaces?.eip155?.accounts as string[] | undefined;
    const sessionAddress = accounts?.[0]?.split(':')?.[2];
    walletCompletionRef.current = true;
    void completeWalletAuth(provider as EthereumProvider, sessionAddress ?? appKitAddress).finally(() => {
      walletCompletionRef.current = false;
    });
  }, [pendingWalletLogin, isConnected, appKitAddress, provider, providerType, loading]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.screen, isOrganizer && styles.orgScreen]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
        <View style={[styles.topbar, isOrganizer && styles.darkTopbar]}>
          <TouchableOpacity
            style={[styles.topIcon, isOrganizer && styles.darkTopIcon]}
            onPress={() => navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate('Main')}
          >
            <AppIcon name="back" color={isOrganizer ? 'rgba(255,255,255,0.7)' : '#475569'} size={19} />
          </TouchableOpacity>
          <View style={styles.topTitleBlock}>
            <Text style={[styles.eyebrow, isOrganizer && styles.darkEyebrow]}>{copy.eyebrow}</Text>
            <Text style={[styles.topTitle, isOrganizer && styles.darkTopTitle]}>{copy.title}</Text>
          </View>
          <Text style={[styles.badge, isSigning && !isOrganizer ? styles.connectedBadge : isOrganizer ? styles.glassBadge : styles.userBadge]}>
            {isSigning ? '연결됨' : isOrganizer ? '운영자' : '사용자'}
          </Text>
        </View>

        <View style={styles.hero}>
          <Gradient colors={['#1A1A2E', '#534AB7', '#1D9E75']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.heroGloss} />
          <Gradient colors={['transparent', 'rgba(0,0,0,0.16)', 'rgba(0,0,0,0.78)']} style={StyleSheet.absoluteFill} />
          {!isSigning ? (
            <View style={styles.posterRow} pointerEvents="none">
              <Gradient colors={['#0C447C', '#185FA5', '#639922']} style={styles.miniCard} />
              <Gradient colors={['#26215C', '#534AB7', '#1D9E75']} style={styles.miniCard} />
              <Gradient colors={['#712B13', '#D85A30', '#EF9F27']} style={styles.miniCard} />
            </View>
          ) : null}
          <View style={styles.heroBody}>
            <Text style={[styles.badge, styles.heroBadge, styles.glassBadge]}>{copy.heroBadge}</Text>
            <Text style={styles.heroTitle}>{copy.heroTitle}</Text>
            <Text style={styles.heroMeta}>{copy.heroMeta}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.card, styles.authCard, isOrganizer && styles.darkCard]}>
            {!isSigning ? (
              <View style={[styles.toggle, isOrganizer && styles.darkToggle]}>
                <TouchableOpacity style={[styles.toggleButton, isLogin && styles.toggleButtonActive, isOrganizer && styles.darkToggleButton, isOrganizer && isLogin && styles.darkToggleButtonActive]} onPress={() => switchMode(true)}>
                  <Text style={[styles.toggleText, isLogin && styles.toggleTextActive, isOrganizer && styles.darkToggleText, isOrganizer && isLogin && styles.darkToggleTextActive]}>로그인</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleButton, !isLogin && styles.toggleButtonActive, isOrganizer && styles.darkToggleButton, isOrganizer && !isLogin && styles.darkToggleButtonActive]} onPress={() => switchMode(false)}>
                  <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive, isOrganizer && styles.darkToggleText, isOrganizer && !isLogin && styles.darkToggleTextActive]}>회원가입</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {feedback && !isSigning ? (
              <View style={[styles.messageBox, feedback.type === 'success' ? styles.successBox : styles.errorBox]}>
                <Text style={[styles.messageText, feedback.type === 'success' ? styles.successText : styles.errorText]}>{feedback.message}</Text>
              </View>
            ) : null}

            {!isLogin && !isSigning ? (
              <View style={styles.field}>
                <Text style={[styles.label, isOrganizer && styles.darkLabel]}>표시 이름</Text>
                <TextInput
                  style={[styles.input, isOrganizer && styles.darkInput]}
                  placeholder="예: 홍길동"
                  placeholderTextColor={isOrganizer ? 'rgba(255,255,255,0.28)' : '#A5ADBA'}
                  value={displayName}
                  onChangeText={setDisplayName}
                />
              </View>
            ) : null}

            <View style={[styles.walletBox, isOrganizer && styles.darkWalletBox]}>
              <View style={[styles.walletIcon, isOrganizer && styles.darkWalletIcon, walletAddress && styles.walletIconConnected, isOrganizer && walletAddress && styles.darkWalletIconConnected]}>
                {walletAddress ? <AppIcon name="check" color={isOrganizer ? '#1D9E75' : '#0F6E56'} /> : <AppIcon name="wallet" color={isOrganizer ? '#A89CF7' : '#534AB7'} />}
              </View>
              <View style={styles.walletInfo}>
                <Text style={styles.walletLabel}>연결된 지갑 주소</Text>
                <Text style={[styles.walletAddress, isOrganizer && styles.darkWalletAddress, !walletAddress && styles.walletAddressEmpty, isOrganizer && !walletAddress && styles.darkWalletAddressEmpty]} numberOfLines={1}>
                  {compactWallet(walletAddress) || '아직 연결된 지갑이 없습니다.'}
                </Text>
              </View>
              {!isSigning ? (
                <TouchableOpacity style={[styles.walletButton, isOrganizer && styles.darkWalletButton]} onPress={startWalletAuth} disabled={loading}>
                  <Text style={[styles.walletButtonText, isOrganizer && styles.darkWalletButtonText]}>연결</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {isSigning ? (
              <>
                <View style={[styles.signBox, isOrganizer && styles.darkSignBox]}>
                  <Text style={styles.signLabel}>서명 요청 메시지</Text>
                  <Text style={[styles.signMessage, isOrganizer && styles.darkSignMessage]}>{walletRequestMessage || '지갑 서명 요청을 준비 중입니다.'}</Text>
                </View>
                <View style={[styles.waitRow, isOrganizer && styles.darkWaitRow]}>
                  <ActivityIndicator color={isOrganizer ? '#A89CF7' : '#534AB7'} />
                  <Text style={[styles.waitText, isOrganizer && styles.darkWaitText]}>지갑 서명 승인 대기 중</Text>
                </View>
                <View style={styles.actionGrid}>
                  <TouchableOpacity style={styles.metamaskButton} onPress={openWalletApp}>
                    <Text style={styles.metamaskButtonText}>MetaMask 열기</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.reconnectButton, isOrganizer && styles.darkReconnectButton]} onPress={startWalletAuth}>
                    <Text style={[styles.reconnectButtonText, isOrganizer && styles.darkReconnectButtonText]}>재연결</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            <TouchableOpacity
              style={[
                styles.mainButton,
                isOrganizer && styles.orgMainButton,
                (loading || isSigning) && styles.disabledButton,
                isOrganizer && (loading || isSigning) && styles.darkDisabledButton,
              ]}
              disabled={loading || isSigning}
              onPress={startWalletAuth}
            >
              {loading && !isSigning ? (
                <ActivityIndicator color={isOrganizer ? '#1A1A2E' : '#FFFFFF'} />
              ) : (
                <Text style={[styles.mainButtonText, isOrganizer && styles.orgMainButtonText]}>
                  {isSigning ? '처리 중...' : isLogin ? '지갑으로 로그인' : '지갑으로 회원가입'}
                </Text>
              )}
            </TouchableOpacity>

            {!isSigning ? (
              <>
                {!isOrganizer && isLogin ? (
                  <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.dividerText}>처음이신가요?</Text>
                    <View style={styles.line} />
                  </View>
                ) : null}
                <Text style={[styles.note, isOrganizer && styles.darkNote]}>
                  {isLogin ? '계정이 없나요? ' : '이미 계정이 있나요? '}
                  <Text style={[styles.noteLink, isOrganizer && styles.darkNoteLink]} onPress={() => switchMode(!isLogin)}>
                    {isLogin ? '회원가입' : '로그인'}
                  </Text>
                  {'\n'}
                  {isOrganizer ? '사용자로 시작하려면 ' : '주최자로 시작하려면 '}
                  <Text style={[styles.noteLink, isOrganizer && styles.darkNoteLink]} onPress={() => switchRole(isOrganizer ? 'USER' : 'ORGANIZER')}>
                    여기
                  </Text>
                </Text>
              </>
            ) : null}
          </View>
        </View>

        {!isOrganizer && isLogin && !isSigning ? (
          <View style={styles.footerTip}>
            <View style={styles.tipIcon}>
              <AppIcon name="shield" color="#A89CF7" />
            </View>
            <View style={styles.tipCopy}>
              <Text style={styles.tipTitle}>서명은 로그인 확인용입니다.</Text>
              <Text style={styles.tipSub}>서명 요청은 계정 인증에만 사용되며 별도 결제를 실행하지 않습니다.</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
  screen: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  orgScreen: {
    backgroundColor: '#1A1A2E',
  },
  scrollContent: {
    paddingBottom: 28,
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
    zIndex: 30,
  },
  darkTopbar: {
    backgroundColor: 'rgba(26,26,46,0.88)',
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  topIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  darkTopIcon: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
    shadowOpacity: 0,
    elevation: 0,
  },
  topTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  eyebrow: {
    color: '#938CF0',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  darkEyebrow: {
    color: '#A89CF7',
  },
  topTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  darkTopTitle: {
    color: '#FFFFFF',
  },
  badge: {
    fontSize: 10,
    fontWeight: '900',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  userBadge: {
    backgroundColor: '#EEEDFE',
    color: '#534AB7',
  },
  connectedBadge: {
    backgroundColor: '#DCFCE7',
    color: '#0F6E56',
  },
  glassBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    color: '#FFFFFF',
  },
  heroBadge: {
    alignSelf: 'flex-start',
  },
  hero: {
    height: 178,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 14,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#534AB7',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.27,
    shadowRadius: 40,
    elevation: 7,
  },
  heroGloss: {
    position: 'absolute',
    left: -42,
    top: -20,
    width: 190,
    height: 118,
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ rotate: '-22deg' }],
  },
  posterRow: {
    position: 'absolute',
    right: -10,
    top: 18,
    flexDirection: 'row',
    gap: 8,
    opacity: 0.74,
    transform: [{ rotate: '8deg' }],
    zIndex: 1,
  },
  miniCard: {
    width: 58,
    height: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroBody: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    zIndex: 2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 29,
    letterSpacing: 0,
    marginTop: 9,
    marginBottom: 9,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    lineHeight: 17,
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
  darkCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.1)',
    shadowOpacity: 0,
    elevation: 0,
  },
  authCard: {
    padding: 16,
  },
  toggle: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: '#EEF2F7',
    borderRadius: 17,
    padding: 4,
    marginBottom: 14,
  },
  darkToggle: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  toggleButton: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkToggleButton: {},
  toggleButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  darkToggleButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    shadowOpacity: 0,
    elevation: 0,
  },
  toggleText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '900',
  },
  darkToggleText: {
    color: 'rgba(255,255,255,0.35)',
  },
  toggleTextActive: {
    color: '#1A1A2E',
  },
  darkToggleTextActive: {
    color: '#FFFFFF',
  },
  field: {
    marginBottom: 12,
  },
  label: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  darkLabel: {
    color: 'rgba(255,255,255,0.35)',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#D9E1EE',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    color: '#0F172A',
    fontSize: 14,
  },
  darkInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#FFFFFF',
  },
  walletBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  darkWalletBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  walletIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  darkWalletIcon: {
    backgroundColor: 'rgba(168,156,247,0.16)',
  },
  walletIconConnected: {
    backgroundColor: '#DCFCE7',
  },
  darkWalletIconConnected: {
    backgroundColor: 'rgba(29,158,117,0.15)',
  },
  walletInfo: {
    flex: 1,
    minWidth: 0,
  },
  walletLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 3,
  },
  walletAddress: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
  darkWalletAddress: {
    color: '#FFFFFF',
  },
  walletAddressEmpty: {
    color: '#A5ADBA',
    fontWeight: '800',
  },
  darkWalletAddressEmpty: {
    color: 'rgba(255,255,255,0.28)',
  },
  walletButton: {
    backgroundColor: '#EEEDFE',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  darkWalletButton: {
    backgroundColor: 'rgba(168,156,247,0.16)',
  },
  walletButtonText: {
    color: '#534AB7',
    fontSize: 12,
    fontWeight: '900',
  },
  darkWalletButtonText: {
    color: '#A89CF7',
  },
  mainButton: {
    width: '100%',
    height: 52,
    borderRadius: 17,
    backgroundColor: '#534AB7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#534AB7',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 26,
    elevation: 3,
  },
  orgMainButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
    marginTop: 12,
  },
  darkDisabledButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  orgMainButtonText: {
    color: '#1A1A2E',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    color: '#94A3B8',
    fontSize: 10,
  },
  note: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 12,
  },
  darkNote: {
    color: 'rgba(255,255,255,0.38)',
  },
  noteLink: {
    color: '#534AB7',
    fontWeight: '900',
  },
  darkNoteLink: {
    color: '#A89CF7',
  },
  signBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EDF2F7',
    borderRadius: 18,
    padding: 13,
    marginBottom: 12,
  },
  darkSignBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  signLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  signMessage: {
    color: '#64748B',
    fontSize: 10,
    lineHeight: 17,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  darkSignMessage: {
    color: 'rgba(255,255,255,0.48)',
  },
  waitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EEEDFE',
    borderRadius: 17,
    padding: 13,
    marginBottom: 12,
  },
  darkWaitRow: {
    backgroundColor: 'rgba(168,156,247,0.13)',
  },
  waitText: {
    color: '#534AB7',
    fontSize: 13,
    fontWeight: '900',
  },
  darkWaitText: {
    color: '#A89CF7',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metamaskButton: {
    flex: 1,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#F6851B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metamaskButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  reconnectButton: {
    flex: 1,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkReconnectButton: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  reconnectButtonText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '900',
  },
  darkReconnectButtonText: {
    color: 'rgba(255,255,255,0.58)',
  },
  footerTip: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#1A1A2E',
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  tipIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(168,156,247,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tipCopy: {
    flex: 1,
    minWidth: 0,
  },
  tipTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 3,
  },
  tipSub: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    lineHeight: 17,
  },
  messageBox: {
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  successBox: {
    backgroundColor: '#ECFDF5',
    borderColor: '#BBF7D0',
  },
  messageText: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 17,
  },
  errorText: {
    color: '#DC2626',
  },
  successText: {
    color: '#047857',
  },
});
