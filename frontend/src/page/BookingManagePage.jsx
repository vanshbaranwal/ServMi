import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { ErrorState, LoadingState } from "@/components/AsyncState"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api, getApiError } from "@/lib/api"
import { formatBookingDate, formatTimeRange } from "@/lib/booking"
import { readBookingAccess, scrubBookingAccessUrl } from "@/lib/bookingAccess"
import { formatMoney, formatStatus } from "@/lib/formatters"

export default function BookingManagePage() {
  const [searchParams] = useSearchParams()
  const [{ bookingId, accessToken, slug }] = useState(() => readBookingAccess(searchParams))
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const loadBooking = async () => {
    if (!bookingId || !accessToken) return
    setLoading(true)
    setError("")
    try {
      const { data } = await api.get(`/api/public/booking/status?booking_id=${encodeURIComponent(bookingId)}`, {
        headers: { "X-Booking-Access-Token": accessToken },
      })
      setBooking(data.booking)
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't load this booking."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    scrubBookingAccessUrl({ bookingId, slug })
    if (!bookingId || !accessToken) return undefined
    let active = true
    api.get(`/api/public/booking/status?booking_id=${encodeURIComponent(bookingId)}`, {
      headers: { "X-Booking-Access-Token": accessToken },
    })
      .then(({ data }) => {
        if (active) setBooking(data.booking)
      })
      .catch((requestError) => {
        if (active) setError(getApiError(requestError, "We couldn't load this booking."))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [accessToken, bookingId, slug])

  const cancelBooking = async () => {
    setCancelling(true)
    try {
      const { data } = await api.post("/api/public/booking/cancel", { booking_id: bookingId }, {
        headers: { "X-Booking-Access-Token": accessToken },
      })
      setBooking(data.booking)
      setConfirmCancel(false)
      toast.success("Booking cancelled")
    } catch (requestError) {
      toast.error(getApiError(requestError, "We couldn't cancel this booking."))
    } finally {
      setCancelling(false)
    }
  }

  if (!bookingId || !accessToken) {
    return <ErrorState title="Booking link is incomplete" message="Open the manage-booking link from your confirmation email or booking confirmation page." />
  }
  if (loading && !booking) return <LoadingState label="Loading booking" rows={4} />
  if (error && !booking) return <ErrorState title="Booking unavailable" message={error} onRetry={loadBooking} />

  const service = typeof booking?.serviceId === "object" ? booking.serviceId : null
  const canCancel = booking?.status === "confirmed"
    && !booking.paymentReviewRequired
    && (booking.paymentStatus === "not_required" || booking.paymentStatus === "paid")

  return (
    <>
      <Card className="mx-auto max-w-2xl shadow-[0_24px_70px_rgba(85,43,65,0.10)]">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">Manage your booking</CardTitle>
              <CardDescription className="mt-2">Review the latest appointment and payment status.</CardDescription>
            </div>
            <Badge variant="secondary">{formatStatus(booking.status)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="divide-y rounded-xl border bg-muted/30 px-4 sm:px-5">
            <div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]"><span className="text-sm text-muted-foreground">Service</span><span className="text-sm font-medium">{service?.name || "Appointment"}</span></div>
            <div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]"><span className="text-sm text-muted-foreground">Date and time</span><span className="text-sm font-medium">{formatBookingDate(booking.date)} · {formatTimeRange(booking.startTime, booking.endTime)}</span></div>
            <div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]"><span className="text-sm text-muted-foreground">Customer</span><span className="text-sm font-medium">{booking.customerName} · {booking.customerEmail}</span></div>
            <div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]"><span className="text-sm text-muted-foreground">Payment</span><span className="text-sm font-medium">{booking.paymentStatus === "not_required" ? "Free booking" : `${formatMoney(booking.amount, booking.currency)} · ${formatStatus(booking.paymentStatus)}`}</span></div>
          </div>

          {booking.paymentReviewRequired && <p className="rounded-lg border border-warning/25 bg-warning-surface px-4 py-3 text-sm text-warning">This payment is being reviewed. The provider cannot withdraw the affected funds while review is open.</p>}
          {booking.status === "cancelled" && <p className="rounded-lg border bg-muted px-4 py-3 text-sm text-muted-foreground">This booking has been cancelled.</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            {booking.customerCalendarUrl && booking.status === "confirmed" && <Button asChild><a href={booking.customerCalendarUrl} target="_blank" rel="noreferrer">Add to Google Calendar</a></Button>}
            {canCancel && <Button variant="outline" className="text-destructive" onClick={() => setConfirmCancel(true)}>Cancel booking</Button>}
            <Button variant="ghost" asChild><Link to={slug ? `/b/${slug}` : "/"}>Return to booking page</Link></Button>
          </div>
          {booking.status === "confirmed" && !canCancel && <p className="text-sm leading-5 text-muted-foreground">This booking cannot change while its payment is under review. Contact the provider if you need help.</p>}
        </CardContent>
      </Card>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {booking?.paymentStatus === "paid"
                ? "The appointment will be released and Stripe will receive a full refund request. The provider payout remains locked until the refund settles."
                : "The appointment will be released and both you and the provider will receive an updated confirmation."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={cancelling} onClick={cancelBooking}>
              {cancelling && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
