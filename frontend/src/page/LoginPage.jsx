import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { AuthPageFrame } from "@/components/AuthPageFrame"
import { FormField } from "@/components/FormField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, getApiError } from "@/lib/api"
import { useAuthStore } from "@/store/useAuthStore"

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuthStore((state) => state.setProviderSession)
  const [form, setForm] = useState({ email: "", password: "" })
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const update = (event) => {
    setError("")
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const { data } = await api.post("/api/auth/login", form)
      setSession({ token: data.token, user: data.user })
      toast.success("Welcome back")
      navigate(location.state?.from || "/dashboard", { replace: true })
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't sign you in."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageFrame
      eyebrow="Provider account"
      title="Welcome back"
      description="Sign in to manage bookings, services, availability, and payouts."
      footer={<>New to ServMi? <Link to="/register" className="font-medium text-accent-foreground underline-offset-4 hover:underline">Create an account</Link></>}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <FormField id="email" label="Email address">
          <Input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} required className="h-10" />
        </FormField>
        <FormField id="password" label="Password" error={error}>
          <Input id="password" name="password" type="password" autoComplete="current-password" value={form.password} onChange={update} required className="h-10" />
        </FormField>
        <div className="-mt-3 text-right">
          <Link to="/forgot-password" className="text-sm font-medium text-accent-foreground underline-offset-4 hover:underline">Forgot password?</Link>
        </div>
        <Button className="h-10 w-full" type="submit" disabled={submitting}>
          {submitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {submitting ? "Signing in" : "Sign in"}
        </Button>
      </form>
    </AuthPageFrame>
  )
}
