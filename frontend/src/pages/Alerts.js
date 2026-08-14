import { useEffect, useState } from "react";
import { ShieldAlert, Search, X, Clock, User } from "lucide-react";
import api, { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { PageHeader, Loading, RiskBadge, StatusPill } from "../components/common";

const SEV = ["Critical", "High", "Medium", "Low"];
const STATUSES = ["Open", "Acknowledged", "Resolved"];

export default function Alerts() {
  const [alerts, setAlerts] = useState(null);
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");

  const load = async () => {
    const p = new URLSearchParams();
    if (severity) p.set("severity", severity);
    if (status) p.set("status", status);
    if (search) p.set("search", search);
    const { data } = await api.get(`/alerts?${p.toString()}`);
    setAlerts(data);
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [severity, status, search]);

  const update = async (alert_id, body) => {
    try {
      const { data } = await api.patch(`/alerts/${alert_id}`, body);
      setSelected(data);
      load();
      toast.success("Alert updated");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Alert Management" subtitle="AI-generated threat alerts requiring triage" />

      <div className="flex flex-col gap-3 border border-zinc-800 bg-zinc-900/40 p-3 md:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input data-testid="alert-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search alert ID or employee..."
            className="w-full border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
        </div>
        <select data-testid="filter-severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className="border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 focus:border-blue-500">
          <option value="">All Severities</option>{SEV.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select data-testid="filter-alert-status" value={status} onChange={(e) => setStatus(e.target.value)} className="border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 focus:border-blue-500">
          <option value="">All Statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {!alerts ? <Loading /> : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.alert_id} data-testid={`alert-${a.alert_id}`} onClick={() => { setSelected(a); setNote(""); }}
              className={`cursor-pointer border border-zinc-800 bg-zinc-900/40 p-4 hover:bg-zinc-900 ${a.severity === "Critical" ? "border-l-2 border-l-red-500 alert-pulse" : "border-l-2 border-l-zinc-700"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ShieldAlert size={18} className={a.severity === "Critical" ? "text-red-400" : a.severity === "High" ? "text-amber-400" : "text-yellow-400"} />
                  <div>
                    <p className="font-medium text-zinc-100">{a.description}</p>
                    <p className="font-mono text-xs text-zinc-500">{a.alert_id} · {a.employee_name} ({a.employee_id}) · {a.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <RiskBadge level={a.severity} />
                  <StatusPill status={a.status} />
                  <span className="font-mono text-xs text-zinc-600">{String(a.time).slice(0, 16).replace("T", " ")}</span>
                </div>
              </div>
            </div>
          ))}
          {alerts.length === 0 && <p className="py-12 text-center text-zinc-500">No alerts match your filters</p>}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setSelected(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold">{selected.alert_id}</h2>
              <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-zinc-100"><X size={18} /></button>
            </div>
            <div className="mb-4 flex items-center gap-2"><RiskBadge level={selected.severity} /><StatusPill status={selected.status} /></div>
            <p className="text-lg text-zinc-100">{selected.description}</p>
            <p className="mt-1 font-mono text-sm text-zinc-500">{selected.employee_name} · {selected.employee_id}</p>

            <h3 className="mb-2 mt-5 font-mono text-xs uppercase tracking-widest text-zinc-500">Reasons</h3>
            <ul className="space-y-1.5">{(selected.reason || []).map((r, i) => <li key={i} className="border-l-2 border-amber-500/40 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300">{r}</li>)}</ul>

            {selected.evidence?.length > 0 && (<>
              <h3 className="mb-2 mt-5 font-mono text-xs uppercase tracking-widest text-zinc-500">Evidence</h3>
              <ul className="space-y-1.5">{selected.evidence.map((e, i) => <li key={i} className="font-mono text-xs text-zinc-400">[{e.type?.toUpperCase()}] {e.detail}</li>)}</ul>
            </>)}

            <h3 className="mb-2 mt-5 font-mono text-xs uppercase tracking-widest text-zinc-500">Assign Analyst</h3>
            <input data-testid="assign-analyst-input" defaultValue={selected.assigned_analyst || ""} placeholder="Analyst name"
              onBlur={(e) => e.target.value !== (selected.assigned_analyst || "") && update(selected.alert_id, { assigned_analyst: e.target.value })}
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500" />

            <h3 className="mb-2 mt-5 font-mono text-xs uppercase tracking-widest text-zinc-500">Notes</h3>
            <div className="mb-2 space-y-1.5">
              {(selected.notes || []).map((n, i) => (
                <div key={i} className="border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm">
                  <p className="text-zinc-300">{n.text}</p>
                  <p className="font-mono text-[10px] text-zinc-600">{n.author} · {String(n.time).slice(0, 16).replace("T", " ")}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input data-testid="alert-note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note..."
                className="flex-1 border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <button data-testid="add-note-btn" onClick={() => { if (note.trim()) { update(selected.alert_id, { note }); setNote(""); } }}
                className="bg-blue-500 px-4 text-sm font-semibold text-white hover:bg-blue-600">Add</button>
            </div>

            <h3 className="mb-2 mt-5 font-mono text-xs uppercase tracking-widest text-zinc-500">Update Status</h3>
            <div className="flex gap-2">
              {STATUSES.map((s) => (
                <button key={s} data-testid={`set-status-${s.toLowerCase()}`} onClick={() => update(selected.alert_id, { status: s })}
                  className={`flex-1 border px-3 py-2 text-sm ${selected.status === s ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
