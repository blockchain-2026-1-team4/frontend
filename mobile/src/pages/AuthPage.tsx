import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAccount, useAppKit, useProvider } from '@reown/appkit-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { TextInput } from '../components/TextInput';
import { accountStatusMessage, errorMessage, routeForEntry } from '../lib/account';
import { isWalletConnectConfigured } from '../lib/appkit';
import { backendApi } from '../lib/backend';
import { config } from '../lib/config';

// ─── Types ─────────────────────────────────────────────────────────────────

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type WalletStep = 'idle' | 'signing' | 'signed';

// ─── Constants ─────────────────────────────────────────────────────────────

const NATIVE_WALLET_HELP = 'WalletConnect 지갑을 연결한 뒤 서명을 승인하면 인증이 완료됩니다.';

// personal_sign 응답 최대 대기 시간: 5분 후 자동으로 에러를 던져 UI 블로킹을 해제
const SIGN_TIMEOUT_MS = 5 * 60 * 1000;

// ─── Helpers ───────────────────────────────────────────────────────────────

// 웹 환경에서 브라우저 내장 지갑(MetaMask 확장 등)을 가져옴
function getEthereumProvider() {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as typeof globalThis & {
    ethereum?: EthereumProvider;
    window?: { ethereum?: EthereumProvider };
  };
  return g.ethereum ?? g.window?.ethereum ?? null;
}

// 지갑 에러 코드·메시지를 사용자에게 보여줄 한국어 문자열로 변환
function walletClientMessage(error: any, fallback: string) {
  if (error?.code === 4001) return '지갑 요청을 거절했습니다. 지갑에서 연결 또는 서명을 승인해야 계속할 수 있습니다.';
  if (error?.code === -32002) return '지갑에서 이미 처리 중인 요청이 있습니다. 지갑 앱을 열어 요청을 완료해 주세요.';
  const raw = typeof error?.message === 'string' ? error.message : '';
  const lower = raw.toLowerCase();
  if (lower.includes('locked') || lower.includes('unlock')) return '지갑이 잠겨 있습니다. 지갑 잠금을 해제하고 다시 시도해 주세요.';
  if (lower.includes('rejected') || lower.includes('denied')) return '지갑 요청을 거절했습니다. 연결 또는 서명을 승인해야 계속할 수 있습니다.';
  if (lower.includes('timeout') || lower.includes('expired')) return '지갑 승인 시간이 만료되었습니다. 다시 시도해 주세요.';
  return raw.trim() ? raw : fallback;
}

function stringifyWalletError(error: any) {
  try {
    return [
      error?.message,
      error?.reason,
      typeof error?.toString === 'function' ? error.toString() : '',
      JSON.stringify(error),
    ].filter(Boolean).join(' ');
  } catch {
    return String(error?.message ?? error ?? '');
  }
}

// WalletConnect 세션이 만료됐을 때 발생하는 에러인지 판별
function isStaleWalletSessionError(error: any) {
  const msg = stringifyWalletError(error);
  return msg.includes('No matching key') || msg.includes('session:');
}

// personal_sign 요청을 보내기 전 MetaMask 앱을 열어 서명 요청을 확인할 수 있게 함
// 저장된 WalletConnect deeplink → metamask:// 순으로 시도
async function openWalletApp(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem('WALLETCONNECT_DEEPLINK_CHOICE');
    if (raw) {
      const choice = JSON.parse(raw) as { href?: string; universal?: string };
      const url = choice.href || choice.universal;
      if (url && (await Linking.canOpenURL(url).catch(() => false))) {
        await Linking.openURL(url);
        return;
      }
    }
  } catch {}
  try {
    if (await Linking.canOpenURL('metamask://').catch(() => false)) {
      await Linking.openURL('metamask://');
      return;
    }
  } catch {}
  Alert.alert(
    '지갑을 열 수 없습니다',
    'MetaMask 앱이 설치되어 있지 않거나 딥링크가 지원되지 않습니다.\n직접 MetaMask 앱으로 이동하여 서명 요청을 확인해 주세요.',
  );
}

// personal_sign에 5분 타임아웃을 추가해 WalletConnect 응답 없음으로 인한 영구 대기를 방지
async function requestPersonalSign(
  provider: EthereumProvider,
  message: string,
  address: string,
): Promise<string> {
  const signPromise = provider.request({ method: 'personal_sign', params: [message, address] });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('서명 요청 시간이 초과되었습니다 (5분). MetaMask 앱을 열어 대기 중인 서명 요청을 확인해 주세요.')),
      SIGN_TIMEOUT_MS,
    ),
  );
  return Promise.race([signPromise, timeout]) as Promise<string>;
}

