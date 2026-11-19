import { useMemo, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api, getApiError } from "@/lib/api"
import { formatBookingDate, formatDateChoice, formatTimeRange, getBookableDates } from "@/lib/booking"
import { cn } from "@/lib/utils"

export function BookingRescheduleDialog({ booking, slug, timezone, onClose, onUpdated }) {
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const dates = useMemo(() => getBookableDates(timezone || "Asia/Kolkata", 21), [timezone])
  const serviceId = typeof booking.serviceId === "object" ? booking.serviceId._id : booking.serviceId

  const loadSlots = async (date) => {
    setSelectedDate(date)
    setSelectedSlot(null)
    setSlots([])
    setLoadingSlots(true)
    setError("")
    try {
      const { data } = await api.get(`/api/public/${encodeURIComponent(slug)}/slots`, {
        params: { date, serviceId },
      })
      setSlots(data.slots || [])
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't load available times."))
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleSave = async () => {
    if (!selectedDate || !selectedSlot) {
      setError("Choose a new date and time.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const { data } = await api.patch(`/api/bookings/${booking._id}/reschedule`, {
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      })
      onUpdated(data.booking)
      toast.success("Booking rescheduled")
      onClose()
    } catch (requestError) {
      const message = getApiError(requestError, "We couldn't reschedule this booking.")
      if (requestError.response?.status === 409) {
        await loadSlots(selectedDate)
        setError(`${message} Available times have been refreshed.`)
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reschedule booking</DialogTitle>
          <DialogDescription>
            Choose a new time for {booking.customerName}. The customer will receive an updated confirmation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-xl border bg-muted/40 p-4 text-sm">
            <p className="font-medium text-foreground">Current appointment</p>
            <p className="mt-1 text-muted-foreground">
              {formatBookingDate(booking.date)} · {formatTimeRange(booking.startTime, booking.endTime)}
            </p>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">New date</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
              {dates.map((date) => {
                const parts = formatDateChoice(date)
                return (
                  <button
                    key={date}
                    type="button"
                    className={cn(
                      "rounded-xl border px-2 py-3 text-center transition-colors hover:border-strong-border",
                      selectedDate === date && "border-primary bg-secondary ring-2 ring-primary/30",
                    )}
                    onClick={() => loadSlots(date)}
                    aria-pressed={selectedDate === date}
                  >
                    <span className="block text-xs text-muted-foreground">{parts.weekday}</span>
                    <span className="mt-1 block text-lg font-semibold">{parts.day}</span>
                    <span className="block text-xs text-muted-foreground">{parts.month}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedDate && (
            <div className="border-t pt-5">
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-foreground">
                  {formatBookingDate(selectedDate, { weekday: "long", month: "long", day: "numeric" })}
                </p>
                <Button variant="ghost" size="sm" onClick={() => loadSlots(selectedDate)} disabled={loadingSlots}>Refresh</Button>
              </div>
              {loadingSlots ? (
                <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <LoaderCircle className="animate-spin" aria-hidden="true" /> Loading times
                </p>
              ) : slots.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {slots.map((slot) => {
                    const selected = selectedSlot?.startTime === slot.startTime && selectedSlot?.endTime === slot.endTime
                    return (
                      <Button
                        key={`${slot.startTime}-${slot.endTime}`}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        onClick={() => {
                          setSelectedSlot(slot)
                          setError("")
                        }}
                      >
                        {formatTimeRange(slot.startTime, slot.endTime)}
                      </Button>
                    )
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No times are available on this date.</p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Keep current time</Button>
          <Button onClick={handleSave} disabled={!selectedSlot || saving}>
            {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {saving ? "Rescheduling" : "Confirm new time"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
