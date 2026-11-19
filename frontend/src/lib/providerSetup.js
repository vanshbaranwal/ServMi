export const weekDays = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
]

export const isProfileComplete = (user) => Boolean(
  user?.businessName?.trim()
  && user?.businessDescription?.trim()
  && user?.timezone?.trim(),
)

export const hasPublishedService = (services = []) => services.some((service) => service.isActive)

export const hasAvailability = (availability = []) => availability.some((day) => day.slots?.length)

export const getSetupState = ({ user, services = [], availability = [] }) => {
  const steps = {
    profile: isProfileComplete(user),
    service: hasPublishedService(services),
    availability: hasAvailability(availability),
  }
  const completed = Object.values(steps).filter(Boolean).length

  return {
    steps,
    completed,
    percent: Math.round((completed / Object.keys(steps).length) * 100),
    ready: completed === Object.keys(steps).length,
  }
}

export const createWeeklySchedule = (availability = []) => weekDays.map((day) => {
  const saved = availability.find((item) => item.dayOfWeek === day.value)
  const slots = saved?.slots?.map(({ startTime, endTime }) => ({ startTime, endTime })) || []

  return {
    dayOfWeek: day.value,
    label: day.label,
    enabled: slots.length > 0,
    slots: slots.length ? slots : [{ startTime: "09:00", endTime: "17:00" }],
  }
})

export const validateWeeklySchedule = (schedule) => {
  for (const day of schedule) {
    if (!day.enabled) continue
    if (!day.slots.length) return `${day.label} needs at least one time range.`

    const sorted = [...day.slots].sort((a, b) => a.startTime.localeCompare(b.startTime))
    for (let index = 0; index < sorted.length; index += 1) {
      const slot = sorted[index]
      if (!slot.startTime || !slot.endTime || slot.startTime >= slot.endTime) {
        return `Check the time range for ${day.label}.`
      }
      if (index > 0 && slot.startTime < sorted[index - 1].endTime) {
        return `${day.label}'s time ranges cannot overlap.`
      }
    }
  }

  return ""
}
