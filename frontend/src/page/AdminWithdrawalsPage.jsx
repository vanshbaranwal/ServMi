import { useEffect, useMemo, useState } from "react"

import { AdminWithdrawalDialog } from "@/components/AdminWithdrawalDialog"
import { EmptyState, ErrorState, LoadingState } from "@/components/AsyncState"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDate, formatMoney, formatStatus } from "@/lib/formatters"
import { useAdminDashboardStore } from "@/store/useAdminDashboardStore"

const filters = ["pending", "processing", "paid", "rejected", "all"]

const statusClass = (status) => {
  if (status === "paid") return "bg-success-surface text-success"
  if (["pending", "processing"].includes(status)) return "bg-warning-surface text-warning"
  return ""
}

export default function AdminWithdrawalsPage() {
  const withdrawals = useAdminDashboardStore((state) => state.withdrawals)
  const paymentReviews = useAdminDashboardStore((state) => state.paymentReviews)
  const loading = useAdminDashboardStore((state) => state.loading)
  const error = useAdminDashboardStore((state) => state.error)
  const loadDashboard = useAdminDashboardStore((state) => state.loadDashboard)
  const updateWithdrawal = useAdminDashboardStore((state) => state.updateWithdrawal)
  const [activeFilter, setActiveFilter] = useState("pending")
  const [action, setAction] = useState(null)

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const reviewProviderIds = useMemo(() => new Set(paymentReviews.map((review) => (
    String(typeof review.userId === "object" ? review.userId?._id : review.userId)
  ))), [paymentReviews])

  const visibleWithdrawals = useMemo(() => withdrawals.filter((withdrawal) => (
    activeFilter === "all" || withdrawal.status === activeFilter
  )), [activeFilter, withdrawals])

  if (loading && !withdrawals.length) return <LoadingState label="Loading withdrawal queue" rows={5} />
  if (error && !withdrawals.length) return <ErrorState message={error} onRetry={loadDashboard} />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin workspace"
        title="Withdrawals"
        description="Move requests through supported states only after checking the held amount and payout destination."
        actions={<Button variant="outline" onClick={loadDashboard} disabled={loading}>{loading ? "Refreshing" : "Refresh queue"}</Button>}
      />

      <Card className="shadow-none">
        <CardContent className="flex flex-wrap gap-2 p-4" aria-label="Withdrawal status filters">
          {filters.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={activeFilter === filter ? "default" : "outline"}
              onClick={() => setActiveFilter(filter)}
            >
              {formatStatus(filter)}
              <span className="ml-1 opacity-70">
                {filter === "all" ? withdrawals.length : withdrawals.filter((item) => item.status === filter).length}
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>

      {!visibleWithdrawals.length ? (
        <EmptyState
          title={`No ${activeFilter === "all" ? "" : `${activeFilter} `}withdrawal requests`}
          message="Requests appear here with the provider, held amount, payout snapshot, and supported status actions."
          action={activeFilter !== "all" ? <Button variant="outline" onClick={() => setActiveFilter("all")}>View all requests</Button> : null}
        />
      ) : (
        <div className="space-y-3">
          {visibleWithdrawals.map((withdrawal) => {
            const provider = withdrawal.userId || {}
            const providerId = String(typeof withdrawal.userId === "object" ? withdrawal.userId?._id : withdrawal.userId)
            const blockedByReview = reviewProviderIds.has(providerId)
            const terminal = ["paid", "rejected"].includes(withdrawal.status)
            return (
              <Card key={withdrawal._id}>
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-foreground">{provider.businessName || provider.name || "Provider"}</h2>
                        <Badge variant="secondary" className={statusClass(withdrawal.status)}>{formatStatus(withdrawal.status)}</Badge>
                        {blockedByReview && <Badge className="bg-warning-surface text-warning">Payment under review</Badge>}
                      </div>
                      <p className="mt-1 break-all text-sm text-muted-foreground">{provider.email}</p>
                      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-muted-foreground">Amount</p>
                          <p className="mt-1 font-semibold text-foreground">{formatMoney(withdrawal.amount, withdrawal.currency)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">UPI ID</p>
                          <p className="mt-1 break-all font-medium text-foreground">{withdrawal.payoutSnapshot?.upiId || "Unavailable"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Requested</p>
                          <p className="mt-1 font-medium text-foreground">{formatDate(withdrawal.createdAt)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Bank fallback</p>
                          <p className="mt-1 font-medium text-foreground">
                            {withdrawal.payoutSnapshot?.accountLast4
                              ? `${withdrawal.payoutSnapshot.bankName || "Bank"} · •••• ${withdrawal.payoutSnapshot.accountLast4}`
                              : "Not provided"}
                          </p>
                        </div>
                      </div>
                      {(withdrawal.adminNote || withdrawal.transferReference) && (
                        <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                          {withdrawal.transferReference && <p>Transfer reference: {withdrawal.transferReference}</p>}
                          {withdrawal.adminNote && <p className={withdrawal.transferReference ? "mt-1" : ""}>Admin note: {withdrawal.adminNote}</p>}
                        </div>
                      )}
                    </div>

                    {!terminal && (
                      <div className="flex flex-wrap gap-2 border-t pt-4 lg:max-w-64 lg:justify-end lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                        {withdrawal.status === "pending" && (
                          <Button
                            onClick={() => setAction({ withdrawal, targetStatus: "processing" })}
                            disabled={blockedByReview}
                          >
                            Start processing
                          </Button>
                        )}
                        {withdrawal.status === "processing" && (
                          <Button
                            onClick={() => setAction({ withdrawal, targetStatus: "paid" })}
                            disabled={blockedByReview}
                          >
                            Mark paid
                          </Button>
                        )}
                        <Button variant="destructive" onClick={() => setAction({ withdrawal, targetStatus: "rejected" })}>
                          Reject
                        </Button>
                        {blockedByReview && <p className="w-full text-sm leading-5 text-warning">Processing is paused until the provider's payment review is resolved.</p>}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {action && (
        <AdminWithdrawalDialog
          key={`${action.withdrawal._id}-${action.targetStatus}`}
          withdrawal={action.withdrawal}
          targetStatus={action.targetStatus}
          onClose={() => setAction(null)}
          onUpdated={updateWithdrawal}
        />
      )}
    </div>
  )
}
