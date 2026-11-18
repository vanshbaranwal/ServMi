import { Outlet } from "react-router-dom"

import { Brand } from "@/components/Brand"

export default function PublicBookingLayout() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="app-container flex h-16 items-center justify-between">
          <Brand />
          <span className="text-xs font-medium text-muted-foreground">Secure booking</span>
        </div>
      </header>
      <main className="app-container py-8 sm:py-12">
        <Outlet />
      </main>
      <footer className="app-container pb-8 text-center text-xs text-muted-foreground">
        Booking experience powered by ServMi
      </footer>
    </div>
  )
}
