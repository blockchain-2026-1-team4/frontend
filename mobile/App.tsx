import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LandingPage from './src/pages/LandingPage';
import AuthPage from './src/pages/AuthPage';
import UserHomePage from './src/pages/UserHomePage';
import EventDetailPage from './src/pages/EventDetailPage';
import ResaleListPage from './src/pages/ResaleListPage';
import MyPage from './src/pages/MyPage';
import MyTicketsPage from './src/pages/MyTicketsPage';
import TicketDetailPage from './src/pages/TicketDetailPage';
import TicketResaleCreatePage from './src/pages/TicketResaleCreatePage';
import OrganizerDashboardPage from './src/pages/OrganizerDashboardPage';
import EventCreatePage from './src/pages/EventCreatePage';
import MyEventsPage from './src/pages/MyEventsPage';

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Landing">
          {/* Auth Flow */}
          <Stack.Screen name="Landing" component={LandingPage} options={{ headerShown: false }} />
          <Stack.Screen name="Auth" component={AuthPage} options={{ title: '인증' }} />

          {/* User Flows */}
          <Stack.Screen name="Main" component={UserHomePage} options={{ title: 'Trust Ticket' }} />
          <Stack.Screen name="EventDetail" component={EventDetailPage} options={{ title: '이벤트 상세' }} />
          <Stack.Screen name="ResaleList" component={ResaleListPage} options={{ title: '리셀 목록' }} />
          <Stack.Screen name="MyPage" component={MyPage} options={{ title: '마이페이지' }} />
          <Stack.Screen name="MyTickets" component={MyTicketsPage} options={{ title: '내 티켓 관리' }} />
          <Stack.Screen name="TicketDetail" component={TicketDetailPage} options={{ title: '티켓 상세' }} />
          <Stack.Screen name="TicketResaleCreate" component={TicketResaleCreatePage} options={{ title: '리셀 판매 등록' }} />

          {/* Organizer Flows */}
          <Stack.Screen name="Organizer" component={OrganizerDashboardPage} options={{ title: '주최자 대시보드' }} />
          <Stack.Screen name="EventCreate" component={EventCreatePage} options={{ title: '이벤트 등록' }} />
          <Stack.Screen name="MyEvents" component={MyEventsPage} options={{ title: '내 이벤트' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
