import { EmptyState } from "@/components/AsyncState"
import { PageHeader } from "@/components/PageHeader"

export default function AdminPaymentReviewsPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin workspace" title="Payment reviews" description="External Stripe refunds and disputes pause provider withdrawals until the wallet record is reconciled." />
      <EmptyState title="No payment reviews" message="Bookings that need manual Stripe and wallet reconciliation will be isolated here before a provider can withdraw funds." />
    </div>
  )
}
