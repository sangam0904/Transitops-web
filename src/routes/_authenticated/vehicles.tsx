import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusPill, TableShell, Th, Td, Btn, Field, EmptyState, inputCls } from "@/components/ui-primitives";
import { currency, numberFmt, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Search, Pencil, Trash2, Truck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vehicles")({
  component: VehiclesPage,
  head: () => ({ meta: [{ title: "Vehicles — TransitOps" }, { name: "description", content: "Fleet vehicle registry: register, edit and monitor every asset." }] }),
});

const schema = z.object({
  registration_number: z.string().trim().min(2, "Registration required").max(40),
  model: z.string().trim().min(2, "Model required").max(80),
  type: z.enum(["truck", "van", "trailer", "tanker", "reefer", "pickup"]),
  max_load_kg: z.coerce.number().min(0),
  odometer_km: z.coerce.number().min(0),
  acquisition_cost: z.coerce.number().min(0),
  insurance_provider: z.string().trim().max(80).optional().or(z.literal("")),
  insurance_expiry: z.string().optional().or(z.literal("")),
  status: z.enum(["available", "in_transit", "in_shop", "retired"]),
  notes: z.string().max(500).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  registration_number: "", model: "", type: "truck",
  max_load_kg: 0, odometer_km: 0, acquisition_cost: 0,
  insurance_provider: "", insurance_expiry: "", status: "available", notes: "",
};

function VehiclesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<null | (FormValues & { id?: string })>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (data ?? []).filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (!s) return true;
      return v.registration_number.toLowerCase().includes(s) || v.model.toLowerCase().includes(s);
    });
  }, [data, search, statusFilter]);

  const upsert = useMutation({
    mutationFn: async (v: FormValues & { id?: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const payload = { ...v, insurance_expiry: v.insurance_expiry || null, insurance_provider: v.insurance_provider || null, notes: v.notes || null, created_by: userRes.user?.id };
      if (v.id) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vehicles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing?.id ? "Vehicle updated" : "Vehicle registered");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Vehicle removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Fleet Registry"
        title="Vehicles"
        description="Every asset in your fleet — with real-time status, insurance and utilization."
        actions={<Btn onClick={() => setEditing({ ...EMPTY })}><Plus className="size-4" /> Register vehicle</Btn>}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search registration or model…" className={inputCls + " pl-10"} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls + " w-48"}>
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="in_transit">In Transit</option>
          <option value="in_shop">In Shop</option>
          <option value="retired">Retired</option>
        </select>
      </div>

      {isLoading ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-sm text-muted-foreground">Loading fleet…</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No vehicles yet" body="Register your first asset to start dispatching operations." action={<Btn onClick={() => setEditing({ ...EMPTY })}><Plus className="size-4" /> Register vehicle</Btn>} />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Registration</Th>
              <Th>Model / Type</Th>
              <Th>Status</Th>
              <Th className="text-right">Max Load</Th>
              <Th className="text-right">Odometer</Th>
              <Th>Insurance Expiry</Th>
              <Th className="text-right">Value</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} className="hover:bg-secondary/20 transition-colors">
                <Td><span className="font-mono text-xs font-bold text-primary">{v.registration_number}</span></Td>
                <Td><p className="font-medium">{v.model}</p><p className="text-[11px] text-muted-foreground capitalize">{v.type}</p></Td>
                <Td><StatusPill status={v.status} /></Td>
                <Td className="text-right font-mono text-xs">{numberFmt(Number(v.max_load_kg))} kg</Td>
                <Td className="text-right font-mono text-xs">{numberFmt(Number(v.odometer_km))} km</Td>
                <Td className="text-xs text-muted-foreground">{dateFmt(v.insurance_expiry)}</Td>
                <Td className="text-right font-mono text-xs">{currency(Number(v.acquisition_cost))}</Td>
                <Td className="text-right">
                  <div className="inline-flex gap-1">
                    <Btn variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing({
                      id: v.id, registration_number: v.registration_number, model: v.model, type: v.type,
                      max_load_kg: Number(v.max_load_kg), odometer_km: Number(v.odometer_km),
                      acquisition_cost: Number(v.acquisition_cost),
                      insurance_provider: v.insurance_provider ?? "", insurance_expiry: v.insurance_expiry ?? "",
                      status: v.status, notes: v.notes ?? "",
                    })}><Pencil className="size-3.5" /></Btn>
                    <Btn variant="ghost" className="h-8 w-8 p-0 hover:text-destructive" onClick={() => { if (confirm(`Remove ${v.registration_number}?`)) del.mutate(v.id); }}><Trash2 className="size-3.5" /></Btn>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Truck className="size-5 text-primary" /> {editing?.id ? "Edit vehicle" : "Register vehicle"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <VehicleForm value={editing} onSubmit={(v) => upsert.mutate({ ...v, id: editing.id })} loading={upsert.isPending} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VehicleForm({ value, onSubmit, loading }: { value: FormValues & { id?: string }; onSubmit: (v: FormValues) => void; loading: boolean }) {
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
      <Field label="Registration number"><input required className={inputCls} value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value.toUpperCase() })} /></Field>
      <Field label="Model"><input required className={inputCls} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
      <Field label="Type">
        <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as FormValues["type"] })}>
          {["truck", "van", "trailer", "tanker", "reefer", "pickup"].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Status">
        <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormValues["status"] })}>
          <option value="available">Available</option>
          <option value="in_transit">In Transit</option>
          <option value="in_shop">In Shop</option>
          <option value="retired">Retired</option>
        </select>
      </Field>
      <Field label="Max load (kg)"><input type="number" min={0} step="0.01" className={inputCls} value={form.max_load_kg} onChange={(e) => setForm({ ...form, max_load_kg: Number(e.target.value) })} /></Field>
      <Field label="Odometer (km)"><input type="number" min={0} step="0.01" className={inputCls} value={form.odometer_km} onChange={(e) => setForm({ ...form, odometer_km: Number(e.target.value) })} /></Field>
      <Field label="Acquisition cost"><input type="number" min={0} step="0.01" className={inputCls} value={form.acquisition_cost} onChange={(e) => setForm({ ...form, acquisition_cost: Number(e.target.value) })} /></Field>
      <Field label="Insurance provider"><input className={inputCls} value={form.insurance_provider ?? ""} onChange={(e) => setForm({ ...form, insurance_provider: e.target.value })} /></Field>
      <Field label="Insurance expiry"><input type="date" className={inputCls} value={form.insurance_expiry ?? ""} onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })} /></Field>
      <div className="col-span-2">
        <Field label="Notes"><textarea className={inputCls + " min-h-20"} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </div>
      <div className="col-span-2 flex justify-end gap-2">
        <Btn variant="primary" type="submit" disabled={loading}>{loading ? "Saving…" : value.id ? "Save changes" : "Register vehicle"}</Btn>
      </div>
    </form>
  );
}
