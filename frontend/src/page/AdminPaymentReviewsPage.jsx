import { useEffect, useMemo, useState } from "react"

import { EmptyState, ErrorState, LoadingState } from "@/components/AsyncState"
import { PageHeader } from "@/components/PageHeader"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDate, formatMoney, formatStatus } from "@/lib/formatters"
import { useAdminDashboardStore } from "@/store/useAdminDashboardStore"

const filters = ["all", "refund_pending", "refund_failed", "paid"]

const paymentBadgeClass = (status) => {
  if (status === "refunded") return "bg-success-surface text-success"
  if (["refund_pending", "paid"].includes(status)) return "bg-warning-surface text-warning"
  if (["refund_failed", "failed"].includes(status)) return "bg-destructive/10 text-destructive"
  return ""
}

export default function AdminPaymentReviewsPage() {
  const paymentReviews = useAdminDashboardStore((state) => state.paymentReviews)
  const loading = useAdminDashboardStore((state) => state.loading)
  const error = useAdminDashboardStore((state) => state.error)
  const loadDashboard = useAdminDashboardStore((state) => state.loadDashboard)
  const [activeFilter, setActiveFilter] = useState("all")

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const visibleReviews = useMemo(() => paymentReviews.filter((booking) => (
    activeFilter === "all" || booking.paymentStatus === activeFilter
  )), [activeFilter, paymentReviews])

  if (loading && !paymentReviews.length) return <LoadingState label="Loading payment reviews" rows={5} />
  if (error && !paymentReviews.length) return <ErrorState message={error} onRetry={loadDashboard} />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin workspace"
        title="Payment reviews"
        description="Inspect bookings that need Stripe and wallet reconciliation before provider withdrawals can continue."
        actions={<Button variant="outline" onClick={loadDashboard} disabled={loading}>{loading ? "Refreshing" : "Refresh reviews"}</Button>}
      />

      <Alert className="border-warning/30 bg-warning-surface/60">
        <AlertTitle>Review-only workspace</AlertTitle>
        <AlertDescription>
          ServMi does not expose a manual resolution action yet. Resolve the refund or payment issue through the existing Stripe and backend reconciliation flow; affected provider withdrawals remain paused meanwhile.
        </AlertDescription>
      </Alert>

      <Card className="shadow-none">
        <CardContent className="flex flex-wrap gap-2 p-4" aria-label="Payment review status filters">
          {filters.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={activeFilter === filter ? "default" : "outline"}
              onClick={() => setActiveFilter(filter)}
            >
              {formatStatus(filter)}
              <span className="ml-1 opacity-70">
                {filter === "all" ? paymentReviews.length : paymentReviews.filter((item) => item.paymentStatus === filter).length}
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>

      {!visibleReviews.length ? (
        <EmptyState
          title={activeFilter === "all" ? "No payment reviews" : `No ${formatStatus(activeFilter).toLowerCase()} reviews`}
          message={activeFilter === "all"
            ? "Bookings that require manual Stripe and wallet reconciliation will appear here."
            : "Choose another status to inspect the remaining review queue."}
          action={activeFilter !== "all" ? <Button variant="outline" onClick={() => setActiveFilter("all")}>View all reviews</Button> : null}
        />
      ) : (
        <div className="space-y-3">
          {visibleReviews.map((booking) => (
            <Card key={booking._id}>
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">{booking.serviceId?.name || "Booking payment"}</h2>
                      <Badge variant="secondary" className={paymentBadgeClass(booking.paymentStatus)}>{formatStatus(booking.paymentStatus)}</Badge>
                      <Badge variant="outline">{formatStatus(booking.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {booking.userId?.businessName || booking.userId?.name || "Provider"} · {booking.customerName || "Customer"}
                    </p>

                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-muted-foreground">Payment amount</p>
                        <p className="mt-1 font-semibold text-foreground">{formatMoney(booking.amount, booking.currency)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Appointment</p>
                        <p className="mt-1 font-medium text-foreground">{formatDate(booking.date)} · {booking.startTime || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Last updated</p>
                        <p className="mt-1 font-medium text-foreground">{formatDate(booking.updatedAt)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Provider payout</p>
                        <p className="mt-1 font-medium text-foreground">{formatMoney(booking.providerPayoutAmount, booking.currency)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-muted/40 p-4 text-sm lg:w-80 lg:shrink-0">
                    <p className="font-semibold text-foreground">Reconciliation context</p>
                    <p className="mt-2 leading-5 text-muted-foreground">{booking.paymentReviewReason || "No review reason was recorded."}</p>
                    <dl className="mt-4 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted-foreground">Payment intent</dt>
                        <dd className="max-w-44 break-all text-right font-medium text-foreground">{booking.stripePaymentIntentId || "Unavailable"}</dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-muted-foreground">Refund</dt>
                        <dd className="max-w-44 break-all text-right font-medium text-foreground">{booking.stripeRefundId || "Not recorded"}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
