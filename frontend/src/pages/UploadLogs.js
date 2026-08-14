import { useState, useRef } from "react";
import { UploadCloud, FileCheck2, Download, Loader2, CheckCircle2, AlertTriangle, Database } from "lucide-react";
import api, { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { PageHeader } from "../components/common";

export default function UploadLogs() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const pick = (f) => {
    if (f && f.name.endsWith(".csv")) { setFile(f); setReport(null); }
    else toast.error("Please select a .csv file");
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/upload/logs", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setReport(data);
      toast.success(`Processed ${data.quality_report.cleaned_rows} logs & analyzed ${data.analyzed_employees} employees`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const downloadTemplate = async () => {
    const { data } = await api.get("/upload/template", { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = "insiderguard_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Upload Activity Logs" subtitle="Import employee activity CSV for AI analysis">
        <button data-testid="download-template-btn" onClick={downloadTemplate}
          className="flex items-center gap-2 border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:border-blue-500">
          <Download size={15} /> CSV Template
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div
            data-testid="upload-dropzone"
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            className={`flex flex-col items-center justify-center border-2 border-dashed p-12 transition-colors ${drag ? "border-blue-500 bg-blue-500/5" : "border-zinc-800 bg-zinc-900/40"}`}
          >
            <div className="mb-4 border border-zinc-800 bg-zinc-950 p-4 text-blue-400">
              <UploadCloud size={32} />
            </div>
            <p className="text-sm text-zinc-300">Drag &amp; drop your CSV file here</p>
            <p className="mt-1 text-xs text-zinc-500">or</p>
            <button data-testid="browse-file-btn" onClick={() => inputRef.current.click()}
              className="mt-3 border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:border-blue-500">
              Browse Files
            </button>
            <input ref={inputRef} type="file" accept=".csv" hidden onChange={(e) => pick(e.target.files[0])} />
            {file && (
              <div className="mt-5 flex items-center gap-2 border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm">
                <FileCheck2 size={16} className="text-green-400" />
                <span className="font-mono">{file.name}</span>
                <span className="text-zinc-500">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>

          <button data-testid="upload-submit-btn" onClick={upload} disabled={!file || busy}
            className="mt-4 flex w-full items-center justify-center gap-2 bg-blue-500 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50">
            {busy ? <><Loader2 size={16} className="animate-spin" /> Processing &amp; Analyzing...</> : <>Upload &amp; Analyze</>}
          </button>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-zinc-300">
            <Database size={16} className="text-blue-400" />
            <h3 className="font-heading text-sm font-bold">Expected Columns</h3>
          </div>
          <ul className="space-y-1.5 text-xs text-zinc-400">
            {["employee_id", "department", "login_time", "logout_time", "downloads", "uploads", "usb_connected", "external_emails", "internal_emails", "failed_logins", "restricted_access", "vpn_usage"].map((c) => (
              <li key={c} className="flex items-center gap-2 font-mono">
                <span className="h-1 w-1 bg-blue-500" /> {c}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-zinc-500">The pipeline validates format, removes duplicates, handles missing values, cleans impossible entries, then re-runs the ML models.</p>
        </div>
      </div>

      {report && (
        <div data-testid="quality-report" className="fade-up border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-green-400" />
            <h3 className="font-heading text-lg font-bold">Data Quality Report</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              { l: "Original Rows", v: report.quality_report.original_rows },
              { l: "Cleaned Rows", v: report.quality_report.cleaned_rows },
              { l: "Duplicates Removed", v: report.quality_report.duplicates_removed },
              { l: "Missing Values", v: report.quality_report.missing_values_found },
              { l: "New Employees", v: report.quality_report.new_employees },
              { l: "Analyzed", v: report.analyzed_employees },
            ].map((s) => (
              <div key={s.l} className="border border-zinc-800 bg-zinc-950 p-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{s.l}</p>
                <p className="mt-1 font-mono text-xl font-bold text-zinc-100">{s.v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-400">
            <AlertTriangle size={15} /> Analysis complete. Review updated risk scores on the Dashboard and Employees pages.
          </div>
        </div>
      )}
    </div>
  );
}
