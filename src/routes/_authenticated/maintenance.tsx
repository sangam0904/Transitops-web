import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusPill, TableShell, Th, Td, Btn, Field, EmptyState, inputCls } from "@/components/ui-primitives";
import { currency, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Search, Pencil, Trash2, Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/maintenance")({
  component: MaintPage,
  head: () => ({ meta: [{ title: "Maintenance — TransitOps" }, { name: "description", content: "Schedule and track vehicle maintenance jobs and repair costs." }] }),
});

const schema = z.object({
  vehicle_id: z.string().uuid("Vehicle required"),
  issue_description: z.string().trim().min(3).max(500),
  mechanic_name: z.string().trim().max(100).optional().or(z.literal("")),
  cost: z.coerce.number().min(0),
  priority: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
  expected_completion: z.string().optional().or(z.literal("")),
  actual_completion: z.string().optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { vehicle_id: "", issue_description: "", mechanic_name: "", cost: 0, priority: "medium", status: "scheduled", expected_completion: "", actual_completion: "" };

function MaintPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<null | (FormValues & { id?: string })>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance"],
    queryFn: async () => (await supabase.from("maintenance_records").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-lite-maint"],
    queryFn: async () => (await supabase.from("vehicles").select("id,registration_number,model").order("registration_number")).data ?? [],
  });
  const vMap = useMemo(() => new Map((vehicles ?? []).map((v) => [v.id, v])), [vehicles]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (data ?? []).filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!s) return true;
      const veh = vMap.get(m.vehicle_id);
      return m.issue_description.toLowerCase().includes(s) || (veh?.registration_number.toLowerCase().includes(s) ?? false);
    });
  }, [data, search, statusFilter, vMap]);

  const upsert = useMutation({
    mutationFn: async (v: FormValues & { id?: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const payload = { ...v, mechanic_name: v.mechanic_name || null, expected_completion: v.expected_completion || null, actual_completion: v.actual_completion || null, created_by: userRes.user?.id };
      if (v.id) { const { error } = await supabase.from("maintenance_records").update(payload).eq("id", v.id); if (error) throw error; }
      else { const { error } = await supabase.from("maintenance_records").insert(payload); if (error) throw error; }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success(editing?.id ? "Maintenance updated" : "Maintenance scheduled");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("maintenance_records").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maintenance"] }); toast.success("Record removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Workshop"
        title="Maintenance"
        description="Repairs, inspections, and downtime tracking. Vehicles auto-shift to 'In Shop' when jobs start."
        actions={<Btn onClick={() => setEditing({ ...EMPTY })}><Plus className="size-4" /> Schedule maintenance</Btn>}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search issue or vehicle…" className={inputCls + " pl-10"} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls + " w-48"}>
          <option value="all">All statuses</option><option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select>
      </div>

      {isLoading ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-sm text-muted-foreground">Loading records…</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No maintenance records" body="Schedule a repair or inspection to keep your fleet healthy." action={<Btn onClick={() => setEditing({ ...EMPTY })}><Plus className="size-4" /> Schedule maintenance</Btn>} />
      ) : (
        <TableShell>
          <thead><tr><Th>Vehicle</Th><Th>Issue</Th><Th>Priority</Th><Th>Status</Th><Th>Expected</Th><Th>Completed</Th><Th className="text-right">Cost</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody>
            {filtered.map((m) => {
              const v = vMap.get(m.vehicle_id);
              return (
                <tr key={m.id} className="hover:bg-secondary/20">
                  <Td>{v ? <><p className="font-mono text-xs font-bold text-primary">{v.registration_number}</p><p className="text-[11px] text-muted-foreground">{v.model}</p></> : <span className="text-xs text-muted-foreground">—</span>}</Td>
                  <Td className="max-w-xs truncate">{m.issue_description}<span className="block text-[10px] text-muted-foreground">{m.mechanic_name ?? "Mechanic TBD"}</span></Td>
                  <Td><StatusPill status={m.priority} /></Td>
                  <Td><StatusPill status={m.status} /></Td>
                  <Td className="text-xs text-muted-foreground">{dateFmt(m.expected_completion)}</Td>
                  <Td className="text-xs text-muted-foreground">{dateFmt(m.actual_completion)}</Td>
                  <Td className="text-right font-mono text-xs">{currency(Number(m.cost))}</Td>
                  <Td className="text-right">
                    <div className="inline-flex gap-1">
                      <Btn variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing({
                        id: m.id, vehicle_id: m.vehicle_id, issue_description: m.issue_description,
                        mechanic_name: m.mechanic_name ?? "", cost: Number(m.cost), priority: m.priority, status: m.status,
                        expected_completion: m.expected_completion ?? "", actual_completion: m.actual_completion ?? "",
                      })}><Pencil className="size-3.5" /></Btn>
                      <Btn variant="ghost" className="h-8 w-8 p-0 hover:text-destructive" onClick={() => { if (confirm("Remove record?")) del.mutate(m.id); }}><Trash2 className="size-3.5" /></Btn>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wrench className="size-5 text-primary" /> {editing?.id ? "Edit maintenance" : "Schedule maintenance"}</DialogTitle></DialogHeader>
          {editing && <MaintForm value={editing} vehicles={vehicles ?? []} onSubmit={(v) => upsert.mutate({ ...v, id: editing.id })} loading={upsert.isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MaintForm({
  value, vehicles, onSubmit, loading,
}: {
  value: FormValues & { id?: string };
  vehicles: { id: string; registration_number: string; model: string }[];
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
      <div className="col-span-2">
        <Field label="Vehicle">
          <select required className={inputCls} value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
            <option value="">— Select vehicle —</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} · {v.model}</option>)}
          </select>
        </Field>
      </div>
      <div className="col-span-2"><Field label="Issue description"><textarea required className={inputCls + " min-h-24"} value={form.issue_description} onChange={(e) => setForm({ ...form, issue_description: e.target.value })} /></Field></div>
      <Field label="Mechanic"><input className={inputCls} value={form.mechanic_name ?? ""} onChange={(e) => setForm({ ...form, mechanic_name: e.target.value })} /></Field>
      <Field label="Cost"><input type="number" min={0} step="0.01" className={inputCls} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></Field>
      <Field label="Priority">
        <select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as FormValues["priority"] })}>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
        </select>
      </Field>
      <Field label="Status">
        <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormValues["status"] })}>
          <option value="scheduled">Scheduled</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select>
      </Field>
      <Field label="Expected completion"><input type="date" className={inputCls} value={form.expected_completion ?? ""} onChange={(e) => setForm({ ...form, expected_completion: e.target.value })} /></Field>
      <Field label="Actual completion"><input type="date" className={inputCls} value={form.actual_completion ?? ""} onChange={(e) => setForm({ ...form, actual_completion: e.target.value })} /></Field>
      <div className="col-span-2 flex justify-end"><Btn type="submit" disabled={loading}>{loading ? "Saving…" : value.id ? "Save changes" : "Schedule"}</Btn></div>
    </form>
  );
}
