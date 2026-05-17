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

export type EventSummary = {
  id: string;
  title: string;
  description?: string;
  venue: string;
  eventDateTime: string;
  status: string;
  category?: string;
  soldOut?: boolean;
};

export type EventDetail = EventSummary & {
  eventId?: string;
  name?: string;
  imageUrl?: string;
  venueDetail?: string;
  description?: string;
  totalTicketCount?: number;
  soldTicketCount?: number;
  remainingTicketCount?: number;
  resaleCount?: number;
  checkInCount?: number;
  policy?: Record<string, unknown>;
};

export type TicketDetail = {
  ticketId: number;
  eventId: string;
  eventName: string;
  seatInfo: string;
  status: string;
  qrImageUrl?: string;
};

export type OrganizerApplication = {
  id?: string;
  userId?: string;
  status?: string;
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
  [key: string]: unknown;
};

export type BlockchainTransactionRecord = {
  id?: string;
  txHash?: string;
  status?: string;
  action?: string;
  contractAddress?: string;
  createdAt?: string;
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
  listingId: string;
  ticketId: number;
  eventId: string;
  eventName: string;
  seatInfo: string;
  price: string;
  sellerDisplayName?: string;
  status: string;
};
