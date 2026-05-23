import '@walletconnect/react-native-compat';

import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import { createAppKit, type AppKitNetwork } from '@reown/appkit-react-native';
import { config } from './config';
import { appKitStorage } from './appkitStorage';

const fallbackProjectId = '00000000000000000000000000000000';

export const isWalletConnectConfigured = Boolean(config.reownProjectId);

export const walletNetwork: AppKitNetwork = {
  id: config.chainId,
  name: config.chainId === 1 ? 'Ethereum' : `Chain ${config.chainId}`,
  chainNamespace: 'eip155',
  caipNetworkId: `eip155:${config.chainId}`,
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [config.chainRpcUrl],
    },
  },
  testnet: config.chainId !== 1,
};

const ethersAdapter = new EthersAdapter();

export const appKit = createAppKit({
  projectId: config.reownProjectId || fallbackProjectId,
  networks: [walletNetwork],
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
});
