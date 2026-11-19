import { useCallback, useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { ErrorState, LoadingState } from "@/components/AsyncState"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { api, getApiError } from "@/lib/api"
import { createWeeklySchedule, validateWeeklySchedule } from "@/lib/providerSetup"
import { useProviderSetupStore } from "@/store/useProviderSetupStore"

export default function AvailabilityPage() {
  const availability = useProviderSetupStore((state) => state.availability)
  const loading = useProviderSetupStore((state) => state.availabilityLoading)
  const error = useProviderSetupStore((state) => state.error)
  const loadAvailability = useProviderSetupStore((state) => state.loadAvailability)
  const replaceAvailability = useProviderSetupStore((state) => state.replaceAvailability)
  const [schedule, setSchedule] = useState(() => createWeeklySchedule([]))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  const loadSchedule = useCallback(async () => {
    await loadAvailability()
    const saved = useProviderSetupStore.getState().availability
    setSchedule(createWeeklySchedule(saved))
  }, [loadAvailability])

  useEffect(() => {
    let active = true
    loadAvailability().then(() => {
      if (active) setSchedule(createWeeklySchedule(useProviderSetupStore.getState().availability))
    })
    return () => { active = false }
  }, [loadAvailability])

  const updateDay = (dayOfWeek, updater) => {
    setFormError("")
    setSchedule((current) => current.map((day) => (
      day.dayOfWeek === dayOfWeek ? updater(day) : day
    )))
  }

  const toggleDay = (dayOfWeek, enabled) => {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      enabled,
      slots: day.slots.length ? day.slots : [{ startTime: "09:00", endTime: "17:00" }],
    }))
  }

  const updateSlot = (dayOfWeek, slotIndex, field, value) => {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      slots: day.slots.map((slot, index) => index === slotIndex ? { ...slot, [field]: value } : slot),
    }))
  }

  const addSlot = (dayOfWeek) => {
    updateDay(dayOfWeek, (day) => {
      const lastEnd = day.slots.at(-1)?.endTime || "09:00"
      const [hours, minutes] = lastEnd.split(":").map(Number)
      const endMinutes = Math.min((hours * 60) + minutes + 60, 23 * 60 + 59)
      const nextEnd = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`
      const nextStart = lastEnd === "23:59" ? "22:59" : lastEnd

      return {
        ...day,
        slots: [...day.slots, { startTime: nextStart, endTime: nextEnd }],
      }
    })
  }

  const removeSlot = (dayOfWeek, slotIndex) => {
    updateDay(dayOfWeek, (day) => ({
      ...day,
      enabled: day.slots.length > 1,
      slots: day.slots.length > 1
        ? day.slots.filter((_, index) => index !== slotIndex)
        : [{ startTime: "09:00", endTime: "17:00" }],
    }))
  }

  const saveSchedule = async () => {
    const validationError = validateWeeklySchedule(schedule)
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError("")
    try {
      const responses = await Promise.all(schedule.map((day) => api.put("/api/availability", {
        dayOfWeek: day.dayOfWeek,
        slots: day.enabled ? [...day.slots].sort((a, b) => a.startTime.localeCompare(b.startTime)) : [],
      })))
      const saved = responses.map((response) => response.data.availability)
      replaceAvailability(saved)
      setSchedule(createWeeklySchedule(saved))
      toast.success("Weekly availability saved")
    } catch (requestError) {
      setFormError(getApiError(requestError, "We couldn't save your weekly availability."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Working hours"
        title="Availability"
        description="Set the recurring hours clients can book. You can add more than one time range per day."
        actions={(
          <Button onClick={saveSchedule} disabled={saving || loading}>
            {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {saving ? "Saving" : "Save schedule"}
          </Button>
        )}
      />

      {loading && !availability.length ? (
        <LoadingState label="Loading weekly availability" rows={7} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadSchedule} />
      ) : (
        <>
          {formError && <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{formError}</p>}
          <Card>
            <CardContent className="divide-y p-0">
              {schedule.map((day) => (
                <div key={day.dayOfWeek} className="grid gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[10rem_1fr]">
                  <div className="flex items-start justify-between gap-3 lg:block">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{day.label}</p>
                      <Badge variant="secondary" className={day.enabled ? "mt-2 bg-success-surface text-success" : "mt-2"}>
                        {day.enabled ? "Available" : "Closed"}
                      </Badge>
                    </div>
                    <Switch
                      checked={day.enabled}
                      onCheckedChange={(checked) => toggleDay(day.dayOfWeek, checked)}
                      aria-label={`Set ${day.label} as ${day.enabled ? "closed" : "available"}`}
                    />
                  </div>

                  {day.enabled ? (
                    <div className="space-y-3">
                      {day.slots.map((slot, slotIndex) => (
                        <div key={`${day.dayOfWeek}-${slotIndex}`} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
                            <Input
                              type="time"
                              value={slot.startTime}
                              onChange={(event) => updateSlot(day.dayOfWeek, slotIndex, "startTime", event.target.value)}
                              aria-label={`${day.label} start time ${slotIndex + 1}`}
                            />
                            <span className="text-sm text-muted-foreground">to</span>
                            <Input
                              type="time"
                              value={slot.endTime}
                              onChange={(event) => updateSlot(day.dayOfWeek, slotIndex, "endTime", event.target.value)}
                              aria-label={`${day.label} end time ${slotIndex + 1}`}
                            />
                          </div>
                          <Button variant="ghost" onClick={() => removeSlot(day.dayOfWeek, slotIndex)}>
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" onClick={() => addSlot(day.dayOfWeek)}>Add another time</Button>
                    </div>
                  ) : (
                    <p className="self-center text-sm text-muted-foreground">Clients cannot book this day.</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
