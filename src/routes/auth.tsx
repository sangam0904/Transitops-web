import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { z } from "zod";
import { Radio, Loader2 } from "lucide-react";

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, "Enter your name").max(100),
  role: z.enum(["fleet_manager", "driver", "safety_officer", "financial_analyst"]),
});

const ROLES = [
  { value: "fleet_manager", label: "Fleet Manager" },
  { value: "driver", label: "Driver" },
  { value: "safety_officer", label: "Safety Officer" },
  { value: "financial_analyst", label: "Financial Analyst" },
] as const;

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — TransitOps" },
      { name: "description", content: "Sign in or create a TransitOps operations account." },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "fleet_manager" as (typeof ROLES)[number]["value"],
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const parsed = signInSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) { toast.error(error.message); return; }
        toast.success("Welcome back");
        navigate({ to: "/dashboard", replace: true });
      } else {
        const parsed = signUpSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: parsed.data.fullName, role: parsed.data.role },
          },
        });
        if (error) { toast.error(error.message); return; }
        toast.success("Account created — signing you in");
        navigate({ to: "/dashboard", replace: true });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (res.error) { toast.error(res.error.message ?? "Google sign-in failed"); return; }
      if (!res.redirected) navigate({ to: "/dashboard", replace: true });
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex relative overflow-hidden border-r border-border">
        <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "var(--gradient-glow)" }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,oklch(0.35_0.09_200/.35),transparent_60%)]" />
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="h-px w-full scan-sweep bg-gradient-to-r from-transparent via-primary/60 to-transparent shadow-[0_0_20px_oklch(0.78_0.14_200/0.6)]" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center">
              <Radio className="size-5 text-primary" />
            </div>
            <p className="font-extrabold text-lg tracking-tight">TRANSIT<span className="text-primary">OPS</span></p>
          </div>
          <div className="space-y-4 max-w-md">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-primary">Control Tower Access</p>
            <h1 className="text-4xl font-black tracking-tight leading-tight text-glow">
              The command deck for modern logistics fleets.
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm">
              Dispatch, maintain, and account for every asset from a single control tower — with real-time telemetry and predictive insights.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-md">
            {[
              { k: "Uptime", v: "99.98%" },
              { k: "Live units", v: "142" },
              { k: "MTD trips", v: "1,284" },
            ].map((s) => (
              <div key={s.k} className="glass-panel rounded-lg p-3">
                <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">{s.k}</p>
                <p className="text-lg font-bold text-glow">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="size-10 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center">
              <Radio className="size-5 text-primary" />
            </div>
            <p className="font-extrabold text-lg tracking-tight">TRANSIT<span className="text-primary">OPS</span></p>
          </div>

          <div className="glass-panel-strong rounded-2xl p-8">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/60 border border-border mb-6">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={
                    "flex-1 py-2 text-xs font-semibold uppercase tracking-widest rounded-md transition " +
                    (mode === m
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {m === "signin" ? "Sign in" : "Register"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <Field label="Full name">
                    <input
                      type="text"
                      autoComplete="name"
                      required
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      className="input"
                    />
                  </Field>
                  <Field label="Operational role">
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}
                      className="input"
                    >
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </Field>
                </>
              )}
              <Field label="Email">
                <input
                  type="email" autoComplete="email" required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input"
                />
              </Field>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold tracking-wide hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {mode === "signin" ? "Access control tower" : "Create operations account"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full h-11 rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-sm font-semibold flex items-center justify-center gap-3 disabled:opacity-60"
            >
              <GoogleIcon /> Continue with Google
            </button>

            <p className="mt-6 text-center text-[11px] text-muted-foreground">
              By continuing you agree to TransitOps operational protocols.{" "}
              <Link to="/" className="text-primary hover:underline">Learn more</Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`.input{width:100%;height:2.75rem;padding:0 .875rem;border-radius:.5rem;background:oklch(0.19 0.02 250 / .7);border:1px solid var(--color-border);font-size:.875rem;color:var(--color-foreground);outline:none;transition:border-color .15s, box-shadow .15s}.input:focus{border-color:oklch(0.78 0.14 200 / .5);box-shadow:0 0 0 3px oklch(0.78 0.14 200 / .18)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-4">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.2 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.2 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.7 34.4 27 35.5 24 35.5c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.5 5.5C41.8 35.6 44 30.2 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}
