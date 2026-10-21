import { ShieldCheck, Cpu, Database, Lock, Github } from "lucide-react";
import { PageHeader } from "../components/common";

const TECH = ["FastAPI", "React", "MongoDB", "scikit-learn", "Isolation Forest", "Local Outlier Factor", "Recharts", "JWT Auth", "ReportLab"];
const SECURITY = [
  "Role-based access control (Admin / Analyst)",
  "bcrypt password hashing",
  "JWT session tokens in httpOnly cookies",
  "Brute-force login protection",
  "Audit & access logging",
  "Server-side input validation",
  "Secure CSV file upload handling",
];

export default function About() {
  return (
    <div className="space-y-6">
      <PageHeader title="About CaughtIn4K" subtitle="AI-based insider threat detection prototype" />

      <div className="border border-[#1F2937] bg-[#111827]/10 p-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center bg-[#374151]"><ShieldCheck size={26} className="text-white" /></div>
          <div>
            <h2 className="font-heading text-2xl font-black">CaughtIn4K</h2>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#E5E7EB]/55">SOC Console · v1.0</p>
          </div>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-[#E5E7EB]/70">
          CaughtIn4K is a prototype cybersecurity application that demonstrates how Artificial Intelligence and Machine Learning
          can assist a Security Operations Center in detecting insider threats. It analyses employee activity logs, engineers
          behavioural features, applies unsupervised anomaly detection, assigns explainable risk scores, raises alerts, and supports
          investigation workflows with downloadable incident reports.
        </p>
        <div className="mt-4 border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-400">
          This is a demonstration prototype. It does not monitor real employees or connect to real organisational systems. All data is simulated.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border border-[#1F2937] bg-[#111827]/10 p-6">
          <div className="mb-4 flex items-center gap-2"><Cpu size={16} className="text-[#374151]" /><h3 className="font-heading text-sm font-bold">Technology Stack</h3></div>
          <div className="flex flex-wrap gap-2">
            {TECH.map((t) => <span key={t} className="border border-[#1F2937] bg-[#0B0F19] px-3 py-1.5 font-mono text-xs text-[#E5E7EB]/90">{t}</span>)}
          </div>
        </div>
        <div className="border border-[#1F2937] bg-[#111827]/10 p-6">
          <div className="mb-4 flex items-center gap-2"><Lock size={16} className="text-[#374151]" /><h3 className="font-heading text-sm font-bold">Security Features</h3></div>
          <ul className="space-y-2">
            {SECURITY.map((s) => <li key={s} className="flex items-start gap-2 text-sm text-[#E5E7EB]/70"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-green-400" /> {s}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
