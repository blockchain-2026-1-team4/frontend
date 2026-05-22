import React, { useMemo, useState } from 'react';
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
import { backendApi } from '../lib/backend';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type WalletStep = 'idle' | 'connected' | 'signing' | 'signed';

function getEthereumProvider() {
  if (Platform.OS !== 'web') return null;
  const globalScope = globalThis as typeof globalThis & {
    ethereum?: EthereumProvider;
    window?: { ethereum?: EthereumProvider };
  };
  return globalScope.ethereum ?? globalScope.window?.ethereum ?? null;
}

function walletClientMessage(error: any, fallback: string) {
  return typeof error?.message === 'string' && error.message.trim() ? error.message : fallback;
}

export default function AuthPage({ navigation, route }: any) {
  const initialRole = route?.params?.initialRole ?? 'USER';
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletMessage, setWalletMessage] = useState('');
  const [walletStep, setWalletStep] = useState<WalletStep>('idle');
  const [walletMode, setWalletMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const targetLabel = useMemo(() => (initialRole === 'ORGANIZER' ? '주최자' : '사용자'), [initialRole]);

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

  const handleWalletAuth = () => {
    setWalletMode((value) => !value);
    setFeedback(null);
  };

  const connectInjectedWallet = async () => {
    const provider = getEthereumProvider();
    if (!provider) {
      throw new Error('브라우저 지갑을 찾을 수 없습니다. MetaMask 등 Web3 지갑을 설치하거나 지갑 내 브라우저에서 접속해 주세요.');
    }

    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    const [address] = Array.isArray(accounts) ? accounts.filter((item): item is string => typeof item === 'string') : [];
    if (!address) {
      throw new Error('연결된 지갑 주소를 가져오지 못했습니다.');
    }

    setWalletAddress(address);
    setWalletStep('connected');
    return { provider, address };
  };

  const handleConnectWallet = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      await connectInjectedWallet();
      setFeedback({ type: 'success', message: '지갑이 연결되었습니다. 이제 지갑에서 서명을 승인해 주세요.' });
    } catch (error: any) {
      const message = walletClientMessage(error, '지갑 연결에 실패했습니다.');
      setFeedback({ type: 'error', message });
      Alert.alert('지갑 연결 실패', message);
    } finally {
      setLoading(false);
    }
  };

  const handleWalletLogin = async () => {
    if (!isLogin && !displayName.trim()) {
      const message = '이름을 입력해 주세요.';
      setFeedback({ type: 'error', message });
      Alert.alert('입력 필요', message);
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const connection = walletAddress.trim()
        ? { provider: getEthereumProvider(), address: walletAddress.trim() }
        : await connectInjectedWallet();
      if (!connection.provider) {
        throw new Error('브라우저 지갑을 찾을 수 없습니다. MetaMask 등 Web3 지갑을 설치하거나 지갑 내 브라우저에서 접속해 주세요.');
      }

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
      const message = errorMessage(error, '지갑 로그인에 실패했습니다.');
      setFeedback({ type: 'error', message });
      Alert.alert(isLogin ? '지갑 로그인 실패' : '지갑 회원가입 실패', message);
    } finally {
      setLoading(false);
    }
  };

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
              {walletMessage ? (
                <View style={styles.walletMessageBox}>
                  <Text style={styles.walletMessageLabel}>서명 요청 메시지</Text>
                  <Text style={styles.walletMessageText}>{walletMessage}</Text>
                </View>
              ) : null}
              {walletStep !== 'idle' ? (
                <View style={styles.walletStatusBox}>
                  <Text style={styles.walletStatusText}>
                    {walletStep === 'connected' ? '지갑 연결 완료' : walletStep === 'signing' ? '지갑 서명 승인 대기 중' : '서명 완료'}
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity style={[styles.secondaryAction, loading && styles.disabledButton]} disabled={loading} onPress={handleConnectWallet}>
                <Text style={styles.secondaryActionText}>{loading ? '처리 중...' : '지갑 연결'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, loading && styles.disabledButton]} disabled={loading} onPress={handleWalletLogin}>
                <Text style={styles.primaryButtonText}>
                  {loading ? '처리 중...' : isLogin ? '지갑 서명 요청 및 로그인' : '지갑 회원가입'}
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
