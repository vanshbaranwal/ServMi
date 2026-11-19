import { useCallback, useEffect, useMemo, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { EmptyState, ErrorState, LoadingState } from "@/components/AsyncState"
import { BookingRescheduleDialog } from "@/components/BookingRescheduleDialog"
import { PageHeader } from "@/components/PageHeader"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api, getApiError } from "@/lib/api"
import { formatBookingDate, formatTimeRange, getBusinessClock } from "@/lib/booking"
import { formatMoney, formatStatus } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/useAuthStore"

const filters = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "all", label: "All" },
]

const statusStyle = {
  confirmed: "bg-success-surface text-success",
  pending: "bg-warning-surface text-warning",
  cancelled: "bg-muted text-muted-foreground",
}

const isBeforeClock = (booking, clock) => (
  booking.date < clock.date || (booking.date === clock.date && booking.endTime <= clock.time)
)

const canChangeFreeBooking = (booking, clock) => (
  !isBeforeClock(booking, clock)
  && ["pending", "confirmed"].includes(booking.status)
  && booking.paymentStatus === "not_required"
  && Number(booking.amount || 0) === 0
  && booking.payoutStatus === "not_required"
  && !booking.stripeSessionId
)

export default function BookingsPage() {
  const user = useAuthStore((state) => state.providerUser)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeFilter, setActiveFilter] = useState("upcoming")
  const [dateFilter, setDateFilter] = useState("")
  const [rescheduling, setRescheduling] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [cancellingId, setCancellingId] = useState("")
  const clock = useMemo(() => getBusinessClock(user?.timezone || "Asia/Kolkata"), [user?.timezone])

  const loadBookings = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const { data } = await api.get("/api/bookings")
      setBookings(data.bookings || [])
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't load your bookings."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get("/api/bookings")
      .then(({ data }) => {
        if (active) setBookings(data.bookings || [])
      })
      .catch((requestError) => {
        if (active) setError(getApiError(requestError, "We couldn't load your bookings."))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const visibleBookings = useMemo(() => {
    const filtered = bookings.filter((booking) => {
      if (dateFilter && booking.date !== dateFilter) return false
      if (activeFilter === "all") return true
      if (activeFilter === "cancelled") return booking.status === "cancelled"
      if (activeFilter === "rescheduled") return booking.isRescheduled
      if (activeFilter === "past") return booking.status !== "cancelled" && isBeforeClock(booking, clock)
      return booking.status !== "cancelled" && !isBeforeClock(booking, clock)
    })

    return filtered.sort((a, b) => {
      const left = `${a.date}T${a.startTime}`
      const right = `${b.date}T${b.startTime}`
      return activeFilter === "upcoming" ? left.localeCompare(right) : right.localeCompare(left)
    })
  }, [activeFilter, bookings, clock, dateFilter])

  const updateBooking = (updated) => {
    setBookings((current) => current.map((booking) => booking._id === updated._id ? updated : booking))
  }

  const cancelBooking = async () => {
    if (!cancelling) return
    setCancellingId(cancelling._id)
    try {
      const { data } = await api.patch(`/api/bookings/${cancelling._id}`, { status: "cancelled" })
      updateBooking(data.booking)
      setCancelling(null)
      toast.success("Booking cancelled and customer notified")
    } catch (requestError) {
      toast.error(getApiError(requestError, "We couldn't cancel this booking."))
    } finally {
      setCancellingId("")
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Schedule"
        title="Bookings"
        description="Review appointments and manage changes without losing track of the customer or payment state."
      />

      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap gap-2" aria-label="Booking status filters">
            {filters.map((filter) => (
              <Button
                key={filter.value}
                size="sm"
                variant={activeFilter === filter.value ? "default" : "outline"}
                onClick={() => setActiveFilter(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
            <label htmlFor="booking-date-filter" className="text-sm font-medium">Filter by date</label>
            <Input
              id="booking-date-filter"
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="sm:w-48"
            />
            <Button variant="ghost" size="sm" onClick={() => setDateFilter(clock.date)}>Today</Button>
            {dateFilter && <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>Clear date</Button>}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingState label="Loading bookings" rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadBookings} />
      ) : !visibleBookings.length ? (
        <EmptyState
          title="No bookings match these filters"
          message="Try another status or date. New confirmed bookings appear here automatically."
          action={<Button variant="outline" onClick={() => { setActiveFilter("all"); setDateFilter("") }}>Clear filters</Button>}
        />
      ) : (
        <div className="space-y-3">
          {visibleBookings.map((booking) => {
            const service = typeof booking.serviceId === "object" ? booking.serviceId : null
            const canChange = canChangeFreeBooking(booking, clock)
            const paid = booking.paymentStatus !== "not_required" || Number(booking.amount || 0) > 0
            return (
              <Card key={booking._id}>
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-foreground">{service?.name || "Appointment"}</h2>
                        <Badge variant="secondary" className={statusStyle[booking.status] || ""}>
                          {booking.isRescheduled && booking.status !== "cancelled" ? "Rescheduled" : formatStatus(booking.status)}
                        </Badge>
                        {paid && <Badge variant="secondary">{formatStatus(booking.paymentStatus)}</Badge>}
                        {booking.paymentReviewRequired && <Badge className="bg-warning-surface text-warning">Payment review</Badge>}
                      </div>
                      <p className="mt-3 text-sm font-medium text-secondary-foreground">
                        {formatBookingDate(booking.date)} · {formatTimeRange(booking.startTime, booking.endTime)}
                      </p>
                      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                        <div>
                          <p className="text-muted-foreground">Customer</p>
                          <p className="mt-1 font-medium text-foreground">{booking.customerName}</p>
                          <p className="mt-1 break-all text-muted-foreground">{booking.customerEmail}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payment</p>
                          <p className="mt-1 font-medium text-foreground">
                            {paid ? formatMoney(booking.amount, booking.currency) : "Free"}
                          </p>
                          <p className="mt-1 text-muted-foreground">{paid ? formatStatus(booking.payoutStatus) : "No payment required"}</p>
                        </div>
                        {booking.notes && (
                          <div>
                            <p className="text-muted-foreground">Customer notes</p>
                            <p className="mt-1 leading-5 text-secondary-foreground">{booking.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={cn("flex flex-wrap gap-2 border-t pt-4 lg:max-w-64 lg:justify-end lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0")}>
                      {booking.customerCalendarUrl && (
                        <Button variant="outline" asChild>
                          <a href={booking.customerCalendarUrl} target="_blank" rel="noreferrer">Customer calendar link</a>
                        </Button>
                      )}
                      {canChange && (
                        <>
                          <Button variant="outline" onClick={() => setRescheduling(booking)}>Reschedule</Button>
                          <Button variant="ghost" className="text-destructive" onClick={() => setCancelling(booking)}>Cancel</Button>
                        </>
                      )}
                      {!canChange && booking.status === "confirmed" && paid && (
                        <p className="w-full text-sm leading-5 text-muted-foreground">Paid bookings require the refund workflow before cancellation.</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {rescheduling && (
        <BookingRescheduleDialog
          key={rescheduling._id}
          booking={rescheduling}
          slug={user?.slug}
          timezone={user?.timezone}
          onClose={() => setRescheduling(null)}
          onUpdated={updateBooking}
        />
      )}

      <AlertDialog open={Boolean(cancelling)} onOpenChange={(open) => !open && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelling?.customerName} will be notified, and the time will become available for another client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={cancelBooking} disabled={Boolean(cancellingId)}>
              {cancellingId && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
