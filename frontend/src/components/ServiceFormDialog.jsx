import { useState } from "react"
import { LoaderCircle } from "lucide-react"

import { FormField } from "@/components/FormField"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api, getApiError } from "@/lib/api"

const emptyForm = {
  name: "",
  description: "",
  duration: "30",
  price: "0",
}

const toForm = (service) => service ? {
  name: service.name || "",
  description: service.description || "",
  duration: String(service.duration || 30),
  price: String(service.price ?? 0),
} : emptyForm

export function ServiceFormDialog({ open, onOpenChange, service, onSaved }) {
  const [form, setForm] = useState(() => toForm(service))
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const update = (event) => {
    setError("")
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const duration = Number(form.duration)
    const price = Number(form.price)

    if (!form.name.trim()) {
      setError("Enter a service name.")
      return
    }
    if (!Number.isSafeInteger(duration) || duration < 5) {
      setError("Duration must be at least 5 whole minutes.")
      return
    }
    const priceInPaise = Math.round(price * 100)
    if (!Number.isFinite(price) || price < 0 || Math.abs(price * 100 - priceInPaise) > 0.000001
      || (priceInPaise > 0 && priceInPaise < 50)) {
      setError("Use 0 for free, or enter a price of at least ₹0.50 with no more than two decimal places.")
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        duration,
        price,
      }
      const { data } = service
        ? await api.patch(`/api/services/${service._id}`, payload)
        : await api.post("/api/services", payload)
      onSaved(data.service, Boolean(service))
      onOpenChange(false)
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't save this service."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{service ? "Edit service" : "Create a service"}</DialogTitle>
            <DialogDescription>
              Keep the name specific and explain what the client receives.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-6">
            <FormField id="service-name" label="Service name">
              <Input
                id="service-name"
                name="name"
                value={form.name}
                onChange={update}
                placeholder="Initial consultation"
                autoFocus
                required
              />
            </FormField>
            <FormField id="service-description" label="Description" hint="Optional">
              <Textarea
                id="service-description"
                name="description"
                value={form.description}
                onChange={update}
                placeholder="Tell clients what is included and how to prepare."
                rows={4}
              />
            </FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="service-duration" label="Duration" hint="Minutes">
                <Input
                  id="service-duration"
                  name="duration"
                  type="number"
                  inputMode="numeric"
                  min="5"
                  step="5"
                  value={form.duration}
                  onChange={update}
                  required
                />
              </FormField>
              <FormField id="service-price" label="Price" hint="Use 0 for free">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">₹</span>
                  <Input
                    id="service-price"
                    name="price"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={update}
                    className="pl-7"
                    required
                  />
                </div>
              </FormField>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              {saving ? "Saving" : service ? "Save changes" : "Create service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
