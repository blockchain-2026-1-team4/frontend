import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PurchaseCompletePage({ route, navigation }: any) {
  const type = route?.params?.type === 'resale' ? '리셀 구매' : '티켓 예매';
  const ticketId = route?.params?.ticketId;

  return (
    <View style={styles.container}>
      <View style={styles.circle}><Text style={styles.check}>✓</Text></View>
      <Text style={styles.title}>{type}가 완료되었습니다.</Text>
      <Text style={styles.description}>구매한 티켓은 내 티켓 목록에서 확인할 수 있습니다.</Text>
      <TouchableOpacity style={styles.button} onPress={() => navigation.replace('MyTickets')}>
        <Text style={styles.buttonText}>내 티켓 보기</Text>
      </TouchableOpacity>
      {ticketId ? (
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace('TicketDetail', { ticketId })}>
          <Text style={styles.secondaryButtonText}>티켓 상세 보기</Text>
        </TouchableOpacity>
      ) : null}
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
