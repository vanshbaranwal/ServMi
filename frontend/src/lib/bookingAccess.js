const STORAGE_PREFIX = "servmi-booking-access:"

const storageKeyFor = ({ sessionId, bookingId }) => {
  if (sessionId) return `${STORAGE_PREFIX}session:${sessionId}`
  if (bookingId) return `${STORAGE_PREFIX}booking:${bookingId}`
  return ""
}

const readStoredAccess = (key) => {
  if (!key) return {}
  try {
    return JSON.parse(window.sessionStorage.getItem(key) || "{}")
  } catch {
    return {}
  }
}

export const readBookingAccess = (searchParams) => {
  const sessionId = searchParams.get("session_id") || ""
  const bookingId = searchParams.get("booking_id") || ""
  const key = storageKeyFor({ sessionId, bookingId })
  const stored = readStoredAccess(key)
  const accessToken = searchParams.get("access_token") || stored.accessToken || ""
  const slug = searchParams.get("slug") || stored.slug || ""

  if (key && accessToken) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify({ accessToken, slug }))
    } catch {
      // The page can still use the in-memory value when storage is unavailable.
    }
  }

  return { sessionId, bookingId, accessToken, slug }
}

export const scrubBookingAccessUrl = ({ sessionId, bookingId, slug }) => {
  const safeParams = new URLSearchParams()
  if (sessionId) safeParams.set("session_id", sessionId)
  if (bookingId) safeParams.set("booking_id", bookingId)
  if (slug) safeParams.set("slug", slug)
  const query = safeParams.toString()
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`)
}
