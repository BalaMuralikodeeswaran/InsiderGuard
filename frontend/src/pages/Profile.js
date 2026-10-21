import { useState } from "react";
import { User, Mail, Shield, Lock, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { PageHeader } from "../components/common";

export default function Profile() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  const forgot = async () => {
    setBusy(true);
    try { await api.post("/auth/forgot-password", { email: user.email }); toast.success("Password reset link generated (check server logs)"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const doLogout = async () => { await logout(); nav("/login"); };

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" subtitle="Your account information" />
      <div className="max-w-xl border border-[#1F2937] bg-[#111827]/10 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center bg-[#111827]/40 font-mono text-xl font-bold text-[#374151]">{user?.name?.slice(0, 2).toUpperCase()}</div>
          <div>
            <h2 className="font-heading text-xl font-bold">{user?.name}</h2>
            <p className="font-mono text-sm text-[#E5E7EB]/55 capitalize">{user?.role}</p>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 border-b border-[#1F2937] py-3"><Mail size={16} className="text-[#E5E7EB]/55" /><span className="text-sm text-[#E5E7EB]/90">{user?.email}</span></div>
          <div className="flex items-center gap-3 border-b border-[#1F2937] py-3"><Shield size={16} className="text-[#E5E7EB]/55" /><span className="text-sm capitalize text-[#E5E7EB]/90">{user?.role} — {user?.role === "admin" ? "Full system access" : "Analyst access"}</span></div>
        </div>
        <div className="mt-6 flex gap-3">
          <button data-testid="reset-password-btn" onClick={forgot} disabled={busy} className="flex items-center gap-2 border border-[#1F2937] bg-[#0B0F19] px-4 py-2 text-sm text-[#E5E7EB] hover:border-[#374151] disabled:opacity-50">
            <Lock size={15} /> Reset Password
          </button>
          <button data-testid="profile-logout-btn" onClick={doLogout} className="flex items-center gap-2 border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20">
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
