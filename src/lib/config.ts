export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  chainRpcUrl: import.meta.env.VITE_CHAIN_RPC_URL || "https://public-en-kairos.node.kaia.io",
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 1001),
  trustTicketContractAddress:
    import.meta.env.VITE_TRUST_TICKET_CONTRACT_ADDRESS || "0x790aa2356BAb711998faA9c58dCDD47205e6683d",
  fanClubMembershipContractAddress:
    import.meta.env.VITE_FANCLUB_MEMBERSHIP_CONTRACT_ADDRESS || "0xCA64026A80a9295aE1829DeDcb143dB23C3A3300",
};
