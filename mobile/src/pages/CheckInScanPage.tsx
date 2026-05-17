import React, { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CheckInScanPage({ navigation, route }: any) {
  const eventId = route?.params?.eventId as string;
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    if (!data) {
      Alert.alert('스캔 실패', 'QR 내용을 읽지 못했습니다.');
      setScanned(false);
      return;
    }
    navigation.replace('CheckInManage', { eventId, scannedPayload: data });
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>카메라 권한을 확인하고 있습니다.</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>카메라 권한이 필요합니다.</Text>
        <Text style={styles.subtitle}>QR/바코드 스캔을 위해 카메라 접근을 허용해 주세요.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>권한 허용</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
      >
        <View style={styles.overlay}>
          <Text style={styles.scanTitle}>QR 코드를 화면 안에 맞춰주세요.</Text>
          <View style={styles.scanBox} />
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>취소</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.18)' },
  scanTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 24 },
  scanBox: { width: 240, height: 240, borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' },
  cancelButton: { marginTop: 28, backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13 },
  cancelButtonText: { color: '#0F172A', fontWeight: '900' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: '#F4F7FB' },
  title: { color: '#0F172A', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  subtitle: { marginTop: 10, color: '#64748B', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  primaryButton: { marginTop: 18, backgroundColor: '#2563EB', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  secondaryButton: { marginTop: 10, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 14 },
  secondaryButtonText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
});
