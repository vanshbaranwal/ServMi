import { EmptyState } from "@/components/AsyncState"
import { PageHeader } from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function BookingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Schedule"
        title="Bookings"
        description="Review upcoming appointments and keep client changes easy to understand."
      />
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" aria-label="Booking filters">
            <Button size="sm">Upcoming</Button>
            <Button size="sm" variant="outline">Past</Button>
            <Button size="sm" variant="outline">Rescheduled</Button>
          </div>
          <Button size="sm" variant="ghost">Today</Button>
        </CardContent>
      </Card>
      <EmptyState
        title="No bookings yet"
        message="Confirmed client appointments will appear here with their service, time, payment state, and available actions."
        action={<Button variant="outline">Copy booking link</Button>}
      />
    </div>
  )
}
