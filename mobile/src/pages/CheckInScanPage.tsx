import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EntryTopBar, entryColors, entryStyles } from '../components/EntryScheduleKit';
import { TicketIcon } from '../components/TicketFlowKit';
import { TextInput } from '../components/TextInput';
import { errorMessage } from '../lib/account';
import { backendApi } from '../lib/backend';

type ScanMode = 'qr' | 'manual';
type Result = { type: 'idle' | 'success' | 'error'; title: string; message: string };
type QrPayload = { ticketId?: string; claimedOwner?: string; expiresAt?: string | number; signature?: string; memo?: string };

function normalizedPayload(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value.trim()) as QrPayload;
    const expiresAt = typeof parsed.expiresAt === 'number' || /^\d+$/.test(String(parsed.expiresAt ?? ''))
      ? new Date(Number(parsed.expiresAt) * 1000).toISOString()
      : parsed.expiresAt;
    return { ...parsed, expiresAt };
  } catch {
    return { ticketId: value.trim() };
  }
}

export default function CheckInScanPage({ navigation, route }: any) {
  const eventId = String(route?.params?.eventId ?? '');
  const roundId = route?.params?.roundId != null ? String(route.params.roundId) : undefined;
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>('qr');
  const [manualValue, setManualValue] = useState('');
  const [processing, setProcessing] = useState(false);
  const [scanEnabled, setScanEnabled] = useState(true);
  const [result, setResult] = useState<Result>({ type: 'idle', title: '스캔 대기 중', message: 'QR을 인식하면 자동으로 티켓 유효성을 검증합니다.' });

  const processValue = async (value: string) => {
    if (!value.trim() || processing) return;
    setProcessing(true);
    setScanEnabled(false);
    try {
      const payload = normalizedPayload(value);
      const id = String(payload.ticketId ?? '').trim();
      if (!id) throw new Error('티켓 ID가 포함되어 있지 않습니다.');
      const ticket = await backendApi.getTicket(id);
      if (eventId && String(ticket.eventId) !== eventId) throw new Error('선택한 이벤트의 티켓이 아닙니다.');
      if (roundId && String(ticket.eventRoundId ?? '') !== roundId) throw new Error('선택한 회차의 티켓이 아닙니다.');
      await backendApi.checkIn(payload);
      setResult({ type: 'success', title: '입장 처리 완료', message: `${ticket.seatInfo || `티켓 ${id}`}의 입장이 정상 처리되었습니다.` });
    } catch (error: any) {
      const message = errorMessage(error, '티켓 입장 처리에 실패했습니다.');
      setResult({ type: 'error', title: '입장 처리 실패', message });
      Alert.alert('입장 처리 실패', message);
    } finally {
      setProcessing(false);
    }
  };

  const restartScan = () => {
    setResult({ type: 'idle', title: '스캔 대기 중', message: 'QR을 인식하면 자동으로 티켓 유효성을 검증합니다.' });
    setScanEnabled(true);
  };

  return (
    <ScrollView style={entryStyles.screen} contentContainerStyle={entryStyles.content} stickyHeaderIndices={[0]}>
      <EntryTopBar eyebrow="QR Scan" title="QR 입장 스캔" back onBack={() => navigation.goBack()} rightIcon="bolt" rightLabel="스캔 다시 시작" onRight={restartScan} />

      <View style={[entryStyles.section, styles.toggleSection]}>
        <View style={styles.toggle}>
          <TouchableOpacity style={[styles.modeButton, mode === 'qr' && styles.modeButtonActive]} onPress={() => setMode('qr')}>
            <Text style={[styles.modeText, mode === 'qr' && styles.modeTextActive]}>QR 스캔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeButton, mode === 'manual' && styles.modeButtonActive]} onPress={() => setMode('manual')}>
            <Text style={[styles.modeText, mode === 'manual' && styles.modeTextActive]}>수동 입력</Text>
          </TouchableOpacity>
        </View>
      </View>

      {mode === 'qr' ? (
        <>
          <View style={styles.scanStage}>
            {permission?.granted ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanEnabled && !processing ? ({ data }) => void processValue(data) : undefined}
              />
            ) : (
              <View style={styles.permission}>
                <TicketIcon name="qr" color="#FFFFFF" size={42} />
                <Text style={styles.permissionTitle}>카메라 권한이 필요합니다.</Text>
                <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                  <Text style={styles.permissionButtonText}>카메라 권한 허용</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.scanDim} pointerEvents="none" />
            <View style={styles.scanFrame} pointerEvents="none">
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <Text style={styles.scanGuide}>티켓 QR을 프레임 안에 맞춰주세요.</Text>
          </View>

          <View style={entryStyles.section}>
            <ResultCard result={result} processing={processing} />
          </View>
          <View style={entryStyles.section}>
            <TouchableOpacity style={entryStyles.outlineButton} onPress={() => setMode('manual')}>
              <Text style={entryStyles.outlineText}>수동 입력으로 전환</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <View style={entryStyles.section}>
            <View style={[entryStyles.card, styles.manualCard]}>
              <Text style={styles.manualTitle}>수동 입장 처리</Text>
              <Text style={styles.manualSubtitle}>QR 인식이 어려운 경우 티켓 ID 또는 QR payload를 직접 입력합니다.</Text>
              <TextInput style={styles.input} value={manualValue} onChangeText={setManualValue} placeholder="티켓 ID 또는 QR payload 입력" multiline />
              <TouchableOpacity style={entryStyles.primaryButton} disabled={processing || !manualValue.trim()} onPress={() => void processValue(manualValue)}>
                <View style={[styles.manualConfirm, (processing || !manualValue.trim()) && styles.disabled]}>
                  {processing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={entryStyles.primaryText}>수동 확인</Text>}
                </View>
              </TouchableOpacity>
            </View>
          </View>
          {result.type !== 'idle' ? <View style={entryStyles.section}><ResultCard result={result} processing={processing} /></View> : null}
          <View style={entryStyles.section}>
            <View style={styles.notice}>
              <TicketIcon name="alert" color="#534AB7" size={21} />
              <View style={{ flex: 1 }}><Text style={styles.noticeTitle}>수동 처리는 보조 경로입니다.</Text><Text style={styles.noticeText}>가능하면 QR 스캔을 우선 사용하고, QR이 훼손되었거나 카메라 인식이 어려울 때만 사용하세요.</Text></View>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function ResultCard({ result, processing }: { result: Result; processing: boolean }) {
  const color = result.type === 'error' ? '#B91C1C' : '#0F6E56';
  const background = result.type === 'error' ? '#FEE2E2' : '#DCFCE7';
  return (
    <View style={[entryStyles.card, styles.result]}>
      <View style={[styles.resultIcon, { backgroundColor: background }]}>
        {processing ? <ActivityIndicator color={color} /> : <TicketIcon name={result.type === 'error' ? 'alert' : 'check'} color={color} size={25} />}
      </View>
      <View style={{ flex: 1 }}><Text style={styles.resultTitle}>{processing ? '입장 처리 중' : result.title}</Text><Text style={styles.resultMessage}>{processing ? '티켓 유효성을 확인하고 있습니다.' : result.message}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleSection: { paddingTop: 14 },
  toggle: { flexDirection: 'row', gap: 8 },
  modeButton: { flex: 1, height: 44, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  modeButtonActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  modeText: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  modeTextActive: { color: '#FFFFFF' },
  scanStage: { height: 420, marginHorizontal: 12, marginBottom: 14, borderRadius: 30, backgroundColor: '#1A1A2E', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: '#534AB7', shadowOpacity: 0.22, shadowRadius: 22, shadowOffset: { width: 0, height: 20 }, elevation: 5 },
  scanDim: { ...StyleSheet.absoluteFillObject, margin: 12, borderRadius: 24, backgroundColor: 'rgba(8,13,28,0.58)' },
  scanFrame: { width: 230, height: 230, borderWidth: 2, borderColor: 'rgba(255,255,255,0.82)', borderRadius: 28 },
  corner: { position: 'absolute', width: 38, height: 38, borderColor: '#5EE3A1' },
  cornerTopLeft: { left: -2, top: -2, borderLeftWidth: 5, borderTopWidth: 5, borderTopLeftRadius: 24 },
  cornerTopRight: { right: -2, top: -2, borderRightWidth: 5, borderTopWidth: 5, borderTopRightRadius: 24 },
  cornerBottomLeft: { left: -2, bottom: -2, borderLeftWidth: 5, borderBottomWidth: 5, borderBottomLeftRadius: 24 },
  cornerBottomRight: { right: -2, bottom: -2, borderRightWidth: 5, borderBottomWidth: 5, borderBottomRightRadius: 24 },
  scanGuide: { position: 'absolute', bottom: 40, color: 'rgba(255,255,255,0.74)', fontSize: 12 },
  permission: { zIndex: 2, alignItems: 'center', gap: 12 },
  permissionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  permissionButton: { height: 42, borderRadius: 15, backgroundColor: '#FFFFFF', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  permissionButtonText: { color: entryColors.purple, fontSize: 12, fontWeight: '900' },
  result: { padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  resultIcon: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  resultMessage: { color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 4 },
  manualCard: { padding: 14 },
  manualTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  manualSubtitle: { color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 3, marginBottom: 10 },
  input: { minHeight: 48, maxHeight: 130, borderWidth: 1, borderColor: '#D9E1EE', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 12, color: '#0F172A', fontWeight: '800', marginBottom: 10 },
  manualConfirm: { flex: 1, borderRadius: 18, backgroundColor: '#534AB7', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  notice: { paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#FBFAFF', borderWidth: 1, borderColor: '#D8D4FF', borderRadius: 20, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noticeTitle: { color: '#0F172A', fontSize: 12, fontWeight: '900', marginBottom: 3 },
  noticeText: { color: '#64748B', fontSize: 10, lineHeight: 15 },
});
