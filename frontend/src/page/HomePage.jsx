import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  {
    number: "01",
    title: "A booking page that feels like your business",
    description: "Share one clear link for services, availability, email verification, and payment.",
  },
  {
    number: "02",
    title: "A schedule you can understand at a glance",
    description: "See upcoming work, reschedule free bookings, and keep customers informed.",
  },
  {
    number: "03",
    title: "Payments with visible states",
    description: "Track earnings, withdrawals, refunds, and reviews without guessing what happened.",
  },
]

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden py-16 sm:py-24 lg:py-28">
        <div className="soft-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="app-container relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="mb-5">For independent service providers</Badge>
            <h1 className="text-4xl font-semibold leading-[1.04] tracking-[-0.055em] text-foreground sm:text-5xl lg:text-6xl">
              Your services, schedule, and payments in one calm workspace.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-secondary-foreground sm:text-lg">
              ServMi helps clients book confidently while you stay in control of availability, customer updates, and payouts.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link to="/register">Start with ServMi</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/book/demo-studio">Preview a booking page</Link>
              </Button>
            </div>
          </div>

          <Card className="relative border-strong-border bg-card shadow-[0_28px_90px_rgba(85,43,65,0.12)]">
            <CardContent className="p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4 border-b pb-5">
                <div>
                  <p className="text-sm font-semibold">Today</p>
                  <p className="mt-1 text-sm text-muted-foreground">Your next bookings</p>
                </div>
                <Badge className="bg-success-surface text-success">2 confirmed</Badge>
              </div>
              <div className="space-y-3 py-5">
                {[
                  ["10:00", "Strategy session", "Aarav Mehta"],
                  ["14:30", "Portfolio review", "Naina Sharma"],
                ].map(([time, service, customer]) => (
                  <div key={time} className="grid grid-cols-[4.5rem_1fr] gap-3 rounded-xl border bg-muted/60 p-4">
                    <span className="text-sm font-semibold text-accent-foreground">{time}</span>
                    <span>
                      <span className="block text-sm font-medium text-foreground">{service}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{customer}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-secondary p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-foreground">Available balance</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-foreground">₹12,450</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="app-container pb-16 sm:pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.number} className="shadow-none">
              <CardContent className="p-6">
                <span className="text-xs font-semibold tracking-[0.16em] text-muted-foreground">{feature.number}</span>
                <h2 className="mt-5 text-lg font-semibold tracking-[-0.025em]">{feature.title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  )
}
