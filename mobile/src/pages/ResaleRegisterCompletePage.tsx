import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ResaleRegisterCompletePage({ route, navigation }: any) {
  const listingId = route?.params?.listingId;

  return (
    <View style={styles.container}>
      <View style={styles.circle}><Text style={styles.check}>✓</Text></View>
      <Text style={styles.title}>판매 등록이 완료되었습니다.</Text>
      <Text style={styles.description}>등록한 티켓은 리셀 목록에서 확인할 수 있습니다.</Text>
      {listingId ? (
        <TouchableOpacity style={styles.button} onPress={() => navigation.replace('ResaleDetail', { listingId })}>
          <Text style={styles.buttonText}>등록 내역 보기</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace('MyTickets')}>
        <Text style={styles.secondaryButtonText}>내 티켓으로 이동</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 28, justifyContent: 'center', alignItems: 'center' },
  circle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E7F8EF', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  check: { color: '#16A34A', fontSize: 34, fontWeight: '900' },
  title: { color: '#212529', fontSize: 23, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  description: { color: '#868E96', textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  button: { backgroundColor: '#007AFF', paddingVertical: 16, borderRadius: 12, alignItems: 'center', alignSelf: 'stretch' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  secondaryButton: { marginTop: 12, borderWidth: 1, borderColor: '#007AFF', paddingVertical: 16, borderRadius: 12, alignItems: 'center', alignSelf: 'stretch' },
  secondaryButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '900' },
});
