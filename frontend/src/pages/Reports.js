import { useEffect, useState } from "react";
import { FileText, Download, Plus, Search } from "lucide-react";
import api from "../lib/api";
import { toast } from "sonner";
import { PageHeader, Loading, RiskBadge } from "../components/common";

export default function Reports() {
  const [reports, setReports] = useState(null);
  const [emps, setEmps] = useState([]);
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [r, e] = await Promise.all([api.get("/reports"), api.get("/employees")]);
    setReports(r.data);
    setEmps(e.data);
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    if (!sel) return toast.error("Select an employee");
    setBusy(true);
    try {
      await api.post(`/reports/generate/${sel}`);
      const res = await api.get(`/reports/download/${sel}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `incident_${sel}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Report generated & downloaded");
      load();
    } catch { toast.error("Failed to generate report"); }
    finally { setBusy(false); }
  };

  const download = async (eid) => {
    const res = await api.get(`/reports/download/${eid}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a"); a.href = url; a.download = `incident_${eid}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Incident Reports" subtitle="Generate and download PDF incident reports" />

      <div className="border border-[#1F2937] bg-[#111827]/10 p-5">
        <h3 className="mb-3 font-heading text-sm font-bold">Generate New Report</h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select data-testid="report-employee-select" value={sel} onChange={(e) => setSel(e.target.value)}
            className="flex-1 border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm text-[#E5E7EB]/90 focus:border-[#374151]">
            <option value="">Select an employee...</option>
            {emps.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.name} ({e.employee_id}) — Risk {e.risk_score}</option>)}
          </select>
          <button data-testid="generate-report-btn" onClick={generate} disabled={busy}
            className="flex items-center justify-center gap-2 bg-[#374151] px-5 py-2 text-sm font-semibold text-white hover:bg-[#111827] disabled:opacity-50">
            <Plus size={15} /> Generate PDF
          </button>
        </div>
      </div>

      {!reports ? <Loading /> : (
        <div className="overflow-x-auto border border-[#1F2937]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1F2937] bg-[#0B0F19] text-left font-mono text-[10px] uppercase tracking-wider text-[#E5E7EB]/55">
                <th className="px-4 py-3">Report ID</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Risk</th><th className="px-4 py-3">Analyst</th><th className="px-4 py-3">Generated</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.report_id} className="border-b border-[#1F2937]/60 hover:bg-[#0B0F19]">
                  <td className="px-4 py-3 font-mono text-xs text-[#374151]">{r.report_id}</td>
                  <td className="px-4 py-3 text-[#E5E7EB]">{r.employee_name} <span className="font-mono text-xs text-[#E5E7EB]/55">{r.employee_id}</span></td>
                  <td className="px-4 py-3 text-[#E5E7EB]/70">{r.department}</td>
                  <td className="px-4 py-3"><RiskBadge level={r.risk_level} /></td>
                  <td className="px-4 py-3 text-[#E5E7EB]/70">{r.analyst}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#E5E7EB]/55">{String(r.created_at).slice(0, 16).replace("T", " ")}</td>
                  <td className="px-4 py-3">
                    <button data-testid={`download-${r.report_id}`} onClick={() => download(r.employee_id)} className="flex items-center gap-1.5 text-xs text-[#374151] hover:text-blue-300"><Download size={14} /> PDF</button>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-[#E5E7EB]/55">No reports generated yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
