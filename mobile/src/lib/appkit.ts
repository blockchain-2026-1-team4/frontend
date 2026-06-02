import '@walletconnect/react-native-compat';

import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import { createAppKit, type AppKitNetwork } from '@reown/appkit-react-native';
import { config } from './config';
import { appKitStorage } from './appkitStorage';

type ChainMeta = { name: string; currencyName: string; symbol: string };

const CHAIN_META: Record<number, ChainMeta> = {
  1: { name: 'Ethereum', currencyName: 'Ether', symbol: 'ETH' },
  1001: { name: 'Kaia Kairos', currencyName: 'KAIA', symbol: 'KAIA' },
  11155111: { name: 'Sepolia', currencyName: 'Sepolia Ether', symbol: 'ETH' },
};

function resolveChainMeta(chainId: number): ChainMeta {
  return CHAIN_META[chainId] ?? { name: `Chain ${chainId}`, currencyName: 'Ether', symbol: 'ETH' };
}

const meta = resolveChainMeta(config.chainId);

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

console.log('[WalletNetwork]', {
  chainId: config.chainId,
  chainIdType: typeof config.chainId,
  chainRpcUrl: config.chainRpcUrl,
  caipNetworkId: walletNetwork.caipNetworkId,
  networkId: walletNetwork.id,
});

const appKitNetworks = [walletNetwork];

const walletConnectMethods = [
  'eth_accounts',
  'eth_requestAccounts',
  'personal_sign',
  'eth_sendTransaction',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
];

const ethersAdapter = new EthersAdapter();

export const appKit = createAppKit({
  projectId: config.reownProjectId,
  networks: appKitNetworks,
  defaultNetwork: walletNetwork,
  adapters: [ethersAdapter],
  storage: appKitStorage,
  enableAnalytics: false,
  features: {
    swaps: false,
    onramp: false,
  },
  universalProviderConfigOverride: {
    methods: {
      eip155: walletConnectMethods,
    },
  },
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

console.log('[ReownConfig]', {
  networks: appKitNetworks,
  defaultNetwork: walletNetwork,
});
