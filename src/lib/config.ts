export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  chainRpcUrl: import.meta.env.VITE_CHAIN_RPC_URL || "http://127.0.0.1:8545",
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 31337),
  trustTicketContractAddress:
    import.meta.env.VITE_TRUST_TICKET_CONTRACT_ADDRESS || "",
};
