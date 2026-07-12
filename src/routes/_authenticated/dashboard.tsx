import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currency, numberFmt, relativeTime } from "@/lib/format";
import {
  Truck, Users, Wrench, Route as RouteIcon, Fuel, DollarSign, Activity, Sparkles,
  TrendingUp, AlertTriangle, CheckCircle2, ArrowUpRight,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Operations Dashboard — TransitOps" },
      { name: "description", content: "Live fleet KPIs, dispatch monitor, expenses and predictive insights." },
    ],
  }),
});

function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [
        vehicles, drivers, trips, maintenance, fuel, expenses, notifications,
      ] = await Promise.all([
        supabase.from("vehicles").select("id,status,type,registration_number,model,acquisition_cost"),
        supabase.from("drivers").select("id,status,license_expiry,safety_score"),
        supabase.from("trips").select("id,trip_code,origin,destination,status,dispatched_at,completed_at,cargo_weight_kg,planned_distance_km,vehicle_id,driver_id,created_at"),
        supabase.from("maintenance_records").select("id,vehicle_id,cost,status,priority,issue_description,created_at"),
        supabase.from("fuel_logs").select("id,vehicle_id,liters,cost,logged_at,odometer_km"),
        supabase.from("expenses").select("id,category,amount,incurred_on"),
        supabase.from("notifications").select("id,title,body,severity,created_at").order("created_at", { ascending: false }).limit(8),
      ]);

      return {
        vehicles: vehicles.data ?? [],
        drivers: drivers.data ?? [],
        trips: trips.data ?? [],
        maintenance: maintenance.data ?? [],
        fuel: fuel.data ?? [],
        expenses: expenses.data ?? [],
        notifications: notifications.data ?? [],
      };
    },
    refetchInterval: 30_000,
  });
}

