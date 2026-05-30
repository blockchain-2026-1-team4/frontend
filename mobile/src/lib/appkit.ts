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
  11155111: { name: 'Sepolia', currencyName: 'Sepolia Ether', symbol: 'ETH' },
};

function resolveChainMeta(chainId: number): ChainMeta {
  return CHAIN_META[chainId] ?? { name: `Chain ${chainId}`, currencyName: 'Ether', symbol: 'ETH' };
}

const meta = resolveChainMeta(config.chainId);

// Single network used for both WalletConnect sessions and on-chain operations.
// EXPO_PUBLIC_CHAIN_ID controls which chain is requested in the WC session proposal.
// Currently set to Sepolia (11155111) for login-flow verification — MetaMask Mobile
// includes Sepolia by default, avoiding network-add prompts during testing.
// Switch back to Kaia Kairos (1001) by updating EXPO_PUBLIC_CHAIN_ID in .env.
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

const ethersAdapter = new EthersAdapter();

// Explicit namespace sent in the WC session proposal's optionalNamespaces.
// AppKit v2 always uses optionalNamespaces (never requiredNamespaces), so MetaMask
// can still choose to exclude any chain. However, providing this override ensures:
//  - Only the target chain appears in optionalNamespaces (no MetaMask-default bloat)
//  - wallet_addEthereumChain and wallet_switchEthereumChain are always in the method list
//  - The RPC URL is embedded in the proposal for wallets that use it
// If MetaMask excludes the chain from the session (e.g. test networks hidden in settings),
// ensureWalletNetwork in AuthPage falls back to wallet_addEthereumChain.
const wcNamespaceOverride = {
  chains: {
    eip155: [`eip155:${config.chainId}`],
  },
  methods: {
    eip155: [
      'personal_sign',
      'eth_accounts',
      'eth_requestAccounts',
      'eth_sendTransaction',
      'eth_signTransaction',
      'eth_sign',
      'eth_signTypedData',
      'eth_signTypedData_v3',
      'eth_signTypedData_v4',
      'wallet_switchEthereumChain',
      'wallet_addEthereumChain',
      'wallet_watchAsset',
      'wallet_getPermissions',
      'wallet_requestPermissions',
    ],
  },
  events: {
    eip155: ['accountsChanged', 'chainChanged'],
  },
  rpcMap: {
    [`eip155:${config.chainId}`]: config.chainRpcUrl,
  },
};

export const appKit = createAppKit({
  projectId: config.reownProjectId || fallbackProjectId,
  networks: appKitNetworks,
  defaultNetwork: walletNetwork,
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
  // universalProviderConfigOverride: wcNamespaceOverride,  // DIAG: disabled for A/B comparison
});

console.log('[ReownConfig]', {
  networks: appKitNetworks,
  defaultNetwork: walletNetwork,
  wcNamespaceOverride,
});
