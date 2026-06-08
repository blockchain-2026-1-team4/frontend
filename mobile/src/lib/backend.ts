import type {
  AuthTokens,
  BlockchainTransactionRecord,
  CheckInRecord,
  DisputeRecord,
  EventDetail,
  EventValidatorRecord,
  EventSummary,
  OrganizerApplication,
  PageResult,
  ResaleListing,
  TicketQr,
  TicketDetail,
  UserAdminRecord,
  UserProfile,
  WalletNonce,
} from "../types/api";
import { Platform } from "react-native";
import { setAccessToken } from "./auth";
import { http, unwrap } from "./http";

export const backendApi = {
  async registerEmail(payload: { email: string; password: string; displayName: string }) {
    const data = await unwrap<AuthTokens>(http.post("/auth/email/register", payload));
    if (data.accessToken) {
      await setAccessToken(data.accessToken);
    }
    return data;
  },

  async loginEmail(payload: { email: string; password: string }) {
    const data = await unwrap<AuthTokens>(http.post("/auth/email/login", payload));
    if (data.accessToken) {
      await setAccessToken(data.accessToken);
    }
    return data;
  },

  async loginDevAccount(userId: string) {
    const data = await unwrap<AuthTokens>(http.post("/auth/dev/login", { userId }));
    if (data.accessToken) {
      await setAccessToken(data.accessToken);
    }
    return data;
  },

  async issueWalletNonce(payload: { walletAddress: string }) {
    return unwrap<WalletNonce>(http.post("/auth/wallet/nonce", payload));
  },

  async loginWallet(payload: { walletAddress: string; nonce: string; signature: string }) {
    const data = await unwrap<AuthTokens>(http.post("/auth/wallet/login", payload));
    if (data.accessToken) {
      await setAccessToken(data.accessToken);
    }
    return data;
  },

  async getMe() {
    return unwrap<UserProfile>(http.get("/users/me"));
  },

  async updateMe(payload: { displayName?: string }) {
    return unwrap<UserProfile>(http.patch("/users/me", payload));
  },

  async getEvents(params?: { query?: string; category?: string; page?: number; size?: number }) {
    return unwrap<PageResult<EventSummary>>(http.get("/events", { params }));
  },

  async getEvent(eventId: string) {
    return unwrap<EventDetail>(http.get(`/events/${eventId}`));
  },

  async getEventTickets(eventId: string) {
    return unwrap<TicketDetail[]>(http.get(`/events/${eventId}/tickets`));
  },

  async getEventValidators(eventId: string) {
    return unwrap<EventValidatorRecord[]>(http.get(`/events/${eventId}/validators`));
  },

  async getMyEvents(params?: { page?: number; size?: number }) {
    return unwrap<PageResult<EventSummary>>(http.get("/events/me", { params }));
  },

  async createEvent(payload: Record<string, unknown>) {
    return unwrap<EventDetail>(http.post("/events", payload));
  },

  async updateEvent(eventId: string, payload: Record<string, unknown>) {
    return unwrap<EventDetail>(http.patch(`/events/${eventId}`, payload));
  },

  async updateEventStatus(eventId: string, payload: Record<string, unknown>) {
    return unwrap<EventDetail>(http.patch(`/events/${eventId}/status`, payload));
  },

  async updateResalePolicy(eventId: string, payload: Record<string, unknown>) {
    return unwrap<EventDetail>(http.patch(`/events/${eventId}/resale-policy`, payload));
  },

  async addEventValidator(eventId: string, payload: Record<string, unknown>) {
    return unwrap<Record<string, unknown>>(http.post(`/events/${eventId}/validators`, payload));
  },

  async uploadEventImage(eventId: string, file: File | { uri: string; name?: string; type?: string }) {
    const formData = new FormData();
    if (Platform.OS === "web" && "uri" in file) {
      // On web, { uri, name, type } is not recognized as a file by the browser.
      // Fetch the URI as a Blob and append it properly.
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const webFile = new File([blob], file.name || `poster-${Date.now()}.jpg`, { type: file.type || blob.type || "image/jpeg" });
      formData.append("file", webFile);
    } else {
      formData.append("file", file as any);
    }
    return unwrap<EventDetail>(http.post(`/events/${eventId}/image`, formData));
  },

  async issueTickets(eventId: string, payload: Record<string, unknown>) {
    return unwrap<TicketDetail[]>(http.post(`/events/${eventId}/tickets`, payload));
  },

  async cancelIssuedTickets(eventId: string, payload: { ticketIds: string[] }) {
    return unwrap<TicketDetail[]>(http.post(`/events/${eventId}/tickets/cancel-issued`, payload));
  },

  async purchasePrimary(ticketId: string, transactionHash?: string) {
    return unwrap<TicketDetail>(http.post(`/tickets/${ticketId}/purchase`, transactionHash ? { transactionHash } : undefined));
  },

  async getResaleListings(params?: { page?: number; size?: number }) {
    return unwrap<PageResult<ResaleListing>>(http.get("/resale-listings", { params }));
  },

  async getResaleListing(listingId: string) {
    return unwrap<ResaleListing>(http.get(`/resale-listings/${listingId}`));
  },

  async purchaseResale(listingId: string, transactionHash?: string) {
    return unwrap<ResaleListing>(http.post(`/resale-listings/${listingId}/purchase`, transactionHash ? { transactionHash } : undefined));
  },

  async cancelResale(listingId: string, transactionHash?: string) {
    return unwrap<ResaleListing>(http.patch(`/resale-listings/${listingId}/cancel`, transactionHash ? { transactionHash } : undefined));
  },

  async getMyTickets() {
    return unwrap<TicketDetail[]>(http.get("/tickets/me"));
  },

  async getTicket(ticketId: string) {
    return unwrap<TicketDetail>(http.get(`/tickets/${ticketId}`));
  },

  async getTicketValidity(ticketId: string) {
    return unwrap<Record<string, unknown>>(http.get(`/tickets/${ticketId}/validity`));
  },

  async createResale(ticketId: string, price: string, transactionHash?: string) {
    return unwrap<ResaleListing>(http.post(`/tickets/${ticketId}/resale-listing`, { priceWei: price, transactionHash }));
  },

  async createDispute(payload: { resaleListingId?: string | null; ticketId?: string | null; type: string; description: string }) {
    return unwrap<DisputeRecord>(http.post("/disputes", payload));
  },

  async updateDispute(disputeId: string, payload: { type: string; description: string }) {
    return unwrap<DisputeRecord>(http.patch(`/disputes/${disputeId}`, payload));
  },

  async cancelDispute(disputeId: string) {
    return unwrap<DisputeRecord>(http.patch(`/disputes/${disputeId}/cancel`));
  },

  async getMyDisputes(params?: { page?: number; size?: number }) {
    return unwrap<PageResult<DisputeRecord>>(http.get("/disputes/me", { params }));
  },

  async createTicketQr(ticketId: string, payload: { claimedOwner: string; expiresAt: string; signature: string }) {
    return unwrap<TicketQr>(http.post(`/tickets/${ticketId}/qr`, payload));
  },

  async checkIn(payload: Record<string, unknown>) {
    return unwrap<CheckInRecord>(http.post("/check-ins", payload));
  },

  async getTicketCheckInMessage(ticketId: string, params: { claimedOwner: string; expiresAt: string }) {
    return unwrap<Record<string, unknown>>(http.get(`/tickets/${ticketId}/check-in-message`, { params }));
  },

  async getTicketCheckIns(ticketId: string) {
    return unwrap<CheckInRecord[]>(http.get(`/tickets/${ticketId}/check-ins`));
  },

  async getAdminDashboard() {
    return unwrap<Record<string, unknown>>(http.get("/admin/dashboard"));
  },

  async getAdminEvents(params?: { page?: number; size?: number; status?: string; category?: string; query?: string; flagged?: boolean }) {
    return unwrap<PageResult<EventDetail>>(http.get("/admin/events", { params }));
  },

  async flagAdminEvent(eventId: string) {
    return unwrap<EventDetail>(http.patch(`/admin/events/${eventId}/flag`));
  },

  async unflagAdminEvent(eventId: string) {
    return unwrap<EventDetail>(http.patch(`/admin/events/${eventId}/unflag`));
  },

  async getUsers(params?: { page?: number; size?: number; status?: string }) {
    return unwrap<PageResult<UserAdminRecord>>(http.get("/users", { params }));
  },

  async searchUsers(query: string) {
    return unwrap<PageResult<UserAdminRecord>>(http.get("/users/search", { params: { query, size: 10 } }));
  },

  async suspendUser(userId: string) {
    return unwrap<UserAdminRecord>(http.patch(`/users/${userId}/suspend`));
  },

  async activateUser(userId: string) {
    return unwrap<UserAdminRecord>(http.patch(`/users/${userId}/activate`));
  },

  async deleteUser(userId: string) {
    return unwrap<UserAdminRecord>(http.patch(`/users/${userId}/delete`));
  },

  async grantValidator(userId: string) {
    return unwrap<UserAdminRecord>(http.patch(`/users/${userId}/validator`));
  },

  async getOrganizerApplications(params?: { status?: string; page?: number; size?: number }) {
    return unwrap<PageResult<OrganizerApplication>>(http.get("/organizer-applications", { params }));
  },

  async getMyOrganizerApplications() {
    return unwrap<OrganizerApplication[]>(http.get("/organizer-applications/me"));
  },

  async submitOrganizerApplication(payload: Record<string, unknown>) {
    return unwrap<OrganizerApplication>(http.post("/organizer-applications", payload));
  },

  async reviewOrganizerApplication(applicationId: string, decision: "APPROVED" | "REJECTED", transactionHash?: string) {
    return unwrap<OrganizerApplication>(
      http.patch(`/organizer-applications/${applicationId}/review`, {
        status: decision,
        transactionHash,
      }),
    );
  },

  async getResaleTransactions(params?: { page?: number; size?: number; status?: string }) {
    return unwrap<PageResult<ResaleListing>>(http.get("/admin/resale-transactions", { params }));
  },

  async getDisputes(params?: { page?: number; size?: number; status?: string }) {
    return unwrap<PageResult<DisputeRecord>>(http.get("/admin/disputes", { params }));
  },

  async reviewDispute(disputeId: string, payload: Record<string, unknown>) {
    return unwrap<DisputeRecord>(http.patch(`/admin/disputes/${disputeId}/review`, payload));
  },

  async getBlockchainTransactions(params?: { size?: number }) {
    return unwrap<BlockchainTransactionRecord[]>(http.get("/admin/blockchain-transactions", { params }));
  },
};
