import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type TabIcon = 'home' | 'search' | 'calendar' | 'ticket' | 'qr' | 'grid' | 'user' | 'resale' | 'dispute';

type TabItem = {
  label: string;
  target: string;
  matches: string[];
  icon: TabIcon;
};

type BottomNavigationProps = {
  routeName?: string;
  onNavigate: (routeName: string) => void;
};

const HIDDEN_ROUTES = new Set(['Auth', 'CheckInScan']);

const userTabs: TabItem[] = [
  { label: '\uD648', target: 'Main', matches: ['Main'], icon: 'home' },
  { label: '\uD0D0\uC0C9', target: 'EventList', matches: ['EventList', 'EventDetail', 'TicketPurchase', 'PurchaseComplete'], icon: 'search' },
  {
    label: '\uB0B4 \uD2F0\uCF13',
    target: 'MyTicketFlow',
    matches: ['MyTicketFlow', 'MyTickets', 'TicketDetail', 'TicketQr', 'TicketResaleCreate', 'ResaleRegisterComplete'],
    icon: 'ticket',
  },
  { label: '\uB0B4 \uC815\uBCF4', target: 'MyPage', matches: ['MyPage', 'ResaleList', 'ResaleDetail', 'MyDisputes', 'DisputeCreate'], icon: 'user' },
];

const organizerTabs: TabItem[] = [
  { label: '\uD648', target: 'Organizer', matches: ['Organizer'], icon: 'home' },
  { label: '\uC774\uBCA4\uD2B8', target: 'MyEvents', matches: ['MyEvents', 'EventCreate', 'OrganizerEventDetail', 'EventSettings'], icon: 'calendar' },
  { label: '\uD2F0\uCF13 \uC6B4\uC601', target: 'SalesStatus', matches: ['SalesStatus', 'TicketExplore', 'TicketIssue'], icon: 'ticket' },
  { label: '\uCCB4\uD06C\uC778', target: 'CheckInHome', matches: ['CheckInHome', 'CheckInEventList', 'CheckInManage', 'CheckInStatus', 'CheckInScan'], icon: 'grid' },
  { label: '\uB0B4 \uC815\uBCF4', target: 'OrganizerProfile', matches: ['OrganizerProfile'], icon: 'user' },
];

const userRoutes = new Set(userTabs.flatMap((tab) => tab.matches));
const organizerRoutes = new Set(organizerTabs.flatMap((tab) => tab.matches));

function tabsForRoute(routeName?: string) {
  if (!routeName || HIDDEN_ROUTES.has(routeName)) return null;
  if (organizerRoutes.has(routeName)) return organizerTabs;
  if (userRoutes.has(routeName)) return userTabs;
  return null;
}

function NavIcon({ name, color }: { name: TabIcon; color: string }) {
  if (Platform.OS === 'web') return <WebNavIcon name={name} color={color} />;

  const common = {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
  };

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {name === 'home' ? (
        <>
          <Path {...common} d="M3 10.8 12 3l9 7.8" />
          <Path {...common} d="M5.5 10v10h13V10" />
          <Path {...common} d="M9.5 20v-6h5v6" />
        </>
      ) : null}
      {name === 'calendar' ? (
        <>
          <Rect {...common} x={4} y={5} width={16} height={15} rx={2.5} />
          <Path {...common} d="M8 3v4m8-4v4M4 10h16" />
          <Path {...common} d="M8 14h3m2 0h3m-8 3h3" />
        </>
      ) : null}
      {name === 'search' ? (
        <>
          <Circle {...common} cx={11} cy={11} r={6} />
          <Path {...common} d="m16 16 4 4" />
        </>
      ) : null}
      {name === 'ticket' ? (
        <>
          <Path {...common} d="M4 8a3 3 0 0 1 0 6v3h16v-3a3 3 0 0 1 0-6V5H4v3Z" />
          <Path {...common} d="M9 9h.01M9 13h.01M13 11h5" />
        </>
      ) : null}
      {name === 'qr' ? (
        <>
          <Path {...common} d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
          <Path {...common} d="M14 14h2v2h-2zM19 14h1v6h-6v-2h3M14 20h1" />
        </>
      ) : null}
      {name === 'grid' ? (
        <>
          <Rect {...common} x={4} y={4} width={6} height={6} rx={1.2} />
          <Rect {...common} x={14} y={4} width={6} height={6} rx={1.2} />
          <Rect {...common} x={4} y={14} width={6} height={6} rx={1.2} />
          <Rect {...common} x={14} y={14} width={6} height={6} rx={1.2} />
        </>
      ) : null}
      {name === 'user' ? (
        <>
          <Circle {...common} cx={12} cy={8} r={4} />
          <Path {...common} d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </>
      ) : null}
      {name === 'resale' ? (
        <>
          <Path {...common} d="M7 7h10l3 5-3 5H7l-3-5 3-5Z" />
          <Path {...common} d="M9 12h6m-2-2 2 2-2 2" />
        </>
      ) : null}
      {name === 'dispute' ? (
        <>
          <Path {...common} d="M5 5h14v11H8l-3 3V5Z" />
          <Path {...common} d="M9 9h6M9 12h4" />
        </>
      ) : null}
    </Svg>
  );
}