function DashboardPage() {
  const { data, isLoading } = useDashboard();

  const stats = useMemo(() => {
    const v = data?.vehicles ?? [];
    const d = data?.drivers ?? [];
    const t = data?.trips ?? [];
    const m = data?.maintenance ?? [];
    const f = data?.fuel ?? [];
    const e = data?.expenses ?? [];

    const activeVehicles = v.filter((x) => x.status === "in_transit").length;
    const availableVehicles = v.filter((x) => x.status === "available").length;
    const inShop = v.filter((x) => x.status === "in_shop").length;
    const activeTrips = t.filter((x) => x.status === "dispatched").length;
    const pendingTrips = t.filter((x) => x.status === "draft").length;
    const availableDrivers = d.filter((x) => x.status === "available").length;
    const totalVehicles = v.filter((x) => x.status !== "retired").length;
    const utilization = totalVehicles ? Math.round((activeVehicles / totalVehicles) * 100) : 0;

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const fuelMtd = f.filter((x) => new Date(x.logged_at) >= monthStart).reduce((s, x) => s + Number(x.cost), 0);
    const maintMtd = m.filter((x) => new Date(x.created_at) >= monthStart).reduce((s, x) => s + Number(x.cost), 0);
    const opsMtd = e.filter((x) => new Date(x.incurred_on) >= monthStart).reduce((s, x) => s + Number(x.amount), 0) + fuelMtd + maintMtd;

    return { activeVehicles, availableVehicles, inShop, activeTrips, pendingTrips, availableDrivers, totalVehicles, utilization, fuelMtd, maintMtd, opsMtd };
  }, [data]);

  // Trends: last 7 days of expenses (all sources)
  const trendData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });
    return days.map((d) => {
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const inRange = (v: string) => { const t = new Date(v); return t >= d && t < next; };
      const fuel = (data?.fuel ?? []).filter((x) => inRange(x.logged_at)).reduce((s, x) => s + Number(x.cost), 0);
      const maint = (data?.maintenance ?? []).filter((x) => inRange(x.created_at)).reduce((s, x) => s + Number(x.cost), 0);
      const other = (data?.expenses ?? []).filter((x) => inRange(x.incurred_on)).reduce((s, x) => s + Number(x.amount), 0);
      return {
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        fuel: Math.round(fuel),
        maintenance: Math.round(maint),
        other: Math.round(other),
      };
    });
  }, [data]);

  const statusDist = useMemo(() => {
    const v = data?.vehicles ?? [];
    const c = { available: 0, in_transit: 0, in_shop: 0, retired: 0 } as Record<string, number>;
    v.forEach((x) => { c[x.status] = (c[x.status] ?? 0) + 1; });
    return [
      { name: "Available", value: c.available, color: "oklch(0.72 0.16 155)" },
      { name: "In Transit", value: c.in_transit, color: "oklch(0.78 0.14 200)" },
      { name: "In Shop", value: c.in_shop, color: "oklch(0.80 0.16 75)" },
      { name: "Retired", value: c.retired, color: "oklch(0.5 0.02 250)" },
    ];
  }, [data]);

  const insights = useMemo(() => buildInsights(data), [data]);
  const activeTripRows = (data?.trips ?? []).filter((t) => t.status === "dispatched" || t.status === "draft").slice(0, 6);
  const vehicleById = new Map((data?.vehicles ?? []).map((v) => [v.id, v]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] text-primary uppercase">Live Operations</p>
          <h1 className="text-3xl font-black tracking-tight mt-1">Command Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time telemetry across your fleet and dispatch operations.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/trips" className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 hover:opacity-90">
            <RouteIcon className="size-4" /> New Trip
          </Link>
          <Link to="/vehicles" className="h-10 px-4 rounded-lg border border-border bg-secondary/40 text-sm font-semibold inline-flex items-center gap-2 hover:bg-secondary">
            <Truck className="size-4" /> Add Vehicle
          </Link>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Active Vehicles" value={numberFmt(stats.activeVehicles)} sub={`${stats.availableVehicles} available`} icon={Truck} accent="primary" loading={isLoading} />
        <Kpi label="Active Trips" value={numberFmt(stats.activeTrips)} sub={`${stats.pendingTrips} pending dispatch`} icon={Activity} accent="info" loading={isLoading} />
        <Kpi label="Fleet Utilization" value={`${stats.utilization}%`} sub={`${stats.availableDrivers} drivers on standby`} icon={TrendingUp} accent="success" loading={isLoading} progress={stats.utilization} />
        <Kpi label="In Maintenance" value={numberFmt(stats.inShop)} sub={`${(data?.maintenance ?? []).filter(m => m.status === "in_progress").length} in progress`} icon={Wrench} accent="warning" loading={isLoading} />
        <Kpi label="Fuel · MTD" value={currency(stats.fuelMtd)} sub="Cost month-to-date" icon={Fuel} accent="info" loading={isLoading} />
        <Kpi label="Maintenance · MTD" value={currency(stats.maintMtd)} sub="Cost month-to-date" icon={Wrench} accent="warning" loading={isLoading} />
        <Kpi label="Operational Cost · MTD" value={currency(stats.opsMtd)} sub="All categories" icon={DollarSign} accent="destructive" loading={isLoading} />
        <Kpi label="Available Drivers" value={numberFmt(stats.availableDrivers)} sub="Ready for assignment" icon={Users} accent="success" loading={isLoading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="glass-panel-strong rounded-2xl p-6 xl:col-span-2">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">7-Day Trend</p>
              <h2 className="text-lg font-bold mt-1">Operational Expenditure</h2>
            </div>
            <div className="flex gap-2">
              <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-primary/10 text-primary border border-primary/30">Fuel</span>
              <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-warning/10 text-warning border border-warning/30">Maintenance</span>
              <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-secondary text-muted-foreground border border-border">Other</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gFuel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.14 200)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.78 0.14 200)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gMaint" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.80 0.16 75)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.80 0.16 75)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOther" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.16 155)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.72 0.16 155)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                <XAxis dataKey="day" stroke="oklch(0.65 0.02 250)" fontSize={11} />
                <YAxis stroke="oklch(0.65 0.02 250)" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.16 0.015 250)", border: "1px solid oklch(1 0 0 / 0.08)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => currency(v)}
                />
                <Area type="monotone" dataKey="fuel" stroke="oklch(0.78 0.14 200)" fill="url(#gFuel)" strokeWidth={2} />
                <Area type="monotone" dataKey="maintenance" stroke="oklch(0.80 0.16 75)" fill="url(#gMaint)" strokeWidth={2} />
                <Area type="monotone" dataKey="other" stroke="oklch(0.72 0.16 155)" fill="url(#gOther)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel-strong rounded-2xl p-6">
          <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">Distribution</p>
          <h2 className="text-lg font-bold mt-1 mb-4">Fleet Status</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusDist} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
                  {statusDist.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "oklch(0.16 0.015 250)", border: "1px solid oklch(1 0 0 / 0.08)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Active trips + insights */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="glass-panel-strong rounded-2xl xl:col-span-2 overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">Live Feed</p>
              <h2 className="text-lg font-bold mt-1">Active Dispatch</h2>
            </div>
            <Link to="/trips" className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:underline">
              All trips <ArrowUpRight className="size-3" />
            </Link>
          </div>
          {activeTripRows.length === 0 ? (
            <EmptyState icon={RouteIcon} title="No active missions" body="Dispatched trips will appear here in real time." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                    <th className="px-6 py-3 font-medium">Trip</th>
                    <th className="px-6 py-3 font-medium">Vehicle</th>
                    <th className="px-6 py-3 font-medium">Route</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Cargo</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTripRows.map((t) => {
                    const v = t.vehicle_id ? vehicleById.get(t.vehicle_id) : null;
                    return (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-primary">{t.trip_code}</td>
                        <td className="px-6 py-3">
                          <p className="font-mono text-xs font-semibold">{v?.registration_number ?? "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{v?.model ?? "Unassigned"}</p>
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">{t.origin} → {t.destination}</td>
                        <td className="px-6 py-3"><StatusPill status={t.status} /></td>
                        <td className="px-6 py-3 text-right font-mono text-xs">{numberFmt(Number(t.cargo_weight_kg))} kg</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-panel-strong rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 size-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="size-4 text-primary" />
              <p className="font-mono text-[10px] tracking-[0.3em] text-primary uppercase">AI Insights</p>
            </div>
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">All systems performing within expected parameters.</p>
            ) : (
              <div className="space-y-3 relative">
                {insights.map((ins, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary/40 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <ins.icon className={`size-3.5 ${ins.tone === "warn" ? "text-warning" : ins.tone === "danger" ? "text-destructive" : "text-success"}`} />
                      <p className="text-xs font-semibold">{ins.title}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{ins.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel-strong rounded-2xl p-6">
            <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-4">Recent Activity</p>
            {(data?.notifications ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No recent events.</p>
            ) : (
              <ul className="space-y-4">
                {(data?.notifications ?? []).map((n) => (
                  <li key={n.id} className="flex gap-3">
                    <div className={`size-2 rounded-full mt-1.5 shrink-0 ${sevDot(n.severity)}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{n.title}</p>
                      <p className="text-[10px] text-muted-foreground">{relativeTime(n.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label, value, sub, icon: Icon, accent, loading, progress,
}: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "info" | "success" | "warning" | "destructive";
  loading?: boolean; progress?: number;
}) {
  const map = {
    primary: "text-primary bg-primary/10 border-primary/30",
    info: "text-info bg-info/10 border-info/30",
    success: "text-success bg-success/10 border-success/30",
    warning: "text-warning bg-warning/10 border-warning/30",
    destructive: "text-destructive bg-destructive/10 border-destructive/30",
  } as const;
  return (
    <div className="glass-panel rounded-xl p-4 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-2xl font-black tracking-tight mt-1.5">
            {loading ? <span className="inline-block h-6 w-16 rounded bg-secondary animate-pulse" /> : value}
          </p>
          {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`size-8 rounded-lg border grid place-items-center ${map[accent]}`}>
          <Icon className="size-4" />
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-1 rounded-full bg-secondary overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    dispatched: "text-primary bg-primary/10 border-primary/30",
    draft: "text-warning bg-warning/10 border-warning/30",
    completed: "text-success bg-success/10 border-success/30",
    cancelled: "text-muted-foreground bg-secondary border-border",
    available: "text-success bg-success/10 border-success/30",
    in_transit: "text-primary bg-primary/10 border-primary/30",
    in_shop: "text-warning bg-warning/10 border-warning/30",
    retired: "text-muted-foreground bg-secondary border-border",
    suspended: "text-destructive bg-destructive/10 border-destructive/30",
    on_trip: "text-primary bg-primary/10 border-primary/30",
    off_duty: "text-muted-foreground bg-secondary border-border",
    scheduled: "text-info bg-info/10 border-info/30",
    in_progress: "text-warning bg-warning/10 border-warning/30",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest border ${map[status] ?? "text-muted-foreground bg-secondary border-border"}`}>
      <span className="size-1 rounded-full bg-current status-pulse" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="p-10 text-center">
      <div className="size-12 rounded-full bg-secondary/60 border border-border grid place-items-center mx-auto mb-3">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{body}</p>
    </div>
  );
}

function sevDot(sev: string) {
  if (sev === "danger" || sev === "error") return "bg-destructive";
  if (sev === "warn" || sev === "warning") return "bg-warning";
  if (sev === "success") return "bg-success";
  return "bg-primary";
}

type Insight = { title: string; body: string; tone: "warn" | "danger" | "ok"; icon: React.ComponentType<{ className?: string }> };
function buildInsights(data: ReturnType<typeof useDashboard>["data"]): Insight[] {
  if (!data) return [];
  const out: Insight[] = [];
  const now = new Date();
  const soon = new Date(); soon.setDate(now.getDate() + 30);

  const expLic = data.drivers.filter((d) => d.license_expiry && new Date(d.license_expiry) <= soon);
  if (expLic.length) {
    out.push({
      title: `${expLic.length} driver license(s) expiring soon`,
      body: "Renew before the 30-day threshold to keep dispatch eligibility active.",
      tone: "warn", icon: AlertTriangle,
    });
  }

  const critMaint = data.maintenance.filter((m) => m.priority === "critical" && m.status !== "completed");
  if (critMaint.length) {
    out.push({
      title: `${critMaint.length} critical maintenance job(s)`,
      body: "High-priority repairs are open. Prioritize to prevent unscheduled downtime.",
      tone: "danger", icon: AlertTriangle,
    });
  }

  const totalCap = data.vehicles.filter(v => v.status !== "retired").length;
  const active = data.vehicles.filter(v => v.status === "in_transit").length;
  if (totalCap && active / totalCap < 0.3) {
    out.push({
      title: "Fleet under-utilized",
      body: `Only ${Math.round((active / totalCap) * 100)}% of active vehicles are on the road today. Consider reassigning idle assets.`,
      tone: "warn", icon: TrendingUp,
    });
  }

  const lowScore = data.drivers.filter((d) => Number(d.safety_score) < 70);
  if (lowScore.length) {
    out.push({
      title: `${lowScore.length} driver(s) below safety threshold`,
      body: "Schedule a safety review — scores under 70 indicate elevated risk.",
      tone: "danger", icon: AlertTriangle,
    });
  }

  if (out.length === 0) {
    out.push({ title: "All systems nominal", body: "No anomalies detected across your fleet.", tone: "ok", icon: CheckCircle2 });
  }
  return out.slice(0, 4);
}
