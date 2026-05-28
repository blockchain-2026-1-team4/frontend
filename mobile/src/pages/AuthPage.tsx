import { useAccount, useAppKit, useProvider } from '@reown/appkit-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { accountStatusMessage, errorMessage, routeForEntry } from '../lib/account';
import { isWalletConnectConfigured } from '../lib/appkit';
import { clearWalletSessionStorage } from '../lib/appkitStorage';
import { backendApi } from '../lib/backend';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type WalletStep = 'idle' | 'connecting' | 'signing' | 'signed';

const NATIVE_WALLET_HELP =
  'WalletConnect 지갑을 연결한 뒤 서명을 승인하면 인증이 완료됩니다.';

function getEthereumProvider() {
  if (Platform.OS !== 'web') return null;
  const globalScope = globalThis as typeof globalThis & {
    ethereum?: EthereumProvider;
    window?: { ethereum?: EthereumProvider };
  };
  return globalScope.ethereum ?? globalScope.window?.ethereum ?? null;
}

function walletClientMessage(error: any, fallback: string) {
  if (error?.code === 4001) {
    return '지갑 요청을 거절했습니다. 지갑에서 연결 또는 서명을 승인해야 계속할 수 있습니다.';
  }
  if (error?.code === -32002) {
    return '지갑에서 이미 처리 중인 요청이 있습니다. 지갑 앱을 열어 요청을 완료해 주세요.';
  }
  const rawMessage = typeof error?.message === 'string' ? error.message : '';
  const lowerMessage = rawMessage.toLowerCase();
  if (lowerMessage.includes('locked') || lowerMessage.includes('unlock')) {
    return '지갑이 잠겨 있습니다. 지갑 잠금을 해제하고 다시 시도해 주세요.';
  }
  if (lowerMessage.includes('rejected') || lowerMessage.includes('denied')) {
    return '지갑 요청을 거절했습니다. 연결 또는 서명을 승인해야 계속할 수 있습니다.';
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('expired')) {
    return '지갑 승인 시간이 만료되었습니다. 다시 시도해 주세요.';
  }
  return rawMessage.trim() ? rawMessage : fallback;
}

