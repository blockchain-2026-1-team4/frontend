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

export default function AuthPage({ navigation, route }: any) {
  const initialRole = route?.params?.initialRole ?? 'USER';
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletNonce, setWalletNonce] = useState('');
  const [walletMessage, setWalletMessage] = useState('');
  const [walletSignature, setWalletSignature] = useState('');
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

  const requestWalletNonce = async () => {
    if (!walletAddress.trim()) {
      const message = '지갑 주소를 입력해 주세요.';
      setFeedback({ type: 'error', message });
      Alert.alert('입력 필요', message);
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const nonce = await backendApi.issueWalletNonce({ walletAddress: walletAddress.trim() });
      setWalletAddress(nonce.walletAddress);
      setWalletNonce(nonce.nonce);
      setWalletMessage(nonce.message);
      setFeedback({ type: 'success', message: '서명 메시지를 발급했습니다. 지갑에서 메시지를 서명한 뒤 서명값을 입력해 주세요.' });
    } catch (error: any) {
      const message = errorMessage(error, '서명 메시지를 발급하지 못했습니다.');
      setFeedback({ type: 'error', message });
      Alert.alert('지갑 인증 실패', message);
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

    if (!walletAddress.trim() || !walletNonce.trim() || !walletSignature.trim()) {
      const message = '지갑 주소, nonce, 서명값이 모두 필요합니다.';
      setFeedback({ type: 'error', message });
      Alert.alert('입력 필요', message);
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const result = await backendApi.loginWallet({
        walletAddress: walletAddress.trim(),
        nonce: walletNonce.trim(),
        signature: walletSignature.trim(),
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
      Alert.alert('지갑 로그인 실패', message);
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
              <TextInput
                style={styles.input}
                placeholder="지갑 주소"
                value={walletAddress}
                onChangeText={setWalletAddress}
                autoCapitalize="none"
              />
              {walletMessage ? (
                <View style={styles.walletMessageBox}>
                  <Text style={styles.walletMessageLabel}>서명 메시지</Text>
                  <Text style={styles.walletMessageText}>{walletMessage}</Text>
                </View>
              ) : null}
              <TextInput
                style={styles.input}
                placeholder="지갑 서명값"
                value={walletSignature}
                onChangeText={setWalletSignature}
                autoCapitalize="none"
              />
              <TouchableOpacity style={[styles.secondaryAction, loading && styles.disabledButton]} disabled={loading} onPress={requestWalletNonce}>
                <Text style={styles.secondaryActionText}>{loading ? '처리 중...' : '서명 메시지 발급'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, loading && styles.disabledButton]} disabled={loading} onPress={handleWalletLogin}>
                <Text style={styles.primaryButtonText}>{loading ? '처리 중...' : '지갑 로그인'}</Text>
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
          <Text style={styles.walletButtonText}>{walletMode ? '이메일로 계속하기' : '지갑으로 계속하기'}</Text>
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
  walletMessageBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12 },
  walletMessageLabel: { color: '#2563EB', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  walletMessageText: { color: '#334155', fontSize: 12, lineHeight: 18 },
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
