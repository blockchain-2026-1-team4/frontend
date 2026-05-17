import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { accountStatusMessage, errorMessage, routeForEntry } from '../lib/account';
import { getAccessToken } from '../lib/auth';
import { backendApi } from '../lib/backend';

export default function LandingPage({ navigation }: any) {
  const [checkingRole, setCheckingRole] = useState<'USER' | 'ORGANIZER' | null>(null);

  const start = async (role: 'USER' | 'ORGANIZER') => {
    setCheckingRole(role);
    try {
      const token = await getAccessToken();
      if (!token) {
        navigation.navigate('Auth', { initialRole: role });
        return;
      }

      const profile = await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        Alert.alert('계정 사용 불가', statusMessage);
        return;
      }

      navigation.navigate(routeForEntry(profile, role));
    } catch (error: any) {
      Alert.alert('세션 확인 실패', errorMessage(error, '다시 로그인해 주세요.'));
      navigation.navigate('Auth', { initialRole: role });
    } finally {
      setCheckingRole(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Trust Ticket</Text>
        <Text style={styles.title}>블록체인 티켓 예매</Text>
        <Text style={styles.subtitle}>
          사용자는 티켓을 예매하고, 주최자는 이벤트를 등록하고 운영합니다.
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.userButton]}
          disabled={checkingRole !== null}
          onPress={() => start('USER')}
        >
          {checkingRole === 'USER' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>사용자로 시작하기</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.organizerButton]}
          disabled={checkingRole !== null}
          onPress={() => start('ORGANIZER')}
        >
          {checkingRole === 'ORGANIZER' ? <ActivityIndicator color="#2563EB" /> : <Text style={styles.buttonTextDark}>주최자로 시작하기</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.footerText}>로그인 후 권한에 따라 알맞은 화면으로 이동합니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 22, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 52 },
  logo: { fontSize: 18, fontWeight: '900', color: '#2563EB', letterSpacing: 0.6 },
  title: { marginTop: 14, fontSize: 34, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  subtitle: { marginTop: 12, fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  buttonContainer: { gap: 13 },
  button: { padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  userButton: { backgroundColor: '#2563EB' },
  organizerButton: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  buttonTextDark: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  footerText: { textAlign: 'center', marginTop: 34, color: '#94A3B8', fontSize: 13 },
});
