import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusPill, TableShell, Th, Td, Btn, Field, EmptyState, inputCls } from "@/components/ui-primitives";
import { dateFmt, initials } from "@/lib/format";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Search, Pencil, Trash2, Users, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/drivers")({
  component: DriversPage,
  head: () => ({ meta: [{ title: "Drivers — TransitOps" }, { name: "description", content: "Driver roster with license tracking and safety scores." }] }),
});

const schema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  license_number: z.string().trim().min(2).max(60),
  license_class: z.string().trim().max(20).optional().or(z.literal("")),
  license_expiry: z.string().min(1, "License expiry required"),
  years_experience: z.coerce.number().min(0).max(80),
  safety_score: z.coerce.number().min(0).max(100),
  emergency_contact_name: z.string().max(100).optional().or(z.literal("")),
  emergency_contact_phone: z.string().max(30).optional().or(z.literal("")),
  status: z.enum(["available", "on_trip", "off_duty", "suspended"]),
  notes: z.string().max(500).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  full_name: "", email: "", phone: "", license_number: "", license_class: "CDL-A",
  license_expiry: "", years_experience: 0, safety_score: 90,
  emergency_contact_name: "", emergency_contact_phone: "", status: "available", notes: "",
};

function DriversPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<null | (FormValues & { id?: string })>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (data ?? []).filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!s) return true;
      return d.full_name.toLowerCase().includes(s) || d.license_number.toLowerCase().includes(s);
    });
  }, [data, search, statusFilter]);

  const upsert = useMutation({
    mutationFn: async (v: FormValues & { id?: string }) => {
      const payload = {
        ...v,
        email: v.email || null, phone: v.phone || null, license_class: v.license_class || null,
        emergency_contact_name: v.emergency_contact_name || null,
        emergency_contact_phone: v.emergency_contact_phone || null,
        notes: v.notes || null,
      };
      if (v.id) {
        const { error } = await supabase.from("drivers").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("drivers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing?.id ? "Driver updated" : "Driver added");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("drivers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["drivers"] }); toast.success("Driver removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = new Date();

  return (
    <div>
      <PageHeader
        eyebrow="Roster"
        title="Drivers"
        description="Personnel, licenses and safety metrics."
        actions={<Btn onClick={() => setEditing({ ...EMPTY })}><Plus className="size-4" /> Add driver</Btn>}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or license…" className={inputCls + " pl-10"} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls + " w-48"}>
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="on_trip">On Trip</option>
          <option value="off_duty">Off Duty</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {isLoading ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-sm text-muted-foreground">Loading roster…</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No drivers yet" body="Add your first driver to enable trip assignments." action={<Btn onClick={() => setEditing({ ...EMPTY })}><Plus className="size-4" /> Add driver</Btn>} />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Driver</Th>
              <Th>License</Th>
              <Th>Expiry</Th>
              <Th className="text-right">Experience</Th>
              <Th className="text-right">Safety</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const expired = d.license_expiry && new Date(d.license_expiry) < today;
              return (
                <tr key={d.id} className="hover:bg-secondary/20 transition-colors">
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary/15 border border-primary/30 grid place-items-center text-xs font-bold text-primary">{initials(d.full_name)}</div>
                      <div>
                        <p className="font-medium">{d.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{d.email ?? d.phone ?? "—"}</p>
                      </div>
                    </div>
                  </Td>
                  <Td><span className="font-mono text-xs">{d.license_number}</span><span className="block text-[10px] text-muted-foreground">{d.license_class ?? "—"}</span></Td>
                  <Td className={expired ? "text-destructive text-xs" : "text-xs text-muted-foreground"}>
                    {expired && <AlertTriangle className="size-3 inline mr-1" />}
                    {dateFmt(d.license_expiry)}
                  </Td>
                  <Td className="text-right font-mono text-xs">{d.years_experience}y</Td>
                  <Td className="text-right">
                    <span className={"font-mono text-xs font-bold " + (Number(d.safety_score) < 70 ? "text-destructive" : Number(d.safety_score) < 85 ? "text-warning" : "text-success")}>
                      {Number(d.safety_score).toFixed(1)}
                    </span>
                  </Td>
                  <Td><StatusPill status={d.status} /></Td>
                  <Td className="text-right">
                    <div className="inline-flex gap-1">
                      <Btn variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing({
                        id: d.id, full_name: d.full_name, email: d.email ?? "", phone: d.phone ?? "",
                        license_number: d.license_number, license_class: d.license_class ?? "",
                        license_expiry: d.license_expiry, years_experience: d.years_experience,
                        safety_score: Number(d.safety_score),
                        emergency_contact_name: d.emergency_contact_name ?? "",
                        emergency_contact_phone: d.emergency_contact_phone ?? "",
                        status: d.status, notes: d.notes ?? "",
                      })}><Pencil className="size-3.5" /></Btn>
                      <Btn variant="ghost" className="h-8 w-8 p-0 hover:text-destructive" onClick={() => { if (confirm(`Remove ${d.full_name}?`)) del.mutate(d.id); }}><Trash2 className="size-3.5" /></Btn>
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
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="size-5 text-primary" /> {editing?.id ? "Edit driver" : "Add driver"}</DialogTitle></DialogHeader>
          {editing && <DriverForm value={editing} onSubmit={(v) => upsert.mutate({ ...v, id: editing.id })} loading={upsert.isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DriverForm({ value, onSubmit, loading }: { value: FormValues & { id?: string }; onSubmit: (v: FormValues) => void; loading: boolean }) {
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
      <div className="col-span-2"><Field label="Full name"><input required className={inputCls} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field></div>
      <Field label="Email"><input type="email" className={inputCls} value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
      <Field label="Phone"><input className={inputCls} value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
      <Field label="License number"><input required className={inputCls} value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value.toUpperCase() })} /></Field>
      <Field label="License class"><input className={inputCls} value={form.license_class ?? ""} onChange={(e) => setForm({ ...form, license_class: e.target.value })} /></Field>
      <Field label="License expiry"><input required type="date" className={inputCls} value={form.license_expiry} onChange={(e) => setForm({ ...form, license_expiry: e.target.value })} /></Field>
      <Field label="Status">
        <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormValues["status"] })}>
          <option value="available">Available</option><option value="on_trip">On Trip</option><option value="off_duty">Off Duty</option><option value="suspended">Suspended</option>
        </select>
      </Field>
      <Field label="Years experience"><input type="number" min={0} className={inputCls} value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: Number(e.target.value) })} /></Field>
      <Field label="Safety score (0-100)"><input type="number" min={0} max={100} step="0.1" className={inputCls} value={form.safety_score} onChange={(e) => setForm({ ...form, safety_score: Number(e.target.value) })} /></Field>
      <Field label="Emergency contact"><input className={inputCls} value={form.emergency_contact_name ?? ""} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} /></Field>
      <Field label="Emergency phone"><input className={inputCls} value={form.emergency_contact_phone ?? ""} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} /></Field>
      <div className="col-span-2"><Field label="Notes"><textarea className={inputCls + " min-h-20"} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
      <div className="col-span-2 flex justify-end gap-2">
        <Btn type="submit" disabled={loading}>{loading ? "Saving…" : value.id ? "Save changes" : "Add driver"}</Btn>
      </div>
    </form>
  );
}
