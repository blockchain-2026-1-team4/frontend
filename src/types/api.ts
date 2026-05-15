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

export type TicketDetail = {
  ticketId: number;
  eventId: string;
  eventName: string;
  seatInfo: string;
  status: string;
  qrImageUrl?: string;
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
