import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  navigation: any;
  feature?: string;
}

export default function WalletRequiredView({ navigation, feature }: Props) {
  const featureText = feature ? `${feature}은(는)` : '이 기능은';

  const goToWalletAuth = () => {
    navigation.navigate('Auth', { initialRole: 'USER', walletMode: true });
  };

  const goBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Text style={styles.iconText}>W</Text>
      </View>
      <Text style={styles.title}>지갑 연결 필요</Text>
      <Text style={styles.message}>
        {featureText} 블록체인 지갑 연결 후 이용할 수 있습니다.{'\n'}
        지갑이 없으면 구매·리셀·QR 입장 등 블록체인 기능을 사용할 수 없습니다.
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={goToWalletAuth}>
        <Text style={styles.primaryButtonText}>지갑 연결하기</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={goBack}>
        <Text style={styles.secondaryButtonText}>돌아가기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F4F7FB',
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#2563EB',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
  },
});
