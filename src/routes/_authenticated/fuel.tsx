import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, TableShell, Th, Td, Btn, Field, EmptyState, inputCls } from "@/components/ui-primitives";
import { currency, numberFmt, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Search, Fuel, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fuel")({
  component: FuelPage,
  head: () => ({ meta: [{ title: "Fuel Logs — TransitOps" }, { name: "description", content: "Fuel consumption logs and efficiency analytics." }] }),
});

const schema = z.object({
  vehicle_id: z.string().uuid("Vehicle required"),
  driver_id: z.string().uuid().optional().or(z.literal("")),
  logged_at: z.string().min(1),
  liters: z.coerce.number().positive("Liters must be positive"),
  cost: z.coerce.number().min(0),
  odometer_km: z.coerce.number().min(0).optional(),
  station: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(300).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

const EMPTY = (): FormValues => ({
  vehicle_id: "", driver_id: "", logged_at: new Date().toISOString().slice(0, 16),
  liters: 0, cost: 0, odometer_km: undefined, station: "", notes: "",
});

function FuelPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["fuel"],
    queryFn: async () => (await supabase.from("fuel_logs").select("*").order("logged_at", { ascending: false })).data ?? [],
  });
  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-lite-fuel"],
    queryFn: async () => (await supabase.from("vehicles").select("id,registration_number,model")).data ?? [],
  });
  const { data: drivers } = useQuery({
    queryKey: ["drivers-lite-fuel"],
    queryFn: async () => (await supabase.from("drivers").select("id,full_name")).data ?? [],
  });
  const vMap = useMemo(() => new Map((vehicles ?? []).map((v) => [v.id, v])), [vehicles]);
  const dMap = useMemo(() => new Map((drivers ?? []).map((d) => [d.id, d])), [drivers]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (logs ?? []).filter((l) => {
      if (!s) return true;
      const v = vMap.get(l.vehicle_id);
      return (v?.registration_number.toLowerCase().includes(s) ?? false) || (l.station?.toLowerCase().includes(s) ?? false);
    });
  }, [logs, search, vMap]);

  const stats = useMemo(() => {
    const totalL = (logs ?? []).reduce((s, l) => s + Number(l.liters), 0);
    const totalC = (logs ?? []).reduce((s, l) => s + Number(l.cost), 0);
    const avgCostPerL = totalL > 0 ? totalC / totalL : 0;
    return { totalL, totalC, avgCostPerL, count: logs?.length ?? 0 };
  }, [logs]);

  const insert = useMutation({
    mutationFn: async (v: FormValues) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("fuel_logs").insert({
        ...v,
        driver_id: v.driver_id || null,
        odometer_km: v.odometer_km ?? null,
        station: v.station || null,
        notes: v.notes || null,
        logged_at: new Date(v.logged_at).toISOString(),
        created_by: userRes.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fuel"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Fuel log added"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("fuel_logs").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fuel"] }); toast.success("Log removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Consumption"
        title="Fuel Logs"
        description="Every fuel stop, with computed efficiency metrics."
        actions={<Btn onClick={() => setOpen(true)}><Plus className="size-4" /> Log fuel</Btn>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Metric label="Logs" value={numberFmt(stats.count)} />
        <Metric label="Total Liters" value={numberFmt(stats.totalL, 1)} />
        <Metric label="Total Cost" value={currency(stats.totalC)} />
        <Metric label="Avg $ / Liter" value={`$${stats.avgCostPerL.toFixed(2)}`} />
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vehicle or station…" className={inputCls + " pl-10"} />
        </div>
      </div>

      {isLoading ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-sm text-muted-foreground">Loading logs…</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No fuel logs yet" body="Log your first fuel stop to unlock efficiency analytics." action={<Btn onClick={() => setOpen(true)}><Plus className="size-4" /> Log fuel</Btn>} />
      ) : (
        <TableShell>
          <thead><tr><Th>Date</Th><Th>Vehicle</Th><Th>Driver</Th><Th>Station</Th><Th className="text-right">Liters</Th><Th className="text-right">Cost</Th><Th className="text-right">Odometer</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody>
            {filtered.map((l) => {
              const v = vMap.get(l.vehicle_id);
              const d = l.driver_id ? dMap.get(l.driver_id) : null;
              return (
                <tr key={l.id} className="hover:bg-secondary/20">
                  <Td className="text-xs text-muted-foreground">{dateTimeFmt(l.logged_at)}</Td>
                  <Td>{v ? <span className="font-mono text-xs font-bold text-primary">{v.registration_number}</span> : "—"}</Td>
                  <Td className="text-sm">{d?.full_name ?? <span className="text-xs text-muted-foreground">—</span>}</Td>
                  <Td className="text-sm text-muted-foreground">{l.station ?? "—"}</Td>
                  <Td className="text-right font-mono text-xs">{numberFmt(Number(l.liters), 2)} L</Td>
                  <Td className="text-right font-mono text-xs">{currency(Number(l.cost))}</Td>
                  <Td className="text-right font-mono text-xs">{l.odometer_km ? numberFmt(Number(l.odometer_km)) + " km" : "—"}</Td>
                  <Td className="text-right"><Btn variant="ghost" className="h-8 w-8 p-0 hover:text-destructive" onClick={() => { if (confirm("Delete log?")) del.mutate(l.id); }}><Trash2 className="size-3.5" /></Btn></Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Fuel className="size-5 text-primary" /> Log fuel</DialogTitle></DialogHeader>
          <FuelForm vehicles={vehicles ?? []} drivers={drivers ?? []} onSubmit={insert.mutate} loading={insert.isPending} />
        </DialogContent>
      </Dialog>
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

function FuelForm({
  vehicles, drivers, onSubmit, loading,
}: {
  vehicles: { id: string; registration_number: string; model: string }[];
  drivers: { id: string; full_name: string }[];
  onSubmit: (v: FormValues) => void; loading: boolean;
}) {
  const [form, setForm] = useState<FormValues>(EMPTY());
  return (
    <form
      className="grid grid-cols-2 gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = schema.safeParse(form);
        if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
        onSubmit(parsed.data);
      }}
    >
      <div className="col-span-2">
        <Field label="Vehicle">
          <select required className={inputCls} value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
            <option value="">— Select vehicle —</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} · {v.model}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Driver">
        <select className={inputCls} value={form.driver_id ?? ""} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
          <option value="">— Unassigned —</option>
          {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
        </select>
      </Field>
      <Field label="Date & time"><input required type="datetime-local" className={inputCls} value={form.logged_at} onChange={(e) => setForm({ ...form, logged_at: e.target.value })} /></Field>
      <Field label="Liters"><input required type="number" min={0} step="0.01" className={inputCls} value={form.liters} onChange={(e) => setForm({ ...form, liters: Number(e.target.value) })} /></Field>
      <Field label="Cost"><input required type="number" min={0} step="0.01" className={inputCls} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></Field>
      <Field label="Odometer (km)"><input type="number" min={0} step="0.01" className={inputCls} value={form.odometer_km ?? ""} onChange={(e) => setForm({ ...form, odometer_km: e.target.value ? Number(e.target.value) : undefined })} /></Field>
      <Field label="Station"><input className={inputCls} value={form.station ?? ""} onChange={(e) => setForm({ ...form, station: e.target.value })} /></Field>
      <div className="col-span-2"><Field label="Notes"><textarea className={inputCls + " min-h-16"} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
      <div className="col-span-2 flex justify-end"><Btn type="submit" disabled={loading}>{loading ? "Saving…" : "Log fuel"}</Btn></div>
    </form>
  );
}
