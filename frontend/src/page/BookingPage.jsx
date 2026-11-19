import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router-dom"

import { EmptyState, ErrorState, LoadingState } from "@/components/AsyncState"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api, getApiError } from "@/lib/api"
import { formatPrice } from "@/lib/formatters"
import { cn } from "@/lib/utils"

export default function BookingPage() {
  const { slug } = useParams()
  const [business, setBusiness] = useState(null)
  const [services, setServices] = useState([])
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadBusiness = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const { data } = await api.get(`/api/public/${encodeURIComponent(slug)}`)
      setBusiness(data.business)
      setServices(data.services || [])
      setSelectedId((current) => current || data.services?.[0]?._id || "")
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't load this booking page."))
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    let active = true
    api.get(`/api/public/${encodeURIComponent(slug)}`)
      .then(({ data }) => {
        if (!active) return
        setBusiness(data.business)
        setServices(data.services || [])
        setSelectedId(data.services?.[0]?._id || "")
      })
      .catch((requestError) => {
        if (active) setError(getApiError(requestError, "We couldn't load this booking page."))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [slug])

  const selectedService = services.find((service) => service._id === selectedId)

  if (loading) return <LoadingState label="Loading booking page" rows={5} />
  if (error) return <ErrorState title="Booking page unavailable" message={error} onRetry={loadBusiness} />

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Book an appointment"
        title={business?.businessName || business?.name || "Service provider"}
        description={business?.businessDescription || "Choose the service that best fits what you need."}
      />

      {!services.length ? (
        <EmptyState
          title="No services are available yet"
          message="This provider is still preparing their booking page. Please check again later."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold">Choose a service</h2>
              <Badge variant="secondary">{services.length} available</Badge>
            </div>
            {services.map((service) => {
              const selected = service._id === selectedId
              return (
                <button
                  key={service._id}
                  type="button"
                  className="block w-full text-left"
                  onClick={() => setSelectedId(service._id)}
                  aria-pressed={selected}
                >
                  <Card className={cn("transition-colors hover:border-strong-border", selected && "border-primary ring-2 ring-primary/40")}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle>{service.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {service.description || "No additional description provided."}
                          </CardDescription>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-accent-foreground">
                          {Number(service.price) === 0 ? "Free" : formatPrice(service.price)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">{service.duration} minutes</CardContent>
                  </Card>
                </button>
              )
            })}
          </div>

          <Card className="h-fit lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle>Booking summary</CardTitle>
              <CardDescription>Review the service before choosing a date and time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedService && (
                <div className="rounded-xl bg-muted p-4 text-sm">
                  <p className="font-medium">{selectedService.name}</p>
                  <p className="mt-1 text-muted-foreground">
                    {selectedService.duration} minutes · {Number(selectedService.price) === 0 ? "Free" : formatPrice(selectedService.price)}
                  </p>
                </div>
              )}
              <Button className="w-full" disabled>Choose a date and time</Button>
              <p className="text-sm leading-5 text-muted-foreground">
                Date selection and customer confirmation are added in the client booking flow.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
