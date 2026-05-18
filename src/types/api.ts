export type ApiEnvelope<T> = {
  success: boolean;
  status: number;
  code: string;
  message: string;
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
  };
};

export type ApiErrorEnvelope = {
  success: false;
  status: number;
  code: string;
  message: string;
  path: string;
  errors?: unknown[];
};

export type PageResult<T> = {
  items: T[];
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
  hasNext?: boolean;
};

export type UserProfile = {
  id: string;
  email?: string;
  displayName?: string;
  walletAddress?: string;
  roles: string[];
  status?: string;
};

export type AuthTokens = {
  tokenType?: string;
  accessToken: string;
  refreshToken?: string;
  user?: UserProfile;
};

export type AdminDashboardSummary = {
  activeEventCount: number;
  soldTicketCount: number;
  usedTicketCount: number;
  activeResaleListingCount: number;
};

export type EventSummary = {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  venue: string;
  eventDateTime?: string;
  eventAt?: string;
  ticketPriceWei?: string;
  status: string;
  category?: string;
  soldOut?: boolean;
  totalTicketCount?: number;
  soldTicketCount?: number;
  remainingTicketCount?: number;
};

export type EventDetail = EventSummary & {
  eventId?: string;
  name?: string;
  imageUrl?: string;
  venueDetail?: string;
  description?: string;
  organizerId?: string;
  organizerName?: string;
  flagged?: boolean;
  adminCanceled?: boolean;
  totalTicketCount?: number;
  soldTicketCount?: number;
  remainingTicketCount?: number;
  resaleCount?: number;
  checkInCount?: number;
  policy?: Record<string, unknown>;
};

export type TicketDetail = {
  id?: string;
  ticketId: number | string;
  eventId: string;
  eventName?: string;
  eventTitle?: string;
  seatInfo: string;
  status: string;
  priceWei?: string;
  originalPriceWei?: string;
  ownerAddress?: string;
  ownerWalletAddress?: string;
  contractTokenId?: string;
  usedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  qrImageUrl?: string;
};

export type OrganizerApplication = {
  id?: string;
  userId?: string;
  businessName?: string;
  contactEmail?: string;
  description?: string;
  status?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type UserAdminRecord = UserProfile & {
  createdAt?: string;
  updatedAt?: string;
};

export type DisputeRecord = {
  id?: string;
  status?: string;
  type?: string;
  description?: string;
  resolutionNote?: string;
  reporterId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type BlockchainTransactionRecord = {
  id?: string;
  transactionHash?: string;
  txHash?: string;
  status?: string;
  action?: string;
  contractAddress?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type CheckInRecord = {
  id?: string;
  ticketId?: string;
  status?: string;
  createdAt?: string;
  memo?: string;
  [key: string]: unknown;
};

export type ResaleListing = {
  id?: string;
  listingId?: string;
  ticketId: number | string;
  eventId: string;
  eventName?: string;
  seatInfo?: string;
  price?: string;
  priceWei?: string;
  sellerDisplayName?: string;
  sellerId?: string;
  buyerId?: string;
  status: string;
  purchasedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ResaleTransactionRecord = {
  listingId?: string;
  id?: string;
  ticketId?: string | number;
  eventId?: string;
  sellerId?: string;
  buyerId?: string;
  priceWei?: string | number;
  price?: string;
  status?: string;
  purchasedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};
