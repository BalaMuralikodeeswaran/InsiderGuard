import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X, CheckCircle2, XCircle, FileText, History } from "lucide-react";
import api, { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { PageHeader, Loading, StatusPill, RiskBadge } from "../components/common";

const STATUSES = ["Open", "In Progress", "Closed"];

export default function Investigations() {
  const [invs, setInvs] = useState(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState("");

  const load = async () => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (search) p.set("search", search);
    const { data } = await api.get(`/investigations?${p.toString()}`);
    setInvs(data);
    if (selected) { const cur = data.find((i) => i.investigation_id === selected.investigation_id); if (cur) setSelected(cur); }
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [status, search]);

  const update = async (id, body) => {
    try { await api.patch(`/investigations/${id}`, body); await load(); toast.success("Investigation updated"); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Investigation Module" subtitle="Manage active insider-threat investigations" />

      <div className="flex flex-col gap-3 border border-zinc-800 bg-zinc-900/40 p-3 md:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input data-testid="investigation-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID or employee..."
            className="w-full border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
        </div>
        <select data-testid="filter-inv-status" value={status} onChange={(e) => setStatus(e.target.value)} className="border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 focus:border-blue-500">
          <option value="">All Statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {!invs ? <Loading /> : invs.length === 0 ? (
        <div className="border border-dashed border-zinc-800 py-16 text-center text-zinc-500">
          No investigations yet. Open one from an employee's profile.
        </div>
      ) : (
        <div className="overflow-x-auto border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">ID</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Analyst</th>
                <th className="px-4 py-3">Priority</th><th className="px-4 py-3 text-right">Risk</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Opened</th>
              </tr>
            </thead>
            <tbody>
              {invs.map((i) => (
                <tr key={i.investigation_id} data-testid={`inv-row-${i.investigation_id}`} onClick={() => { setSelected(i); setNote(""); setEvidence(""); }}
                  className="cursor-pointer border-b border-zinc-800/60 hover:bg-zinc-900">
                  <td className="px-4 py-3 font-mono text-xs text-blue-400">{i.investigation_id}</td>
                  <td className="px-4 py-3"><p className="text-zinc-200">{i.employee_name}</p><p className="font-mono text-xs text-zinc-500">{i.employee_id}</p></td>
                  <td className="px-4 py-3 text-zinc-400">{i.analyst}</td>
                  <td className="px-4 py-3 text-zinc-400">{i.priority}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-zinc-200">{i.risk_score}</td>
                  <td className="px-4 py-3"><StatusPill status={i.status} />{i.false_positive && <span className="ml-1 text-xs text-zinc-500">(FP)</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{String(i.created_at).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setSelected(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-blue-400">{selected.investigation_id}</h2>
              <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-zinc-100"><X size={18} /></button>
            </div>
            <div className="flex items-center gap-2"><StatusPill status={selected.status} /><span className="text-sm text-zinc-400">Analyst: {selected.analyst}</span></div>
            <Link to={`/employees/${selected.employee_id}`} className="mt-3 flex items-center justify-between border border-zinc-800 bg-zinc-900 p-3 hover:border-blue-500">
              <span className="text-zinc-200">{selected.employee_name} <span className="font-mono text-xs text-zinc-500">{selected.employee_id}</span></span>
              <span className="font-mono font-bold">{selected.risk_score}</span>
            </Link>

            <h3 className="mb-2 mt-5 font-mono text-xs uppercase tracking-widest text-zinc-500">Update Status</h3>
            <div className="flex gap-2">
              {STATUSES.map((s) => (
                <button key={s} data-testid={`inv-status-${s.replace(" ", "-").toLowerCase()}`} onClick={() => update(selected.investigation_id, { status: s })}
                  className={`flex-1 border px-2 py-2 text-xs ${selected.status === s ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"}`}>{s}</button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <button data-testid="mark-fp-btn" onClick={() => update(selected.investigation_id, { false_positive: !selected.false_positive })}
                className={`flex flex-1 items-center justify-center gap-1.5 border px-3 py-2 text-xs ${selected.false_positive ? "border-zinc-600 bg-zinc-800 text-zinc-300" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-amber-500"}`}>
                {selected.false_positive ? <XCircle size={13} /> : <CheckCircle2 size={13} />} {selected.false_positive ? "Marked False Positive" : "Mark False Positive"}
              </button>
              <a data-testid="inv-report-btn" href={`${process.env.REACT_APP_BACKEND_URL}/api/reports/download/${selected.employee_id}`} target="_blank" rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 hover:border-blue-500"><FileText size={13} /> Report</a>
            </div>

            <h3 className="mb-2 mt-5 font-mono text-xs uppercase tracking-widest text-zinc-500">Notes</h3>
            <div className="mb-2 space-y-1.5">
              {(selected.notes || []).map((n, i) => (
                <div key={i} className="border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"><p className="text-zinc-300">{n.text}</p><p className="font-mono text-[10px] text-zinc-600">{n.author} · {String(n.time).slice(0, 16).replace("T", " ")}</p></div>
              ))}
            </div>
            <div className="flex gap-2">
              <input data-testid="inv-note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add note..." className="flex-1 border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <button data-testid="inv-add-note-btn" onClick={() => { if (note.trim()) { update(selected.investigation_id, { note }); setNote(""); } }} className="bg-blue-500 px-4 text-sm font-semibold text-white hover:bg-blue-600">Add</button>
            </div>

            <h3 className="mb-2 mt-5 font-mono text-xs uppercase tracking-widest text-zinc-500">Evidence</h3>
            <div className="mb-2 space-y-1.5">
              {(selected.evidence || []).map((e, i) => <div key={i} className="border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300">{e.detail}</div>)}
            </div>
            <div className="flex gap-2">
              <input data-testid="inv-evidence-input" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Log evidence detail..." className="flex-1 border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <button data-testid="inv-add-evidence-btn" onClick={() => { if (evidence.trim()) { update(selected.investigation_id, { evidence }); setEvidence(""); } }} className="bg-blue-500 px-4 text-sm font-semibold text-white hover:bg-blue-600">Add</button>
            </div>

            <h3 className="mb-2 mt-5 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500"><History size={12} /> History</h3>
            <div className="space-y-1.5">
              {(selected.history || []).map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-zinc-400"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />{h.action} <span className="text-zinc-600">— {h.by}, {String(h.time).slice(0, 16).replace("T", " ")}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
