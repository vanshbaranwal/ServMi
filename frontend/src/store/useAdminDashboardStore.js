import { create } from "zustand"

import { api, getApiError } from "@/lib/api"

const initialData = {
  summary: {},
  users: [],
  withdrawals: [],
  recentBookings: [],
  paymentReviews: [],
}

export const useAdminDashboardStore = create((set) => ({
  ...initialData,
  loading: false,
  error: "",

  loadDashboard: async () => {
    set({ loading: true, error: "" })
    try {
      const { data } = await api.get("/api/admin/dashboard")
      set({
        summary: data.summary || {},
        users: data.users || [],
        withdrawals: data.withdrawals || [],
        recentBookings: data.recentBookings || [],
        paymentReviews: data.paymentReviews || [],
        loading: false,
      })
    } catch (error) {
      set({ loading: false, error: getApiError(error, "We couldn't load the admin workspace.") })
    }
  },

  updateWithdrawal: (withdrawal, summary) => set((state) => ({
    withdrawals: state.withdrawals.map((item) => item._id === withdrawal._id ? withdrawal : item),
    ...(summary ? { summary } : {}),
  })),

  reset: () => set({ ...initialData, loading: false, error: "" }),
}))
