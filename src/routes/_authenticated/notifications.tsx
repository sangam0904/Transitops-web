import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, Btn } from "@/components/ui-primitives";
import { relativeTime } from "@/lib/format";
import { toast } from "sonner";
import { Bell, CheckCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications — TransitOps" }, { name: "description", content: "Fleet alerts and operational notifications." }] }),
});

function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader eyebrow="Signals" title="Notifications" description="Alerts and events from across your operations." />
      {isLoading ? (
        <div className="glass-panel rounded-2xl p-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState title="No notifications" body="Alerts about maintenance, licenses and completed trips will appear here." />
      ) : (
        <ul className="space-y-2">
          {data!.map((n) => (
            <li key={n.id} className={"glass-panel rounded-xl p-4 flex gap-4 items-start " + (n.read_at ? "opacity-70" : "")}>
              <div className={"size-9 rounded-lg grid place-items-center shrink-0 " + sevBg(n.severity)}>
                <Bell className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-1">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-2 font-mono uppercase tracking-widest">{relativeTime(n.created_at)}</p>
              </div>
              {!n.read_at && (
                <Btn variant="ghost" className="h-8" onClick={() => markRead.mutate(n.id)}>
                  <CheckCheck className="size-3.5" /> Mark read
                </Btn>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function sevBg(sev: string) {
  if (sev === "danger" || sev === "error") return "bg-destructive/15 text-destructive border border-destructive/30";
  if (sev === "warn" || sev === "warning") return "bg-warning/15 text-warning border border-warning/30";
  if (sev === "success") return "bg-success/15 text-success border border-success/30";
  return "bg-primary/15 text-primary border border-primary/30";
}
