import type { RouteObject } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAdmin } from "./components/RequireAdmin";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { AdminBlockchainLogPage } from "./pages/admin/AdminBlockchainLogPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminDisputeTransactionPage } from "./pages/admin/AdminDisputeTransactionPage";
import { AdminEventsPage } from "./pages/admin/AdminEventsPage";
import { AdminUserManagePage } from "./pages/admin/AdminUserManagePage";
import { OrganizerApprovalsPage } from "./pages/admin/OrganizerApprovalsPage";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: "login", element: <LoginPage /> },
      {
        path: "admin",
        element: <RequireAdmin />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: "organizer-approvals", element: <OrganizerApprovalsPage /> },
          { path: "events", element: <AdminEventsPage /> },
          { path: "users", element: <AdminUserManagePage /> },
          { path: "disputes", element: <AdminDisputeTransactionPage /> },
          { path: "blockchain", element: <AdminBlockchainLogPage /> },
        ],
      },
    ],
  },
];
