import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlowBadge, TicketIcon, flowShadow } from '../components/TicketFlowKit';

export default function ResaleRegisterCompletePage({ route, navigation }: any) {
  const listingId = route?.params?.listingId;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.circle}><TicketIcon name="check" size={42} color="#0F6E56" /></View>
        <FlowBadge label="Resale Listed" tone="green" />
        <Text style={styles.title}>리셀 등록이 완료되었습니다</Text>
        <Text style={styles.description}>등록한 티켓은 리셀 목록에서 확인할 수 있습니다.</Text>

        {listingId ? (
          <TouchableOpacity style={styles.button} onPress={() => navigation.replace('ResaleDetail', { listingId })} activeOpacity={0.88}>
            <Text style={styles.buttonText}>등록 내역 보기</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.replace('MyTicketFlow')} activeOpacity={0.88}>
          <Text style={styles.secondaryButtonText}>내 티켓으로 이동</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB', padding: 24, justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 24, padding: 24, alignItems: 'center', ...flowShadow },
  circle: { width: 82, height: 82, borderRadius: 24, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: '#0F172A', fontSize: 23, fontWeight: '900', textAlign: 'center', marginTop: 12, marginBottom: 10, letterSpacing: 0 },
  description: { color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 24, fontWeight: '700' },
  button: { backgroundColor: '#534AB7', paddingVertical: 16, borderRadius: 17, alignItems: 'center', alignSelf: 'stretch', ...flowShadow },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { marginTop: 12, borderWidth: 1.5, borderColor: '#CECBF6', backgroundColor: '#FFFFFF', paddingVertical: 16, borderRadius: 17, alignItems: 'center', alignSelf: 'stretch' },
  secondaryButtonText: { color: '#534AB7', fontSize: 16, fontWeight: '900' },
});
