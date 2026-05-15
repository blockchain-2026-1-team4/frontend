import type { EventSummary, ResaleListing, TicketDetail } from "../types/api";
import { setAccessToken } from "./auth";
import { http, unwrap } from "./http";

export const backendApi = {
  async registerEmail(payload: { email: string; password: string; displayName: string }) {
    const data = await unwrap<{ accessToken: string }>(
      http.post("/auth/email/register", payload),
    );
    if (data.accessToken) {
      setAccessToken(data.accessToken);
    }
    return data;
  },

  async loginEmail(payload: { email: string; password: string }) {
    const data = await unwrap<{ accessToken: string }>(
      http.post("/auth/email/login", payload),
    );
    if (data.accessToken) {
      setAccessToken(data.accessToken);
    }
    return data;
  },

  async getMe() {
    return unwrap<{ id: string; email: string; displayName: string; roles: string[] }>(
      http.get("/users/me"),
    );
  },

  async getEvents(params?: { keyword?: string; category?: string; page?: number }) {
    return unwrap<{ items: EventSummary[] }>(http.get("/events", { params }));
  },

  async getEvent(eventId: string) {
    return unwrap<EventSummary & { policy?: Record<string, unknown> }>(
      http.get(`/events/${eventId}`),
    );
  },

  async purchasePrimary(ticketId: number) {
    return unwrap<{ txHash?: string }>(http.post(`/tickets/${ticketId}/purchase`));
  },

  async getResaleListings(params?: { eventId?: string }) {
    return unwrap<{ items: ResaleListing[] }>(http.get("/resale-listings", { params }));
  },

  async getResaleListing(listingId: string) {
    return unwrap<ResaleListing>(http.get(`/resale-listings/${listingId}`));
  },

  async purchaseResale(listingId: string) {
    return unwrap<{ txHash?: string }>(http.post(`/resale-listings/${listingId}/purchase`));
  },

  async getMyTickets() {
    return unwrap<{ items: TicketDetail[] }>(http.get("/tickets/me"));
  },

  async getTicket(ticketId: number) {
    return unwrap<TicketDetail>(http.get(`/tickets/${ticketId}`));
  },

  async createResale(ticketId: number, price: string) {
    return unwrap<{ listingId: string }>(
      http.post(`/tickets/${ticketId}/resale-listing`, { price }),
    );
  },

  async cancelResale(listingId: string) {
    return unwrap<{ canceled: boolean }>(http.patch(`/resale-listings/${listingId}/cancel`));
  },

  async createEvent(payload: Record<string, unknown>) {
    return unwrap<{ eventId: string }>(http.post("/events", payload));
  },

  async getMyEvents() {
    return unwrap<{ items: EventSummary[] }>(http.get("/events/me"));
  },

  async getAdminDashboard() {
    return unwrap<Record<string, unknown>>(http.get("/admin/dashboard"));
  },

  async getOrganizerApplications() {
    return unwrap<{ items: Array<Record<string, unknown>> }>(
      http.get("/organizer-applications"),
    );
  },

  async reviewOrganizerApplication(applicationId: string, decision: "APPROVED" | "REJECTED") {
    return unwrap<Record<string, unknown>>(
      http.patch(`/organizer-applications/${applicationId}/review`, {
        status: decision,
      }),
    );
  },

  async getDisputes() {
    return unwrap<{ items: Array<Record<string, unknown>> }>(http.get("/admin/disputes"));
  },
};
