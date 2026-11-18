import { MetricCard } from "@/components/MetricCard"
import { ModuleNotice } from "@/components/ModuleNotice"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin workspace" title="Platform overview" description="Monitor providers, captured revenue, wallet credits, and items that need review." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Providers" value="0" detail="Registered businesses" />
        <MetricCard label="Paid bookings" value="0" detail="Captured payments" />
        <MetricCard label="Platform fees" value="₹0" detail="From paid bookings" />
        <MetricCard label="Payment reviews" value="0" detail="Manual action required" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <ModuleNotice title="Admin data contract is ready" description="Summary, users, withdrawals, recent bookings, and payment review records share one protected dashboard response." />
        <Card>
          <CardHeader><CardTitle>Operational status</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b pb-3"><span>Withdrawal queue</span><Badge variant="secondary">Clear</Badge></div>
            <div className="flex items-center justify-between border-b pb-3"><span>Ledger difference</span><Badge className="bg-success-surface text-success">₹0</Badge></div>
            <div className="flex items-center justify-between"><span>Payment reviews</span><Badge variant="secondary">None</Badge></div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
