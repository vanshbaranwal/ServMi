import { FormField } from "@/components/FormField"
import { PageHeader } from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuthStore } from "@/store/useAuthStore"

export default function ProfilePage() {
  const user = useAuthStore((state) => state.providerUser)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Public booking page"
        title="Business profile"
        description="Keep the details clients see before they choose a service and time."
        actions={<Button>Save profile</Button>}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader><CardTitle>Business details</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <FormField id="business-name" label="Business name">
              <Input id="business-name" defaultValue={user?.businessName || ""} className="h-10" />
            </FormField>
            <FormField id="business-description" label="Description">
              <Textarea id="business-description" defaultValue={user?.businessDescription || ""} rows={5} />
            </FormField>
            <FormField id="timezone" label="Timezone">
              <Input id="timezone" defaultValue={user?.timezone || "Asia/Kolkata"} className="h-10" />
            </FormField>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Booking link</CardTitle></CardHeader>
          <CardContent>
            <p className="break-all rounded-lg bg-muted p-3 text-sm text-secondary-foreground">
              {user?.slug ? `${window.location.origin}/book/${user.slug}` : "Your link appears after registration"}
            </p>
            <Button variant="outline" className="mt-4 w-full">Copy link</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
