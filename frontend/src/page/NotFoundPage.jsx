import { Link } from "react-router-dom"

import { Brand } from "@/components/Brand"
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-center">
      <div>
        <Brand className="mb-8 justify-center" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">This page isn't here</h1>
        <p className="mt-3 text-sm text-muted-foreground">The link may be old or the address may be incomplete.</p>
        <Button asChild className="mt-6"><Link to="/">Go to ServMi</Link></Button>
      </div>
    </main>
  )
}
