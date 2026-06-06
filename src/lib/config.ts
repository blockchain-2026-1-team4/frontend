export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  chainRpcUrl: import.meta.env.VITE_CHAIN_RPC_URL || "https://public-en-kairos.node.kaia.io",
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 1001),
  trustTicketContractAddress:
    import.meta.env.VITE_TRUST_TICKET_CONTRACT_ADDRESS || "0xce763CEefFA79695a2A2499a80ff40A27a4678f5",
  fanClubMembershipContractAddress:
    import.meta.env.VITE_FANCLUB_MEMBERSHIP_CONTRACT_ADDRESS || "0x0AB82F1545D83f46a5a97470215b5E8Ca6226507",
};
