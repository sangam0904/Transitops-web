export const currency = (n: number | null | undefined, code = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(Number(n ?? 0));

export const currencyPrecise = (n: number | null | undefined, code = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(Number(n ?? 0));

export const numberFmt = (n: number | null | undefined, digits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(Number(n ?? 0));

export const dateFmt = (v: string | Date | null | undefined) => {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return "—"; }
};

export const dateTimeFmt = (v: string | Date | null | undefined) => {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};

export const relativeTime = (v: string | Date | null | undefined) => {
  if (!v) return "—";
  const diff = (Date.now() - new Date(v).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const initials = (name?: string | null) => {
  if (!name) return "??";
  return name.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("") || "??";
};

export const roleLabel: Record<string, string> = {
  fleet_manager: "Fleet Manager",
  driver: "Driver",
  safety_officer: "Safety Officer",
  financial_analyst: "Financial Analyst",
};
