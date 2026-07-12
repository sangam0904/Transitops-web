import { createFileRoute, Outlet, redirect, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentProfile } from "@/lib/auth-hooks";
import { initials, roleLabel } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Truck, Users, Route as RouteIcon, Wrench, Fuel, Receipt,
  BarChart3, Bell, LogOut, Search, Radio
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

const NAV_OPS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vehicles", label: "Vehicles", icon: Truck },
  { to: "/drivers", label: "Drivers", icon: Users },
  { to: "/trips", label: "Trips & Dispatch", icon: RouteIcon },
] as const;

const NAV_OPS2 = [
  { to: "/maintenance", label: "Maintenance", icon: Wrench },
  { to: "/fuel", label: "Fuel Logs", icon: Fuel },
  { to: "/expenses", label: "Expenses", icon: Receipt },
] as const;

const NAV_INTEL = [
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/notifications", label: "Notifications", icon: Bell },
] as const;

function AuthenticatedLayout() {
  const profileQ = useCurrentProfile();
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const displayName = profileQ.data?.profile?.full_name ?? profileQ.data?.user?.email ?? "Operator";
  const primaryRole = profileQ.data?.roles?.[0] ?? "fleet_manager";

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground sticky top-0 h-screen">
        <div className="px-6 py-5 flex items-center gap-3 border-b border-sidebar-border">
          <div className="size-9 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center relative">
            <Radio className="size-4 text-primary" />
            <span className="absolute inset-0 rounded-lg ring-1 ring-primary/40 animate-pulse pointer-events-none" />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold tracking-tight text-base leading-none">TRANSIT<span className="text-primary">OPS</span></p>
            <p className="text-[10px] font-mono uppercase text-muted-foreground mt-1 tracking-widest">Control Tower</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          <NavGroup label="Operations" items={NAV_OPS} pathname={pathname} />
          <NavGroup label="Records" items={NAV_OPS2} pathname={pathname} />
          <NavGroup label="Intelligence" items={NAV_INTEL} pathname={pathname} />
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-sidebar-accent">
            <div className="size-9 rounded-full bg-primary/20 border border-primary/30 grid place-items-center text-xs font-bold text-primary shrink-0">
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{roleLabel[primaryRole] ?? primaryRole}</p>
            </div>
            <button onClick={signOut} title="Sign out" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 border-b border-border sticky top-0 z-30 backdrop-blur-xl bg-background/60 flex items-center px-4 md:px-8 gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search vehicles, drivers, trips…"
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary/60 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/30"
            />
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
            <span className="relative flex size-2">
              <span className="absolute inset-0 rounded-full bg-success opacity-60 animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-success">Live · Systems nominal</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded border border-primary/30 text-primary bg-primary/5">
            {roleLabel[primaryRole] ?? primaryRole}
          </span>
        </header>

        <div className="flex-1 p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: readonly { to: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  pathname: string;
}) {
  return (
    <div>
      <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors " +
                (active
                  ? "bg-primary/10 text-primary border-l-2 border-primary pl-[10px]"
                  : "text-sidebar-foreground/70 hover:text-foreground hover:bg-sidebar-accent")
              }
            >
              <item.icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
