import { create } from "zustand"
import { persist } from "zustand/middleware"

export const useAuthStore = create(
  persist(
    (set) => ({
      providerToken: null,
      providerUser: null,
      adminToken: null,
      adminUser: null,
      setProviderSession: ({ token, user }) =>
        set({ providerToken: token, providerUser: user }),
      updateProviderUser: (user) => set({ providerUser: user }),
      clearProviderSession: () => set({ providerToken: null, providerUser: null }),
      setAdminSession: ({ token, admin }) =>
        set({ adminToken: token, adminUser: admin }),
      clearAdminSession: () => set({ adminToken: null, adminUser: null }),
    }),
    {
      name: "servmi-session",
      partialize: ({ providerToken, providerUser, adminToken, adminUser }) => ({
        providerToken,
        providerUser,
        adminToken,
        adminUser,
      }),
    },
  ),
)
