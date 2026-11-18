import { Link } from "react-router-dom"

import { Brand } from "@/components/Brand"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function AuthPageFrame({ eyebrow, title, description, footer, children }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="soft-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <Card className="shadow-[0_24px_70px_rgba(85,43,65,0.10)]">
          <CardHeader className="text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </p>
            <CardTitle className="text-2xl tracking-[-0.035em]">{title}</CardTitle>
            <CardDescription className="mx-auto max-w-sm leading-6">{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        {footer && <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>}
        <p className="mt-auto pt-8 text-center text-xs text-muted-foreground">
          <Link to="/" className="underline-offset-4 hover:text-foreground hover:underline">
            Back to ServMi
          </Link>
        </p>
      </div>
    </div>
  )
}