function showWalletAlert(title: string, message: string) {
  Alert.alert(title, message);
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

function isStaleWalletSessionError(error: any) {
  const message = stringifyWalletError(error);
  return message.includes('No matching key') || message.includes('session:');
}

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
  const [pendingWalletLogin, setPendingWalletLogin] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const autoStartWalletRef = useRef(false);
  const autoWalletLoginRef = useRef(false);

  const { open, disconnect } = useAppKit();
  const { address: appKitAddress, isConnected } = useAccount();
  const { provider, providerType } = useProvider();

  const targetLabel = useMemo(() => (initialRole === 'ORGANIZER' ? '주최자' : '사용자'), [initialRole]);

  useEffect(() => {
    if (Platform.OS !== 'web' && isConnected && appKitAddress) {
      setWalletAddress(appKitAddress);
    }
  }, [appKitAddress, isConnected]);

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
        if (statusMessage) {
          setFeedback({ type: 'error', message: statusMessage });
          Alert.alert('로그인 실패', statusMessage);
          return;
        }

        navigation.replace(routeForEntry(profile, initialRole));
      } else {
        if (!displayName.trim()) {
          const message = '이름을 입력해 주세요.';
          setFeedback({ type: 'error', message });
          Alert.alert('입력 필요', message);
          return;
        }

        const result = await backendApi.registerEmail({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        });
        const profile = result.user ?? await backendApi.getMe();
        const message = initialRole === 'ORGANIZER'
          ? '가입되었습니다. 주최자 신청을 이어서 진행해 주세요.'
          : '가입되었습니다.';
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

  const handleWalletAuth = () => {
    setWalletMode((value) => !value);
    setFeedback(null);
  };

  const connectInjectedWallet = async () => {
    const injectedProvider = getEthereumProvider();
    if (!injectedProvider) {
      throw new Error('브라우저 지갑을 찾을 수 없습니다. MetaMask 같은 Web3 지갑을 설치하거나 지갑 브라우저에서 접속해 주세요.');
    }

    setWalletStep('connecting');
    const accounts = await injectedProvider.request({ method: 'eth_requestAccounts' });
    const [address] = Array.isArray(accounts) ? accounts.filter((item): item is string => typeof item === 'string') : [];
    if (!address) {
      throw new Error('연결된 지갑 주소를 가져오지 못했습니다.');
    }

    setWalletAddress(address);
    return { provider: injectedProvider, address };
  };

  const connectReownWallet = async () => {
    if (!isWalletConnectConfigured) {
      throw new Error('WalletConnect Project ID가 설정되지 않았습니다. EXPO_PUBLIC_REOWN_PROJECT_ID를 .env에 추가해 주세요.');
    }

    setWalletStep('connecting');
    if (!isConnected || !appKitAddress || !provider) {
      setPendingWalletLogin(true);
      open({ view: 'Connect' });
      setFeedback({ type: 'success', message: '지갑 연결 화면을 열었습니다. 연결 승인 후 자동으로 서명 요청을 이어갑니다.' });
      setWalletStep('idle');
      return null;
    }

    if (providerType !== 'eip155') {
      throw new Error('EVM 지갑만 지원합니다. Ethereum 계열 지갑으로 연결해 주세요.');
    }

    setWalletAddress(appKitAddress);
    return { provider: provider as EthereumProvider, address: appKitAddress };
  };

  const connectWallet = async () => {
    if (Platform.OS === 'web') {
      return connectInjectedWallet();
    }

    return connectReownWallet();
  };

  const handleWalletLogin = async () => {
    if (!isLogin && !displayName.trim()) {
      setPendingWalletLogin(false);
      const message = '이름을 입력해 주세요.';
      setFeedback({ type: 'error', message });
      Alert.alert('입력 필요', message);
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const connection = await connectWallet();
      if (!connection) {
        return;
      }

      setPendingWalletLogin(false);
      const nonce = await backendApi.issueWalletNonce({ walletAddress: connection.address });
      setWalletAddress(nonce.walletAddress);
      setWalletMessage(nonce.message);
      setWalletStep('signing');

      const signature = await connection.provider.request({
        method: 'personal_sign',
        params: [nonce.message, nonce.walletAddress],
      });

      if (typeof signature !== 'string' || !signature.trim()) {
        throw new Error('지갑 서명이 완료되지 않았습니다.');
      }

      setWalletStep('signed');
      const result = await backendApi.loginWallet({
        walletAddress: nonce.walletAddress,
        nonce: nonce.nonce,
        signature,
      });
      const profile = !isLogin && displayName.trim()
        ? await backendApi.updateMe({ displayName: displayName.trim() })
        : result.user ?? await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        setFeedback({ type: 'error', message: statusMessage });
        Alert.alert('로그인 실패', statusMessage);
        return;
      }
      navigation.replace(routeForEntry(profile, initialRole));
    } catch (error: any) {
      if (isStaleWalletSessionError(error)) {
        setPendingWalletLogin(false);
        const message = '이전 WalletConnect 세션이 만료되어 초기화했습니다. 다시 지갑을 연결해 주세요.';
        try {
          disconnect('eip155');
        } catch {
          // Local storage cleanup below is the important recovery step.
        }
        await clearWalletSessionStorage();
        setWalletAddress('');
        setWalletMessage('');
        setWalletStep('idle');
        setFeedback({ type: 'error', message });
        showWalletAlert('지갑 세션 초기화', message);
        return;
      }

      const message = error?.response
        ? errorMessage(error, '지갑 로그인에 실패했습니다.')
        : walletClientMessage(error, '지갑 인증에 실패했습니다.');
      setPendingWalletLogin(false);
      setWalletStep('idle');
      setFeedback({ type: 'error', message });
      showWalletAlert(isLogin ? '지갑 로그인 실패' : '지갑 회원가입 실패', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!pendingWalletLogin || autoWalletLoginRef.current || loading) return;
    if (!isConnected || !appKitAddress || !provider || providerType !== 'eip155') return;

    autoWalletLoginRef.current = true;
    setFeedback({ type: 'success', message: '지갑 연결이 완료되었습니다. 서명 요청을 이어갑니다.' });

    void handleWalletLogin().finally(() => {
      autoWalletLoginRef.current = false;
    });
  }, [appKitAddress, isConnected, loading, pendingWalletLogin, provider, providerType]);

  useEffect(() => {
    if (!route?.params?.autoWalletLogin || autoStartWalletRef.current || loading) return;

    autoStartWalletRef.current = true;
    setWalletMode(true);
    void handleWalletLogin();
  }, [loading, route?.params?.autoWalletLogin]);

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
                  <TextInput
                    style={styles.input}
                    placeholder="이름"
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                </>
              ) : null}
              <View style={styles.connectedWalletBox}>
                <Text style={styles.connectedWalletLabel}>연결된 지갑 주소</Text>
                <Text style={[styles.connectedWalletAddress, !walletAddress && styles.emptyWalletAddress]} numberOfLines={1}>
                  {walletAddress || '아직 연결된 지갑이 없습니다.'}
                </Text>
              </View>
              {Platform.OS !== 'web' ? (
                <Text style={styles.nativeWalletHelp}>{NATIVE_WALLET_HELP}</Text>
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
                    {walletStep === 'connecting' ? '지갑 연결 요청 중' : walletStep === 'signing' ? '지갑 서명 승인 대기 중' : '인증 완료'}
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity style={[styles.primaryButton, loading && styles.disabledButton]} disabled={loading} onPress={handleWalletLogin}>
                <Text style={styles.primaryButtonText}>
                  {loading ? '처리 중...' : isLogin ? '지갑으로 로그인' : '지갑으로 회원가입'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {!isLogin ? (
                <TextInput
                  style={styles.input}
                  placeholder="이름"
                  value={displayName}
                  onChangeText={setDisplayName}
                />
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

        <TouchableOpacity style={styles.walletButton} onPress={handleWalletAuth}>
          <Text style={styles.walletButtonText}>{walletMode ? '이메일 인증으로 전환' : '지갑 인증으로 전환'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchButton} onPress={() => setIsLogin((value) => !value)}>
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
  walletMessageBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12 },
  walletMessageLabel: { color: '#2563EB', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  walletMessageText: { color: '#334155', fontSize: 12, lineHeight: 18 },
  walletStatusBox: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 11, borderWidth: 1, borderColor: '#BFDBFE' },
  walletStatusText: { color: '#1D4ED8', fontSize: 13, fontWeight: '900' },
  primaryButton: { backgroundColor: '#2563EB', padding: 17, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  secondaryAction: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 14, alignItems: 'center', marginTop: 6 },
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
