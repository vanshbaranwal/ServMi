import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Booking catalogue"
        title="Services"
        description="Create the offers clients can choose from on your public booking page."
        actions={<Button>Add service</Button>}
      />
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Your first service</CardTitle>
              <CardDescription className="mt-1">A clear service card will show its duration, price, and availability.</CardDescription>
            </div>
            <Badge variant="secondary">Draft</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 rounded-xl border border-dashed bg-muted/50 p-5 sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Duration</p><p className="mt-1 text-sm font-medium">30 minutes</p></div>
            <div><p className="text-xs text-muted-foreground">Price</p><p className="mt-1 text-sm font-medium">Free or paid</p></div>
            <div><p className="text-xs text-muted-foreground">Visibility</p><p className="mt-1 text-sm font-medium">Inactive until ready</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
