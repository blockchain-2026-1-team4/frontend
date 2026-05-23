import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabItem = {
  label: string;
  target: string;
  matches: string[];
};

type BottomNavigationProps = {
  routeName?: string;
  onNavigate: (routeName: string) => void;
};

const HIDDEN_ROUTES = new Set(['Landing', 'Auth', 'CheckInScan', 'OrganizerLogout']);

const userTabs: TabItem[] = [
  { label: '홈', target: 'Main', matches: ['Main'] },
  { label: '검색', target: 'EventList', matches: ['EventList', 'EventDetail', 'TicketPurchase', 'PurchaseComplete'] },
  { label: '리셀', target: 'ResaleList', matches: ['ResaleList', 'ResaleDetail'] },
  {
    label: '티켓',
    target: 'MyTickets',
    matches: ['MyTickets', 'TicketDetail', 'TicketQr', 'TicketResaleCreate', 'ResaleRegisterComplete'],
  },
  { label: '마이', target: 'MyPage', matches: ['MyPage', 'DisputeCreate', 'MyDisputes'] },
];

const organizerTabs: TabItem[] = [
  { label: '센터', target: 'Organizer', matches: ['Organizer'] },
  { label: '이벤트', target: 'MyEvents', matches: ['MyEvents', 'EventCreate', 'OrganizerEventDetail', 'TicketIssue', 'TicketExplore', 'SalesStatus', 'EventSettings'] },
  { label: '체크인', target: 'CheckInHome', matches: ['CheckInHome', 'CheckInManage', 'CheckInStatus', 'CheckInScan'] },
  { label: '내 정보', target: 'OrganizerProfile', matches: ['OrganizerProfile', 'OrganizerLogout'] },
];

const userRoutes = new Set(userTabs.flatMap((tab) => tab.matches));
const organizerRoutes = new Set(organizerTabs.flatMap((tab) => tab.matches));

function tabsForRoute(routeName?: string) {
  if (!routeName || HIDDEN_ROUTES.has(routeName)) return null;
  if (organizerRoutes.has(routeName)) return organizerTabs;
  if (userRoutes.has(routeName)) return userTabs;
  return null;
}

export default function BottomNavigation({ routeName, onNavigate }: BottomNavigationProps) {
  const insets = useSafeAreaInsets();
  const tabs = tabsForRoute(routeName);

  if (!tabs) return null;

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 10) },
        Platform.OS === 'web' && styles.webContainer,
      ]}
    >
      {tabs.map((tab) => {
        const active = tab.matches.includes(routeName ?? '');

        return (
          <TouchableOpacity
            key={`${tab.label}-${tab.target}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onNavigate(tab.target)}
            style={[styles.tab, active && styles.activeTab]}
          >
            <View style={[styles.indicator, active && styles.activeIndicator]} />
            <Text numberOfLines={1} style={[styles.label, active && styles.activeLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  webContainer: {
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#EFF6FF',
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  activeIndicator: {
    backgroundColor: '#2563EB',
  },
  label: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  activeLabel: {
    color: '#2563EB',
  },
});
