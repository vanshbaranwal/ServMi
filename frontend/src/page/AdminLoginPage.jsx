import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { AuthPageFrame } from "@/components/AuthPageFrame"
import { FormField } from "@/components/FormField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, getApiError } from "@/lib/api"
import { useAuthStore } from "@/store/useAuthStore"

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuthStore((state) => state.setAdminSession)
  const [form, setForm] = useState({ email: "", password: "" })
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const { data } = await api.post("/api/admin/login", form)
      setSession({ token: data.token, admin: data.admin })
      toast.success("Admin session started")
      navigate(location.state?.from || "/admin", { replace: true })
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't sign you in."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageFrame
      eyebrow="Restricted access"
      title="Admin sign in"
      description="Use the platform administrator credentials configured on the ServMi server."
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <FormField id="admin-email" label="Admin email">
          <Input id="admin-email" type="email" autoComplete="username" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required className="h-10" />
        </FormField>
        <FormField id="admin-password" label="Password" error={error}>
          <Input id="admin-password" type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required className="h-10" />
        </FormField>
        <Button className="h-10 w-full" type="submit" disabled={submitting}>
          {submitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {submitting ? "Signing in" : "Sign in as admin"}
        </Button>
      </form>
    </AuthPageFrame>
  )
}
