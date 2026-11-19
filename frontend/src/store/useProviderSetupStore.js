import { create } from "zustand"

import { api, getApiError } from "@/lib/api"
import { useAuthStore } from "@/store/useAuthStore"

export const useProviderSetupStore = create((set) => ({
  services: [],
  availability: [],
  setupLoading: false,
  servicesLoading: false,
  availabilityLoading: false,
  error: "",

  loadSetup: async () => {
    set({ setupLoading: true, error: "" })
    try {
      const [profileResponse, servicesResponse, availabilityResponse] = await Promise.all([
        api.get("/api/auth/me"),
        api.get("/api/services"),
        api.get("/api/availability"),
      ])
      useAuthStore.getState().updateProviderUser(profileResponse.data.user)
      set({
        services: servicesResponse.data.services || [],
        availability: availabilityResponse.data.availability || [],
        setupLoading: false,
      })
    } catch (error) {
      set({ setupLoading: false, error: getApiError(error, "We couldn't load your setup progress.") })
    }
  },

  loadServices: async () => {
    set({ servicesLoading: true, error: "" })
    try {
      const { data } = await api.get("/api/services")
      set({ services: data.services || [], servicesLoading: false })
    } catch (error) {
      set({ servicesLoading: false, error: getApiError(error, "We couldn't load your services.") })
    }
  },

  loadAvailability: async () => {
    set({ availabilityLoading: true, error: "" })
    try {
      const { data } = await api.get("/api/availability")
      set({ availability: data.availability || [], availabilityLoading: false })
    } catch (error) {
      set({ availabilityLoading: false, error: getApiError(error, "We couldn't load your availability.") })
    }
  },

  upsertService: (service) => set((state) => {
    const exists = state.services.some((item) => item._id === service._id)
    return {
      services: exists
        ? state.services.map((item) => item._id === service._id ? service : item)
        : [service, ...state.services],
    }
  }),

  removeService: (serviceId) => set((state) => ({
    services: state.services.filter((service) => service._id !== serviceId),
  })),

  replaceAvailability: (availability) => set({ availability }),
  clearError: () => set({ error: "" }),
  reset: () => set({
    services: [],
    availability: [],
    setupLoading: false,
    servicesLoading: false,
    availabilityLoading: false,
    error: "",
  }),
}))
