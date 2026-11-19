import { useEffect } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { ErrorState, LoadingState } from "@/components/AsyncState"
import { MetricCard } from "@/components/MetricCard"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { getSetupState } from "@/lib/providerSetup"
import { useAuthStore } from "@/store/useAuthStore"
import { useProviderSetupStore } from "@/store/useProviderSetupStore"

const setupSteps = [
  {
    key: "profile",
    title: "Complete your business profile",
    description: "Add the public name, description, and timezone clients will see.",
    to: "/profile",
    action: "Edit profile",
  },
  {
    key: "service",
    title: "Create and publish a service",
    description: "Set the duration and price, then make the service visible.",
    to: "/services",
    action: "Manage services",
  },
  {
    key: "availability",
    title: "Set your weekly hours",
    description: "Choose the recurring time windows clients can book.",
    to: "/availability",
    action: "Set availability",
  },
]

export default function DashboardPage() {
  const user = useAuthStore((state) => state.providerUser)
  const services = useProviderSetupStore((state) => state.services)
  const availability = useProviderSetupStore((state) => state.availability)
  const loading = useProviderSetupStore((state) => state.setupLoading)
  const error = useProviderSetupStore((state) => state.error)
  const loadSetup = useProviderSetupStore((state) => state.loadSetup)

  useEffect(() => {
    loadSetup()
  }, [loadSetup])

  const setup = getSetupState({ user, services, availability })
  const publishedServices = services.filter((service) => service.isActive).length
  const availableDays = availability.filter((day) => day.slots?.length).length
  const bookingUrl = user?.slug ? `${window.location.origin}/book/${user.slug}` : ""

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl)
      toast.success("Booking link copied")
    } catch {
      toast.error("Copying is unavailable. Open your public page and copy the address.")
    }
  }

  if (loading && !services.length && !availability.length) {
    return <LoadingState label="Loading provider setup" rows={5} />
  }

  if (error && !services.length && !availability.length) {
    return <ErrorState message={error} onRetry={loadSetup} />
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Provider workspace"
        title={`Good to see you${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={setup.ready
          ? "Your booking page is ready to share with clients."
          : "Complete the essentials below to start accepting bookings."}
        actions={setup.ready && user?.slug ? (
          <Button variant="outline" asChild>
            <Link to={`/book/${user.slug}`}>View booking page</Link>
          </Button>
        ) : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Setup progress" value={`${setup.percent}%`} detail={`${setup.completed} of 3 essentials`} />
        <MetricCard label="Published services" value={String(publishedServices)} detail={`${services.length} total service${services.length === 1 ? "" : "s"}`} />
        <MetricCard label="Available days" value={String(availableDays)} detail="In your weekly schedule" />
        <MetricCard label="Booking page" value={setup.ready ? "Ready" : "Not ready"} detail="Public availability" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Finish the essentials</CardTitle>
                <CardDescription className="mt-1">Complete these in order, then share your booking link.</CardDescription>
              </div>
              <span className="text-sm font-semibold text-accent-foreground">{setup.percent}%</span>
            </div>
            <Progress value={setup.percent} className="mt-3" />
          </CardHeader>
          <CardContent className="space-y-3">
            {setupSteps.map((step, index) => {
              const complete = setup.steps[step.key]
              return (
                <div key={step.key} className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-accent-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">{step.title}</h2>
                      <Badge variant="secondary" className={complete ? "bg-success-surface text-success" : ""}>{complete ? "Done" : "To do"}</Badge>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.description}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={step.to}>{step.action}</Link>
                  </Button>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className={setup.ready ? "border-primary/70" : ""}>
          <CardHeader>
            <div className="mb-1">
              <Badge variant="secondary" className={setup.ready ? "bg-success-surface text-success" : ""}>
                {setup.ready ? "Ready to share" : `${3 - setup.completed} step${3 - setup.completed === 1 ? "" : "s"} remaining`}
              </Badge>
            </div>
            <CardTitle>Your booking link</CardTitle>
            <CardDescription>
              {setup.ready
                ? "Send this link to clients or add it to your social profiles."
                : "The link is reserved. Finish setup before sharing it with clients."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="break-all rounded-lg border bg-muted/50 p-3 text-sm text-secondary-foreground">
              {bookingUrl || "Your link will appear here"}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Button onClick={copyLink} disabled={!setup.ready || !bookingUrl}>Copy link</Button>
              {user?.slug && (
                <Button variant="outline" asChild>
                  <Link to={`/book/${user.slug}`}>Preview page</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
