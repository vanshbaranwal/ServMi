import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { AuthPageFrame } from "@/components/AuthPageFrame"
import { FormField } from "@/components/FormField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, getApiError } from "@/lib/api"

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState("email")
  const [form, setForm] = useState({ email: "", emailOtp: "", password: "", confirmPassword: "" })
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const update = (event) => {
    setError("")
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const sendCode = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const { data } = await api.post("/api/auth/password/request-otp", { email: form.email })
      toast.success(data.message)
      setStep("reset")
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't send a reset code."))
    } finally {
      setSubmitting(false)
    }
  }

  const resetPassword = async (event) => {
    event.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      await api.post("/api/auth/password/reset", {
        email: form.email,
        emailOtp: form.emailOtp,
        password: form.password,
      })
      toast.success("Password reset. Sign in with your new password.")
      navigate("/login", { replace: true })
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't reset your password."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageFrame
      eyebrow="Account recovery"
      title={step === "email" ? "Reset your password" : "Create a new password"}
      description={step === "email"
        ? "Enter your provider email and we'll send a one-time verification code."
        : `Enter the code sent to ${form.email} and choose a new password.`}
      footer={<Link to="/login" className="font-medium text-accent-foreground underline-offset-4 hover:underline">Return to sign in</Link>}
    >
      {step === "email" ? (
        <form className="space-y-5" onSubmit={sendCode} noValidate>
          <FormField id="email" label="Email address" error={error}>
            <Input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} required className="h-10" />
          </FormField>
          <Button className="h-10 w-full" type="submit" disabled={submitting}>
            {submitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {submitting ? "Sending code" : "Send reset code"}
          </Button>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={resetPassword} noValidate>
          <FormField id="emailOtp" label="Verification code">
            <Input id="emailOtp" name="emailOtp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.emailOtp} onChange={update} required className="h-10" />
          </FormField>
          <FormField id="password" label="New password">
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} value={form.password} onChange={update} required className="h-10" />
          </FormField>
          <FormField id="confirmPassword" label="Confirm new password" error={error}>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} value={form.confirmPassword} onChange={update} required className="h-10" />
          </FormField>
          <Button className="h-10 w-full" type="submit" disabled={submitting}>
            {submitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {submitting ? "Resetting password" : "Reset password"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep("email"); setError("") }}>
            Use a different email
          </Button>
        </form>
      )}
    </AuthPageFrame>
  )
}
