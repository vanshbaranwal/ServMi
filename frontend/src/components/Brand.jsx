import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"

export function Brand({ to = "/", compact = false, className }) {
  return (
    <Link
      to={to}
      className={cn("inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40", className)}
      aria-label="ServMi home"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-[0_7px_20px_rgba(255,157,206,0.28)]">
        S
      </span>
      {!compact && (
        <span className="text-lg font-semibold tracking-[-0.03em] text-foreground">ServMi</span>
      )}
    </Link>
  )
}
