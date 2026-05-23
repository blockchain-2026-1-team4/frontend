import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Storage } from '@reown/appkit-react-native';

const STORAGE_PREFIX = '@trustticket:appkit:';
const WALLET_STORAGE_PREFIXES = [
  STORAGE_PREFIX,
  '@appkit/',
  '@reown',
  '@walletconnect',
  'walletconnect',
  'wc@',
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
  const walletKeys = keys.filter((key) =>
    WALLET_STORAGE_KEYS.includes(key) ||
    WALLET_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
    key.toLowerCase().includes('walletconnect')
  );

  if (walletKeys.length > 0) {
    await AsyncStorage.multiRemove(walletKeys);
  }
}
