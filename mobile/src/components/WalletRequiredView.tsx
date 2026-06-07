import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TicketIcon, flowShadow } from './TicketFlowKit';

interface Props {
  navigation: any;
  feature?: string;
}

export default function WalletRequiredView({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const goBack = () => navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate('Main');

  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity style={styles.topbarIcon} onPress={goBack} activeOpacity={0.84}>
          <TicketIcon name="arrowLeft" size={20} color="#475569" />
        </TouchableOpacity>
        <View style={styles.topbarCopy}>
          <Text style={styles.eyebrow}>Wallet Required</Text>
          <Text style={styles.topbarTitle}>지갑 연결 필요</Text>
        </View>
        <View style={styles.topbarPlaceholder} />
      </View>

      <View style={styles.center}>
        <View style={styles.card}>
          <View style={styles.walletRing}>
            <View style={styles.walletMark}>
              <TicketIcon name="wallet" size={40} color="#534AB7" />
            </View>
          </View>
          <Text style={styles.title}>지갑 연결이 필요합니다</Text>
          <Text style={styles.message}>
            티켓 구매, 리셀 등록, QR 입장은{'\n'}
            블록체인 지갑 연결 후 이용할 수 있습니다.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Auth', { initialRole: 'USER', walletMode: true })} activeOpacity={0.88}>
            <LinearGradient colors={['#534AB7', '#6F67D8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}>
              <Text style={styles.primaryButtonText}>지갑 연결하기</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={goBack} activeOpacity={0.84}>
            <Text style={styles.secondaryButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  topbar: {
    backgroundColor: 'rgba(246,247,251,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topbarIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...flowShadow,
  },
  topbarPlaceholder: {
    width: 38,
    height: 38,
  },
  topbarCopy: {
    flex: 1,
    alignItems: 'center',
  },
  eyebrow: {
    color: '#938CF0',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  topbarTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 0,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingVertical: 30,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 18 },
    elevation: 4,
  },
  walletRing: {
    width: 98,
    height: 98,
    borderRadius: 37,
    borderWidth: 1.5,
    borderColor: '#D8D4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -7,
    marginBottom: 15,
  },
  walletMark: {
    width: 84,
    height: 84,
    borderRadius: 30,
    backgroundColor: '#EEEDFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.8,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 21.5,
    textAlign: 'center',
    marginBottom: 22,
  },
  primaryButton: {
    width: '100%',
    height: 54,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#534AB7',
    shadowOpacity: 0.22,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 14 },
    elevation: 3,
  },
  primaryGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    width: '100%',
    height: 54,
    borderWidth: 1.5,
    borderColor: '#D9E1EE',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#1A1A2E',
    fontSize: 15,
    fontWeight: '900',
  },
});
