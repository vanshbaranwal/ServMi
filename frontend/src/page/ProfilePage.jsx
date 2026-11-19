import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { FormField } from "@/components/FormField"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api, getApiError } from "@/lib/api"
import { isProfileComplete } from "@/lib/providerSetup"
import { useAuthStore } from "@/store/useAuthStore"

const toForm = (user) => ({
  businessName: user?.businessName || "",
  businessDescription: user?.businessDescription || "",
  timezone: user?.timezone || "Asia/Kolkata",
})

export default function ProfilePage() {
  const user = useAuthStore((state) => state.providerUser)
  const updateProviderUser = useAuthStore((state) => state.updateProviderUser)
  const [form, setForm] = useState(() => toForm(user))
  const [loading, setLoading] = useState(!user)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    const loadProfile = async () => {
      setLoading(true)
      try {
        const { data } = await api.get("/api/auth/me")
        if (!active) return
        updateProviderUser(data.user)
        setForm(toForm(data.user))
      } catch (requestError) {
        if (active) setError(getApiError(requestError, "We couldn't load your business profile."))
      } finally {
        if (active) setLoading(false)
      }
    }
    loadProfile()
    return () => { active = false }
  }, [updateProviderUser])

  const update = (event) => {
    setError("")
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.businessName.trim()) {
      setError("Enter your business name.")
      return
    }
    if (!form.businessDescription.trim()) {
      setError("Add a short description so clients know what you offer.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const { data } = await api.patch("/api/auth/profile", {
        businessName: form.businessName.trim(),
        businessDescription: form.businessDescription.trim(),
        timezone: form.timezone.trim(),
      })
      updateProviderUser(data.user)
      setForm(toForm(data.user))
      toast.success("Business profile saved")
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't save your business profile."))
    } finally {
      setSaving(false)
    }
  }

  const bookingUrl = user?.slug ? `${window.location.origin}/b/${user.slug}` : ""

  const copyLink = async () => {
    if (!bookingUrl) return
    try {
      await navigator.clipboard.writeText(bookingUrl)
      toast.success("Booking link copied")
    } catch {
      toast.error("Copying is unavailable. Select the link and copy it manually.")
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Public booking page"
        title="Business profile"
        description="Keep the public details clients see before choosing a service and time."
        actions={(
          <Button type="submit" form="profile-form" disabled={saving || loading}>
            {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {saving ? "Saving" : "Save profile"}
          </Button>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_21rem]">
        <Card>
          <CardHeader>
            <CardTitle>Business details</CardTitle>
            <CardDescription>Use a concise description that helps clients understand the result you provide.</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="profile-form" className="space-y-5" onSubmit={handleSubmit}>
              <FormField id="provider-name" label="Account owner">
                <Input id="provider-name" value={user?.name || ""} disabled />
              </FormField>
              <FormField id="business-name" label="Business name">
                <Input
                  id="business-name"
                  name="businessName"
                  value={form.businessName}
                  onChange={update}
                  autoComplete="organization"
                  disabled={loading}
                  required
                />
              </FormField>
              <FormField id="business-description" label="Description" hint={`${form.businessDescription.length}/300`}>
                <Textarea
                  id="business-description"
                  name="businessDescription"
                  value={form.businessDescription}
                  onChange={update}
                  maxLength={300}
                  rows={5}
                  disabled={loading}
                  required
                />
              </FormField>
              <FormField id="timezone" label="Timezone" hint="Use an IANA timezone, such as Asia/Kolkata">
                <Input
                  id="timezone"
                  name="timezone"
                  value={form.timezone}
                  onChange={update}
                  list="servmi-timezones"
                  disabled={loading}
                  required
                />
                <datalist id="servmi-timezones">
                  <option value="Asia/Kolkata" />
                  <option value="Asia/Dubai" />
                  <option value="Europe/London" />
                  <option value="America/New_York" />
                  <option value="America/Los_Angeles" />
                </datalist>
              </FormField>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="mb-1">
                <Badge variant="secondary" className={isProfileComplete(user) ? "bg-success-surface text-success" : ""}>
                  {isProfileComplete(user) ? "Profile complete" : "Needs details"}
                </Badge>
              </div>
              <CardTitle>Booking link</CardTitle>
              <CardDescription>Share this address after publishing a service and setting your hours.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="break-all rounded-lg border bg-muted/50 p-3 text-sm text-secondary-foreground">
                {bookingUrl || "Your link appears after registration"}
              </p>
              <div className="mt-4 grid gap-2">
                <Button variant="outline" onClick={copyLink} disabled={!bookingUrl}>Copy link</Button>
                {user?.slug && (
                  <Button variant="ghost" asChild>
                    <Link to={`/b/${user.slug}`}>View public page</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
