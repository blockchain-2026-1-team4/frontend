import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { clearAccessToken } from '../lib/auth';

export default function OrganizerLogoutPage({ navigation }: any) {
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await clearAccessToken();
      navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
    } catch (error: any) {
      Alert.alert('로그아웃 실패', error.message || '세션을 종료하지 못했습니다.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Logout</Text>
      <Text style={styles.title}>로그아웃</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>세션 종료</Text>
        <Text style={styles.cardText}>현재 주최자 계정에서 로그아웃합니다.</Text>
      </View>

      <TouchableOpacity style={[styles.primaryButton, loggingOut && styles.disabledButton]} disabled={loggingOut} onPress={logout}>
        {loggingOut ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>확인</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
        <Text style={styles.secondaryButtonText}>취소</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB', padding: 18, justifyContent: 'center' },
  eyebrow: { color: '#2563EB', fontWeight: '800', fontSize: 12, letterSpacing: 0.5, textAlign: 'center' },
  title: { marginTop: 4, fontSize: 28, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  card: { marginTop: 24, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  cardText: { marginTop: 8, color: '#64748B', lineHeight: 21 },
  primaryButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
});
