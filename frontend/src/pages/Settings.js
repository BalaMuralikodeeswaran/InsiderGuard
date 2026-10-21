import { useEffect, useState } from "react";
import { Save, SlidersHorizontal, Clock, Building2, Shield } from "lucide-react";
import api from "../lib/api";
import { toast } from "sonner";
import { PageHeader, Loading } from "../components/common";

export default function SettingsPage() {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { (async () => { const { data } = await api.get("/settings"); setS(data); })(); }, []);

  const save = async () => {
    setBusy(true);
    try { await api.put("/settings", s); toast.success("Settings saved"); }
    catch { toast.error("Failed to save"); }
    finally { setBusy(false); }
  };

  if (!s) return <Loading />;
  const th = s.risk_thresholds || {};
  const wh = s.working_hours || {};

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Configure detection thresholds and system policies">
        <button data-testid="save-settings-btn" onClick={save} disabled={busy} className="flex items-center gap-2 bg-[#374151] px-4 py-2 text-sm font-semibold text-white hover:bg-[#111827] disabled:opacity-50">
          <Save size={15} /> Save Changes
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border border-[#1F2937] bg-[#111827]/10 p-6">
          <div className="mb-4 flex items-center gap-2"><SlidersHorizontal size={16} className="text-[#374151]" /><h3 className="font-heading text-sm font-bold">Risk Thresholds</h3></div>
          {["medium", "high", "critical"].map((k) => (
            <div key={k} className="mb-4">
              <div className="mb-1 flex items-center justify-between">
                <label className="font-mono text-xs uppercase tracking-wider text-[#E5E7EB]/70">{k} threshold</label>
                <span className="font-mono text-sm text-[#E5E7EB]">{th[k]}</span>
              </div>
              <input data-testid={`threshold-${k}`} type="range" min="0" max="100" value={th[k]} onChange={(e) => setS({ ...s, risk_thresholds: { ...th, [k]: Number(e.target.value) } })} className="w-full accent-blue-500" />
            </div>
          ))}
        </div>

        <div className="border border-[#1F2937] bg-[#111827]/10 p-6">
          <div className="mb-4 flex items-center gap-2"><Clock size={16} className="text-[#374151]" /><h3 className="font-heading text-sm font-bold">Working Hours</h3></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block font-mono text-xs uppercase tracking-wider text-[#E5E7EB]/70">Start Hour</label>
              <input data-testid="wh-start" type="number" min="0" max="23" value={wh.start} onChange={(e) => setS({ ...s, working_hours: { ...wh, start: Number(e.target.value) } })} className="w-full border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm font-mono focus:border-[#374151]" /></div>
            <div><label className="mb-1 block font-mono text-xs uppercase tracking-wider text-[#E5E7EB]/70">End Hour</label>
              <input data-testid="wh-end" type="number" min="0" max="23" value={wh.end} onChange={(e) => setS({ ...s, working_hours: { ...wh, end: Number(e.target.value) } })} className="w-full border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm font-mono focus:border-[#374151]" /></div>
          </div>
          <div className="mt-6 flex items-center gap-2"><Shield size={16} className="text-[#374151]" /><h3 className="font-heading text-sm font-bold">Session</h3></div>
          <div className="mt-3"><label className="mb-1 block font-mono text-xs uppercase tracking-wider text-[#E5E7EB]/70">Session Timeout (minutes)</label>
            <input data-testid="session-timeout" type="number" value={s.session_timeout_minutes} onChange={(e) => setS({ ...s, session_timeout_minutes: Number(e.target.value) })} className="w-full border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm font-mono focus:border-[#374151]" /></div>
          <label className="mt-4 flex items-center gap-2 text-sm text-[#E5E7EB]/90">
            <input data-testid="email-notif-toggle" type="checkbox" checked={s.email_notifications} onChange={(e) => setS({ ...s, email_notifications: e.target.checked })} className="accent-blue-500" />
            Enable email notifications
          </label>
        </div>

        <div className="border border-[#1F2937] bg-[#111827]/10 p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2"><Building2 size={16} className="text-[#374151]" /><h3 className="font-heading text-sm font-bold">Departments</h3></div>
          <div className="flex flex-wrap gap-2">
            {(s.departments || []).map((d) => <span key={d} className="border border-[#1F2937] bg-[#0B0F19] px-3 py-1.5 font-mono text-xs text-[#E5E7EB]/90">{d}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
