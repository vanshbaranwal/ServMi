import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { AuthPageFrame } from "@/components/AuthPageFrame"
import { FormField } from "@/components/FormField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api, getApiError } from "@/lib/api"
import { useAuthStore } from "@/store/useAuthStore"

const initialForm = {
  name: "",
  businessName: "",
  businessDescription: "",
  email: "",
  password: "",
  emailOtp: "",
  timezone: "Asia/Kolkata",
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((state) => state.setProviderSession)
  const [form, setForm] = useState(initialForm)
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const update = (event) => {
    setError("")
    if (event.target.name === "email") {
      setOtpSent(false)
      setOtpVerified(false)
    }
    if (event.target.name === "emailOtp") setOtpVerified(false)
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const requestOtp = async () => {
    if (!form.email.trim()) {
      setError("Enter your email address first.")
      return
    }
    setSendingOtp(true)
    setError("")
    try {
      await api.post("/api/auth/register/request-otp", { email: form.email })
      setOtpSent(true)
      setOtpVerified(false)
      toast.success("Verification code sent")
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't send the verification code."))
    } finally {
      setSendingOtp(false)
    }
  }

  const verifyOtp = async () => {
    if (!form.emailOtp.trim()) {
      setError("Enter the verification code from your email.")
      return
    }
    setVerifyingOtp(true)
    setError("")
    try {
      await api.post("/api/auth/register/verify-otp", {
        email: form.email,
        emailOtp: form.emailOtp,
      })
      setOtpVerified(true)
      toast.success("Email verified")
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't verify this code."))
    } finally {
      setVerifyingOtp(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!otpVerified) {
      setError("Verify your email before creating your account.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const { data } = await api.post("/api/auth/register", form)
      setSession({ token: data.token, user: data.user })
      toast.success("Your ServMi workspace is ready")
      navigate("/dashboard", { replace: true })
    } catch (requestError) {
      setError(getApiError(requestError, "We couldn't create your account."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageFrame
      eyebrow="Provider account"
      title="Create your workspace"
      description="Start with the essentials. You can finish your public booking profile after signing up."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-accent-foreground underline-offset-4 hover:underline">Log in</Link></>}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="name" label="Your name">
            <Input id="name" name="name" autoComplete="name" value={form.name} onChange={update} required className="h-10" />
          </FormField>
          <FormField id="businessName" label="Business name">
            <Input id="businessName" name="businessName" autoComplete="organization" value={form.businessName} onChange={update} required className="h-10" />
          </FormField>
        </div>
        <FormField id="businessDescription" label="Short description" hint="Optional">
          <Textarea id="businessDescription" name="businessDescription" value={form.businessDescription} onChange={update} rows={3} />
        </FormField>
        <FormField id="email" label="Email address">
          <div className="flex gap-2">
            <Input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} required className="h-10" />
            <Button type="button" variant="outline" className="h-10 shrink-0" onClick={requestOtp} disabled={sendingOtp}>
              {sendingOtp ? "Sending" : otpSent ? "Resend" : "Send code"}
            </Button>
          </div>
        </FormField>
        {otpSent && (
          <FormField id="emailOtp" label="Verification code" hint={otpVerified ? "Email verified" : "Expires in 10 minutes"}>
            <div className="flex gap-2">
              <Input id="emailOtp" name="emailOtp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.emailOtp} onChange={update} required className="h-10 tracking-[0.3em]" />
              <Button type="button" variant="outline" className="h-10 shrink-0" onClick={verifyOtp} disabled={verifyingOtp || otpVerified}>
                {verifyingOtp ? "Checking" : otpVerified ? "Verified" : "Verify"}
              </Button>
            </div>
          </FormField>
        )}
        <FormField id="password" label="Password" hint="At least 6 characters" error={error}>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6} value={form.password} onChange={update} required className="h-10" />
        </FormField>
        <Button className="h-10 w-full" type="submit" disabled={submitting || !otpVerified}>
          {submitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {submitting ? "Creating workspace" : "Create account"}
        </Button>
      </form>
    </AuthPageFrame>
  )
}
