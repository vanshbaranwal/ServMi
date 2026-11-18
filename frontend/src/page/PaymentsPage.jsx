import { PageHeader } from "@/components/PageHeader"
import { MetricCard } from "@/components/MetricCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Wallet and payouts"
        title="Payments"
        description="Understand earned, held, withdrawn, and reviewed amounts in paise-safe totals."
        actions={<Button>Request withdrawal</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Available" value="₹0" detail="Ready to withdraw" />
        <MetricCard label="Earned" value="₹0" detail="Paid booking income" />
        <MetricCard label="Pending" value="₹0" detail="Withdrawal requests" />
        <MetricCard label="Paid out" value="₹0" detail="Completed withdrawals" />
      </div>
      <Alert className="bg-card">
        <AlertTitle>Add a UPI payout destination</AlertTitle>
        <AlertDescription>A verified UPI ID is required before a withdrawal can be submitted.</AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Booking credits, withdrawal holds, and reversals will appear here.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
