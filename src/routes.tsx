import type { RouteObject } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import {
  AdminBlockchainLogPage,
  AdminDashboardPage,
  AdminDisputeTransactionPage,
  AdminEventManagePage,
  AdminLoginPage,
  AdminUserManagePage,
  OrganizerApprovalPage,
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
        path: "admin",
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: "login", element: <AdminLoginPage /> },
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
