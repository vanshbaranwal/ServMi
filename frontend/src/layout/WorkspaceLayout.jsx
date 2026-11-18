import { Menu } from "lucide-react"
import { NavLink, Outlet, useLocation } from "react-router-dom"

import { Brand } from "@/components/Brand"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { getInitials } from "@/lib/formatters"
import { routeMeta } from "@/lib/navigation"
import { cn } from "@/lib/utils"

function Navigation({ items }) {
  return (
    <nav className="space-y-1" aria-label="Workspace navigation">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/dashboard" || item.to === "/admin"}
          className={({ isActive }) =>
            cn(
              "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-secondary text-accent-foreground"
                : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function WorkspaceLayout({
  navigation,
  homeTo,
  workspaceLabel,
  profileName,
  profileSubtitle,
  onLogout,
}) {
  const location = useLocation()
  const meta = routeMeta[location.pathname] || { title: workspaceLabel, eyebrow: "Workspace" }

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden border-r bg-sidebar lg:flex lg:min-h-dvh lg:flex-col">
        <div className="flex h-16 items-center border-b px-5">
          <Brand to={homeTo} />
        </div>
        <div className="flex-1 px-3 py-5">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {workspaceLabel}
          </p>
          <Navigation items={navigation} />
        </div>
        <div className="border-t p-3">
          <ProfileMenu
            name={profileName}
            subtitle={profileSubtitle}
            onLogout={onLogout}
            align="start"
          />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b bg-background/92 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b px-5 py-4 text-left">
                  <SheetTitle>
                    <Brand to={homeTo} />
                  </SheetTitle>
                </SheetHeader>
                <div className="px-3 py-5">
                  <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {workspaceLabel}
                  </p>
                  <Navigation items={navigation} />
                </div>
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-muted-foreground">{meta.eyebrow}</p>
              <p className="truncate text-sm font-semibold text-foreground">{meta.title}</p>
            </div>
            <div className="lg:hidden">
              <ProfileMenu name={profileName} subtitle={profileSubtitle} onLogout={onLogout} />
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function ProfileMenu({ name, subtitle, onLogout, align = "end" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2">
          <Avatar className="size-8">
            <AvatarFallback className="bg-secondary text-xs font-semibold text-accent-foreground">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 flex-1 text-left lg:block">
            <span className="block truncate text-sm font-medium text-foreground">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
