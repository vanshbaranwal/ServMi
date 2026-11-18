import { useParams } from "react-router-dom"

import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const demoServices = [
  { name: "Intro consultation", detail: "30 minutes", price: "Free" },
  { name: "Focused session", detail: "60 minutes", price: "₹1,200" },
]

export default function BookingPage() {
  const { slug } = useParams()
  const displayName = slug === "demo-studio" ? "Studio North" : slug?.replaceAll("-", " ")

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Book an appointment"
        title={displayName || "Service provider"}
        description="Choose a service first. Available dates and times will follow in a clear step-by-step flow."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">1. Choose a service</h2>
            <Badge variant="secondary">Step 1 of 3</Badge>
          </div>
          {demoServices.map((service, index) => (
            <Card key={service.name} className={index === 0 ? "ring-2 ring-primary" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{service.name}</CardTitle>
                    <CardDescription className="mt-1">A concise description of what the client receives.</CardDescription>
                  </div>
                  <span className="text-sm font-semibold text-accent-foreground">{service.price}</span>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{service.detail}</CardContent>
            </Card>
          ))}
        </div>

        <Card className="h-fit lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Booking summary</CardTitle>
            <CardDescription>Your choices stay visible as you continue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-muted p-4 text-sm">
              <p className="font-medium">Intro consultation</p>
              <p className="mt-1 text-muted-foreground">30 minutes · Free</p>
            </div>
            <label className="block text-sm font-medium" htmlFor="booking-date">Preferred date</label>
            <Input id="booking-date" type="date" className="h-10" />
            <Button className="h-10 w-full" disabled>Continue to a time</Button>
            <p className="text-xs leading-5 text-muted-foreground">Live service and slot data will be connected in the public booking feature build.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
