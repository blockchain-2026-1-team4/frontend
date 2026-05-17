import type { RouteObject } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAdmin } from "./components/RequireAdmin";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import {
  AdminBlockchainLogPage,
  AdminDashboardPage,
  AdminDisputeTransactionPage,
  AdminEventManagePage,
  AdminUserManagePage,
  EventCreatePage,
  EventDetailPage,
  MyTicketListPage,
  OrganizerDashboardPage,
  OrganizerEventListPage,
  OrganizerApprovalPage,
  ResaleDetailPage,
  ResaleListPage,
  TicketDetailPage,
  UserHomePage,
} from "./pages/portalPages";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        path: "app",
        children: [
          { index: true, element: <UserHomePage /> },
          { path: "events", element: <UserHomePage /> },
          { path: "events/:eventId", element: <EventDetailPage /> },
          { path: "resale", element: <ResaleListPage /> },
          { path: "resale/:listingId", element: <ResaleDetailPage /> },
          { path: "me", element: <MyTicketListPage /> },
          { path: "tickets", element: <MyTicketListPage /> },
          { path: "tickets/:ticketId", element: <TicketDetailPage /> },
        ],
      },
      {
        path: "organizer",
        children: [
          { index: true, element: <OrganizerDashboardPage /> },
          { path: "events", element: <OrganizerEventListPage /> },
          { path: "events/new", element: <EventCreatePage /> },
          { path: "me", element: <OrganizerDashboardPage /> },
          { path: "start", element: <OrganizerDashboardPage /> },
        ],
      },
      {
        path: "admin",
        element: <RequireAdmin />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: "organizer-approvals", element: <OrganizerApprovalPage /> },
          { path: "events", element: <AdminEventManagePage /> },
          { path: "users", element: <AdminUserManagePage /> },
          { path: "disputes", element: <AdminDisputeTransactionPage /> },
          { path: "blockchain", element: <AdminBlockchainLogPage /> },
        ],
      },
    ],
  },
];
