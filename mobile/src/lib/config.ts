import Constants from "expo-constants";
import { Platform } from "react-native";

type ExpoHostConstants = typeof Constants & {
  expoConfig?: { hostUri?: string | null } | null;
  manifest?: { debuggerHost?: string; hostUri?: string } | null;
  manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } | null;
};

const API_PATH = "/api/v1";
const API_PORT = process.env.EXPO_PUBLIC_API_PORT || "8080";
const ADMIN_WEB_PORT = process.env.EXPO_PUBLIC_ADMIN_WEB_PORT || "5173";

function trimUrl(value: string) {
  return value.replace(/\/$/, "");
}

function isLocalhostUrl(value?: string) {
  if (!value) return false;
  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return value.includes("localhost") || value.includes("127.0.0.1");
  }
}

function hostFromExpoValue(value?: string | null) {
  if (!value) return null;
  const withoutProtocol = value.replace(/^[a-z]+:\/\//i, "");
  const host = withoutProtocol.split("/")[0]?.split(":")[0];
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

function getExpoDevHost() {
  const constants = Constants as ExpoHostConstants;
  const candidates = [
    constants.expoConfig?.hostUri,
    constants.manifest?.debuggerHost,
    constants.manifest?.hostUri,
    constants.manifest2?.extra?.expoGo?.debuggerHost,
  ];

  for (const candidate of candidates) {
    const host = hostFromExpoValue(candidate);
    if (host) return host;
  }

  return null;
}

function getApiBaseUrl() {
  const sharedUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const webUrl = process.env.EXPO_PUBLIC_WEB_API_BASE_URL || sharedUrl;
  const mobileUrl = process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL;

  if (Platform.OS === "web") {
    return trimUrl(webUrl || `http://localhost:${API_PORT}${API_PATH}`);
  }

  if (mobileUrl) {
    return trimUrl(mobileUrl);
  }

  const expoHost = getExpoDevHost();
  if (expoHost) {
    return `http://${expoHost}:${API_PORT}${API_PATH}`;
  }

  if (sharedUrl && !isLocalhostUrl(sharedUrl)) {
    return trimUrl(sharedUrl);
  }

  return `http://10.0.2.2:${API_PORT}${API_PATH}`;
}

function getAdminWebUrl() {
  const explicitUrl = process.env.EXPO_PUBLIC_ADMIN_WEB_URL;
  if (explicitUrl) {
    return trimUrl(explicitUrl);
  }

  const expoHost = getExpoDevHost();
  if (expoHost) {
    return `http://${expoHost}:${ADMIN_WEB_PORT}/login`;
  }

  return `http://localhost:${ADMIN_WEB_PORT}/login`;
}

// Converts a relative image URL returned by the backend (e.g. "/images/uuid.jpg")
// into an absolute URL using the server origin derived from apiBaseUrl.
// Required because React Native's Image component cannot resolve relative URLs.
export function resolveImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const origin = getApiBaseUrl().replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
  return `${origin}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

export const config = {
  apiBaseUrl: getApiBaseUrl(),
  adminWebUrl: getAdminWebUrl(),
  dappName: process.env.EXPO_PUBLIC_DAPP_NAME || "Trust Ticket",
  dappUrl: process.env.EXPO_PUBLIC_DAPP_URL || "https://trust-ticket.local",
  appScheme: process.env.EXPO_PUBLIC_APP_SCHEME || "trustticket",
  reownProjectId: process.env.EXPO_PUBLIC_REOWN_PROJECT_ID || "",
  chainRpcUrl: process.env.EXPO_PUBLIC_CHAIN_RPC_URL || "https://public-en-kairos.node.kaia.io",
  chainId: Number(process.env.EXPO_PUBLIC_CHAIN_ID || 1001),
  trustTicketContractAddress:
    process.env.EXPO_PUBLIC_TRUST_TICKET_CONTRACT_ADDRESS || "0x790aa2356BAb711998faA9c58dCDD47205e6683d",
  fanClubMembershipContractAddress:
    process.env.EXPO_PUBLIC_FANCLUB_MEMBERSHIP_CONTRACT_ADDRESS || "0xCA64026A80a9295aE1829DeDcb143dB23C3A3300",
};
