export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  chainRpcUrl: import.meta.env.VITE_CHAIN_RPC_URL || "https://public-en-kairos.node.kaia.io",
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 1001),
  trustTicketContractAddress:
    import.meta.env.VITE_TRUST_TICKET_CONTRACT_ADDRESS || "0x3e1B4b3F8B61D12DFe7Ba1d8893Ff4E84bdb378C",
  fanClubMembershipContractAddress:
    import.meta.env.VITE_FANCLUB_MEMBERSHIP_CONTRACT_ADDRESS || "0x73aF7a3B647a81ab7003817c9Cb99137fF6A6b4D",
};
