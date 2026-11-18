import axios from "axios"

import { useAuthStore } from "@/store/useAuthStore"

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
})

api.interceptors.request.use((config) => {
  const { providerToken, adminToken } = useAuthStore.getState()
  const isAdminRequest = String(config.url || "").startsWith("/api/admin")
  const token = isAdminRequest ? adminToken : providerToken

  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const requestUrl = String(error.config?.url || "")

    if (status === 401 && !requestUrl.endsWith("/login")) {
      if (requestUrl.startsWith("/api/admin")) {
        useAuthStore.getState().clearAdminSession()
      } else if (!requestUrl.startsWith("/api/public")) {
        useAuthStore.getState().clearProviderSession()
      }
    }

    return Promise.reject(error)
  },
)

export const getApiError = (error, fallback = "Something went wrong. Please try again.") =>
  error?.response?.data?.message || error?.message || fallback
