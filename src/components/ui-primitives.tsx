import type { ReactNode } from "react";

export function PageHeader({
  eyebrow, title, description, actions,
}: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        {eyebrow && <p className="font-mono text-[10px] tracking-[0.3em] text-primary uppercase">{eyebrow}</p>}
        <h1 className="text-3xl font-black tracking-tight mt-1">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
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
    critical: "text-destructive bg-destructive/10 border-destructive/30",
    high: "text-warning bg-warning/10 border-warning/30",
    medium: "text-info bg-info/10 border-info/30",
    low: "text-muted-foreground bg-secondary border-border",
  };
  return (
    <span className={
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest border " +
      (map[status] ?? "text-muted-foreground bg-secondary border-border")
    }>
      <span className="size-1 rounded-full bg-current status-pulse" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function EmptyState({
  title, body, action,
}: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-12 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">{body}</p>
      {action && <div className="mt-4 inline-flex">{action}</div>}
    </div>
  );
}

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="glass-panel-strong rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">{children}</table>
      </div>
    </div>
  );
}

export function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={"px-6 py-3 font-medium text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border " + className}>{children}</th>;
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={"px-6 py-3 border-b border-border/50 " + className}>{children}</td>;
}

export function Btn({
  variant = "primary", type = "button", ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const map = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "border border-border bg-secondary/40 hover:bg-secondary",
    danger: "bg-destructive text-destructive-foreground hover:opacity-90",
    ghost: "hover:bg-secondary text-muted-foreground hover:text-foreground",
  } as const;
  return (
    <button
      type={type}
      {...rest}
      className={
        "h-10 px-4 rounded-lg text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition " +
        map[variant] + " " + (rest.className ?? "")
      }
    />
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">{label}</span>
      {children}
      {error && <span className="block text-[11px] text-destructive mt-1">{error}</span>}
    </label>
  );
}

export const inputCls = "w-full h-10 px-3 rounded-lg bg-secondary/60 border border-border text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20";
export const textareaCls = "w-full min-h-24 p-3 rounded-lg bg-secondary/60 border border-border text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20";