function webPath(d: string, color: string, key: string) {
  return React.createElement('path', {
    key,
    d,
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
  });
}

function webCircle(props: { cx: number; cy: number; r: number; color: string; key: string }) {
  return React.createElement('circle', {
    key: props.key,
    cx: props.cx,
    cy: props.cy,
    r: props.r,
    fill: 'none',
    stroke: props.color,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
  });
}

function webRect(props: { x: number; y: number; width: number; height: number; rx?: number; color: string; key: string }) {
  return React.createElement('rect', {
    key: props.key,
    x: props.x,
    y: props.y,
    width: props.width,
    height: props.height,
    rx: props.rx,
    fill: 'none',
    stroke: props.color,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
  });
}

function WebNavIcon({ name, color }: { name: TabIcon; color: string }) {
  const children: React.ReactNode[] = [];

  if (name === 'home') {
    children.push(
      webPath('M3 10.8 12 3l9 7.8', color, 'home-roof'),
      webPath('M5.5 10v10h13V10', color, 'home-body'),
      webPath('M9.5 20v-6h5v6', color, 'home-door'),
    );
  }
  if (name === 'calendar') {
    children.push(
      webRect({ x: 4, y: 5, width: 16, height: 15, rx: 2.5, color, key: 'calendar-box' }),
      webPath('M8 3v4m8-4v4M4 10h16', color, 'calendar-head'),
      webPath('M8 14h3m2 0h3m-8 3h3', color, 'calendar-days'),
    );
  }
  if (name === 'search') {
    children.push(
      webCircle({ cx: 11, cy: 11, r: 6, color, key: 'search-circle' }),
      webPath('m16 16 4 4', color, 'search-line'),
    );
  }
  if (name === 'ticket') {
    children.push(
      webPath('M4 8a3 3 0 0 1 0 6v3h16v-3a3 3 0 0 1 0-6V5H4v3Z', color, 'ticket-body'),
      webPath('M9 9h.01M9 13h.01M13 11h5', color, 'ticket-lines'),
    );
  }
  if (name === 'qr') {
    children.push(
      webPath('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z', color, 'qr-boxes'),
      webPath('M14 14h2v2h-2zM19 14h1v6h-6v-2h3M14 20h1', color, 'qr-detail'),
    );
  }
  if (name === 'grid') {
    children.push(
      webRect({ x: 4, y: 4, width: 6, height: 6, rx: 1.2, color, key: 'grid-1' }),
      webRect({ x: 14, y: 4, width: 6, height: 6, rx: 1.2, color, key: 'grid-2' }),
      webRect({ x: 4, y: 14, width: 6, height: 6, rx: 1.2, color, key: 'grid-3' }),
      webRect({ x: 14, y: 14, width: 6, height: 6, rx: 1.2, color, key: 'grid-4' }),
    );
  }
  if (name === 'user') {
    children.push(
      webCircle({ cx: 12, cy: 8, r: 4, color, key: 'user-head' }),
      webPath('M4.5 21a7.5 7.5 0 0 1 15 0', color, 'user-body'),
    );
  }
  if (name === 'resale') {
    children.push(
      webPath('M7 7h10l3 5-3 5H7l-3-5 3-5Z', color, 'resale-tag'),
      webPath('M9 12h6m-2-2 2 2-2 2', color, 'resale-arrow'),
    );
  }
  if (name === 'dispute') {
    children.push(
      webPath('M5 5h14v11H8l-3 3V5Z', color, 'dispute-box'),
      webPath('M9 9h6M9 12h4', color, 'dispute-lines'),
    );
  }

  return React.createElement(
    'svg',
    {
      width: 22,
      height: 22,
      viewBox: '0 0 24 24',
      style: { display: 'block', flexShrink: 0 },
      'aria-hidden': true,
      focusable: false,
    },
    children,
  );
}

export default function BottomNavigation({ routeName, onNavigate }: BottomNavigationProps) {
  const insets = useSafeAreaInsets();
  const tabs = tabsForRoute(routeName);

  if (!tabs) return null;

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 18) },
        Platform.OS === 'web' && styles.webContainer,
      ]}
    >
      {tabs.map((tab) => {
        const active = tab.matches.includes(routeName ?? '');
        const color = active ? '#534AB7' : '#9CA3AF';

        return (
          <TouchableOpacity
            key={`${tab.label}-${tab.target}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onNavigate(tab.target)}
            style={styles.tab}
          >
            <NavIcon name={tab.icon} color={color} />
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
    borderTopColor: '#E5E7EB',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 0,
    paddingTop: 9,
  },
  webContainer: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '800',
  },
  activeLabel: {
    color: '#534AB7',
  },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  activeIndicator: {
    backgroundColor: '#534AB7',
  },
});
