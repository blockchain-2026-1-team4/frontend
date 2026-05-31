import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { clearAccessToken } from '../lib/auth';

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5m7 7-7-7 7-7" />
    </Svg>
  );
}

export default function OrganizerLogoutPage({ navigation }: any) {
  const insets = useSafeAreaInsets();
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
      <HeroGradient
        colors={['#1A1A2E', '#2D2B6B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: Math.max(insets.top + 20, 42) }]}
      >
        <View style={styles.heroTopBar}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="뒤로가기" style={styles.backButton} onPress={() => navigation.goBack()}>
            <BackIcon />
          </TouchableOpacity>
        </View>
        <Text style={styles.eyebrow}>ORGANIZER</Text>
        <Text style={styles.heroTitle}>로그아웃</Text>
        <Text style={styles.heroSub}>현재 주최자 세션을 종료합니다.</Text>
      </HeroGradient>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>세션 종료</Text>
          <Text style={styles.cardText}>현재 주최자 계정에서 로그아웃합니다. 로그아웃하면 로그인 화면으로 돌아갑니다.</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loggingOut && styles.disabledButton]}
          disabled={loggingOut}
          onPress={logout}
        >
          {loggingOut ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>로그아웃</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>취소</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18 },
  body: { padding: 16, flex: 1 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: '#E5E7EB', marginBottom: 16 },
  cardTitle: { color: '#1A1A2E', fontSize: 15, fontWeight: '800' },
  cardText: { marginTop: 8, color: '#6B7280', lineHeight: 21, fontSize: 13 },
  primaryButton: { backgroundColor: '#1A1A2E', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: { borderWidth: 0.5, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  secondaryButtonText: { color: '#1A1A2E', fontSize: 15, fontWeight: '700' },
  disabledButton: { opacity: 0.55 },
});
