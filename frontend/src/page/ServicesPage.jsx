import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { EmptyState, ErrorState, LoadingState } from "@/components/AsyncState"
import { PageHeader } from "@/components/PageHeader"
import { ServiceFormDialog } from "@/components/ServiceFormDialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { api, getApiError } from "@/lib/api"
import { formatPrice } from "@/lib/formatters"
import { useProviderSetupStore } from "@/store/useProviderSetupStore"

export default function ServicesPage() {
  const services = useProviderSetupStore((state) => state.services)
  const loading = useProviderSetupStore((state) => state.servicesLoading)
  const error = useProviderSetupStore((state) => state.error)
  const loadServices = useProviderSetupStore((state) => state.loadServices)
  const upsertService = useProviderSetupStore((state) => state.upsertService)
  const removeService = useProviderSetupStore((state) => state.removeService)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [deletingService, setDeletingService] = useState(null)
  const [busyId, setBusyId] = useState("")

  useEffect(() => {
    loadServices()
  }, [loadServices])

  const openCreate = () => {
    setEditingService(null)
    setDialogOpen(true)
  }

  const openEdit = (service) => {
    setEditingService(service)
    setDialogOpen(true)
  }

  const handleSaved = (service, wasEditing) => {
    upsertService(service)
    toast.success(wasEditing ? "Service updated" : "Service created as a draft")
  }

  const toggleVisibility = async (service, isActive) => {
    setBusyId(service._id)
    try {
      const { data } = await api.patch(`/api/services/${service._id}`, { isActive })
      upsertService(data.service)
      toast.success(isActive ? "Service published" : "Service hidden")
    } catch (requestError) {
      toast.error(getApiError(requestError, "We couldn't update this service."))
    } finally {
      setBusyId("")
    }
  }

  const handleDelete = async () => {
    if (!deletingService) return
    setBusyId(deletingService._id)
    try {
      await api.delete(`/api/services/${deletingService._id}`)
      removeService(deletingService._id)
      toast.success("Service deleted")
      setDeletingService(null)
    } catch (requestError) {
      toast.error(getApiError(requestError, "We couldn't delete this service."))
    } finally {
      setBusyId("")
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Booking catalogue"
        title="Services"
        description="Create services, set clear prices, and control what clients can book."
        actions={<Button onClick={openCreate}>Add service</Button>}
      />

      {loading && !services.length ? (
        <LoadingState label="Loading services" rows={3} />
      ) : error && !services.length ? (
        <ErrorState message={error} onRetry={loadServices} />
      ) : !services.length ? (
        <EmptyState
          title="Create your first service"
          message="Add a name, duration, and price. You can review it before publishing it to your booking page."
          action={<Button onClick={openCreate}>Add service</Button>}
        />
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <Card key={service._id}>
              <CardContent className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">{service.name}</h2>
                    <Badge variant="secondary" className={service.isActive ? "bg-success-surface text-success" : ""}>
                      {service.isActive ? "Published" : "Hidden"}
                    </Badge>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {service.description || "No description added yet."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-secondary-foreground">
                    <span>{service.duration} minutes</span>
                    <span>{Number(service.price) === 0 ? "Free" : formatPrice(service.price)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                  <label className="mr-2 flex items-center gap-2 text-sm font-medium">
                    <Switch
                      checked={Boolean(service.isActive)}
                      onCheckedChange={(checked) => toggleVisibility(service, checked)}
                      disabled={busyId === service._id}
                      aria-label={`${service.isActive ? "Hide" : "Publish"} ${service.name}`}
                    />
                    {service.isActive ? "Visible" : "Hidden"}
                  </label>
                  <Button variant="outline" onClick={() => openEdit(service)} disabled={busyId === service._id}>
                    Edit
                  </Button>
                  <Button variant="ghost" className="text-destructive" onClick={() => setDeletingService(service)} disabled={busyId === service._id}>
                    {busyId === service._id ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialogOpen && (
        <ServiceFormDialog
          key={editingService?._id || "new-service"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          service={editingService}
          onSaved={handleSaved}
        />
      )}

      <AlertDialog open={Boolean(deletingService)} onOpenChange={(open) => !open && setDeletingService(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this service?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingService?.name} will disappear from your workspace and public booking page. Existing bookings are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep service</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>Delete service</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
