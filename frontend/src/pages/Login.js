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


  return (
    <div className="flex min-h-screen bg-[#0B0F19] text-[#E5E7EB]">
      {/* Left visual */}
      <div className="relative hidden w-1/2 lg:block">
        <img
          src="https://www.uts.edu.au/AdaptiveImages/bynder/3CD93EBA-D585-4326-A2D82E141F4460F8/Original_Image-UTS-Central.jpg?stamp=4957a25ac7ded610656a61b2f354104b76f42c0a"
          alt="UTS Central"
          className="h-full w-full object-cover opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/40 to-transparent" />
        <div className="absolute bottom-0 left-0 p-12">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center bg-[#374151]">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <span className="font-heading text-xl font-black tracking-tight">CaughtIn4K</span>
          </div>
          <h2 className="max-w-md font-heading text-3xl font-black leading-tight tracking-tight">
            AI-Driven Insider Threat Detection
          </h2>
          <p className="mt-3 max-w-md text-sm text-[#E5E7EB]/70">
            Lowkey Sus. Highkey Caught. Every Weird Move Leaves a Digital Trace.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm fade-up">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center bg-[#374151]">
                <ShieldCheck size={20} className="text-white" />
              </div>
              <span className="font-heading text-xl font-black tracking-tight">CaughtIn4K</span>
            </div>
          </div>

          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#374151]">
            {mode === "login" ? "Secure Access" : "Recover Access"}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-black tracking-tight">
            {mode === "login" ? "Analyst Login" : "Forgot Password"}
          </h1>
          <p className="mt-2 text-sm text-[#E5E7EB]/70">
            {mode === "login" ? "Sign in to the SOC monitoring console." : "Enter your email to generate a reset link."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-[#E5E7EB]/70">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E5E7EB]/55" />
                <input
                  data-testid="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-[#1F2937] bg-[#0B0F19] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#374151] focus:ring-1 focus:ring-[#374151]"
                />
              </div>
            </div>

            {mode === "login" && (
              <div>
                <label className="mb-1.5 block font-mono text-xs uppercase tracking-wider text-[#E5E7EB]/70">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E5E7EB]/55" />
                  <input
                    data-testid="login-password-input"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-[#1F2937] bg-[#0B0F19] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#374151] focus:ring-1 focus:ring-[#374151]"
                  />
                </div>
              </div>
            )}

            {err && <p data-testid="login-error" className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</p>}

            <button
              data-testid="login-submit-btn"
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 bg-[#374151] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#111827] disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <>{mode === "login" ? "Sign In" : "Send Reset Link"} <ArrowRight size={16} /></>}
            </button>
          </form>

          <button
            data-testid="toggle-forgot-btn"
            onClick={() => { setMode(mode === "login" ? "forgot" : "login"); setErr(""); }}
            className="mt-4 text-xs text-[#E5E7EB]/55 hover:text-[#374151]"
          >
            {mode === "login" ? "Forgot your password?" : "← Back to login"}
          </button>
        </div>
      </div>
    </div>
  );
}
