import { useEffect } from "react"
import { Link } from "react-router-dom"

import { EmptyState, ErrorState, LoadingState } from "@/components/AsyncState"
import { MetricCard } from "@/components/MetricCard"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, formatMoney } from "@/lib/formatters"
import { useAdminDashboardStore } from "@/store/useAdminDashboardStore"

export default function AdminDashboardPage() {
  const summary = useAdminDashboardStore((state) => state.summary)
  const users = useAdminDashboardStore((state) => state.users)
  const recentBookings = useAdminDashboardStore((state) => state.recentBookings)
  const loading = useAdminDashboardStore((state) => state.loading)
  const error = useAdminDashboardStore((state) => state.error)
  const loadDashboard = useAdminDashboardStore((state) => state.loadDashboard)

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  if (loading && !users.length && !recentBookings.length) {
    return <LoadingState label="Loading platform overview" rows={6} />
  }
  if (error && !users.length && !recentBookings.length) {
    return <ErrorState message={error} onRetry={loadDashboard} />
  }

  const ledgerDifference = Number(summary.payoutLedgerDifference || 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin workspace"
        title="Platform overview"
        description="Monitor providers, paid bookings, platform revenue, and operational queues from the data ServMi records."
        actions={<Button variant="outline" onClick={loadDashboard} disabled={loading}>{loading ? "Refreshing" : "Refresh data"}</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Providers" value={String(summary.users || 0)} detail="Registered accounts" />
        <MetricCard label="Paid bookings" value={String(summary.paidBookings || 0)} detail={`${summary.bookings || 0} total bookings`} />
        <MetricCard label="Gross revenue" value={formatMoney(summary.grossRevenue)} detail="Captured customer payments" />
        <MetricCard label="Platform fees" value={formatMoney(summary.platformFees)} detail="Recorded platform share" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Provider payouts" value={formatMoney(summary.providerPayouts)} detail="Paid booking earnings" />
        <MetricCard label="Available balances" value={formatMoney(summary.usersAvailableBalance)} detail="Across providers" />
        <MetricCard label="Pending withdrawals" value={formatMoney(summary.pendingWithdrawals)} detail="Pending and processing" />
        <MetricCard label="Payment reviews" value={String(summary.paymentReviews || 0)} detail="Withdrawals paused" />
      </div>

      <Card className={ledgerDifference === 0 ? "border-success/25" : "border-warning/30"}>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Payout ledger reconciliation</p>
            <p className="mt-1 text-sm text-muted-foreground">Paid provider allocations compared with wallet booking credits.</p>
          </div>
          <Badge variant="secondary" className={ledgerDifference === 0 ? "bg-success-surface text-success" : "bg-warning-surface text-warning"}>
            Difference {formatMoney(ledgerDifference)}
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Recent providers</CardTitle>
                <CardDescription className="mt-1">Newest registered businesses. This view is intentionally read-only.</CardDescription>
              </div>
              <Badge variant="secondary">{users.length} loaded</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {!users.length ? (
              <EmptyState title="No providers yet" message="Registered provider accounts will appear here." />
            ) : (
              <div className="divide-y">
                {users.slice(0, 8).map((user) => (
                  <div key={user._id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{user.businessName || user.name}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary" className={user.payoutDetails?.isComplete ? "bg-success-surface text-success" : ""}>
                        {user.payoutDetails?.isComplete ? "Payout ready" : "Payout incomplete"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(user.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Recent paid bookings</CardTitle>
                <CardDescription className="mt-1">The latest successfully paid customer appointments.</CardDescription>
              </div>
              <Badge variant="secondary">Latest 10</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {!recentBookings.length ? (
              <EmptyState title="No paid bookings" message="Captured Stripe bookings will appear here." />
            ) : (
              <div className="divide-y">
                {recentBookings.map((booking) => (
                  <div key={booking._id} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{booking.serviceId?.name || "Paid appointment"}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {booking.userId?.businessName || booking.userId?.name || "Provider"} · {booking.customerName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(booking.updatedAt)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-foreground">{formatMoney(booking.amount, booking.currency)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" asChild><Link to="/admin/withdrawals">Open withdrawal queue</Link></Button>
        <Button variant="ghost" asChild><Link to="/admin/payment-reviews">View payment reviews</Link></Button>
      </div>
    </div>
  )
}
