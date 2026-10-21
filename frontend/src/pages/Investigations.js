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

      <div className="flex flex-col gap-3 border border-[#1F2937] bg-[#111827]/10 p-3 md:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#E5E7EB]/55" />
          <input data-testid="investigation-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID or employee..."
            className="w-full border border-[#1F2937] bg-[#0B0F19] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#374151]" />
        </div>
        <select data-testid="filter-inv-status" value={status} onChange={(e) => setStatus(e.target.value)} className="border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm text-[#E5E7EB]/90 focus:border-[#374151]">
          <option value="">All Statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {!invs ? <Loading /> : invs.length === 0 ? (
        <div className="border border-dashed border-[#1F2937] py-16 text-center text-[#E5E7EB]/55">
          No investigations yet. Open one from an employee's profile.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#1F2937]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1F2937] bg-[#0B0F19] text-left font-mono text-[10px] uppercase tracking-wider text-[#E5E7EB]/55">
                <th className="px-4 py-3">ID</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Analyst</th>
                <th className="px-4 py-3">Priority</th><th className="px-4 py-3 text-right">Risk</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Opened</th>
              </tr>
            </thead>
            <tbody>
              {invs.map((i) => (
                <tr key={i.investigation_id} data-testid={`inv-row-${i.investigation_id}`} onClick={() => { setSelected(i); setNote(""); setEvidence(""); }}
                  className="cursor-pointer border-b border-[#1F2937]/60 hover:bg-[#0B0F19]">
                  <td className="px-4 py-3 font-mono text-xs text-[#374151]">{i.investigation_id}</td>
                  <td className="px-4 py-3"><p className="text-[#E5E7EB]">{i.employee_name}</p><p className="font-mono text-xs text-[#E5E7EB]/55">{i.employee_id}</p></td>
                  <td className="px-4 py-3 text-[#E5E7EB]/70">{i.analyst}</td>
                  <td className="px-4 py-3 text-[#E5E7EB]/70">{i.priority}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-[#E5E7EB]">{i.risk_score}</td>
                  <td className="px-4 py-3"><StatusPill status={i.status} />{i.false_positive && <span className="ml-1 text-xs text-[#E5E7EB]/55">(FP)</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#E5E7EB]/55">{String(i.created_at).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setSelected(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto border-l border-[#1F2937] bg-[#0B0F19] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-[#374151]">{selected.investigation_id}</h2>
              <button onClick={() => setSelected(null)} className="text-[#E5E7EB]/55 hover:text-[#E5E7EB]"><X size={18} /></button>
            </div>
            <div className="flex items-center gap-2"><StatusPill status={selected.status} /><span className="text-sm text-[#E5E7EB]/70">Analyst: {selected.analyst}</span></div>
            <Link to={`/employees/${selected.employee_id}`} className="mt-3 flex items-center justify-between border border-[#1F2937] bg-[#0B0F19] p-3 hover:border-[#374151]">
              <span className="text-[#E5E7EB]">{selected.employee_name} <span className="font-mono text-xs text-[#E5E7EB]/55">{selected.employee_id}</span></span>
              <span className="font-mono font-bold">{selected.risk_score}</span>
            </Link>

            <h3 className="mb-2 mt-5 font-mono text-xs uppercase tracking-widest text-[#E5E7EB]/55">Update Status</h3>
            <div className="flex gap-2">
              {STATUSES.map((s) => (
                <button key={s} data-testid={`inv-status-${s.replace(" ", "-").toLowerCase()}`} onClick={() => update(selected.investigation_id, { status: s })}
                  className={`flex-1 border px-2 py-2 text-xs ${selected.status === s ? "border-[#374151] bg-[#111827]/30 text-[#374151]" : "border-[#1F2937] bg-[#0B0F19] text-[#E5E7EB]/90 hover:border-zinc-600"}`}>{s}</button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <button data-testid="mark-fp-btn" onClick={() => update(selected.investigation_id, { false_positive: !selected.false_positive })}
                className={`flex flex-1 items-center justify-center gap-1.5 border px-3 py-2 text-xs ${selected.false_positive ? "border-zinc-600 bg-[#1F2937] text-[#E5E7EB]/90" : "border-[#1F2937] bg-[#0B0F19] text-[#E5E7EB]/70 hover:border-amber-500"}`}>
                {selected.false_positive ? <XCircle size={13} /> : <CheckCircle2 size={13} />} {selected.false_positive ? "Marked False Positive" : "Mark False Positive"}
              </button>
              <a data-testid="inv-report-btn" href={`${process.env.REACT_APP_BACKEND_URL}/api/reports/download/${selected.employee_id}`} target="_blank" rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-xs text-[#E5E7EB]/70 hover:border-[#374151]"><FileText size={13} /> Report</a>
            </div>

            <h3 className="mb-2 mt-5 font-mono text-xs uppercase tracking-widest text-[#E5E7EB]/55">Notes</h3>
            <div className="mb-2 space-y-1.5">
              {(selected.notes || []).map((n, i) => (
                <div key={i} className="border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm"><p className="text-[#E5E7EB]/90">{n.text}</p><p className="font-mono text-[10px] text-[#E5E7EB]/40">{n.author} · {String(n.time).slice(0, 16).replace("T", " ")}</p></div>
              ))}
            </div>
            <div className="flex gap-2">
              <input data-testid="inv-note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add note..." className="flex-1 border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm outline-none focus:border-[#374151]" />
              <button data-testid="inv-add-note-btn" onClick={() => { if (note.trim()) { update(selected.investigation_id, { note }); setNote(""); } }} className="bg-[#374151] px-4 text-sm font-semibold text-white hover:bg-[#111827]">Add</button>
            </div>

            <h3 className="mb-2 mt-5 font-mono text-xs uppercase tracking-widest text-[#E5E7EB]/55">Evidence</h3>
            <div className="mb-2 space-y-1.5">
              {(selected.evidence || []).map((e, i) => <div key={i} className="border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-xs text-[#E5E7EB]/90">{e.detail}</div>)}
            </div>
            <div className="flex gap-2">
              <input data-testid="inv-evidence-input" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Log evidence detail..." className="flex-1 border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm outline-none focus:border-[#374151]" />
              <button data-testid="inv-add-evidence-btn" onClick={() => { if (evidence.trim()) { update(selected.investigation_id, { evidence }); setEvidence(""); } }} className="bg-[#374151] px-4 text-sm font-semibold text-white hover:bg-[#111827]">Add</button>
            </div>

            <h3 className="mb-2 mt-5 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-[#E5E7EB]/55"><History size={12} /> History</h3>
            <div className="space-y-1.5">
              {(selected.history || []).map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[#E5E7EB]/70"><span className="h-1.5 w-1.5 rounded-full bg-[#374151]" />{h.action} <span className="text-[#E5E7EB]/40">— {h.by}, {String(h.time).slice(0, 16).replace("T", " ")}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
