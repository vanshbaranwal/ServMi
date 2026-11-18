export const formatMoney = (amount = 0, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: String(currency).toUpperCase(),
    maximumFractionDigits: 2,
  }).format(Number(amount || 0) / 100)

export const formatPrice = (amount = 0, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: String(currency).toUpperCase(),
    maximumFractionDigits: 2,
  }).format(Number(amount || 0))

export const formatDate = (value, options = {}) => {
  if (!value) return "—"
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : undefined,
    ...options,
  }).format(date)
}

export const getInitials = (value = "") =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "SM"

export const createRequestId = () =>
  globalThis.crypto?.randomUUID?.() || `servmi-${Date.now()}-${Math.random().toString(16).slice(2)}`
