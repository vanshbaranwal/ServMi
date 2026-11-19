import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"

import { ErrorState, LoadingState } from "@/components/AsyncState"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api, getApiError } from "@/lib/api"
import { formatBookingDate, formatTimeRange } from "@/lib/booking"

export default function BookingCancelledPage() {
  const [searchParams] = useSearchParams()
  const bookingId = searchParams.get("booking_id")
  const accessToken = searchParams.get("access_token")
  const slug = searchParams.get("slug")
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const invalidRequest = !bookingId || !accessToken

  useEffect(() => {
    if (invalidRequest) return undefined
    let active = true
    api.post("/api/public/booking/cancel-payment", {
      booking_id: bookingId,
      access_token: accessToken,
    })
      .then(({ data }) => {
        if (!active) return
        setResult({ kind: "cancelled", message: data.message, booking: data.booking })
        setError("")
      })
      .catch((requestError) => {
        if (!active) return
        const message = getApiError(requestError, "We couldn't release this time yet.")
        if (requestError.response?.status === 409) {
          setResult({ kind: "attention", message })
          setError("")
        } else {
          setError(message)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [accessToken, attempt, bookingId, invalidRequest])

  const retry = () => {
    setLoading(true)
    setError("")
    setAttempt((current) => current + 1)
  }

  if (invalidRequest) {
    return <ErrorState title="Checkout details are missing" message="Open the complete cancellation link from Stripe Checkout." />
  }
  if (loading && !result) return <LoadingState label="Releasing held booking time" rows={3} />
  if (error && !result) return <ErrorState title="Checkout cancellation is incomplete" message={error} onRetry={retry} />

  const statusQuery = new URLSearchParams({
    booking_id: bookingId,
    access_token: accessToken,
    ...(slug ? { slug } : {}),
  })
  const attention = result?.kind === "attention"

  return (
    <Card className="mx-auto max-w-2xl text-center shadow-[0_24px_70px_rgba(85,43,65,0.10)]">
      <CardHeader>
        <Badge variant="secondary" className="mx-auto bg-warning-surface text-warning">
          {attention ? "Check payment status" : "Checkout closed"}
        </Badge>
        <CardTitle className="mt-3 text-2xl">
          {attention ? "This checkout needs another look" : "The payment was not completed"}
        </CardTitle>
        <CardDescription className="mx-auto max-w-lg text-base leading-6">
          {attention
            ? result?.message
            : "The Stripe session has been closed and the held appointment time is available again."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {result?.booking && (
          <div className="rounded-xl border bg-muted/30 p-4 text-left text-sm">
            <p className="font-medium text-foreground">Released appointment</p>
            <p className="mt-1 text-muted-foreground">
              {formatBookingDate(result.booking.date)} · {formatTimeRange(result.booking.startTime, result.booking.endTime)}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {attention && (
            <Button asChild>
              <Link to={`/booking/success?${statusQuery}`}>Check booking status</Link>
            </Button>
          )}
          <Button variant={attention ? "outline" : "default"} asChild>
            <Link to={slug ? `/b/${slug}` : "/"}>{slug ? "Choose another time" : "Return to ServMi"}</Link>
          </Button>
          {attention && <Button variant="ghost" onClick={retry} disabled={loading}>{loading ? "Trying" : "Try release again"}</Button>}
        </div>
      </CardContent>
    </Card>
  )
}
