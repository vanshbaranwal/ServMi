import { useNavigate } from "react-router-dom"

import WorkspaceLayout from "@/layout/WorkspaceLayout"
import { adminNavigation } from "@/lib/navigation"
import { useAdminDashboardStore } from "@/store/useAdminDashboardStore"
import { useAuthStore } from "@/store/useAuthStore"

export default function AdminLayout() {
  const navigate = useNavigate()
  const admin = useAuthStore((state) => state.adminUser)
  const clearSession = useAuthStore((state) => state.clearAdminSession)
  const resetDashboard = useAdminDashboardStore((state) => state.reset)

  const handleLogout = () => {
    resetDashboard()
    clearSession()
    navigate("/admin/login", { replace: true })
  }

  return (
    <WorkspaceLayout
      navigation={adminNavigation}
      homeTo="/admin"
      workspaceLabel="Admin workspace"
      profileName="ServMi admin"
      profileSubtitle={admin?.email || "Platform operations"}
      onLogout={handleLogout}
    />
  )
}
