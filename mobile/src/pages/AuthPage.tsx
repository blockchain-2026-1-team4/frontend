import { useAccount, useAppKit, useProvider } from '@reown/appkit-react-native';
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

function BackIcon({ color = '#6B7280' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5m7 7-7-7 7-7" />
    </Svg>
  );
}

function WalletIcon({ color = '#534AB7' }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 7h16v12H4zM4 7l3-3h10l3 3M16 13h4" />
    </Svg>
  );
}

function CheckIcon({ color = '#0F6E56' }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m5 12 4 4L19 6" />
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
  const autoWalletLoginRef = useRef(false);
  const autoStartWalletRef = useRef(false);

  const { open } = useAppKit();
  const { address: appKitAddress, isConnected } = useAccount();
  const { provider, providerType } = useProvider();

  const isOrganizer = role === 'ORGANIZER';
  const isSigning = walletStep === 'signing';
  const targetLabel = isOrganizer ? '주최자' : '사용자';
  const pageTitle = isSigning ? '로그인 중' : isLogin ? '로그인' : '회원가입';
  const subtitle = isSigning
    ? 'MetaMask에서 서명 요청을 확인하고 승인해 주세요.'
    : isLogin
      ? isOrganizer
        ? '지갑을 연결해 이벤트를 등록하고\n티켓을 운영하세요.'
        : '지갑을 연결해 티켓을 예매하고\n내 티켓을 관리하세요.'
      : isOrganizer
        ? '이름과 지갑 서명으로\n주최자 계정을 만듭니다.'
        : '이름과 지갑 서명으로\n내 계정을 만듭니다.';

  const resetWalletUi = () => {
    setWalletStep('idle');
    setWalletRequestMessage('');
    setWalletAddress('');
    setFeedback(null);
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

      navigation.replace(routeForEntry(profile, role));
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
    if (loading || autoWalletLoginRef.current) return;

    const accounts = (provider as any)?.session?.namespaces?.eip155?.accounts as string[] | undefined;
    const sessionAddress = accounts?.[0]?.split(':')?.[2];
    autoWalletLoginRef.current = true;
    void completeWalletAuth(provider as EthereumProvider, sessionAddress ?? appKitAddress).finally(() => {
      autoWalletLoginRef.current = false;
    });
  }, [pendingWalletLogin, isConnected, appKitAddress, provider, providerType, loading]);

  useEffect(() => {
    if (!route?.params?.autoWalletLogin || autoStartWalletRef.current) return;
    autoStartWalletRef.current = true;
    void startWalletAuth();
  }, [route?.params?.autoWalletLogin]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, isOrganizer && styles.orgContainer]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topbar}>
          <TouchableOpacity style={isOrganizer ? styles.orgBackButton : styles.backButton} onPress={() => navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate('Main')}>
            <BackIcon color={isOrganizer ? 'rgba(255,255,255,0.52)' : '#6B7280'} />
          </TouchableOpacity>
          <Text style={isOrganizer ? styles.orgBrand : styles.brand}>Trust Ticket · {targetLabel}</Text>
        </View>

        <View style={styles.hero}>
          {isOrganizer ? <Text style={styles.orgEyebrow}>Organizer</Text> : null}
          <Text style={isOrganizer ? styles.orgTitle : styles.title}>{isOrganizer && !isSigning ? `주최자\n${pageTitle}` : pageTitle}</Text>
          <Text style={isOrganizer ? styles.orgSub : styles.sub}>{subtitle}</Text>
        </View>

        <View style={styles.body}>
          {!isSigning ? (
            <View style={isOrganizer ? styles.orgTabToggle : styles.tabToggle}>
              <TouchableOpacity style={[isOrganizer ? styles.orgToggleButton : styles.toggleButton, isLogin && (isOrganizer ? styles.orgToggleButtonActive : styles.toggleButtonActive)]} onPress={() => setIsLogin(true)}>
                <Text style={[isOrganizer ? styles.orgToggleText : styles.toggleText, isLogin && (isOrganizer ? styles.orgToggleTextActive : styles.toggleTextActive)]}>로그인</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[isOrganizer ? styles.orgToggleButton : styles.toggleButton, !isLogin && (isOrganizer ? styles.orgToggleButtonActive : styles.toggleButtonActive)]} onPress={() => setIsLogin(false)}>
                <Text style={[isOrganizer ? styles.orgToggleText : styles.toggleText, !isLogin && (isOrganizer ? styles.orgToggleTextActive : styles.toggleTextActive)]}>회원가입</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {feedback ? (
            <View style={[styles.messageBox, feedback.type === 'success' ? styles.successBox : styles.errorBox]}>
              <Text style={[styles.messageText, feedback.type === 'success' ? styles.successText : styles.errorText]}>{feedback.message}</Text>
            </View>
          ) : null}

          {!isLogin && !isSigning ? (
            <View style={styles.field}>
              <Text style={isOrganizer ? styles.orgFieldLabel : styles.fieldLabel}>표시 이름</Text>
              <TextInput
                style={[isOrganizer ? styles.orgInput : styles.input, !!displayName.trim() && (isOrganizer ? styles.orgInputFilled : styles.inputFilled)]}
                placeholder="예: 홍길동"
                placeholderTextColor={isOrganizer ? 'rgba(255,255,255,0.25)' : '#B4B2A9'}
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>
          ) : null}

          <View style={isOrganizer ? styles.orgWalletBox : styles.walletBox}>
            <View style={[isOrganizer ? styles.orgWalletIcon : styles.walletIcon, walletAddress && (isOrganizer ? styles.orgWalletIconConnected : styles.walletIconConnected)]}>
              {walletAddress ? <CheckIcon color={isOrganizer ? '#1D9E75' : '#0F6E56'} /> : <WalletIcon color={isOrganizer ? '#A89CF7' : '#534AB7'} />}
            </View>
            <View style={styles.walletCopy}>
              <Text style={isOrganizer ? styles.orgWalletLabel : styles.walletLabel}>연결된 지갑 주소</Text>
              <Text style={[isOrganizer ? styles.orgWalletAddress : styles.walletAddress, !walletAddress && (isOrganizer ? styles.orgWalletAddressEmpty : styles.walletAddressEmpty)]} numberOfLines={1}>
                {compactWallet(walletAddress) || '아직 연결된 지갑이 없습니다.'}
              </Text>
            </View>
            {!isSigning ? (
              <TouchableOpacity style={isOrganizer ? styles.orgWalletMiniButton : styles.walletMiniButton} onPress={startWalletAuth} disabled={loading}>
                <Text style={isOrganizer ? styles.orgWalletMiniButtonText : styles.walletMiniButtonText}>연결</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {isSigning && walletRequestMessage ? (
            <View style={isOrganizer ? styles.orgSigningBox : styles.signingBox}>
              <Text style={isOrganizer ? styles.orgSigningLabel : styles.signingLabel}>서명 요청 메시지</Text>
              <Text style={isOrganizer ? styles.orgSigningMessage : styles.signingMessage}>{walletRequestMessage}</Text>
            </View>
          ) : null}

          {isSigning ? (
            <>
              <View style={isOrganizer ? styles.orgStatusRow : styles.statusRow}>
                <ActivityIndicator color={isOrganizer ? '#A89CF7' : '#534AB7'} />
                <Text style={isOrganizer ? styles.orgStatusText : styles.statusText}>지갑 서명 승인 대기 중</Text>
              </View>
              <View style={styles.walletActionGrid}>
                <TouchableOpacity style={styles.metamaskButton} onPress={openWalletApp}>
                  <Text style={styles.metamaskButtonText}>MetaMask 열기</Text>
                </TouchableOpacity>
                <TouchableOpacity style={isOrganizer ? styles.orgReconnectButton : styles.reconnectButton} onPress={startWalletAuth}>
                  <Text style={isOrganizer ? styles.orgReconnectButtonText : styles.reconnectButtonText}>재연결</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          <TouchableOpacity
            style={[
              isOrganizer ? styles.orgMainButton : styles.mainButton,
              (loading || isSigning) && (isOrganizer ? styles.orgDisabledButton : styles.disabledButton),
            ]}
            disabled={loading || isSigning}
            onPress={startWalletAuth}
          >
            {loading && !isSigning ? (
              <ActivityIndicator color={isOrganizer ? '#1A1A2E' : '#FFFFFF'} />
            ) : (
              <Text style={isOrganizer ? styles.orgMainButtonText : styles.mainButtonText}>
                {isSigning ? '처리 중...' : isLogin ? '지갑으로 로그인' : '지갑으로 회원가입'}
              </Text>
            )}
          </TouchableOpacity>

          {!isSigning ? (
            <>
              {!isOrganizer ? (
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>처음이신가요?</Text>
                  <View style={styles.dividerLine} />
                </View>
              ) : null}
              <Text style={isOrganizer ? styles.orgNote : styles.authNote}>
                {isLogin ? '계정이 없나요? ' : '이미 계정이 있나요? '}
                <Text style={isOrganizer ? styles.orgNoteLink : styles.authNoteLink} onPress={() => setIsLogin((value) => !value)}>
                  {isLogin ? '회원가입' : '로그인'}
                </Text>
                {'\n\n'}
                {isOrganizer ? '사용자로 시작하려면 ' : '주최자로 시작하려면 '}
                <Text
                  style={isOrganizer ? styles.orgNoteLink : styles.authNoteLink}
                  onPress={() => {
                    setRole(isOrganizer ? 'USER' : 'ORGANIZER');
                    setIsLogin(true);
                    setFeedback(null);
                  }}
                >
                  여기
                </Text>
              </Text>
            </>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  orgContainer: { backgroundColor: '#1A1A2E' },
  scrollContent: { paddingBottom: 40 },
  topbar: { paddingHorizontal: 18, paddingTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  orgBackButton: { width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  brand: { color: '#9CA3AF', fontSize: 11, fontWeight: '800' },
  orgBrand: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '800' },
  hero: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 },
  title: { color: '#0F0F1A', fontSize: 26, fontWeight: '900', lineHeight: 31, marginBottom: 6 },
  sub: { color: '#9CA3AF', fontSize: 12, lineHeight: 19 },
  orgEyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  orgTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', lineHeight: 31, marginBottom: 6 },
  orgSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 19 },
  body: { paddingHorizontal: 24, paddingBottom: 40 },
  tabToggle: { flexDirection: 'row', gap: 3, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 3, marginBottom: 20 },
  toggleButton: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  toggleButtonActive: { backgroundColor: '#FFFFFF' },
  toggleText: { color: '#9CA3AF', fontSize: 12, fontWeight: '800' },
  toggleTextActive: { color: '#0F0F1A' },
  orgTabToggle: { flexDirection: 'row', gap: 3, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 3, marginBottom: 20 },
  orgToggleButton: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  orgToggleButtonActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  orgToggleText: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '800' },
  orgToggleTextActive: { color: '#FFFFFF' },
  field: { marginBottom: 10 },
  fieldLabel: { color: '#9CA3AF', fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 },
  orgFieldLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 5 },
  input: { borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFFFFF', color: '#0F0F1A', fontSize: 13 },
  inputFilled: { borderColor: '#534AB7', backgroundColor: '#FAFAFE' },
  orgInput: { borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.06)', color: '#FFFFFF', fontSize: 13 },
  orgInputFilled: { borderColor: 'rgba(168,156,247,0.42)', backgroundColor: 'rgba(168,156,247,0.1)' },
  walletBox: { backgroundColor: '#F9F9F9', borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  orgWalletBox: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  walletIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#EEEDFE', alignItems: 'center', justifyContent: 'center' },
  walletIconConnected: { backgroundColor: '#E1F5EE' },
  orgWalletIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(168,156,247,0.15)', alignItems: 'center', justifyContent: 'center' },
  orgWalletIconConnected: { backgroundColor: 'rgba(29,158,117,0.15)' },
  walletCopy: { flex: 1, minWidth: 0 },
  walletLabel: { color: '#9CA3AF', fontSize: 10, marginBottom: 1 },
  walletAddress: { color: '#0F0F1A', fontSize: 11, fontWeight: '800' },
  walletAddressEmpty: { color: '#B4B2A9', fontWeight: '400' },
  orgWalletLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginBottom: 1 },
  orgWalletAddress: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  orgWalletAddressEmpty: { color: 'rgba(255,255,255,0.25)', fontWeight: '400' },
  walletMiniButton: { backgroundColor: '#EEEDFE', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 },
  walletMiniButtonText: { color: '#534AB7', fontSize: 10, fontWeight: '800' },
  orgWalletMiniButton: { backgroundColor: 'rgba(168,156,247,0.15)', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 },
  orgWalletMiniButtonText: { color: '#A89CF7', fontSize: 10, fontWeight: '800' },
  signingBox: { backgroundColor: '#F5F5F5', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  signingLabel: { color: '#9CA3AF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  signingMessage: { color: '#6B7280', fontSize: 10, lineHeight: 16 },
  orgSigningBox: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  orgSigningLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  orgSigningMessage: { color: 'rgba(255,255,255,0.4)', fontSize: 10, lineHeight: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EEEDFE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  statusText: { color: '#534AB7', fontSize: 12, fontWeight: '800', flex: 1 },
  orgStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(168,156,247,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  orgStatusText: { color: '#A89CF7', fontSize: 12, fontWeight: '800', flex: 1 },
  walletActionGrid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metamaskButton: { flex: 1, backgroundColor: '#F6851B', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  metamaskButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  reconnectButton: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  reconnectButtonText: { color: '#6B7280', fontSize: 12, fontWeight: '800' },
  orgReconnectButton: { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  orgReconnectButtonText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '800' },
  mainButton: { backgroundColor: '#534AB7', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  mainButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  orgMainButton: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  orgMainButtonText: { color: '#1A1A2E', fontSize: 14, fontWeight: '900' },
  disabledButton: { backgroundColor: '#E5E7EB' },
  orgDisabledButton: { backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 16 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: '#E5E7EB' },
  dividerLabel: { color: '#B4B2A9', fontSize: 10 },
  authNote: { color: '#B4B2A9', fontSize: 11, lineHeight: 18, textAlign: 'center' },
  authNoteLink: { color: '#534AB7', fontWeight: '900' },
  orgNote: { color: 'rgba(255,255,255,0.25)', fontSize: 11, lineHeight: 18, textAlign: 'center' },
  orgNoteLink: { color: '#A89CF7', fontWeight: '900' },
  messageBox: { borderRadius: 11, padding: 11, borderWidth: 0.5, marginBottom: 10 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  successBox: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  messageText: { fontSize: 12, fontWeight: '800', lineHeight: 18 },
  errorText: { color: '#DC2626' },
  successText: { color: '#047857' },
});
