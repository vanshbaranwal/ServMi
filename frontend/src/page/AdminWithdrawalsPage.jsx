import { EmptyState } from "@/components/AsyncState"
import { PageHeader } from "@/components/PageHeader"
import { Button } from "@/components/ui/button"

export default function AdminWithdrawalsPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin workspace" title="Withdrawals" description="Move requests through pending, processing, paid, or rejected with a usable UPI destination and transfer reference." />
      <EmptyState title="No withdrawal requests" message="Requests will appear here with provider details, the held ledger amount, payout snapshot, and allowed status actions." action={<Button variant="outline">Refresh queue</Button>} />
    </div>
  )
}
