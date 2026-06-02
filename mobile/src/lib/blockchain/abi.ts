export const trustTicketAbi = [
  'function purchaseTicket(uint256 tokenId) payable',
  'function listTicket(uint256 tokenId, uint256 resalePrice)',
  'function cancelListing(uint256 tokenId)',
  'function purchaseResaleTicket(uint256 tokenId) payable',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getTicketInfo(uint256 tokenId) view returns ((uint256 tokenId,uint256 eventId,string seatInfo,uint256 originalPrice,bool used,bool listed))',
] as const;
