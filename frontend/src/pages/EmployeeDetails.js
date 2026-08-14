import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, FileDown, Search as SearchIcon, AlertTriangle, Cpu, Usb, Download,
  Mail, FolderLock, Clock, ShieldCheck, Loader2, Activity,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import api, { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { Loading, RiskBadge, StatusPill, chartTooltipStyle } from "../components/common";

const axisProps = { stroke: "#52525b", tick: { fill: "#a1a1aa", fontSize: 11, fontFamily: "JetBrains Mono" } };

const EVENT_ICON = { login: Clock, download: Download, access: FolderLock, usb: Usb };

export default function EmployeeDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const { data } = await api.get(`/employees/${id}`); setD(data); }
    catch { toast.error("Employee not found"); nav("/employees"); }
  };
  useEffect(() => { load(); }, [id]);

  const openInvestigation = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/investigations", { employee_id: id });
      toast.success(`Investigation ${data.investigation_id} opened`);
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const downloadReport = async () => {
    try {
      await api.post(`/reports/generate/${id}`);
      const res = await api.get(`/reports/download/${id}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `incident_${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Incident report generated");
    } catch { toast.error("Report generation failed"); }
  };

  if (!d) return <Loading label="Loading employee profile" />;
  const e = d.employee;
  const f = e.features || {};
  const tt = chartTooltipStyle();
  const scoreColor = e.risk_score >= 81 ? "#ef4444" : e.risk_score >= 61 ? "#f59e0b" : e.risk_score >= 31 ? "#eab308" : "#22c55e";

  const featureRows = [
    { icon: Clock, label: "Off-hours Logins", value: f.offhours_logins },
    { icon: Activity, label: "Weekend Logins", value: f.weekend_logins },
    { icon: Download, label: "Peak Downloads", value: f.max_downloads },
    { icon: FolderLock, label: "Restricted Access", value: f.restricted_access_count },
    { icon: Usb, label: "USB Usage", value: f.usb_usage_count },
    { icon: Mail, label: "External Email Ratio", value: `${Math.round((f.external_email_ratio || 0) * 100)}%` },
    { icon: AlertTriangle, label: "Failed Logins", value: f.total_failed_logins },
    { icon: Cpu, label: "Distinct Devices", value: f.distinct_devices },
  ];

  return (
    <div className="space-y-6">
      <button onClick={() => nav("/employees")} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100">
        <ArrowLeft size={15} /> Back to registry
      </button>

      {/* Header card */}
      <div className="flex flex-col gap-5 border border-zinc-800 bg-zinc-900/40 p-5 md:flex-row md:items-center">
        <img src={e.avatar} alt="" className="h-20 w-20 rounded-sm object-cover" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-black">{e.name}</h1>
            <RiskBadge level={e.risk_level} testid="employee-risk-badge" />
            <StatusPill status={e.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-zinc-500">{e.employee_id} · {e.title} · {e.department}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{e.email}</p>
        </div>
        <div className="flex flex-col items-center border border-zinc-800 bg-zinc-950 px-6 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Risk Score</p>
          <p className="font-mono text-4xl font-black" style={{ color: scoreColor }} data-testid="employee-risk-score">{e.risk_score}</p>
          <p className="font-mono text-[10px] text-zinc-600">/ 100</p>
        </div>
        <div className="flex flex-col gap-2">
          <button data-testid="open-investigation-btn" onClick={openInvestigation} disabled={busy || d.investigation}
            className="flex items-center justify-center gap-2 bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <SearchIcon size={15} />}
            {d.investigation ? "Investigation Open" : "Open Investigation"}
          </button>
          <button data-testid="download-report-btn" onClick={downloadReport}
            className="flex items-center justify-center gap-2 border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:border-blue-500">
            <FileDown size={15} /> Incident Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Explainable AI */}
        <div className="border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <div className="border border-blue-500/30 bg-blue-500/10 p-1.5 text-blue-400"><Cpu size={16} /></div>
            <h3 className="font-heading text-sm font-bold">Explainable AI — Risk Analysis</h3>
          </div>
          <p className="mb-3 text-xs text-zinc-500">Human-readable reasons the model assigned this score:</p>
          <ul className="space-y-2" data-testid="ai-reasons">
            {(e.reasons || []).map((r, i) => (
              <li key={i} className="flex items-start gap-2 border-l-2 border-red-500/40 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" /> {r}
              </li>
            ))}
          </ul>

          <h4 className="mb-2 mt-5 font-heading text-sm font-bold text-zinc-200">Recommended Actions</h4>
          <ul className="space-y-1.5" data-testid="recommended-actions">
            {(e.recommended_actions || []).map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-green-400" /> {a}
              </li>
            ))}
          </ul>
        </div>

        {/* Feature panel */}
        <div className="border border-zinc-800 bg-zinc-900/40 p-5">
          <h3 className="mb-4 font-heading text-sm font-bold">Behavioural Features</h3>
          <div className="space-y-2">
            {featureRows.map((r) => (
              <div key={r.label} className="flex items-center justify-between border-b border-zinc-800/60 py-2">
                <span className="flex items-center gap-2 text-xs text-zinc-400"><r.icon size={13} className="text-zinc-500" /> {r.label}</span>
                <span className="font-mono text-sm font-semibold text-zinc-200">{r.value ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk history + suspicious events */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-2">
          <h3 className="mb-4 font-heading text-sm font-bold">Risk Score Timeline</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.risk_history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
              <XAxis dataKey="date" {...axisProps} />
              <YAxis {...axisProps} domain={[0, 100]} />
              <Tooltip {...tt} />
              <ReferenceLine y={81} stroke="#ef4444" strokeDasharray="4 4" />
              <ReferenceLine y={61} stroke="#f59e0b" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 p-5">
          <h3 className="mb-4 font-heading text-sm font-bold">Suspicious Events</h3>
          <div className="max-h-64 space-y-2 overflow-y-auto" data-testid="suspicious-events">
            {d.suspicious_events.length === 0 && <p className="text-sm text-zinc-500">No suspicious events detected.</p>}
            {d.suspicious_events.map((ev, i) => {
              const Icon = EVENT_ICON[ev.type] || AlertTriangle;
              return (
                <div key={i} className="flex items-start gap-2 border-l-2 border-zinc-700 bg-zinc-950 px-3 py-1.5">
                  <Icon size={13} className="mt-0.5 shrink-0 text-amber-400" />
                  <div>
                    <p className="text-xs text-zinc-300">{ev.event}</p>
                    <p className="font-mono text-[10px] text-zinc-600">{ev.time.replace("T", " ")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent activity + devices */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="overflow-x-auto border border-zinc-800 lg:col-span-2">
          <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3"><h3 className="font-heading text-sm font-bold">Recent Activity Logs</h3></div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="px-3 py-2">Login</th><th className="px-3 py-2">Device</th><th className="px-3 py-2">IP</th>
                <th className="px-3 py-2 text-right">DL</th><th className="px-3 py-2 text-right">USB</th><th className="px-3 py-2 text-right">Ext Mail</th>
              </tr>
            </thead>
            <tbody>
              {d.recent_activities.map((l, i) => (
                <tr key={i} className="border-b border-zinc-800/60">
                  <td className="px-3 py-2 font-mono text-xs text-zinc-400">{String(l.login_time).slice(0, 16).replace("T", " ")}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-400">{l.device}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">{l.ip_address}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-300">{l.downloads}</td>
                  <td className="px-3 py-2 text-right">{l.usb_connected ? <span className="text-red-400">●</span> : <span className="text-zinc-700">○</span>}</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-300">{l.external_emails}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 p-5">
          <h3 className="mb-4 font-heading text-sm font-bold">Device History</h3>
          <div className="space-y-2">
            {d.device_history.map((dev) => (
              <div key={dev.device} className="flex items-center justify-between border-b border-zinc-800/60 py-2 text-sm">
                <span className="flex items-center gap-2 font-mono text-zinc-300"><Cpu size={13} className="text-zinc-500" /> {dev.device}</span>
                <span className="font-mono text-xs text-zinc-500">{dev.count} sessions</span>
              </div>
            ))}
          </div>
          {d.alerts.length > 0 && (
            <>
              <h3 className="mb-3 mt-5 font-heading text-sm font-bold">Related Alerts</h3>
              <div className="space-y-1.5">
                {d.alerts.slice(0, 5).map((a) => (
                  <Link to="/alerts" key={a.alert_id} className="flex items-center justify-between border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs hover:border-blue-500">
                    <span className="text-zinc-300">{a.description}</span>
                    <RiskBadge level={a.severity} />
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
