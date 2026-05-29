import '@walletconnect/react-native-compat';

import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import { createAppKit, type AppKitNetwork } from '@reown/appkit-react-native';
import { config } from './config';
import { appKitStorage } from './appkitStorage';

const fallbackProjectId = '00000000000000000000000000000000';

export const isWalletConnectConfigured = Boolean(config.reownProjectId);

type ChainMeta = { name: string; currencyName: string; symbol: string };

const CHAIN_META: Record<number, ChainMeta> = {
  1: { name: 'Ethereum', currencyName: 'Ether', symbol: 'ETH' },
  1001: { name: 'Kaia Kairos', currencyName: 'KAIA', symbol: 'KAIA' },
  11155111: { name: 'Ethereum Sepolia', currencyName: 'Sepolia ETH', symbol: 'ETH' },
};

function chainMeta(chainId: number): ChainMeta {
  return CHAIN_META[chainId] ?? { name: `Chain ${chainId}`, currencyName: 'Ether', symbol: 'ETH' };
}

const meta = chainMeta(config.chainId);

export const walletNetwork: AppKitNetwork = {
  id: config.chainId,
  name: meta.name,
  chainNamespace: 'eip155',
  caipNetworkId: `eip155:${config.chainId}`,
  nativeCurrency: {
    name: meta.currencyName,
    symbol: meta.symbol,
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [config.chainRpcUrl],
    },
  },
  testnet: config.chainId !== 1,
};

// WalletConnect v2 places the defaultNetwork in requiredNamespaces of the session
// proposal. MetaMask Mobile stalls at the fox loading screen when it receives an
// unknown required chain (e.g. Hardhat 31337). Kairos 1001 is the same network
// used by the web client, so we always ensure it is present as the first (default)
// network. personal_sign for nonce auth is chain-agnostic — the wallet address is
// identical on every EVM chain.
const kairosNetwork: AppKitNetwork = {
  id: 1001,
  name: 'Kaia Kairos',
  chainNamespace: 'eip155',
  caipNetworkId: 'eip155:1001',
  nativeCurrency: { name: 'KAIA', symbol: 'KAIA', decimals: 18 },
  rpcUrls: { default: { http: ['https://public-en-kairos.node.kaia.io'] } },
  testnet: true,
};

// If the configured chain is already Kairos, avoid duplicating it in the list.
const appKitNetworks: AppKitNetwork[] =
  config.chainId === 1001 ? [walletNetwork] : [kairosNetwork, walletNetwork];

const ethersAdapter = new EthersAdapter();

export const appKit = createAppKit({
  projectId: config.reownProjectId || fallbackProjectId,
  networks: appKitNetworks,
  defaultNetwork: appKitNetworks[0],
  adapters: [ethersAdapter],
  storage: appKitStorage,
  enableAnalytics: false,
  logger: 'silent',
  metadata: {
    name: config.dappName,
    description: `${config.dappName} wallet authentication`,
    url: config.dappUrl,
    icons: [`${config.dappUrl.replace(/\/$/, '')}/icon.png`],
    redirect: {
      native: `${config.appScheme}://`,
    },
  },
});
