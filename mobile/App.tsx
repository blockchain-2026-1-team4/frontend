import 'react-native-gesture-handler';
import React from 'react';
import { AppKit, AppKitProvider } from '@reown/appkit-react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LandingPage from './src/pages/LandingPage';
import AuthPage from './src/pages/AuthPage';
import UserHomePage from './src/pages/UserHomePage';
import EventListPage from './src/pages/EventListPage';
import EventDetailPage from './src/pages/EventDetailPage';
import TicketPurchasePage from './src/pages/TicketPurchasePage';
import ResaleListPage from './src/pages/ResaleListPage';
import ResaleDetailPage from './src/pages/ResaleDetailPage';
import PurchaseCompletePage from './src/pages/PurchaseCompletePage';
import MyPage from './src/pages/MyPage';
import MyTicketsPage from './src/pages/MyTicketsPage';
import TicketDetailPage from './src/pages/TicketDetailPage';
import TicketQrPage from './src/pages/TicketQrPage';
import TicketResaleCreatePage from './src/pages/TicketResaleCreatePage';
import ResaleRegisterCompletePage from './src/pages/ResaleRegisterCompletePage';
import OrganizerDashboardPage from './src/pages/OrganizerDashboardPage';
import EventCreatePage from './src/pages/EventCreatePage';
import MyEventsPage from './src/pages/MyEventsPage';
import TicketIssuePage from './src/pages/TicketIssuePage';
import OrganizerLogoutPage from './src/pages/OrganizerLogoutPage';
import CheckInStatusPage from './src/pages/CheckInStatusPage';
import EventSettingsPage from './src/pages/EventSettingsPage';
import CheckInManagePage from './src/pages/CheckInManagePage';
import CheckInScanPage from './src/pages/CheckInScanPage';
import CheckInHomePage from './src/pages/CheckInHomePage';
import CheckInEventListPage from './src/pages/CheckInEventListPage';
import DisputeCreatePage from './src/pages/DisputeCreatePage';
import MyDisputesPage from './src/pages/MyDisputesPage';
import BottomNavigation from './src/components/BottomNavigation';
import { appKit } from './src/lib/appkit';
import { backendApi } from './src/lib/backend';
import { hasOrganizerAccess } from './src/lib/roles';

const Stack = createStackNavigator();
const navigationRef = createNavigationContainerRef<any>();
const TicketExplorePage = require('./src/pages/TicketExplorePage').default;
const OrganizerEventDetailPage = require('./src/pages/OrganizerEventDetailPage').default;
const OrganizerProfilePage = require('./src/pages/OrganizerProfilePage').default;
const SalesStatusPage = require('./src/pages/SalesStatusPage').default;

