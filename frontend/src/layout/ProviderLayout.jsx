import { useNavigate } from "react-router-dom"

import WorkspaceLayout from "@/layout/WorkspaceLayout"
import { providerNavigation } from "@/lib/navigation"
import { useAuthStore } from "@/store/useAuthStore"
import { useProviderSetupStore } from "@/store/useProviderSetupStore"

export default function ProviderLayout() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.providerUser)
  const clearSession = useAuthStore((state) => state.clearProviderSession)
  const resetSetup = useProviderSetupStore((state) => state.reset)

  const handleLogout = () => {
    resetSetup()
    clearSession()
    navigate("/login", { replace: true })
  }

  return (
    <WorkspaceLayout
      navigation={providerNavigation}
      homeTo="/dashboard"
      workspaceLabel="Provider workspace"
      profileName={user?.businessName || user?.name || "Your business"}
      profileSubtitle={user?.email || "Provider account"}
      onLogout={handleLogout}
    />
  )
}
