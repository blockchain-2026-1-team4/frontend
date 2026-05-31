import React, { useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const HeroGradient = LinearGradient as unknown as React.ComponentType<any>;

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5m7 7-7-7 7-7" />
    </Svg>
  );
}

export default function CheckInScanPage({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
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
        <Text style={styles.centerTitle}>카메라 권한을 확인하고 있습니다.</Text>
      </View>
    );
  }

  if (!permission.granted) {
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
          <Text style={styles.eyebrow}>QR SCAN</Text>
          <Text style={styles.heroTitle}>QR 스캔</Text>
          <Text style={styles.heroSub}>카메라 권한이 필요합니다.</Text>
        </HeroGradient>
        <View style={styles.permissionBody}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>카메라 권한 요청</Text>
            <Text style={styles.cardText}>QR 코드 스캔을 위해 카메라 접근 권한을 허용해 주세요. 권한은 체크인 처리에만 사용됩니다.</Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>권한 허용</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.scanContainer}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
      >
        <View style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity style={styles.overlayBack} onPress={() => navigation.goBack()}>
            <BackIcon />
          </TouchableOpacity>
          <View style={styles.scanCenter}>
            <Text style={styles.scanTitle}>QR 코드를 화면 안에 맞춰주세요.</Text>
            <View style={styles.scanBox}>
              <View style={[styles.scanCorner, styles.scanCornerTL]} />
              <View style={[styles.scanCorner, styles.scanCornerTR]} />
              <View style={[styles.scanCorner, styles.scanCornerBL]} />
              <View style={[styles.scanCorner, styles.scanCornerBR]} />
            </View>
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>취소</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const CORNER_SIZE = 22;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scanContainer: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: '#F5F5F5' },
  centerTitle: { color: '#1A1A2E', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  hero: { paddingHorizontal: 20, paddingBottom: 28 },
  heroTopBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#A89CF7', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: 4 },
  heroSub: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 18 },
  permissionBody: { padding: 16, flex: 1 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: '#E5E7EB', marginBottom: 16 },
  cardTitle: { color: '#1A1A2E', fontSize: 15, fontWeight: '800' },
  cardText: { marginTop: 8, color: '#6B7280', lineHeight: 21, fontSize: 13 },
  primaryButton: { backgroundColor: '#1A1A2E', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: { borderWidth: 0.5, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  secondaryButtonText: { color: '#1A1A2E', fontSize: 15, fontWeight: '700' },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 20, paddingBottom: 40 },
  overlayBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  scanCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 28, opacity: 0.9 },
  scanBox: { width: 240, height: 240, position: 'relative' },
  scanCorner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: '#A89CF7' },
  scanCornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderTopLeftRadius: 4 },
  scanCornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderTopRightRadius: 4 },
  scanCornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderBottomLeftRadius: 4 },
  scanCornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderBottomRightRadius: 4 },
  cancelButton: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 20, paddingHorizontal: 28, paddingVertical: 12 },
  cancelButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
