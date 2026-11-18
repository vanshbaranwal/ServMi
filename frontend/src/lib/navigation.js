export const providerNavigation = [
  { label: "Overview", to: "/dashboard" },
  { label: "Bookings", to: "/bookings" },
  { label: "Services", to: "/services" },
  { label: "Availability", to: "/availability" },
  { label: "Payments", to: "/payments" },
  { label: "Business profile", to: "/profile" },
]

export const adminNavigation = [
  { label: "Overview", to: "/admin" },
  { label: "Withdrawals", to: "/admin/withdrawals" },
  { label: "Payment reviews", to: "/admin/payment-reviews" },
]

export const routeMeta = {
  "/dashboard": { title: "Overview", eyebrow: "Provider workspace" },
  "/bookings": { title: "Bookings", eyebrow: "Schedule" },
  "/services": { title: "Services", eyebrow: "Booking catalogue" },
  "/availability": { title: "Availability", eyebrow: "Working hours" },
  "/payments": { title: "Payments", eyebrow: "Wallet and payouts" },
  "/profile": { title: "Business profile", eyebrow: "Public booking page" },
  "/admin": { title: "Platform overview", eyebrow: "Admin workspace" },
  "/admin/withdrawals": { title: "Withdrawals", eyebrow: "Admin workspace" },
  "/admin/payment-reviews": { title: "Payment reviews", eyebrow: "Admin workspace" },
}
