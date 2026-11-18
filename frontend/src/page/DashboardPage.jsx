import { Link } from "react-router-dom"

import { MetricCard } from "@/components/MetricCard"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthStore } from "@/store/useAuthStore"

const setupSteps = [
  ["Add your first service", "Give clients a clear name, duration, and price.", "/services"],
  ["Set your weekly availability", "Choose the hours clients can book.", "/availability"],
  ["Finish your public profile", "Add the details that build trust before booking.", "/profile"],
]

export default function DashboardPage() {
  const user = useAuthStore((state) => state.providerUser)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Provider workspace"
        title={`Good to see you${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="A clear view of your bookings, setup, and payout activity."
        actions={user?.slug && (
          <Button variant="outline" asChild>
            <Link to={`/book/${user.slug}`}>View booking page</Link>
          </Button>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Today's bookings" value="0" detail="Confirmed appointments" />
        <MetricCard label="Upcoming" value="0" detail="Next 7 days" />
        <MetricCard label="Available balance" value="₹0" detail="Ready for withdrawal" />
        <MetricCard label="Public page" value={user?.slug ? "Live" : "Setup"} detail="Booking availability" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Finish the essentials</CardTitle>
            <CardDescription>These three steps prepare the full client booking flow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {setupSteps.map(([title, description, to], index) => (
              <Link key={title} to={to} className="flex gap-4 rounded-xl border p-4 transition-colors hover:bg-muted">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-accent-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{title}</span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2"><Badge className="bg-success-surface text-success">Ready</Badge></div>
            <CardTitle>Frontend foundation</CardTitle>
            <CardDescription>The workspace now shares one responsive layout and state system.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-secondary-foreground">
              <li className="border-b pb-3">Responsive provider navigation</li>
              <li className="border-b pb-3">Consistent form, loading, and error states</li>
              <li>Central API client and session store</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
