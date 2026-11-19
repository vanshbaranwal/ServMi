const dateParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const part = (type) => parts.find((entry) => entry.type === type)?.value
  return `${part("year")}-${part("month")}-${part("day")}`
}

export const getBusinessToday = (timeZone = "Asia/Kolkata") => {
  try {
    return dateParts(new Date(), timeZone)
  } catch {
    return dateParts(new Date(), "Asia/Kolkata")
  }
}

export const getBusinessClock = (timeZone = "Asia/Kolkata") => {
  const format = (zone) => new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date())
  let parts
  try {
    parts = format(timeZone)
  } catch {
    parts = format("Asia/Kolkata")
  }
  const part = (type) => parts.find((entry) => entry.type === type)?.value
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  }
}

export const addCalendarDays = (dateString, amount) => {
  const date = new Date(`${dateString}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export const getBookableDates = (timeZone, count = 21) => {
  const today = getBusinessToday(timeZone)
  return Array.from({ length: count }, (_, index) => addCalendarDays(today, index))
}

export const formatBookingDate = (dateString, options = {}) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || "")) return "—"
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    ...(Object.keys(options).length ? options : { dateStyle: "long" }),
  }).format(new Date(`${dateString}T00:00:00Z`))
}

export const formatDateChoice = (dateString) => ({
  weekday: formatBookingDate(dateString, { weekday: "short" }),
  day: new Date(`${dateString}T00:00:00Z`).getUTCDate(),
  month: formatBookingDate(dateString, { month: "short" }),
})

export const formatTimeRange = (startTime, endTime) => `${startTime}–${endTime}`

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim())
