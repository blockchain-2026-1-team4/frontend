import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ImageBackground } from 'react-native';

export default function LandingPage({ navigation }: any) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Trust Ticket</Text>
        <Text style={styles.subtitle}>블록체인 기반의 안전한 티켓 거래</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.userButton]} 
          onPress={() => navigation.navigate('Auth', { initialRole: 'USER' })}
        >
          <Text style={styles.buttonText}>사용자로 시작하기</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.organizerButton]} 
          onPress={() => navigation.navigate('Auth', { initialRole: 'ORGANIZER' })}
        >
          <Text style={styles.buttonTextDark}>주최자로 시작하기</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footerText}>로그인 후 권한에 따라 자동으로 대시보드가 전환됩니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  buttonContainer: {
    gap: 15,
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userButton: {
    backgroundColor: '#007AFF',
  },
  organizerButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonTextDark: {
    color: '#1C1C1E',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footerText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#8E8E93',
    fontSize: 14,
  },
});
