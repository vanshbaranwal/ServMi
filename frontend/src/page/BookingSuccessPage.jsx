import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function BookingSuccessPage() {
  return (
    <Card className="mx-auto max-w-xl text-center shadow-[0_24px_70px_rgba(85,43,65,0.10)]">
      <CardHeader>
        <span className="mx-auto mb-3 rounded-full bg-success-surface px-3 py-1 text-xs font-semibold text-success">Payment received</span>
        <CardTitle className="text-2xl">Your booking is being confirmed</CardTitle>
        <CardDescription className="mx-auto max-w-md leading-6">This page will verify the Stripe session and show the final booking details, calendar link, or refund state.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" asChild><Link to="/">Return to ServMi</Link></Button>
      </CardContent>
    </Card>
  )
}
