import axios from "axios";
import type { ApiEnvelope } from "../types/api";
import { config } from "./config";
import { clearAccessToken, getAccessToken } from "./auth";

export const http = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10000,
});

http.interceptors.request.use((request) => {
  const token = getAccessToken();
  if (token) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  return request;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAccessToken();
    }
    return Promise.reject(error);
  },
);

export async function unwrap<T>(promise: Promise<{ data: ApiEnvelope<T> }>) {
  const { data } = await promise;
  if (!data.success) {
    throw new Error(data.message || "Request failed");
  }
  return data.data;
}
