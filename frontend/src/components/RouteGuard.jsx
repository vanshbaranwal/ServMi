import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuthStore } from "@/store/useAuthStore"

export function RequireProvider() {
  const token = useAuthStore((state) => state.providerToken)
  const location = useLocation()
  return token ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />
}

export function RequireAdmin() {
  const token = useAuthStore((state) => state.adminToken)
  const location = useLocation()
  return token ? <Outlet /> : <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
}
