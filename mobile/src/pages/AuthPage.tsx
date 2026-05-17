import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { backendApi } from '../lib/backend';

export default function AuthPage({ navigation, route }: any) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleEmailAuth = async () => {
    console.log('Email Auth Attempt:', { isLogin, email });
    try {
      if (isLogin) {
        const res = await backendApi.loginEmail({ email, password });
        console.log('Login Success:', res);
        navigateByRole(res.roles);
      } else {
        const res = await backendApi.registerEmail({ email, password, displayName });
        console.log('Register Success:', res);
        if (Platform.OS === 'web') {
          alert('회원가입 완료: 가입되었습니다. 로그인해 주세요.');
          setIsLogin(true);
        } else {
          Alert.alert('회원가입 완료', '가입되었습니다. 로그인해 주세요.', [
            { text: '확인', onPress: () => setIsLogin(true) }
          ]);
        }
      }
    } catch (error: any) {
      console.error('Auth Error:', error);
      const msg = error.response?.data?.message || error.message || '인증에 실패했습니다.';
      if (Platform.OS === 'web') alert('오류: ' + msg);
      else Alert.alert('오류', msg);
    }
  };

  const handleWalletAuth = async () => {
    console.log('Wallet Auth Attempt');
    const msg = '지갑 인증 기능은 모바일 브라우저 또는 전용 지갑 앱 연동이 필요합니다. (준비 중)';
    if (Platform.OS === 'web') alert(msg);
    else Alert.alert('안내', msg);
  };

  const navigateByRole = (roles: string[]) => {
    if (roles.includes('ADMIN')) {
      Alert.alert('관리자 계정', '관리자 기능은 웹에서 이용해 주세요.');
      return;
    }
    if (roles.includes('ORGANIZER')) {
      navigation.replace('Organizer');
    } else {
      navigation.replace('Main');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{isLogin ? '로그인' : '회원가입'}</Text>
        
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, isLogin && styles.activeTab]} 
            onPress={() => setIsLogin(true)}
          >
            <Text style={[styles.tabText, isLogin && styles.activeTabText]}>로그인</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, !isLogin && styles.activeTab]} 
            onPress={() => setIsLogin(false)}
          >
            <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>회원가입</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {!isLogin && (
            <TextInput
              style={styles.input}
              placeholder="이름 (Display Name)"
              value={displayName}
              onChangeText={setDisplayName}
            />
          )}
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
          
          <TouchableOpacity style={styles.primaryButton} onPress={handleEmailAuth}>
            <Text style={styles.primaryButtonText}>
              {isLogin ? '이메일로 로그인' : '이메일로 시작하기'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity style={styles.walletButton} onPress={handleWalletAuth}>
          <Text style={styles.walletButtonText}>지갑(Wallet)으로 계속하기</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.switchButton} 
          onPress={() => setIsLogin(!isLogin)}
        >
          <Text style={styles.switchButtonText}>
            {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 30,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 30,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#007AFF',
  },
  form: {
    gap: 15,
  },
  input: {
    backgroundColor: '#F2F2F7',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#D1D1D6',
  },
  dividerText: {
    paddingHorizontal: 15,
    color: '#8E8E93',
  },
  walletButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
  },
  walletButtonText: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 30,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#8E8E93',
    fontSize: 14,
  },
});
