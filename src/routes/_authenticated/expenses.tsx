import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, TableShell, Th, Td, Btn, Field, EmptyState, inputCls } from "@/components/ui-primitives";
import { currency, dateFmt } from "@/lib/format";
import { toast } from "sonner";
import { z } from "zod";
import { Plus, Search, Receipt, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/expenses")({
  component: ExpensesPage,
  head: () => ({ meta: [{ title: "Expenses — TransitOps" }, { name: "description", content: "Operational expense ledger with category rollups." }] }),
});

const CATS = ["fuel", "maintenance", "toll", "insurance", "parking", "repair", "salary", "other"] as const;

const schema = z.object({
  category: z.enum(CATS),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().length(3).default("USD"),
  vehicle_id: z.string().uuid().optional().or(z.literal("")),
  trip_id: z.string().uuid().optional().or(z.literal("")),
  description: z.string().max(300).optional().or(z.literal("")),
  incurred_on: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

const EMPTY = (): FormValues => ({
  category: "other", amount: 0, currency: "USD", vehicle_id: "", trip_id: "", description: "",
  incurred_on: new Date().toISOString().slice(0, 10),
});

function ExpensesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => (await supabase.from("expenses").select("*").order("incurred_on", { ascending: false })).data ?? [],
  });
  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-lite-exp"],
    queryFn: async () => (await supabase.from("vehicles").select("id,registration_number")).data ?? [],
  });
  const vMap = useMemo(() => new Map((vehicles ?? []).map((v) => [v.id, v])), [vehicles]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (data ?? []).filter((x) => {
      if (catFilter !== "all" && x.category !== catFilter) return false;
      if (!s) return true;
      return (x.description?.toLowerCase().includes(s) ?? false);
    });
  }, [data, search, catFilter]);

  const monthTotal = useMemo(() => {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    return (data ?? []).filter((x) => new Date(x.incurred_on) >= start).reduce((s, x) => s + Number(x.amount), 0);
  }, [data]);

  const catTotals = useMemo(() => {
    const acc: Record<string, number> = {};
    (data ?? []).forEach((x) => { acc[x.category] = (acc[x.category] ?? 0) + Number(x.amount); });
    return acc;
  }, [data]);

  const insert = useMutation({
    mutationFn: async (v: FormValues) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("expenses").insert({
        ...v,
        vehicle_id: v.vehicle_id || null,
        trip_id: v.trip_id || null,
        description: v.description || null,
        created_by: userRes.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Expense recorded"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success("Removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Ledger"
        title="Expenses"
        description="All operational costs, categorized and rolled up for finance reporting."
        actions={<Btn onClick={() => setOpen(true)}><Plus className="size-4" /> Record expense</Btn>}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="glass-panel rounded-xl p-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">This Month</p>
          <p className="text-2xl font-black tracking-tight mt-1">{currency(monthTotal)}</p>
        </div>
        {(["fuel", "maintenance", "insurance", "other"] as const).map((c) => (
          <div key={c} className="glass-panel rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{c}</p>
            <p className="text-xl font-bold mt-1">{currency(catTotals[c] ?? 0)}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description…" className={inputCls + " pl-10"} />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={inputCls + " w-48"}>
          <option value="all">All categories</option>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No expenses yet" body="Record your first operational cost." action={<Btn onClick={() => setOpen(true)}><Plus className="size-4" /> Record expense</Btn>} />
      ) : (
        <TableShell>
          <thead><tr><Th>Date</Th><Th>Category</Th><Th>Vehicle</Th><Th>Description</Th><Th className="text-right">Amount</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody>
            {filtered.map((x) => (
              <tr key={x.id} className="hover:bg-secondary/20">
                <Td className="text-xs text-muted-foreground">{dateFmt(x.incurred_on)}</Td>
                <Td><span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-border bg-secondary">{x.category}</span></Td>
                <Td>{x.vehicle_id ? <span className="font-mono text-xs">{vMap.get(x.vehicle_id)?.registration_number ?? "—"}</span> : <span className="text-xs text-muted-foreground">—</span>}</Td>
                <Td className="text-sm text-muted-foreground max-w-md truncate">{x.description ?? "—"}</Td>
                <Td className="text-right font-mono text-xs font-bold">{currency(Number(x.amount), x.currency ?? "USD")}</Td>
                <Td className="text-right"><Btn variant="ghost" className="h-8 w-8 p-0 hover:text-destructive" onClick={() => { if (confirm("Delete expense?")) del.mutate(x.id); }}><Trash2 className="size-3.5" /></Btn></Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="size-5 text-primary" /> Record expense</DialogTitle></DialogHeader>
          <ExpenseForm vehicles={vehicles ?? []} onSubmit={insert.mutate} loading={insert.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpenseForm({
  vehicles, onSubmit, loading,
}: {
  vehicles: { id: string; registration_number: string }[];
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
      <Field label="Category">
        <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as FormValues["category"] })}>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Date"><input required type="date" className={inputCls} value={form.incurred_on} onChange={(e) => setForm({ ...form, incurred_on: e.target.value })} /></Field>
      <Field label="Amount"><input required type="number" min={0} step="0.01" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
      <Field label="Currency"><input maxLength={3} className={inputCls} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></Field>
      <div className="col-span-2">
        <Field label="Vehicle (optional)">
          <select className={inputCls} value={form.vehicle_id ?? ""} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}>
            <option value="">— None —</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number}</option>)}
          </select>
        </Field>
      </div>
      <div className="col-span-2"><Field label="Description"><textarea className={inputCls + " min-h-20"} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
      <div className="col-span-2 flex justify-end"><Btn type="submit" disabled={loading}>{loading ? "Saving…" : "Record"}</Btn></div>
    </form>
  );
}
