import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusPill, TableShell, Th, Td, Btn, Field, EmptyState, inputCls } from "@/components/ui-primitives";
import { numberFmt, dateTimeFmt } from "@/lib/format";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Search, Pencil, Trash2, Route as RouteIcon, Play, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trips")({
  component: TripsPage,
  head: () => ({ meta: [{ title: "Trips & Dispatch — TransitOps" }, { name: "description", content: "Draft, dispatch and monitor every trip through completion." }] }),
});

const schema = z.object({
  origin: z.string().trim().min(2).max(120),
  destination: z.string().trim().min(2).max(120),
  vehicle_id: z.string().uuid().optional().or(z.literal("")),
  driver_id: z.string().uuid().optional().or(z.literal("")),
  cargo_weight_kg: z.coerce.number().min(0),
  planned_distance_km: z.coerce.number().min(0),
  estimated_fuel_l: z.coerce.number().min(0),
  delivery_notes: z.string().max(500).optional().or(z.literal("")),
  scheduled_at: z.string().optional().or(z.literal("")),
  status: z.enum(["draft", "dispatched", "completed", "cancelled"]),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  origin: "", destination: "", vehicle_id: "", driver_id: "",
  cargo_weight_kg: 0, planned_distance_km: 0, estimated_fuel_l: 0,
  delivery_notes: "", scheduled_at: "", status: "draft",
};

function TripsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<null | (FormValues & { id?: string })>(null);

  const { data: trips, isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: async () => (await supabase.from("trips").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-lite"],
    queryFn: async () => (await supabase.from("vehicles").select("id,registration_number,model,status,max_load_kg")).data ?? [],
  });
  const { data: drivers } = useQuery({
    queryKey: ["drivers-lite"],
    queryFn: async () => (await supabase.from("drivers").select("id,full_name,status,license_expiry")).data ?? [],
  });

  const vMap = useMemo(() => new Map((vehicles ?? []).map((v) => [v.id, v])), [vehicles]);
  const dMap = useMemo(() => new Map((drivers ?? []).map((d) => [d.id, d])), [drivers]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (trips ?? []).filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!s) return true;
      return t.trip_code.toLowerCase().includes(s) || t.origin.toLowerCase().includes(s) || t.destination.toLowerCase().includes(s);
    });
  }, [trips, search, statusFilter]);

  const upsert = useMutation({
    mutationFn: async (v: FormValues & { id?: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const payload = {
        ...v,
        vehicle_id: v.vehicle_id || null,
        driver_id: v.driver_id || null,
        scheduled_at: v.scheduled_at || null,
        delivery_notes: v.delivery_notes || null,
        created_by: userRes.user?.id,
      };
      if (v.id) {
        const { error } = await supabase.from("trips").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trips").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["drivers"] });
      toast.success(editing?.id ? "Trip updated" : "Trip created");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FormValues["status"] }) => {
      const { error } = await supabase.from("trips").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["trips"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["drivers"] });
      toast.success(`Trip ${v.status}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("trips").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); toast.success("Trip removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Dispatch"
        title="Trips"
        description="Full lifecycle: draft, dispatch, and complete. Business rules run automatically on dispatch."
        actions={<Btn onClick={() => setEditing({ ...EMPTY })}><Plus className="size-4" /> New trip</Btn>}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search trip code, origin, destination…" className={inputCls + " pl-10"} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls + " w-48"}>
          <option value="all">All statuses</option><option value="draft">Draft</option><option value="dispatched">Dispatched</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select>
      </div>

      {isLoading ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-sm text-muted-foreground">Loading trips…</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No trips yet" body="Create your first trip and dispatch when ready." action={<Btn onClick={() => setEditing({ ...EMPTY })}><Plus className="size-4" /> New trip</Btn>} />
      ) : (
        <TableShell>
          <thead><tr>
            <Th>Trip</Th><Th>Route</Th><Th>Vehicle</Th><Th>Driver</Th><Th>Status</Th>
            <Th className="text-right">Cargo</Th><Th>Scheduled</Th><Th className="text-right">Actions</Th>
          </tr></thead>
          <tbody>
            {filtered.map((t) => {
              const v = t.vehicle_id ? vMap.get(t.vehicle_id) : null;
              const d = t.driver_id ? dMap.get(t.driver_id) : null;
              return (
                <tr key={t.id} className="hover:bg-secondary/20 transition-colors">
                  <Td><span className="font-mono text-xs text-primary font-bold">{t.trip_code}</span></Td>
                  <Td className="text-sm">{t.origin} → {t.destination}</Td>
                  <Td>{v ? <span className="font-mono text-xs">{v.registration_number}</span> : <span className="text-xs text-muted-foreground">Unassigned</span>}</Td>
                  <Td className="text-sm">{d?.full_name ?? <span className="text-xs text-muted-foreground">Unassigned</span>}</Td>
                  <Td><StatusPill status={t.status} /></Td>
                  <Td className="text-right font-mono text-xs">{numberFmt(Number(t.cargo_weight_kg))} kg</Td>
                  <Td className="text-xs text-muted-foreground">{dateTimeFmt(t.scheduled_at)}</Td>
                  <Td className="text-right">
                    <div className="inline-flex gap-1">
                      {t.status === "draft" && <Btn variant="ghost" className="h-8 w-8 p-0 hover:text-primary" title="Dispatch" onClick={() => setStatus.mutate({ id: t.id, status: "dispatched" })}><Play className="size-3.5" /></Btn>}
                      {t.status === "dispatched" && <Btn variant="ghost" className="h-8 w-8 p-0 hover:text-success" title="Complete" onClick={() => setStatus.mutate({ id: t.id, status: "completed" })}><CheckCircle2 className="size-3.5" /></Btn>}
                      {(t.status === "draft" || t.status === "dispatched") && <Btn variant="ghost" className="h-8 w-8 p-0 hover:text-destructive" title="Cancel" onClick={() => setStatus.mutate({ id: t.id, status: "cancelled" })}><XCircle className="size-3.5" /></Btn>}
                      <Btn variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing({
                        id: t.id, origin: t.origin, destination: t.destination,
                        vehicle_id: t.vehicle_id ?? "", driver_id: t.driver_id ?? "",
                        cargo_weight_kg: Number(t.cargo_weight_kg), planned_distance_km: Number(t.planned_distance_km),
                        estimated_fuel_l: Number(t.estimated_fuel_l), delivery_notes: t.delivery_notes ?? "",
                        scheduled_at: t.scheduled_at ? new Date(t.scheduled_at).toISOString().slice(0, 16) : "",
                        status: t.status,
                      })}><Pencil className="size-3.5" /></Btn>
                      <Btn variant="ghost" className="h-8 w-8 p-0 hover:text-destructive" onClick={() => { if (confirm(`Delete trip ${t.trip_code}?`)) del.mutate(t.id); }}><Trash2 className="size-3.5" /></Btn>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><RouteIcon className="size-5 text-primary" /> {editing?.id ? "Edit trip" : "New trip"}</DialogTitle></DialogHeader>
          {editing && <TripForm value={editing} vehicles={vehicles ?? []} drivers={drivers ?? []} onSubmit={(v) => upsert.mutate({ ...v, id: editing.id })} loading={upsert.isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TripForm({
  value, vehicles, drivers, onSubmit, loading,
}: {
  value: FormValues & { id?: string };
  vehicles: { id: string; registration_number: string; model: string; status: string; max_load_kg: number }[];
  drivers: { id: string; full_name: string; status: string; license_expiry: string }[];
  onSubmit: (v: FormValues) => void; loading: boolean;
}) {
  const [form, setForm] = useState<FormValues>(value);
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
      <Field label="Origin"><input required className={inputCls} value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} /></Field>
      <Field label="Destination"><input required className={inputCls} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></Field>
      <Field label="Vehicle">
        <select className={inputCls} value={form.vehicle_id ?? ""} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
          <option value="">— Unassigned —</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} · {v.model} ({v.status})</option>)}
        </select>
      </Field>
      <Field label="Driver">
        <select className={inputCls} value={form.driver_id ?? ""} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
          <option value="">— Unassigned —</option>
          {drivers.map(d => <option key={d.id} value={d.id}>{d.full_name} ({d.status})</option>)}
        </select>
      </Field>
      <Field label="Cargo (kg)"><input type="number" min={0} step="0.01" className={inputCls} value={form.cargo_weight_kg} onChange={(e) => setForm({ ...form, cargo_weight_kg: Number(e.target.value) })} /></Field>
      <Field label="Distance (km)"><input type="number" min={0} step="0.01" className={inputCls} value={form.planned_distance_km} onChange={(e) => setForm({ ...form, planned_distance_km: Number(e.target.value) })} /></Field>
      <Field label="Est. fuel (L)"><input type="number" min={0} step="0.01" className={inputCls} value={form.estimated_fuel_l} onChange={(e) => setForm({ ...form, estimated_fuel_l: Number(e.target.value) })} /></Field>
      <Field label="Scheduled at"><input type="datetime-local" className={inputCls} value={form.scheduled_at ?? ""} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></Field>
      <Field label="Status">
        <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormValues["status"] })}>
          <option value="draft">Draft</option><option value="dispatched">Dispatched</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select>
      </Field>
      <div className="col-span-2"><Field label="Delivery notes"><textarea className={inputCls + " min-h-20"} value={form.delivery_notes ?? ""} onChange={(e) => setForm({ ...form, delivery_notes: e.target.value })} /></Field></div>
      <div className="col-span-2 flex justify-end gap-2">
        <Btn type="submit" disabled={loading}>{loading ? "Saving…" : value.id ? "Save changes" : "Create trip"}</Btn>
      </div>
    </form>
  );
}
