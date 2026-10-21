import { HelpCircle, Upload, Cpu, ShieldAlert, Search, FileText } from "lucide-react";
import { PageHeader } from "../components/common";

const STEPS = [
  { icon: Upload, title: "1. Upload Activity Logs", body: "Go to Upload Logs and import a CSV of employee activity. The pipeline validates, cleans and stores the data automatically." },
  { icon: Cpu, title: "2. AI Analysis", body: "Isolation Forest and Local Outlier Factor models score behaviour. Each employee receives a 0–100 risk score with explainable reasons." },
  { icon: ShieldAlert, title: "3. Review Alerts", body: "The system raises alerts for high-risk behaviour. Triage them, assign analysts and add notes." },
  { icon: Search, title: "4. Investigate", body: "Open investigations on suspicious employees. Track status, log evidence, add notes and mark false positives." },
  { icon: FileText, title: "5. Generate Reports", body: "Produce downloadable PDF incident reports containing the full evidence trail and AI explanation." },
];

const FAQ = [
  { q: "Where does the data come from?", a: "A realistic simulated dataset is seeded on first launch. You can also upload your own CSV. No real employees are ever monitored." },
  { q: "How is the risk score calculated?", a: "An ensemble of unsupervised anomaly detection (Isolation Forest + LOF) combined with weighted behavioural rules, normalised to 0–100." },
  { q: "What do the risk bands mean?", a: "0–30 Low, 31–60 Medium, 61–80 High, 81–100 Critical." },
  { q: "Who can manage users and settings?", a: "Only Administrators. Security Analysts can upload, investigate, and generate reports." },
];

export default function Help() {
  return (
    <div className="space-y-6">
      <PageHeader title="Help & Documentation" subtitle="How to use the CaughtIn4K console" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.title} className="border border-[#1F2937] bg-[#111827]/10 p-5">
            <div className="mb-3 inline-flex border border-[#374151]/40 bg-[#111827]/30 p-2 text-[#374151]"><s.icon size={18} /></div>
            <h3 className="font-heading text-sm font-bold text-[#E5E7EB]">{s.title}</h3>
            <p className="mt-2 text-sm text-[#E5E7EB]/70">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="border border-[#1F2937] bg-[#111827]/10 p-6">
        <h3 className="mb-4 font-heading text-lg font-bold">Frequently Asked Questions</h3>
        <div className="space-y-4">
          {FAQ.map((f) => (
            <div key={f.q} className="border-b border-[#1F2937] pb-4">
              <p className="flex items-center gap-2 font-semibold text-[#E5E7EB]"><HelpCircle size={15} className="text-[#374151]" /> {f.q}</p>
              <p className="mt-1.5 pl-6 text-sm text-[#E5E7EB]/70">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
