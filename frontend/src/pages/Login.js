import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Lock, Mail, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api, { formatApiError } from "../lib/api";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // login | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Access granted");
        navigate("/dashboard");
      } else {
        await api.post("/auth/forgot-password", { email });
        toast.success("Reset link generated (check server logs)");
        setMode("login");
      }
    } catch (e2) {
      setErr(formatApiError(e2.response?.data?.detail) || e2.message);
    } finally {
      setBusy(false);
    }
  };

  const fill = (r) => {
    setEmail(r === "admin" ? "admin@insiderguard.io" : "analyst@insiderguard.io");
    setPassword(r === "admin" ? "Admin@123" : "Analyst@123");
  };

  return (
    <div className="flex min-h-screen bg-[#09090b] text-zinc-100">
      {/* Left visual */}
      <div className="relative hidden w-1/2 lg:block">
        <img
          src="https://images.unsplash.com/photo-1589431024675-c56516cb4398?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwyfHxjeWJlcnNlY3VyaXR5JTIwc2VydmVyJTIwcm9vbSUyMGRhcmslMjBuZW9ufGVufDB8fHx8MTc4MTk2ODEyNnww&ixlib=rb-4.1.0&q=85"
          alt="SOC"
          className="h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent" />
        <div className="absolute bottom-0 left-0 p-12">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center bg-blue-500">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <span className="font-heading text-xl font-black tracking-tight">InsiderGuard</span>
          </div>
          <h2 className="max-w-md font-heading text-3xl font-black leading-tight tracking-tight">
            AI-Driven Insider Threat Detection
          </h2>
          <p className="mt-3 max-w-md text-sm text-zinc-400">
            Behavioural analytics and machine learning to surface risky employee activity before data is compromised. A Security Operations Center console.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm fade-up">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center bg-blue-500">
                <ShieldCheck size={20} className="text-white" />
              </div>
              <span className="font-heading text-xl font-black tracking-tight">InsiderGuard</span>
            </div>
          </div>

          <p className="font-mono text-xs uppercase tracking-[0.2em] text-blue-400">
            {mode === "login" ? "Secure Access" : "Recover Access"}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-black tracking-tight">
            {mode === "login" ? "Analyst Login" : "Forgot Password"}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {mode === "login" ? "Sign in to the SOC monitoring console." : "Enter your email to generate a reset link."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-zinc-400">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  data-testid="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@insiderguard.io"
                  className="w-full border border-zinc-800 bg-zinc-900 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {mode === "login" && (
              <div>
                <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-zinc-400">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    data-testid="login-password-input"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-zinc-800 bg-zinc-900 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {err && <p data-testid="login-error" className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</p>}

            <button
              data-testid="login-submit-btn"
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 bg-blue-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <>{mode === "login" ? "Sign In" : "Send Reset Link"} <ArrowRight size={16} /></>}
            </button>
          </form>

          <button
            data-testid="toggle-forgot-btn"
            onClick={() => { setMode(mode === "login" ? "forgot" : "login"); setErr(""); }}
            className="mt-4 text-xs text-zinc-500 hover:text-blue-400"
          >
            {mode === "login" ? "Forgot your password?" : "← Back to login"}
          </button>

          {mode === "login" && (
            <div className="mt-8 border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Demo credentials</p>
              <div className="flex gap-2">
                <button data-testid="fill-admin-btn" onClick={() => fill("admin")} className="flex-1 border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300 hover:border-blue-500">Administrator</button>
                <button data-testid="fill-analyst-btn" onClick={() => fill("analyst")} className="flex-1 border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300 hover:border-blue-500">Analyst</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
