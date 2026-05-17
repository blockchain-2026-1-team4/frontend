import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { backendApi } from '../lib/backend';

export default function TicketResaleCreatePage({ route, navigation }: any) {
  const { ticketId } = route.params;
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateResale = async () => {
    if (!price || isNaN(Number(price))) {
      const msg = '올바른 가격을 입력해 주세요.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('입력 오류', msg);
      return;
    }

    setLoading(true);
    try {
      await backendApi.createResale(ticketId, price);
      const msg = '리셀 판매 등록이 완료되었습니다.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('성공', msg);
      navigation.goBack();
    } catch (error: any) {
      console.error(error);
      const msg = error.message || '등록에 실패했습니다.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('오류', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>리셀 판매 등록</Text>
      <Text style={styles.description}>
        판매를 원하는 가격(WEI)을 입력해 주세요. 등록 후에는 취소하기 전까지 티켓 사용이 제한됩니다.
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>판매 가격 (WEI)</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="예: 10000"
          keyboardType="numeric"
        />
      </View>

      <TouchableOpacity 
        style={[styles.submitButton, loading && styles.disabledButton]} 
        onPress={handleCreateResale}
        disabled={loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? '등록 중...' : '판매 등록하기'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 30 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, color: '#212529' },
  description: { fontSize: 15, color: '#868E96', lineHeight: 22, marginBottom: 40 },
  inputContainer: { marginBottom: 30 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#495057', marginBottom: 10 },
  input: { backgroundColor: '#F1F3F5', padding: 15, borderRadius: 10, fontSize: 18, fontWeight: 'bold' },
  submitButton: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center' },
  disabledButton: { backgroundColor: '#A5D8FF' },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
