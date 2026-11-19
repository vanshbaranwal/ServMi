import { useEffect, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"

import { ErrorState, LoadingState } from "@/components/AsyncState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api, getApiError } from "@/lib/api"
import { formatBookingDate, formatTimeRange } from "@/lib/booking"
import { formatMoney } from "@/lib/formatters"

const statusCopy = (booking) => {
  if (!booking) return { label: "Checking", title: "Confirming your booking", description: "Please keep this page open for a moment." }
  if (booking.status === "confirmed") {
    return {
      label: "Confirmed",
      title: "Your booking is confirmed",
      description: "The provider has been notified and a confirmation has been sent to your email.",
      success: true,
    }
  }
  if (booking.status === "pending_payment" || booking.paymentStatus === "pending") {
    return {
      label: "Processing",
      title: "Your payment is still processing",
      description: "We are checking the payment with Stripe. You can refresh the status safely.",
    }
  }
  if (booking.paymentStatus === "refund_pending") {
    return {
      label: "Refund pending",
      title: "Your payment needs review",
      description: "The booking could not be completed and the refund is being processed.",
    }
  }
  return {
    label: "Not confirmed",
    title: "This booking was not completed",
    description: "No confirmed appointment was created. Return to the booking page to choose another time.",
  }
}

export default function BookingSuccessPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const bookingId = searchParams.get("booking_id")
  const accessToken = searchParams.get("access_token")
  const slug = searchParams.get("slug")
  const [booking, setBooking] = useState(location.state?.booking || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const invalidRequest = (!sessionId && !bookingId) || (sessionId && bookingId) || !accessToken

  useEffect(() => {
    if (invalidRequest) return undefined
    let active = true
    let timer
    const query = new URLSearchParams({ access_token: accessToken })
    if (sessionId) query.set("session_id", sessionId)
    if (bookingId) query.set("booking_id", bookingId)

    api.get(`/api/public/booking/status?${query}`)
      .then(({ data }) => {
        if (!active) return
        setBooking(data.booking)
        setError("")
        if ((data.booking.status === "pending_payment" || data.booking.paymentStatus === "pending") && attempt < 4) {
          timer = window.setTimeout(() => setAttempt((current) => current + 1), 2000)
        }
      })
      .catch((requestError) => {
        if (active) setError(getApiError(requestError, "We couldn't verify this booking yet."))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      if (timer) window.clearTimeout(timer)
    }
  }, [accessToken, attempt, bookingId, invalidRequest, sessionId])

  const retry = () => {
    setLoading(true)
    setError("")
    setAttempt((current) => current + 1)
  }

  if (invalidRequest) {
    return <ErrorState title="Booking details are missing" message="Open the complete confirmation link from Stripe or your booking flow." />
  }
  if (loading && !booking) return <LoadingState label="Confirming booking" rows={4} />
  if (error && !booking) return <ErrorState title="Confirmation unavailable" message={error} onRetry={retry} />

  const copy = statusCopy(booking)
  const service = typeof booking?.serviceId === "object" ? booking.serviceId : location.state?.service

  return (
    <Card className="mx-auto max-w-2xl shadow-[0_24px_70px_rgba(85,43,65,0.10)]">
      <CardHeader className="text-center">
        <Badge variant="secondary" className={copy.success ? "mx-auto bg-success-surface text-success" : "mx-auto"}>
          {copy.label}
        </Badge>
        <CardTitle className="mt-3 text-2xl">{copy.title}</CardTitle>
        <CardDescription className="mx-auto max-w-lg text-base leading-6">{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {booking && (
          <div className="divide-y rounded-xl border bg-muted/30 px-4 sm:px-5">
            <div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]">
              <span className="text-sm text-muted-foreground">Service</span>
              <span className="text-sm font-medium text-foreground">{service?.name || "Appointment"}</span>
            </div>
            <div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]">
              <span className="text-sm text-muted-foreground">Date and time</span>
              <span className="text-sm font-medium text-foreground">
                {formatBookingDate(booking.date)} · {formatTimeRange(booking.startTime, booking.endTime)}
              </span>
            </div>
            <div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]">
              <span className="text-sm text-muted-foreground">Customer</span>
              <span className="text-sm font-medium text-foreground">{booking.customerName} · {booking.customerEmail}</span>
            </div>
            <div className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr]">
              <span className="text-sm text-muted-foreground">Payment</span>
              <span className="text-sm font-medium text-foreground">
                {booking.paymentStatus === "not_required" ? "Free booking" : `${formatMoney(booking.amount, booking.currency)} · ${booking.paymentStatus}`}
              </span>
            </div>
          </div>
        )}

        {error && <p className="rounded-lg border border-warning/25 bg-warning-surface px-4 py-3 text-sm text-warning" role="status">{error}</p>}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {booking?.customerCalendarUrl && booking.status === "confirmed" && (
            <Button asChild>
              <a href={booking.customerCalendarUrl} target="_blank" rel="noreferrer">Add to Google Calendar</a>
            </Button>
          )}
          {!copy.success && <Button onClick={retry} disabled={loading}>{loading ? "Checking" : "Refresh status"}</Button>}
          <Button variant="outline" asChild>
            <Link to={slug ? `/b/${slug}` : "/"}>{slug ? "Return to booking page" : "Return to ServMi"}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
