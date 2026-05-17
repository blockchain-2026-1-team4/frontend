import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { accountStatusMessage, errorMessage, routeForEntry } from '../lib/account';
import { backendApi } from '../lib/backend';

export default function LoginPage({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('입력 필요', '이메일과 비밀번호를 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const tokens = await backendApi.loginEmail({ email: email.trim(), password });
      const profile = tokens.user ?? await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        Alert.alert('로그인 실패', statusMessage);
        return;
      }
      navigation.replace(routeForEntry(profile, 'USER'));
    } catch (error: any) {
      Alert.alert('로그인 실패', errorMessage(error, '로그인할 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trust Ticket</Text>
      <Text style={styles.subtitle}>티켓 예매와 이벤트 관리를 시작하세요.</Text>
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
      <TouchableOpacity style={[styles.button, loading && styles.disabled]} disabled={loading} onPress={handleLogin}>
        <Text style={styles.buttonText}>{loading ? '로그인 중...' : '로그인'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: '#FFFFFF' },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center', color: '#0F172A' },
  subtitle: { marginTop: 8, marginBottom: 24, textAlign: 'center', color: '#64748B' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', padding: 13, marginBottom: 10, borderRadius: 12, color: '#0F172A' },
  button: { marginTop: 8, backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
