import { BrowserProvider, Contract, getBytes } from 'ethers';
import { Platform } from 'react-native';
import { config } from '../config';
import { trustTicketAbi } from './abi';

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }, chainId?: string) => Promise<unknown>;
};

type TransactionReceiptLike = { hash?: string | null; transactionHash?: string | null };

function getInjectedProvider(): EthereumProvider | null {
  if (Platform.OS !== 'web') return null;
  const global = globalThis as typeof globalThis & {
    ethereum?: EthereumProvider;
    window?: { ethereum?: EthereumProvider };
  };
  return global.ethereum ?? global.window?.ethereum ?? null;
}

function getWalletProvider(provider?: unknown): EthereumProvider {
  const candidate = provider as EthereumProvider | null | undefined;
  if (candidate?.request) return candidate;
  const injected = getInjectedProvider();
  if (injected?.request) return injected;
  throw new Error('MetaMask 지갑을 찾을 수 없습니다. 먼저 지갑으로 로그인하거나 연결해 주세요.');
}

function requireContractAddress() {
  if (!config.trustTicketContractAddress) {
    throw new Error('TrustTicket 컨트랙트 주소가 설정되지 않았습니다.');
  }
  return config.trustTicketContractAddress;
}

function chainHex() {
  return `0x${config.chainId.toString(16)}`;
}

function walletErrorCode(error: any) {
  return error?.code ?? error?.error?.code ?? error?.info?.error?.code ?? error?.data?.originalError?.code;
}

function isUnknownChainError(error: any) {
  const code = walletErrorCode(error);
  if (code === 4902 || code === '4902') return true;

  const message = [
    error?.message,
    error?.error?.message,
    error?.info?.error?.message,
    error?.data?.originalError?.message,
  ]
    .filter(Boolean)
    .join(' ');
  return /unrecognized chain|unknown chain|wallet_addEthereumChain/i.test(message);
}

async function addConfiguredChain(provider: EthereumProvider, target: string) {
  await provider.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: target,
      chainName: 'Kaia Kairos Testnet',
      nativeCurrency: { name: 'KAIA', symbol: 'KAIA', decimals: 18 },
      rpcUrls: [config.chainRpcUrl],
      blockExplorerUrls: ['https://kairos.kaiascan.io'],
    }],
  });
}

async function ensureChain(provider: EthereumProvider) {
  const target = chainHex();
  const current = await provider.request({ method: 'eth_chainId' }).catch(() => null);
  if (typeof current === 'string' && current.toLowerCase() === target.toLowerCase()) return;

  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: target }] });
  } catch (error: any) {
    if (!isUnknownChainError(error)) throw error;
    await addConfiguredChain(provider, target);
    const updated = await provider.request({ method: 'eth_chainId' }).catch(() => null);
    if (typeof updated !== 'string' || updated.toLowerCase() !== target.toLowerCase()) {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: target }] });
    }
  }
}

async function walletSigner(provider?: unknown) {
  const walletProvider = getWalletProvider(provider);
  await ensureChain(walletProvider);
  await walletProvider.request({ method: 'eth_requestAccounts' });
  const browserProvider = new BrowserProvider(walletProvider as any, config.chainId);
  return browserProvider.getSigner();
}

async function contractWithSigner(provider?: unknown) {
  const signer = await walletSigner(provider);
  return new Contract(requireContractAddress(), trustTicketAbi, signer);
}

async function waitForHash(tx: any) {
  const receipt = await tx.wait();
  const typedReceipt = receipt as TransactionReceiptLike | null;
  const hash = typedReceipt?.hash ?? typedReceipt?.transactionHash ?? tx.hash;
  if (!hash) throw new Error('트랜잭션 해시를 확인하지 못했습니다.');
  return hash;
}

export async function purchaseTicketOnChain(provider: unknown, tokenId: string, valueWei: string) {
  if (!tokenId || BigInt(tokenId) === 0n) throw new Error('티켓이 아직 온체인에 발행되지 않았습니다. 주최자에게 문의하세요.');
  const contract = await contractWithSigner(provider);
  const tx = await contract.purchaseTicket(BigInt(tokenId), { value: BigInt(valueWei) });
  return waitForHash(tx);
}

export async function listTicketOnChain(provider: unknown, tokenId: string, resalePriceWei: string) {
  const contract = await contractWithSigner(provider);
  const tx = await contract.listTicket(BigInt(tokenId), BigInt(resalePriceWei));
  return waitForHash(tx);
}

export async function purchaseResaleTicketOnChain(provider: unknown, tokenId: string, valueWei: string) {
  const contract = await contractWithSigner(provider);
  const tx = await contract.purchaseResaleTicket(BigInt(tokenId), { value: BigInt(valueWei) });
  return waitForHash(tx);
}

export async function cancelListingOnChain(provider: unknown, tokenId: string) {
  const contract = await contractWithSigner(provider);
  const tx = await contract.cancelListing(BigInt(tokenId));
  return waitForHash(tx);
}

export async function signCheckInMessageHash(provider: unknown, hashHex: string) {
  const signer = await walletSigner(provider);
  return {
    address: await signer.getAddress(),
    signature: await signer.signMessage(getBytes(hashHex)),
  };
}
