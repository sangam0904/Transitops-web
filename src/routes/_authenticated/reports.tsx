import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, TableShell, Th, Td } from "@/components/ui-primitives";
import { currency, numberFmt } from "@/lib/format";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports & Analytics — TransitOps" }, { name: "description", content: "Fleet utilization, ROI, and financial performance reports." }] }),
});

function ReportsPage() {
  const q = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [v, t, m, f, e] = await Promise.all([
        supabase.from("vehicles").select("id,registration_number,model,acquisition_cost,status"),
        supabase.from("trips").select("id,vehicle_id,status,planned_distance_km,cargo_weight_kg,completed_at"),
        supabase.from("maintenance_records").select("id,vehicle_id,cost,created_at"),
        supabase.from("fuel_logs").select("id,vehicle_id,liters,cost,logged_at"),
        supabase.from("expenses").select("id,vehicle_id,category,amount,incurred_on"),
      ]);
      return {
        vehicles: v.data ?? [], trips: t.data ?? [], maintenance: m.data ?? [],
        fuel: f.data ?? [], expenses: e.data ?? [],
      };
    },
  });

  const byVehicle = useMemo(() => {
    if (!q.data) return [];
    return q.data.vehicles.map((v) => {
      const trips = q.data.trips.filter((t) => t.vehicle_id === v.id);
      const completed = trips.filter((t) => t.status === "completed");
      const km = completed.reduce((s, t) => s + Number(t.planned_distance_km), 0);
      const maintCost = q.data.maintenance.filter((m) => m.vehicle_id === v.id).reduce((s, m) => s + Number(m.cost), 0);
      const fuelCost = q.data.fuel.filter((f) => f.vehicle_id === v.id).reduce((s, f) => s + Number(f.cost), 0);
      const otherCost = q.data.expenses.filter((e) => e.vehicle_id === v.id).reduce((s, e) => s + Number(e.amount), 0);
      const totalCost = maintCost + fuelCost + otherCost;
      const acq = Number(v.acquisition_cost);
      const costPerKm = km > 0 ? totalCost / km : 0;
      return {
        id: v.id, registration: v.registration_number, model: v.model, status: v.status,
        tripsCompleted: completed.length, km, maintCost, fuelCost, otherCost, totalCost, acq, costPerKm,
      };
    }).sort((a, b) => b.totalCost - a.totalCost);
  }, [q.data]);

  const chartData = byVehicle.slice(0, 8).map(v => ({
    name: v.registration, Fuel: Math.round(v.fuelCost), Maintenance: Math.round(v.maintCost), Other: Math.round(v.otherCost),
  }));

  const totals = useMemo(() => {
    const tot = byVehicle.reduce((s, r) => ({
      trips: s.trips + r.tripsCompleted, km: s.km + r.km, cost: s.cost + r.totalCost, acq: s.acq + r.acq,
    }), { trips: 0, km: 0, cost: 0, acq: 0 });
    return tot;
  }, [byVehicle]);

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Reports"
        description="ROI, utilization, and cost breakdowns across the fleet."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Metric label="Completed Trips" value={numberFmt(totals.trips)} />
        <Metric label="Total Distance" value={`${numberFmt(totals.km)} km`} />
        <Metric label="Total Ops Cost" value={currency(totals.cost)} />
        <Metric label="Fleet Value" value={currency(totals.acq)} />
      </div>

      <div className="glass-panel-strong rounded-2xl p-6 mb-6">
        <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">Cost Breakdown</p>
        <h2 className="text-lg font-bold mt-1 mb-4">Per Vehicle · Top 8 by Total Cost</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
              <XAxis dataKey="name" stroke="oklch(0.65 0.02 250)" fontSize={11} />
              <YAxis stroke="oklch(0.65 0.02 250)" fontSize={11} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: "oklch(0.16 0.015 250)", border: "1px solid oklch(1 0 0 / 0.08)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => currency(v)} />
              <Bar dataKey="Fuel" stackId="a" fill="oklch(0.78 0.14 200)" />
              <Bar dataKey="Maintenance" stackId="a" fill="oklch(0.80 0.16 75)" />
              <Bar dataKey="Other" stackId="a" fill="oklch(0.72 0.16 155)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <TableShell>
        <thead><tr>
          <Th>Vehicle</Th><Th>Model</Th><Th className="text-right">Trips</Th>
          <Th className="text-right">Distance</Th><Th className="text-right">Fuel</Th>
          <Th className="text-right">Maintenance</Th><Th className="text-right">Other</Th>
          <Th className="text-right">Total Cost</Th><Th className="text-right">$/km</Th>
        </tr></thead>
        <tbody>
          {byVehicle.map((r) => (
            <tr key={r.id} className="hover:bg-secondary/20">
              <Td><span className="font-mono text-xs font-bold text-primary">{r.registration}</span></Td>
              <Td className="text-sm">{r.model}</Td>
              <Td className="text-right font-mono text-xs">{r.tripsCompleted}</Td>
              <Td className="text-right font-mono text-xs">{numberFmt(r.km)} km</Td>
              <Td className="text-right font-mono text-xs">{currency(r.fuelCost)}</Td>
              <Td className="text-right font-mono text-xs">{currency(r.maintCost)}</Td>
              <Td className="text-right font-mono text-xs">{currency(r.otherCost)}</Td>
              <Td className="text-right font-mono text-xs font-bold">{currency(r.totalCost)}</Td>
              <Td className="text-right font-mono text-xs">${r.costPerKm.toFixed(2)}</Td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-xl p-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-2xl font-black tracking-tight mt-1">{value}</p>
    </div>
  );
}
