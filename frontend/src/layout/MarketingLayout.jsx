import { Link, Outlet } from "react-router-dom"

import { Brand } from "@/components/Brand"
import { Button } from "@/components/ui/button"

export default function MarketingLayout() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-background/90 backdrop-blur">
        <div className="app-container flex h-16 items-center justify-between">
          <Brand />
          <nav className="flex items-center gap-2" aria-label="Main navigation">
            <Button variant="ghost" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Create account</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="border-t bg-card">
        <div className="app-container flex flex-col gap-2 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 ServMi</span>
          <span>Clear bookings for independent service providers.</span>
        </div>
      </footer>
    </div>
  )
}
