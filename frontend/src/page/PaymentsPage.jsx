import { useCallback, useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { EmptyState, ErrorState, LoadingState } from "@/components/AsyncState"
import { FormField } from "@/components/FormField"
import { MetricCard } from "@/components/MetricCard"
import { PageHeader } from "@/components/PageHeader"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { api, getApiError } from "@/lib/api"
import { createRequestId, formatDate, formatMoney, formatStatus } from "@/lib/formatters"

const emptyOverview = {
  payoutDetails: {},
  wallet: {
    earned: 0,
    available: 0,
    pendingWithdrawals: 0,
    paidWithdrawals: 0,
    withdrawnOrPending: 0,
    underReview: false,
  },
  transactions: [],
  withdrawals: [],
}

const payoutFormFrom = (details = {}) => ({
  accountHolderName: details.accountHolderName || "",
  upiId: details.upiId || "",
  bankName: details.bankName || "",
  accountNumber: "",
  ifsc: details.ifsc || "",
})

const transactionSign = (transaction) => (
  transaction.type === "booking_payout" || transaction.type === "withdrawal_reversal" ? "+" : "−"
)

const statusClass = (status) => {
  if (["available", "paid"].includes(status)) return "bg-success-surface text-success"
  if (["pending", "processing"].includes(status)) return "bg-warning-surface text-warning"
  return ""
}

export default function PaymentsPage() {
  const [overview, setOverview] = useState(emptyOverview)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [payoutForm, setPayoutForm] = useState(() => payoutFormFrom())
  const [payoutError, setPayoutError] = useState("")
  const [savingPayout, setSavingPayout] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawError, setWithdrawError] = useState("")
  const [withdrawRequestId, setWithdrawRequestId] = useState("")
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false)

  const loadOverview = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true)
    setError("")
    try {
      const { data } = await api.get("/api/payments")
      setOverview({ ...emptyOverview, ...data, wallet: { ...emptyOverview.wallet, ...data.wallet } })
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't load your payment overview."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    api.get("/api/payments")
      .then(({ data }) => {
        if (active) setOverview({ ...emptyOverview, ...data, wallet: { ...emptyOverview.wallet, ...data.wallet } })
      })
      .catch((requestError) => {
        if (active) setError(getApiError(requestError, "We couldn't load your payment overview."))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const openPayout = () => {
    setPayoutForm(payoutFormFrom(overview.payoutDetails))
    setPayoutError("")
    setPayoutOpen(true)
  }

  const updatePayout = (event) => {
    setPayoutError("")
    setPayoutForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const savePayout = async (event) => {
    event.preventDefault()
    if (!payoutForm.accountHolderName.trim() || !payoutForm.upiId.trim()) {
      setPayoutError("Account holder and UPI ID are required.")
      return
    }
    if (payoutForm.accountNumber && (!payoutForm.bankName || !payoutForm.ifsc)) {
      setPayoutError("Enter the bank name and IFSC with the new account number.")
      return
    }
    if (!payoutForm.accountNumber && !overview.payoutDetails?.accountLast4 && (payoutForm.bankName || payoutForm.ifsc)) {
      setPayoutError("Enter the bank name, account number, and IFSC together, or leave all bank fields empty.")
      return
    }

    setSavingPayout(true)
    setPayoutError("")
    try {
      const { data } = await api.put("/api/payments/payout-details", {
        accountHolderName: payoutForm.accountHolderName.trim(),
        upiId: payoutForm.upiId.trim(),
        bankName: payoutForm.bankName.trim(),
        accountNumber: payoutForm.accountNumber.trim(),
        ifsc: payoutForm.ifsc.trim(),
      })
      setOverview((current) => ({ ...current, payoutDetails: data.payoutDetails }))
      setPayoutOpen(false)
      toast.success("Payout details saved")
    } catch (requestError) {
      setPayoutError(getApiError(requestError, "We couldn't save your payout details."))
    } finally {
      setSavingPayout(false)
    }
  }

  const openWithdrawal = () => {
    setWithdrawAmount("")
    setWithdrawError("")
    setWithdrawRequestId(createRequestId())
    setWithdrawOpen(true)
  }

  const requestWithdrawal = async (event) => {
    event.preventDefault()
    const numericAmount = Number(withdrawAmount)
    const amount = Math.round(numericAmount * 100)
    if (!Number.isFinite(numericAmount) || Math.abs((numericAmount * 100) - amount) > 0.000001
      || !Number.isSafeInteger(amount) || amount < 100) {
      setWithdrawError("Enter an amount of at least ₹1.00.")
      return
    }
    if (amount > overview.wallet.available) {
      setWithdrawError("This amount is higher than your available balance.")
      return
    }

    setRequestingWithdrawal(true)
    setWithdrawError("")
    try {
      const { data } = await api.post("/api/payments/withdrawals", { amount }, {
        headers: { "Idempotency-Key": withdrawRequestId },
      })
      toast.success(data.message || "Withdrawal requested")
      setWithdrawOpen(false)
      await loadOverview({ showLoading: false })
    } catch (requestError) {
      setWithdrawError(getApiError(requestError, "We couldn't submit this withdrawal."))
    } finally {
      setRequestingWithdrawal(false)
    }
  }

  if (loading) return <LoadingState label="Loading payments" rows={6} />
  if (error) return <ErrorState message={error} onRetry={loadOverview} />

  const { wallet, payoutDetails, transactions, withdrawals } = overview
  const canWithdraw = payoutDetails?.isComplete && wallet.available >= 100 && !wallet.underReview

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Wallet and payouts"
        title="Payments"
        description="See exactly what you earned, what is available, and where each withdrawal stands."
        actions={<Button onClick={openWithdrawal} disabled={!canWithdraw}>Request withdrawal</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Available" value={formatMoney(wallet.available)} detail="Ready to withdraw" />
        <MetricCard label="Earned" value={formatMoney(wallet.earned)} detail="After platform fees" />
        <MetricCard label="Pending" value={formatMoney(wallet.pendingWithdrawals)} detail="Withdrawal requests" />
        <MetricCard label="Paid out" value={formatMoney(wallet.paidWithdrawals)} detail="Completed withdrawals" />
      </div>

      {wallet.underReview ? (
        <Alert className="border-warning/30 bg-warning-surface">
          <AlertTitle>Withdrawals are temporarily paused</AlertTitle>
          <AlertDescription>A payment needs admin review. Your balance remains visible, and withdrawals resume after the review is resolved.</AlertDescription>
        </Alert>
      ) : !payoutDetails?.isComplete ? (
        <Alert className="bg-card">
          <AlertTitle>Add payout details</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>Add an account holder and valid UPI ID before requesting a withdrawal.</span>
            <Button variant="outline" size="sm" onClick={openPayout}>Set up payouts</Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Recent wallet activity</CardTitle>
            <CardDescription>Booking credits, withdrawal holds, and returned holds are recorded in paise and shown here in rupees.</CardDescription>
          </CardHeader>
          <CardContent>
            {!transactions.length ? (
              <EmptyState title="No wallet activity yet" message="Paid booking earnings and withdrawal movements will appear here." />
            ) : (
              <div className="divide-y">
                {transactions.map((transaction) => (
                  <div key={transaction._id} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{transaction.description || transaction.type.replaceAll("_", " ")}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">{formatDate(transaction.createdAt)}</span>
                        <Badge variant="secondary" className={statusClass(transaction.status)}>{formatStatus(transaction.status || "recorded")}</Badge>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-foreground">
                      {transactionSign(transaction)}{formatMoney(transaction.amount, transaction.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <div className="mb-1">
              <Badge variant="secondary" className={payoutDetails?.isComplete ? "bg-success-surface text-success" : ""}>
                {payoutDetails?.isComplete ? "Ready" : "Setup required"}
              </Badge>
            </div>
            <CardTitle>Payout destination</CardTitle>
            <CardDescription>Withdrawals are sent using the details saved here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {payoutDetails?.isComplete ? (
              <>
                <div>
                  <p className="text-muted-foreground">Account holder</p>
                  <p className="mt-1 font-medium">{payoutDetails.accountHolderName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">UPI ID</p>
                  <p className="mt-1 break-all font-medium">{payoutDetails.upiId}</p>
                </div>
                {payoutDetails.accountLast4 && (
                  <div>
                    <p className="text-muted-foreground">Bank account</p>
                    <p className="mt-1 font-medium">{payoutDetails.bankName} · •••• {payoutDetails.accountLast4}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="leading-6 text-muted-foreground">No payout destination has been completed.</p>
            )}
            <Button variant="outline" className="w-full" onClick={openPayout}>
              {payoutDetails?.isComplete ? "Edit payout details" : "Add payout details"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Withdrawal requests</CardTitle>
          <CardDescription>Pending, processing, paid, and rejected requests remain visible for reference.</CardDescription>
        </CardHeader>
        <CardContent>
          {!withdrawals.length ? (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No withdrawals have been requested yet.</p>
          ) : (
            <div className="divide-y">
              {withdrawals.map((withdrawal) => (
                <div key={withdrawal._id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{formatMoney(withdrawal.amount, withdrawal.currency)}</p>
                      <Badge variant="secondary" className={statusClass(withdrawal.status)}>{formatStatus(withdrawal.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Requested {formatDate(withdrawal.createdAt)}</p>
                  </div>
                  {(withdrawal.transferReference || withdrawal.adminNote) && (
                    <p className="max-w-md text-sm text-muted-foreground">
                      {withdrawal.transferReference ? `Reference: ${withdrawal.transferReference}` : withdrawal.adminNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={savePayout}>
            <DialogHeader>
              <DialogTitle>Payout details</DialogTitle>
              <DialogDescription>A valid UPI ID is required. Bank details are optional and stored only as the last four account digits.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-6">
              <FormField id="payout-holder" label="Account holder name">
                <Input id="payout-holder" name="accountHolderName" value={payoutForm.accountHolderName} onChange={updatePayout} required />
              </FormField>
              <FormField id="payout-upi" label="UPI ID">
                <Input id="payout-upi" name="upiId" value={payoutForm.upiId} onChange={updatePayout} placeholder="name@bank" required />
              </FormField>
              <div className="border-t pt-5">
                <p className="mb-4 text-sm font-semibold">Optional bank payout details</p>
                <div className="space-y-5">
                  <FormField id="payout-bank" label="Bank name">
                    <Input id="payout-bank" name="bankName" value={payoutForm.bankName} onChange={updatePayout} />
                  </FormField>
                  <FormField id="payout-account" label="Account number" hint={payoutDetails?.accountLast4 ? `Leave blank to keep •••• ${payoutDetails.accountLast4}` : "Optional"}>
                    <Input id="payout-account" name="accountNumber" value={payoutForm.accountNumber} onChange={updatePayout} inputMode="numeric" autoComplete="off" />
                  </FormField>
                  <FormField id="payout-ifsc" label="IFSC">
                    <Input id="payout-ifsc" name="ifsc" value={payoutForm.ifsc} onChange={updatePayout} className="uppercase" />
                  </FormField>
                </div>
              </div>
              {payoutError && <p className="text-sm text-destructive" role="alert">{payoutError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayoutOpen(false)} disabled={savingPayout}>Cancel</Button>
              <Button type="submit" disabled={savingPayout}>
                {savingPayout && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                {savingPayout ? "Saving" : "Save payout details"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={requestWithdrawal}>
            <DialogHeader>
              <DialogTitle>Request withdrawal</DialogTitle>
              <DialogDescription>Available now: {formatMoney(wallet.available)}. The request will remain pending until reviewed.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-6">
              <FormField id="withdraw-amount" label="Amount in rupees">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₹</span>
                  <Input
                    id="withdraw-amount"
                    type="number"
                    min="1"
                    step="0.01"
                    value={withdrawAmount}
                    onChange={(event) => { setWithdrawAmount(event.target.value); setWithdrawError("") }}
                    className="pl-7"
                    autoFocus
                    required
                  />
                </div>
              </FormField>
              <Button type="button" variant="ghost" size="sm" onClick={() => setWithdrawAmount((wallet.available / 100).toFixed(2))}>
                Use full available balance
              </Button>
              {withdrawError && <p className="text-sm text-destructive" role="alert">{withdrawError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWithdrawOpen(false)} disabled={requestingWithdrawal}>Cancel</Button>
              <Button type="submit" disabled={requestingWithdrawal}>
                {requestingWithdrawal && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                {requestingWithdrawal ? "Submitting" : "Request withdrawal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
