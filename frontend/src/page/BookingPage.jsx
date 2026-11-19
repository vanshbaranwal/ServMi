import { useCallback, useEffect, useMemo, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { EmptyState, ErrorState, LoadingState } from "@/components/AsyncState"
import { FormField } from "@/components/FormField"
import { PageHeader } from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api, getApiError } from "@/lib/api"
import {
  formatBookingDate,
  formatDateChoice,
  formatTimeRange,
  getBookableDates,
  isEmail,
} from "@/lib/booking"
import { formatPrice } from "@/lib/formatters"
import { cn } from "@/lib/utils"

const initialCustomer = {
  customerName: "",
  customerEmail: "",
  notes: "",
  emailOtp: "",
}

function StepHeader({ title, complete, current }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <Badge
        variant="secondary"
        className={complete ? "bg-success-surface text-success" : ""}
      >
        {complete ? "Complete" : current ? "Current" : "Waiting"}
      </Badge>
    </div>
  )
}

export default function BookingPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [business, setBusiness] = useState(null)
  const [services, setServices] = useState([])
  const [selectedId, setSelectedId] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [slots, setSlots] = useState([])
  const [customer, setCustomer] = useState(initialCustomer)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState("")
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [booking, setBooking] = useState(false)
  const [bookingError, setBookingError] = useState("")

  const loadBusiness = useCallback(async () => {
    setLoading(true)
    setPageError("")
    try {
      const { data } = await api.get(`/api/public/${encodeURIComponent(slug)}`)
      setBusiness(data.business)
      setServices(data.services || [])
    } catch (requestError) {
      setPageError(getApiError(requestError, "We couldn't load this booking page."))
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
      })
      .catch((requestError) => {
        if (active) setPageError(getApiError(requestError, "We couldn't load this booking page."))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [slug])

  const selectedService = services.find((service) => service._id === selectedId)
  const dateChoices = useMemo(
    () => getBookableDates(business?.timezone || "Asia/Kolkata", 21),
    [business?.timezone],
  )

  const chooseService = (serviceId) => {
    setSelectedId(serviceId)
    setSelectedDate("")
    setSelectedSlot(null)
    setSlots([])
    setSlotsError("")
    setBookingError("")
  }

  const loadSlots = async (dateValue) => {
    if (!selectedId || !dateValue) return
    setSelectedDate(dateValue)
    setSelectedSlot(null)
    setSlotsLoading(true)
    setSlotsError("")
    setBookingError("")
    try {
      const { data } = await api.get(`/api/public/${encodeURIComponent(slug)}/slots`, {
        params: { date: dateValue, serviceId: selectedId },
      })
      setSlots(data.slots || [])
    } catch (requestError) {
      setSlots([])
      setSlotsError(getApiError(requestError, "We couldn't load times for this date."))
    } finally {
      setSlotsLoading(false)
    }
  }

  const updateCustomer = (event) => {
    const { name, value } = event.target
    setBookingError("")
    if (name === "customerEmail") {
      setOtpSent(false)
      setOtpVerified(false)
    }
    if (name === "emailOtp") setOtpVerified(false)
    setCustomer((current) => ({ ...current, [name]: value }))
  }

  const requestOtp = async () => {
    if (!isEmail(customer.customerEmail)) {
      setBookingError("Enter a valid email address first.")
      return
    }
    setSendingOtp(true)
    setBookingError("")
    try {
      await api.post(`/api/public/${encodeURIComponent(slug)}/request-otp`, {
        customerEmail: customer.customerEmail,
      })
      setOtpSent(true)
      setOtpVerified(false)
      toast.success("Verification code sent")
    } catch (requestError) {
      setBookingError(getApiError(requestError, "We couldn't send the verification code."))
    } finally {
      setSendingOtp(false)
    }
  }

  const verifyOtp = async () => {
    if (!customer.emailOtp.trim()) {
      setBookingError("Enter the verification code from your email.")
      return
    }
    setVerifyingOtp(true)
    setBookingError("")
    try {
      await api.post(`/api/public/${encodeURIComponent(slug)}/verify-otp`, {
        customerEmail: customer.customerEmail,
        emailOtp: customer.emailOtp,
      })
      setOtpVerified(true)
      toast.success("Email verified")
    } catch (requestError) {
      setOtpVerified(false)
      setBookingError(getApiError(requestError, "We couldn't verify this code."))
    } finally {
      setVerifyingOtp(false)
    }
  }

  const handleBooking = async (event) => {
    event.preventDefault()
    if (!selectedService || !selectedDate || !selectedSlot) {
      setBookingError("Choose a service, date, and time before continuing.")
      return
    }
    if (!customer.customerName.trim()) {
      setBookingError("Enter your name.")
      return
    }
    if (!otpVerified) {
      setBookingError("Verify your email before confirming the booking.")
      return
    }

    setBooking(true)
    setBookingError("")
    try {
      const { data } = await api.post(`/api/public/${encodeURIComponent(slug)}/book`, {
        serviceId: selectedService._id,
        customerName: customer.customerName.trim(),
        customerEmail: customer.customerEmail.trim(),
        notes: customer.notes.trim(),
        emailOtp: customer.emailOtp,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      })

      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl)
        return
      }

      const query = new URLSearchParams({
        booking_id: data.booking._id,
        access_token: data.accessToken,
        slug,
      })
      navigate(`/booking/success?${query}`, {
        replace: true,
        state: { booking: data.booking, business, service: selectedService },
      })
    } catch (requestError) {
      if (requestError.response?.status === 409) {
        await loadSlots(selectedDate)
        setBookingError("That time was just taken. The available times have been refreshed.")
      } else {
        const message = getApiError(requestError, "We couldn't complete this booking.")
        setBookingError(message)
        if (/otp|verification|code/i.test(message)
          || !requestError.response
          || requestError.response.status === 500) {
          setOtpVerified(false)
        }
      }
    } finally {
      setBooking(false)
    }
  }

  if (loading) return <LoadingState label="Loading booking page" rows={6} />
  if (pageError) return <ErrorState title="Booking page unavailable" message={pageError} onRetry={loadBusiness} />

  return (
    <div className="mx-auto max-w-6xl space-y-8">
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <StepHeader title="Choose a service" complete={Boolean(selectedService)} current={!selectedService} />
              </CardHeader>
              <CardContent className="space-y-3">
                {services.map((service) => {
                  const selected = service._id === selectedId
                  return (
                    <button
                      key={service._id}
                      type="button"
                      className={cn(
                        "block w-full rounded-xl border p-4 text-left transition-colors hover:border-strong-border",
                        selected && "border-primary bg-secondary/40 ring-2 ring-primary/30",
                      )}
                      onClick={() => chooseService(service._id)}
                      aria-pressed={selected}
                    >
                      <span className="flex items-start justify-between gap-4">
                        <span>
                          <span className="block text-sm font-semibold text-foreground">{service.name}</span>
                          <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                            {service.description || "No additional description provided."}
                          </span>
                          <span className="mt-2 block text-sm text-secondary-foreground">{service.duration} minutes</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-accent-foreground">
                          {Number(service.price) === 0 ? "Free" : formatPrice(service.price)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </CardContent>
            </Card>

            {selectedService && (
              <Card>
                <CardHeader>
                  <StepHeader title="Choose a date and time" complete={Boolean(selectedSlot)} current={!selectedSlot} />
                  <CardDescription>Times are shown in {business?.timezone || "the provider's timezone"}.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
                    {dateChoices.map((date) => {
                      const parts = formatDateChoice(date)
                      const selected = date === selectedDate
                      return (
                        <button
                          key={date}
                          type="button"
                          className={cn(
                            "rounded-xl border px-2 py-3 text-center transition-colors hover:border-strong-border",
                            selected && "border-primary bg-secondary ring-2 ring-primary/30",
                          )}
                          onClick={() => loadSlots(date)}
                          aria-pressed={selected}
                        >
                          <span className="block text-xs font-medium text-muted-foreground">{parts.weekday}</span>
                          <span className="mt-1 block text-lg font-semibold text-foreground">{parts.day}</span>
                          <span className="block text-xs text-muted-foreground">{parts.month}</span>
                        </button>
                      )
                    })}
                  </div>

                  {selectedDate && (
                    <div className="space-y-3 border-t pt-5">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-semibold">{formatBookingDate(selectedDate, { weekday: "long", month: "long", day: "numeric" })}</p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => loadSlots(selectedDate)} disabled={slotsLoading}>
                          Refresh times
                        </Button>
                      </div>
                      {slotsLoading ? (
                        <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
                          <LoaderCircle className="animate-spin" aria-hidden="true" /> Loading available times
                        </div>
                      ) : slotsError ? (
                        <ErrorState title="Times unavailable" message={slotsError} onRetry={() => loadSlots(selectedDate)} />
                      ) : !slots.length ? (
                        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No times are available on this date. Choose another day.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                          {slots.map((slot) => {
                            const selected = selectedSlot?.startTime === slot.startTime && selectedSlot?.endTime === slot.endTime
                            return (
                              <Button
                                key={`${slot.startTime}-${slot.endTime}`}
                                type="button"
                                variant={selected ? "default" : "outline"}
                                className="h-10"
                                onClick={() => {
                                  setSelectedSlot(slot)
                                  setBookingError("")
                                }}
                              >
                                {formatTimeRange(slot.startTime, slot.endTime)}
                              </Button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {selectedSlot && (
              <Card>
                <CardHeader>
                  <StepHeader title="Your details" complete={otpVerified} current={!otpVerified} />
                  <CardDescription>Your email is verified before the booking is created.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-5" onSubmit={handleBooking} noValidate>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <FormField id="customer-name" label="Your name">
                        <Input
                          id="customer-name"
                          name="customerName"
                          value={customer.customerName}
                          onChange={updateCustomer}
                          autoComplete="name"
                          required
                        />
                      </FormField>
                      <FormField id="customer-email" label="Email address">
                        <Input
                          id="customer-email"
                          name="customerEmail"
                          type="email"
                          value={customer.customerEmail}
                          onChange={updateCustomer}
                          autoComplete="email"
                          required
                        />
                      </FormField>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <FormField id="booking-otp" label="Email verification code" hint={otpVerified ? "Verified" : "Required"}>
                        <Input
                          id="booking-otp"
                          name="emailOtp"
                          value={customer.emailOtp}
                          onChange={updateCustomer}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          className="tracking-[0.3em] sm:w-56"
                          disabled={!otpSent}
                          required
                        />
                      </FormField>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={requestOtp} disabled={sendingOtp}>
                          {sendingOtp ? "Sending" : otpSent ? "Resend code" : "Send code"}
                        </Button>
                        <Button type="button" variant="outline" onClick={verifyOtp} disabled={!otpSent || verifyingOtp || otpVerified}>
                          {verifyingOtp ? "Checking" : otpVerified ? "Verified" : "Verify"}
                        </Button>
                      </div>
                    </div>
                    <FormField id="booking-notes" label="Notes for the provider" hint="Optional">
                      <Textarea
                        id="booking-notes"
                        name="notes"
                        value={customer.notes}
                        onChange={updateCustomer}
                        rows={3}
                        maxLength={500}
                        placeholder="Anything helpful for the provider to know before your appointment."
                      />
                    </FormField>
                    {bookingError && <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{bookingError}</p>}
                    <Button className="h-10 w-full" type="submit" disabled={!otpVerified || booking}>
                      {booking && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                      {booking
                        ? "Confirming booking"
                        : Number(selectedService.price) > 0
                          ? `Continue to payment · ${formatPrice(selectedService.price)}`
                          : "Confirm free booking"}
                    </Button>
                    {Number(selectedService.price) > 0 && (
                      <p className="text-center text-sm leading-5 text-muted-foreground">You will continue to Stripe to complete the payment securely.</p>
                    )}
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="h-fit lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle>Booking summary</CardTitle>
              <CardDescription>Your selections stay here as you continue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Service</p>
                <p className="mt-1 font-medium text-foreground">{selectedService?.name || "Not selected"}</p>
                {selectedService && <p className="mt-1 text-muted-foreground">{selectedService.duration} minutes · {Number(selectedService.price) === 0 ? "Free" : formatPrice(selectedService.price)}</p>}
              </div>
              <div className="border-t pt-4">
                <p className="text-muted-foreground">Date and time</p>
                <p className="mt-1 font-medium text-foreground">
                  {selectedDate ? formatBookingDate(selectedDate, { month: "long", day: "numeric", year: "numeric" }) : "Not selected"}
                </p>
                {selectedSlot && <p className="mt-1 text-muted-foreground">{formatTimeRange(selectedSlot.startTime, selectedSlot.endTime)}</p>}
              </div>
              <div className="border-t pt-4">
                <p className="text-muted-foreground">Timezone</p>
                <p className="mt-1 font-medium text-foreground">{business?.timezone || "Asia/Kolkata"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
