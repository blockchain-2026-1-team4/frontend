import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  getBytes,
  parseEther,
} from "ethers";
import { config } from "../config";
import { trustTicketAbi } from "./abi";

function getAddress() {
  if (!config.trustTicketContractAddress) {
    throw new Error("VITE_TRUST_TICKET_CONTRACT_ADDRESS is required");
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
  if (code === 4902 || code === "4902") {
    return true;
  }

  const message = [
    error?.message,
    error?.error?.message,
    error?.info?.error?.message,
    error?.data?.originalError?.message,
  ]
    .filter(Boolean)
    .join(" ");
  return /unrecognized chain|unknown chain|wallet_addEthereumChain/i.test(message);
}

async function addConfiguredChain(provider: BrowserProvider, target: string) {
  await provider.send("wallet_addEthereumChain", [{
    chainId: target,
    chainName: "Kaia Kairos Testnet",
    nativeCurrency: { name: "KAIA", symbol: "KAIA", decimals: 18 },
    rpcUrls: [config.chainRpcUrl],
    blockExplorerUrls: ["https://kairos.kaiascan.io"],
  }]);
}

async function ensureConfiguredChain(provider: BrowserProvider) {
  const target = chainHex();
  const current = await provider.send("eth_chainId", []);
  if (typeof current === "string" && current.toLowerCase() === target.toLowerCase()) {
    return;
  }

  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: target }]);
  } catch (error: any) {
    if (!isUnknownChainError(error)) {
      throw error;
    }
    await addConfiguredChain(provider, target);
    const updated = await provider.send("eth_chainId", []).catch(() => null);
    if (typeof updated !== "string" || updated.toLowerCase() !== target.toLowerCase()) {
      await provider.send("wallet_switchEthereumChain", [{ chainId: target }]);
    }
  }
}

const readProvider = new JsonRpcProvider(config.chainRpcUrl, config.chainId);

export const chainRead = {

  async getEventInfo(eventId: bigint) {
    const contract = new Contract(getAddress(), trustTicketAbi, readProvider);
    return contract.getEventInfo(eventId);
  },

  async getTicketInfo(tokenId: bigint) {
    const contract = new Contract(getAddress(), trustTicketAbi, readProvider);
    return contract.getTicketInfo(tokenId);
  },

  async getTicketsByOwner(owner: string) {
    const contract = new Contract(getAddress(), trustTicketAbi, readProvider);
    return contract.getTicketsByOwner(owner);
  },

  async verifySignedTicket(
    tokenId: bigint,
    claimedOwner: string,
    expiresAt: bigint,
    signature: string,
  ) {
    const contract = new Contract(getAddress(), trustTicketAbi, readProvider);
    return contract.verifySignedTicket(tokenId, claimedOwner, expiresAt, signature);
  },
};

export async function withWalletContract() {
  const { ethereum } = window as Window & { ethereum?: unknown };
  if (!ethereum) {
    throw new Error("브라우저 지갑을 찾을 수 없습니다. Chrome MetaMask 확장 프로그램을 켜고 다시 시도해주세요.");
  }

  const provider = new BrowserProvider(ethereum as any);
  await ensureConfiguredChain(provider);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const contract = new Contract(getAddress(), trustTicketAbi, signer);

  return {
    provider,
    signer,
    contract,
  };
}

export async function signCheckInMessageHash(hashHex: string) {
  const { signer } = await withWalletContract();
  const bytes = getBytes(hashHex);
  return signer.signMessage(bytes);
}

export async function buyTicketOnChain(tokenId: bigint, priceEth: string) {
  const { contract } = await withWalletContract();
  const tx = await contract.purchaseTicket(tokenId, {
    value: parseEther(priceEth),
  });
  return tx.wait();
}

async function waitForHash(tx: any) {
  const receipt = await tx.wait();
  const hash = receipt?.hash ?? receipt?.transactionHash ?? tx.hash;
  if (!hash) {
    throw new Error("트랜잭션 해시를 확인하지 못했습니다.");
  }
  return hash as string;
}

export async function addOrganizerOnChain(organizerWallet: string) {
  if (!organizerWallet?.trim()) {
    throw new Error("주최자 신청자의 지갑 주소가 없습니다.");
  }
  const { contract } = await withWalletContract();
  const tx = await contract.addOrganizer(organizerWallet);
  return waitForHash(tx);
}
