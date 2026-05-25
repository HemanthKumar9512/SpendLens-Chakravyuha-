import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { ensureSeed } from "@/lib/seed";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, Eye, Shield, Leaf, Settings as SettingsIcon,
  LogOut, Sun, Moon, Bell, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/drishti", label: "Drishti-Chanakya", icon: Eye, subtitle: "Module 1" },
  { to: "/chakravyuha", label: "Chakravyuha-Nadi", icon: Shield, subtitle: "Module 2" },
  { to: "/kosha", label: "Pancha Kosha", icon: Leaf, subtitle: "Module 3" },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function AppLayout() {
  const { user, profile, tenant, signOut, loading } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("theme") === "dark";
      setDark(t);
      document.documentElement.classList.toggle("dark", t);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  useEffect(() => {
    if (tenant?.id) {
      ensureSeed(tenant.id).then(() => {
        supabase.from("alert_log").select("*").eq("tenant_id", tenant.id)
          .order("sent_at", { ascending: false }).limit(5)
          .then(({ data }) => setAlerts(data ?? []));
      });
    }
  }, [tenant?.id]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const initials = (profile?.full_name || user.email || "U")
    .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={`${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform`}>
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-bold text-base leading-tight">SpendLens</div>
              <div className="text-xs text-sidebar-foreground/60 leading-tight">Chakravyuha</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium leading-tight truncate">{item.label}</div>
                  {"subtitle" in item && (
                    <div className="text-[10px] uppercase tracking-wide opacity-60">{item.subtitle}</div>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 p-2">
            <div className="w-9 h-9 rounded-full bg-primary/30 flex items-center justify-center text-sm font-semibold">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{profile?.full_name || user.email}</div>
              <Badge variant="secondary" className="text-[10px] mt-0.5 uppercase">{profile?.role || "user"}</Badge>
            </div>
            <Button size="icon" variant="ghost" onClick={() => signOut().then(() => nav({ to: "/login" }))} className="text-sidebar-foreground hover:bg-sidebar-accent">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-14 bg-card border-b flex items-center px-4 gap-3">
          <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold truncate">SpendLens Chakravyuha</span>
            {tenant && <Badge variant="outline" className="hidden sm:inline-flex">{tenant.name}</Badge>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge className="bg-[color:var(--success)] text-white gap-1.5 hidden sm:inline-flex">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
            </Badge>
            <Button size="icon" variant="ghost" onClick={toggleTheme}>
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="relative">
                  <Bell className="w-4 h-4" />
                  {alerts.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Recent alerts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {alerts.length === 0 && <div className="px-2 py-6 text-sm text-muted-foreground text-center">No alerts</div>}
                {alerts.map((a) => (
                  <DropdownMenuItem key={a.id} className="flex-col items-start gap-0.5">
                    <div className="flex w-full items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{a.severity}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">{new Date(a.sent_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-sm">{a.message}</div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold">{initials}</div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
