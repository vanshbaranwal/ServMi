import { AlertCircle, Inbox } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function LoadingState({ rows = 3, label = "Loading" }) {
  return (
    <Card aria-busy="true" aria-label={label}>
      <CardContent className="space-y-3 py-2">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

export function ErrorState({ title = "We couldn't load this", message, onRetry }) {
  return (
    <Alert variant="destructive" className="bg-card">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{message || "Check your connection and try again."}</span>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

export function EmptyState({ title, message, action }) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 grid size-10 place-items-center rounded-full bg-secondary text-accent-foreground">
          <Inbox className="size-4" aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{message}</p>
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  )
}