// 체인별 메타데이터: wallet_addEthereumChain 호출 시 사용
const CHAIN_ADD_META: Record<number, {
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls: string[];
}> = {
  1001: { chainName: 'Kaia Kairos Testnet', nativeCurrency: { name: 'KAIA', symbol: 'KAIA', decimals: 18 }, blockExplorerUrls: ['https://kairos.kaiascan.io'] },
  11155111: { chainName: 'Sepolia Testnet', nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://sepolia.etherscan.io'] },
};

// personal_sign 전에 지갑이 올바른 체인에 연결됐는지 확인하고 필요하면 전환·추가
async function ensureWalletNetwork(provider: EthereumProvider): Promise<void> {
  const chainIdHex = `0x${config.chainId.toString(16)}`;
  const addMeta = CHAIN_ADD_META[config.chainId] ?? {
    chainName: `Chain ${config.chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: [],
  };
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
  } catch (switchError: any) {
    const code = switchError?.code;

    // 런타임에서 실제로 어떤 값이 들어오는지 확인하기 위한 디버그 로그
    console.log('[WalletLogin] switch chain failed', {
      code: switchError?.code,
      message: switchError?.message,
      messageType: typeof switchError?.message,
      raw: switchError,
    });

    // switchError?.message ?? '' 조합은 Hermes 일부 버전에서 undefined를 반환하는
    // 컴파일 버그가 있으므로 typeof 가드로 완전히 방어한다.
    // undefined, null, object, array, number 모두 '' 로 치환됨.
    const rawMsg = switchError?.message;
    const msg = typeof rawMsg === 'string' ? rawMsg : '';

    const needsAdd =
      code === 4902 || code === -32603 || code === 5100 ||
      msg.includes('not approved') || msg.includes('not supported') || msg.includes('does not support');
    if (needsAdd) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{ chainId: chainIdHex, chainName: addMeta.chainName, nativeCurrency: addMeta.nativeCurrency, rpcUrls: [config.chainRpcUrl], blockExplorerUrls: addMeta.blockExplorerUrls }],
        });
      } catch {
        throw new Error(`${addMeta.chainName} 네트워크 추가가 필요합니다. MetaMask에서 네트워크 추가 요청을 승인해주세요.`);
      }
    } else {
      throw switchError;
    }
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function AuthPage({ navigation, route }: any) {
  const initialRole = route?.params?.initialRole ?? 'USER';
  const startsInWalletMode = Boolean(route?.params?.walletMode || route?.params?.autoWalletLogin);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletMessage, setWalletMessage] = useState('');
  const [walletStep, setWalletStep] = useState<WalletStep>('idle');
  const [walletMode, setWalletMode] = useState(startsInWalletMode);
  const [loading, setLoading] = useState(false);
  // true: WalletConnect 모달을 통한 연결 대기 중 → useEffect가 연결 완료를 감지하면 서명 단계로 진행
  const [pendingWalletLogin, setPendingWalletLogin] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // 중복 실행 방지: useEffect가 여러 번 발화해도 doWalletLogin은 한 번만 실행
  const autoWalletLoginRef = useRef(false);
  // route-param 자동 시작 중복 방지
  const autoStartWalletRef = useRef(false);

  const { open } = useAppKit();
  const { address: appKitAddress, isConnected } = useAccount();
  const { provider, providerType } = useProvider();

  const targetLabel = useMemo(() => (initialRole === 'ORGANIZER' ? '주최자' : '사용자'), [initialRole]);

  // ─── 이메일 인증 ─────────────────────────────────────────────────────────

  const handleEmailAuth = async () => {
    setFeedback(null);
    if (!email.trim() || !password) {
      const message = '이메일과 비밀번호를 입력해 주세요.';
      setFeedback({ type: 'error', message });
      Alert.alert('입력 필요', message);
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const result = await backendApi.loginEmail({ email: email.trim(), password });
        const profile = result.user ?? await backendApi.getMe();
        const statusMessage = accountStatusMessage(profile.status);
        if (statusMessage) { setFeedback({ type: 'error', message: statusMessage }); Alert.alert('로그인 실패', statusMessage); return; }
        navigation.replace(routeForEntry(profile, initialRole));
      } else {
        if (!displayName.trim()) {
          const message = '이름을 입력해 주세요.';
          setFeedback({ type: 'error', message });
          Alert.alert('입력 필요', message);
          return;
        }
        const result = await backendApi.registerEmail({ email: email.trim(), password, displayName: displayName.trim() });
        const profile = result.user ?? await backendApi.getMe();
        const message = initialRole === 'ORGANIZER' ? '가입되었습니다. 주최자 신청을 이어서 진행해 주세요.' : '가입되었습니다.';
        setFeedback({ type: 'success', message });
        Alert.alert('회원가입 완료', message);
        navigation.replace(routeForEntry(profile, initialRole));
      }
    } catch (error: any) {
      const message = errorMessage(error, '요청을 처리하지 못했습니다.');
      setFeedback({ type: 'error', message });
      Alert.alert(isLogin ? '로그인 실패' : '회원가입 실패', message);
    } finally {
      setLoading(false);
    }
  };

  // ─── 지갑 인증 핵심 로직 ─────────────────────────────────────────────────

  // provider와 address가 확보된 상태에서 호출: 체인 전환 → nonce → 서명 → 백엔드 검증 → 화면 이동
  const doWalletLogin = async (walletProvider: EthereumProvider, address: string) => {
    setLoading(true);
    setFeedback(null);
    try {
      // 1. 올바른 체인인지 확인 (필요하면 전환·추가)
      await ensureWalletNetwork(walletProvider);

      // 2. 백엔드에서 서명용 nonce 발급
      const nonce = await backendApi.issueWalletNonce({ walletAddress: address });
      setWalletAddress(nonce.walletAddress);
      setWalletMessage(nonce.message);
      setWalletStep('signing');

      // 3. MetaMask에 personal_sign 요청 (5분 timeout)
      const signature = await requestPersonalSign(walletProvider, nonce.message, nonce.walletAddress);
      if (typeof signature !== 'string' || !signature.trim()) throw new Error('서명이 완료되지 않았습니다.');

      // 4. 서명을 백엔드로 전송해 JWT accessToken 발급
      setWalletStep('signed');
      const result = await backendApi.loginWallet({ walletAddress: nonce.walletAddress, nonce: nonce.nonce, signature });

      // 5. 프로필 조회 (회원가입이면 displayName 먼저 업데이트)
      const profile = !isLogin && displayName.trim()
        ? await backendApi.updateMe({ displayName: displayName.trim() })
        : result.user ?? await backendApi.getMe();

      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        setFeedback({ type: 'error', message: statusMessage });
        Alert.alert('로그인 실패', statusMessage);
        setPendingWalletLogin(false);
        return;
      }

      // 6. 성공: 화면 이동
      setPendingWalletLogin(false);
      navigation.replace(routeForEntry(profile, initialRole));
    } catch (error: any) {
      console.error('[WalletLogin]', stringifyWalletError(error));
      setPendingWalletLogin(false);
      setWalletStep('idle');

      // WalletConnect 세션 만료 → 재연결 유도
      if (isStaleWalletSessionError(error)) {
        const message = 'WalletConnect 세션이 만료되었습니다. 지갑을 다시 연결해 주세요.';
        setFeedback({ type: 'error', message });
        Alert.alert('세션 만료', message);
        return;
      }

      // 백엔드 HTTP 에러와 지갑 클라이언트 에러를 구분해서 메시지 표시
      const message = error?.response
        ? errorMessage(error, '지갑 로그인에 실패했습니다.')
        : walletClientMessage(error, '지갑 인증에 실패했습니다.');
      setFeedback({ type: 'error', message });
      Alert.alert(isLogin ? '지갑 로그인 실패' : '지갑 회원가입 실패', message);
    } finally {
      setLoading(false);
    }
  };

  // 지갑 로그인 버튼 클릭
  //   웹:    window.ethereum으로 직접 연결 후 doWalletLogin 호출
  //   모바일: pendingWalletLogin=true 설정 후 Connect 모달 오픈 → useEffect가 연결 감지
  const handleWalletLoginClick = async () => {
    if (!isLogin && !displayName.trim()) {
      const message = '이름을 입력해 주세요.';
      setFeedback({ type: 'error', message });
      Alert.alert('입력 필요', message);
      return;
    }
    setWalletStep('idle');
    setWalletMessage('');
    setWalletAddress('');
    setFeedback(null);

    if (Platform.OS === 'web') {
      // 웹 전용: window.ethereum으로 직접 연결
      const injectedProvider = getEthereumProvider();
      if (!injectedProvider) {
        setFeedback({ type: 'error', message: '브라우저 지갑을 찾을 수 없습니다. MetaMask 같은 Web3 지갑을 설치하거나 지갑 브라우저에서 접속해 주세요.' });
        return;
      }
      let address: string | undefined;
      try {
        const rawAccounts = await injectedProvider.request({ method: 'eth_requestAccounts' });
        address = (Array.isArray(rawAccounts) ? rawAccounts : []).find((a): a is string => typeof a === 'string');
      } catch (error: any) {
        setFeedback({ type: 'error', message: walletClientMessage(error, '지갑 연결에 실패했습니다.') });
        return;
      }
      if (!address) { setFeedback({ type: 'error', message: '연결된 지갑 주소를 가져오지 못했습니다.' }); return; }
      setWalletAddress(address);
      await doWalletLogin(injectedProvider, address);
      return;
    }

    // 모바일: WalletConnect 설정 확인 후 모달 오픈
    if (!isWalletConnectConfigured) {
      setFeedback({ type: 'error', message: 'WalletConnect Project ID가 설정되지 않았습니다. EXPO_PUBLIC_REOWN_PROJECT_ID를 .env에 추가해 주세요.' });
      return;
    }
    setPendingWalletLogin(true);
    open({ view: 'Connect' });
  };

  // 재연결 버튼: 서명이 멈추거나 지갑을 바꾸고 싶을 때 상태를 초기화하고 모달을 다시 염
  const handleReconnect = () => {
    if (loading) return;
    autoWalletLoginRef.current = false;
    setPendingWalletLogin(false);
    setWalletStep('idle');
    setWalletMessage('');
    setWalletAddress('');
    setFeedback(null);
    // React가 false 상태를 처리한 뒤 true로 전환하기 위해 다음 tick에 실행
    setTimeout(() => {
      setPendingWalletLogin(true);
      open({ view: 'Connect' });
    }, 50);
  };

  // ─── WalletConnect 연결 완료 감지 ───────────────────────────────────────
  // pendingWalletLogin 상태에서 isConnected + provider가 모두 준비되면 자동으로 서명 단계 진행
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!pendingWalletLogin || !isConnected || !appKitAddress || !provider || providerType !== 'eip155') return;
    if (autoWalletLoginRef.current) return;

    const walletProvider = provider as EthereumProvider;
    const address = appKitAddress;

    autoWalletLoginRef.current = true;
    void doWalletLogin(walletProvider, address).finally(() => {
      autoWalletLoginRef.current = false;
    });
  }, [pendingWalletLogin, isConnected, appKitAddress, provider, providerType]);

  // Route-param 자동 시작: autoWalletLogin:true로 진입 시 바로 지갑 로그인 실행
  useEffect(() => {
    if (!route?.params?.autoWalletLogin || autoStartWalletRef.current) return;
    autoStartWalletRef.current = true;
    setWalletMode(true);
    void handleWalletLoginClick();
  }, [route?.params?.autoWalletLogin]);

  // ─── Render ──────────────────────────────────────────────────────────────

  const isSigning = walletStep === 'signing';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.eyebrow}>{targetLabel} 시작</Text>
        <Text style={styles.title}>{isLogin ? '로그인' : '회원가입'}</Text>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, isLogin && styles.activeTab]} onPress={() => setIsLogin(true)}>
            <Text style={[styles.tabText, isLogin && styles.activeTabText]}>로그인</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, !isLogin && styles.activeTab]} onPress={() => setIsLogin(false)}>
            <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>회원가입</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {feedback ? (
            <View style={[styles.messageBox, feedback.type === 'success' ? styles.successBox : styles.errorBox]}>
              <Text style={[styles.messageText, feedback.type === 'success' ? styles.successText : styles.errorText]}>
                {feedback.message}
              </Text>
            </View>
          ) : null}

          {walletMode ? (
            <>
              {!isLogin ? (
                <>
                  <Text style={styles.walletSignupHelp}>지갑으로 새 계정을 만들려면 이름과 지갑 서명이 필요합니다.</Text>
                  <TextInput style={styles.input} placeholder="이름" value={displayName} onChangeText={setDisplayName} />
                </>
              ) : null}

              <View style={styles.connectedWalletBox}>
                <Text style={styles.connectedWalletLabel}>연결된 지갑 주소</Text>
                <Text style={[styles.connectedWalletAddress, !walletAddress && styles.emptyWalletAddress]} numberOfLines={1}>
                  {walletAddress || '아직 연결된 지갑이 없습니다.'}
                </Text>
              </View>

              {Platform.OS !== 'web' && !isSigning ? (
                <Text style={styles.nativeWalletHelp}>{NATIVE_WALLET_HELP}</Text>
              ) : null}

              {isSigning ? (
                <View style={styles.signingHelpBox}>
                  <Text style={styles.signingHelpText}>MetaMask 앱에서 서명 요청을 확인하고 승인해 주세요.</Text>
                  <View style={styles.signingActions}>
                    <TouchableOpacity style={styles.openWalletButton} onPress={openWalletApp}>
                      <Text style={styles.openWalletButtonText}>MetaMask 열기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.reconnectButton} onPress={handleReconnect}>
                      <Text style={styles.reconnectButtonText}>재연결</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {walletMessage ? (
                <View style={styles.walletMessageBox}>
                  <Text style={styles.walletMessageLabel}>서명 요청 메시지</Text>
                  <Text style={styles.walletMessageText}>{walletMessage}</Text>
                </View>
              ) : null}

              {walletStep !== 'idle' ? (
                <View style={styles.walletStatusBox}>
                  <Text style={styles.walletStatusText}>
                    {walletStep === 'signing' ? '지갑 서명 승인 대기 중' : '인증 완료'}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.disabledButton]}
                disabled={loading}
                onPress={handleWalletLoginClick}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? '처리 중...' : isLogin ? '지갑으로 로그인' : '지갑으로 회원가입'}
                </Text>
              </TouchableOpacity>

              {!loading && !isSigning && isConnected ? (
                <TouchableOpacity style={styles.secondaryAction} onPress={handleReconnect}>
                  <Text style={styles.secondaryActionText}>지갑 재연결</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <>
              {!isLogin ? (
                <TextInput style={styles.input} placeholder="이름" value={displayName} onChangeText={setDisplayName} />
              ) : null}
              <TextInput
                style={styles.input}
                placeholder="이메일"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder="비밀번호"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.disabledButton]}
                disabled={loading}
                onPress={handleEmailAuth}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? '처리 중...' : isLogin ? '이메일로 로그인' : '이메일로 시작하기'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity
          style={styles.walletButton}
          onPress={() => { setWalletMode((v) => !v); setFeedback(null); }}
        >
          <Text style={styles.walletButtonText}>
            {walletMode ? '이메일 인증으로 전환' : '지갑 인증으로 전환'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchButton} onPress={() => setIsLogin((v) => !v)}>
          <Text style={styles.switchButtonText}>
            {isLogin ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 30, paddingTop: 60 },
  eyebrow: { color: '#2563EB', fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: 28, textAlign: 'center', color: '#0F172A' },
  tabContainer: { flexDirection: 'row', marginBottom: 26, backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 9 },
  activeTab: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 16, color: '#64748B', fontWeight: '800' },
  activeTabText: { color: '#2563EB' },
  form: { gap: 12 },
  messageBox: { borderRadius: 12, padding: 12, borderWidth: 1 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  successBox: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  messageText: { fontSize: 13, fontWeight: '800', lineHeight: 19 },
  errorText: { color: '#DC2626' },
  successText: { color: '#047857' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', padding: 15, borderRadius: 12, fontSize: 16 },
  walletSignupHelp: { color: '#64748B', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  nativeWalletHelp: { color: '#64748B', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  connectedWalletBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12 },
  connectedWalletLabel: { color: '#2563EB', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  connectedWalletAddress: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  emptyWalletAddress: { color: '#94A3B8' },
  signingHelpBox: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#BFDBFE', gap: 10 },
  signingHelpText: { color: '#1E40AF', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  signingActions: { flexDirection: 'row', gap: 8 },
  openWalletButton: { flex: 1, backgroundColor: '#2563EB', padding: 11, borderRadius: 10, alignItems: 'center' },
  openWalletButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  reconnectButton: { flex: 1, backgroundColor: '#FFFFFF', padding: 11, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  reconnectButtonText: { color: '#64748B', fontSize: 13, fontWeight: '900' },
  walletMessageBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12 },
  walletMessageLabel: { color: '#2563EB', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  walletMessageText: { color: '#334155', fontSize: 12, lineHeight: 18 },
  walletStatusBox: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 11, borderWidth: 1, borderColor: '#BFDBFE' },
  walletStatusText: { color: '#1D4ED8', fontSize: 13, fontWeight: '900' },
  primaryButton: { backgroundColor: '#2563EB', padding: 17, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  secondaryAction: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 14, alignItems: 'center' },
  secondaryActionText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 28 },
  divider: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { paddingHorizontal: 15, color: '#94A3B8', fontWeight: '700' },
  walletButton: { borderWidth: 1, borderColor: '#2563EB', padding: 17, borderRadius: 14, alignItems: 'center' },
  walletButtonText: { color: '#2563EB', fontSize: 16, fontWeight: '900' },
  switchButton: { marginTop: 28, alignItems: 'center' },
  switchButtonText: { color: '#64748B', fontSize: 14, fontWeight: '700' },
});