export default function App() {
  const [currentRouteName, setCurrentRouteName] = React.useState('Landing');
  const lastOrganizerEventIdRef = React.useRef<string | null>(null);

  const syncCurrentRoute = React.useCallback(() => {
    const route = navigationRef.getCurrentRoute();
    const routeName = route?.name;
    const routeParams = route?.params as { eventId?: string | number } | undefined;
    const routeEventId = routeParams?.eventId;
    const normalizedRouteEventId = routeEventId != null ? String(routeEventId).trim() : '';

    if (normalizedRouteEventId) {
      lastOrganizerEventIdRef.current = normalizedRouteEventId;
    }

    if (routeName) {
      setCurrentRouteName(routeName);
    }
  }, []);

  const navigateFromBottom = React.useCallback(async (routeName: string) => {
    const eventScopedRoutes = new Set(['TicketIssue', 'TicketExplore', 'CheckInStatus', 'EventSettings', 'CheckInManage']);
    const organizerRoutes = new Set([
      'Organizer',
      'MyEvents',
      'EventCreate',
      'OrganizerEventDetail',
      'EventSettings',
      'SalesStatus',
      'TicketExplore',
      'TicketIssue',
      'CheckInHome',
      'CheckInManage',
      'CheckInStatus',
      'OrganizerProfile',
    ]);

    if (navigationRef.isReady()) {
      if (organizerRoutes.has(routeName)) {
        const profile = await backendApi.getMe().catch(() => null);
        if (!profile || !hasOrganizerAccess(profile.roles)) {
          Alert.alert('주최자 승인 대기 중입니다.', '관리자 승인 후 주최자 기능을 사용할 수 있습니다.');
          navigationRef.navigate('Organizer');
          return;
        }
      }

      if (eventScopedRoutes.has(routeName)) {
        const currentParams = navigationRef.getCurrentRoute()?.params as { eventId?: string | number } | undefined;
        const currentEventId = currentParams?.eventId;
        const normalizedCurrentEventId = currentEventId != null ? String(currentEventId).trim() : '';
        const eventId = normalizedCurrentEventId || lastOrganizerEventIdRef.current;

        if (eventId) {
          navigationRef.navigate(routeName, { eventId });
          return;
        }

        navigationRef.navigate('MyEvents');
        return;
      }

      if (routeName === 'SalesStatus') {
        navigationRef.navigate('SalesStatus');
        return;
      }

      if (routeName === 'CheckInHome') {
        navigationRef.navigate('CheckInHome');
        return;
      }

      navigationRef.navigate(routeName);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <AppKitProvider instance={appKit}>
        <View style={[styles.appRoot, Platform.OS === 'web' && styles.webRoot]}>
          <View style={[styles.appFrame, Platform.OS === 'web' && styles.webFrame]}>
            <View style={styles.navigationHost}>
              <NavigationContainer ref={navigationRef} onReady={syncCurrentRoute} onStateChange={syncCurrentRoute}>
                <Stack.Navigator
                  initialRouteName="Landing"
                  screenOptions={{
                    headerShown: false,
                  }}
                >
          <Stack.Screen name="Landing" component={LandingPage} options={{ headerShown: false }} />
          <Stack.Screen name="Auth" component={AuthPage} options={{ title: '인증' }} />

          <Stack.Screen name="Main" component={UserHomePage} options={{ title: 'Trust Ticket' }} />
          <Stack.Screen name="EventList" component={EventListPage} options={{ title: '이벤트 목록' }} />
          <Stack.Screen name="EventDetail" component={EventDetailPage} options={{ title: '이벤트 상세' }} />
          <Stack.Screen name="TicketPurchase" component={TicketPurchasePage} options={{ title: '티켓 예매' }} />
          <Stack.Screen name="ResaleList" component={ResaleListPage} options={{ title: '리셀 목록' }} />
          <Stack.Screen name="ResaleDetail" component={ResaleDetailPage} options={{ title: '리셀 상세' }} />
          <Stack.Screen name="PurchaseComplete" component={PurchaseCompletePage} options={{ title: '구매 완료' }} />
          <Stack.Screen name="MyPage" component={MyPage} options={{ title: '마이페이지' }} />
          <Stack.Screen name="MyTickets" component={MyTicketsPage} options={{ title: '내 티켓' }} />
          <Stack.Screen name="TicketDetail" component={TicketDetailPage} options={{ title: '티켓 상세' }} />
          <Stack.Screen name="TicketQr" component={TicketQrPage} options={{ title: 'QR 보기' }} />
          <Stack.Screen name="TicketResaleCreate" component={TicketResaleCreatePage} options={{ title: '판매 등록' }} />
          <Stack.Screen name="ResaleRegisterComplete" component={ResaleRegisterCompletePage} options={{ title: '판매 등록 완료' }} />
          <Stack.Screen name="DisputeCreate" component={DisputeCreatePage} options={{ title: '분쟁 신고' }} />
          <Stack.Screen name="MyDisputes" component={MyDisputesPage} options={{ title: '내 분쟁 신고' }} />

          <Stack.Screen name="Organizer" component={OrganizerDashboardPage} options={{ title: '주최자 센터' }} />
          <Stack.Screen name="EventCreate" component={EventCreatePage} options={{ title: '이벤트 등록' }} />
          <Stack.Screen name="MyEvents" component={MyEventsPage} options={{ title: '내 이벤트' }} />
          <Stack.Screen name="TicketIssue" component={TicketIssuePage} options={{ title: '티켓 발행' }} />
          <Stack.Screen name="TicketExplore" component={TicketExplorePage} options={{ title: '전체 티켓 탐색' }} />
          <Stack.Screen name="OrganizerEventDetail" component={OrganizerEventDetailPage} options={{ title: '이벤트 상세' }} />
          <Stack.Screen name="SalesStatus" component={SalesStatusPage} options={{ title: '판매 현황' }} />
          <Stack.Screen name="CheckInStatus" component={CheckInStatusPage} options={{ title: '체크인 현황' }} />
          <Stack.Screen name="CheckInHome" component={CheckInHomePage} options={{ title: '체크인' }} />
          <Stack.Screen name="CheckInEventList" component={CheckInEventListPage} options={{ title: '체크인 이벤트 목록' }} />
          <Stack.Screen name="EventSettings" component={EventSettingsPage} options={{ title: '이벤트 설정' }} />
          <Stack.Screen name="CheckInManage" component={CheckInManagePage} options={{ title: '체크인 관리' }} />
          <Stack.Screen name="CheckInScan" component={CheckInScanPage} options={{ title: 'QR 스캔' }} />
          <Stack.Screen name="OrganizerProfile" component={OrganizerProfilePage} options={{ title: '내 정보' }} />
          <Stack.Screen name="OrganizerLogout" component={OrganizerLogoutPage} options={{ title: '로그아웃' }} />
                </Stack.Navigator>
              </NavigationContainer>
            </View>
            <BottomNavigation routeName={currentRouteName} onNavigate={navigateFromBottom} />
          </View>
          <View style={styles.appKitHost} pointerEvents="box-none">
            <AppKit />
          </View>
        </View>
      </AppKitProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  webRoot: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
  },
  appFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  webFrame: {
    minWidth: 360,
    maxWidth: 430,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  navigationHost: {
    flex: 1,
    minHeight: 0,
  },
  appKitHost: {
    position: 'absolute',
    height: '100%',
    width: '100%',
  },
});
