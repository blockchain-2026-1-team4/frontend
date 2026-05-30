import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Storage } from '@reown/appkit-react-native';

const STORAGE_PREFIX = '@trustticket:appkit:';
const WALLET_STORAGE_PREFIXES = [
  STORAGE_PREFIX,       // '@trustticket:appkit:' — AppKit 커스텀 storage 어댑터
  '@appkit/',
  '@reown',
  '@walletconnect',
  'walletconnect',
  'wc@',
  'wc_',               // WalletConnect v2 일부 구현체가 사용
  '@w3m',              // WalletConnect Modal v2
  'W3M_',
  'WALLETCONNECT_',    // 대문자 접두사 변형
];
const WALLET_STORAGE_KEYS = ['WALLETCONNECT_DEEPLINK_CHOICE'];

function keyFor(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

function stripPrefix(key: string) {
  return key.replace(STORAGE_PREFIX, '');
}

function decodeValue<T>(value: string | null): T | undefined {
  if (value === null) return undefined;

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

export const appKitStorage: Storage = {
  async getKeys() {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter((key) => key.startsWith(STORAGE_PREFIX)).map(stripPrefix);
  },

  async getEntries<T = any>() {
    const keys = await this.getKeys();
    const entries = await AsyncStorage.multiGet(keys.map(keyFor));

    return entries.map(([key, value]) => [
      stripPrefix(key),
      decodeValue<T>(value),
    ]) as [string, T][];
  },

  async getItem<T = any>(key: string) {
    const value = await AsyncStorage.getItem(keyFor(key));
    return decodeValue<T>(value);
  },

  async setItem<T = any>(key: string, value: T) {
    await AsyncStorage.setItem(keyFor(key), JSON.stringify(value));
  },

  async removeItem(key: string) {
    await AsyncStorage.removeItem(keyFor(key));
  },
};

export async function clearWalletSessionStorage() {
  const keys = await AsyncStorage.getAllKeys();
  const lk = (k: string) => k.toLowerCase();
  const walletKeys = keys.filter((key) =>
    WALLET_STORAGE_KEYS.includes(key) ||
    WALLET_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
    lk(key).includes('walletconnect') ||
    lk(key).includes('reown') ||
    // '@trustticket:appkit:' 이외의 appkit 키 (예: 서드파티 캐시)
    (lk(key).includes('appkit') && !key.startsWith(STORAGE_PREFIX))
  );

  if (walletKeys.length > 0) {
    console.log('[WalletStorage] Clearing', walletKeys.length, 'wallet keys:', walletKeys);
    await AsyncStorage.multiRemove(walletKeys);
    console.log('[WalletStorage] Done');
  } else {
    console.log('[WalletStorage] No wallet keys to clear');
  }
}
