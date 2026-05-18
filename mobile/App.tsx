import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
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
import OrganizerEventDetailPage from './src/pages/OrganizerEventDetailPage';
import OrganizerProfilePage from './src/pages/OrganizerProfilePage';
import OrganizerLogoutPage from './src/pages/OrganizerLogoutPage';
import SalesStatusPage from './src/pages/SalesStatusPage';
import CheckInStatusPage from './src/pages/CheckInStatusPage';
import EventSettingsPage from './src/pages/EventSettingsPage';
import CheckInManagePage from './src/pages/CheckInManagePage';
import CheckInScanPage from './src/pages/CheckInScanPage';

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Landing">
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

          <Stack.Screen name="Organizer" component={OrganizerDashboardPage} options={{ title: '주최자 센터' }} />
          <Stack.Screen name="EventCreate" component={EventCreatePage} options={{ title: '이벤트 등록' }} />
          <Stack.Screen name="MyEvents" component={MyEventsPage} options={{ title: '내 이벤트' }} />
          <Stack.Screen name="TicketIssue" component={TicketIssuePage} options={{ title: '티켓 발행' }} />
          <Stack.Screen name="OrganizerEventDetail" component={OrganizerEventDetailPage} options={{ title: '이벤트 운영' }} />
          <Stack.Screen name="SalesStatus" component={SalesStatusPage} options={{ title: '판매 현황' }} />
          <Stack.Screen name="CheckInStatus" component={CheckInStatusPage} options={{ title: '체크인 현황' }} />
          <Stack.Screen name="EventSettings" component={EventSettingsPage} options={{ title: '이벤트 설정' }} />
          <Stack.Screen name="CheckInManage" component={CheckInManagePage} options={{ title: '체크인 관리' }} />
          <Stack.Screen name="CheckInScan" component={CheckInScanPage} options={{ title: 'QR 스캔' }} />
          <Stack.Screen name="OrganizerProfile" component={OrganizerProfilePage} options={{ title: '내 정보' }} />
          <Stack.Screen name="OrganizerLogout" component={OrganizerLogoutPage} options={{ title: '로그아웃' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
