import type { RouteObject } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { DisputesPage } from "./pages/admin/DisputesPage";
import { OrganizerApprovalsPage } from "./pages/admin/OrganizerApprovalsPage";
import { EventCreatePage } from "./pages/organizer/EventCreatePage";
import { MyEventsPage } from "./pages/organizer/MyEventsPage";
import { OrganizerDashboardPage } from "./pages/organizer/OrganizerDashboardPage";
import { EventDetailPage } from "./pages/user/EventDetailPage";
import { MyPage } from "./pages/user/MyPage";
import { ResaleDetailPage } from "./pages/user/ResaleDetailPage";
import { ResaleListPage } from "./pages/user/ResaleListPage";
import { TicketDetailPage } from "./pages/user/TicketDetailPage";
import { UserHomePage } from "./pages/user/UserHomePage";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "user", element: <UserHomePage /> },
      { path: "user/events/:eventId", element: <EventDetailPage /> },
      { path: "user/resale", element: <ResaleListPage /> },
      { path: "user/resale/:listingId", element: <ResaleDetailPage /> },
      { path: "user/me", element: <MyPage /> },
      { path: "user/tickets/:ticketId", element: <TicketDetailPage /> },
      { path: "organizer", element: <OrganizerDashboardPage /> },
      { path: "organizer/events/new", element: <EventCreatePage /> },
      { path: "organizer/events", element: <MyEventsPage /> },
      { path: "admin", element: <AdminDashboardPage /> },
      { path: "admin/organizer-approvals", element: <OrganizerApprovalsPage /> },
      { path: "admin/disputes", element: <DisputesPage /> },
    ],
  },
];
