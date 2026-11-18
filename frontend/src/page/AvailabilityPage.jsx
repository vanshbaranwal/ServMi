import { PageHeader } from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export default function AvailabilityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Working hours"
        title="Availability"
        description="Set reusable weekly windows. Bookable times are generated from each service duration."
        actions={<Button>Save schedule</Button>}
      />
      <Card>
        <CardContent className="divide-y p-0">
          {days.map((day, index) => (
            <div key={day} className="grid gap-3 px-4 py-4 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:px-6">
              <div className="flex items-center justify-between sm:block">
                <p className="text-sm font-medium">{day}</p>
                <Badge variant="secondary" className="sm:hidden">{index < 5 ? "Available" : "Closed"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{index < 5 ? "09:00 – 17:00" : "No hours added"}</p>
              <Button variant="ghost" size="sm" className="justify-self-start sm:justify-self-end">Edit</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
