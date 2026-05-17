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
    throw new Error("Ethereum wallet not found");
  }

  const provider = new BrowserProvider(ethereum as any);
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
