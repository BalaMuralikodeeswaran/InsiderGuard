import { useEffect, useState } from "react";
import { Bell, ShieldAlert, Upload, Cpu, Search, FileText, CheckCheck, AlertCircle } from "lucide-react";
import api from "../lib/api";
import { toast } from "sonner";
import { PageHeader, Loading } from "../components/common";

const ICON = { alert: ShieldAlert, upload: Upload, analysis: Cpu, investigation: Search, report: FileText, error: AlertCircle };
const COLOR = { critical: "text-red-400 border-red-500/30", info: "text-blue-400 border-zinc-800" };

export default function Notifications() {
  const [data, setData] = useState(null);

  const load = async () => { const { data } = await api.get("/notifications"); setData(data); };
  useEffect(() => { load(); }, []);

  const markAll = async () => { await api.post("/notifications/read-all"); load(); toast.success("All notifications marked read"); };

  if (!data) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle={`${data.unread} unread of ${data.notifications.length}`}>
        <button data-testid="mark-all-read-btn" onClick={markAll} className="flex items-center gap-2 border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:border-blue-500">
          <CheckCheck size={15} /> Mark all read
        </button>
      </PageHeader>

      <div className="space-y-2">
        {data.notifications.map((n, i) => {
          const Icon = ICON[n.type] || Bell;
          return (
            <div key={i} data-testid={`notification-${i}`} className={`flex items-start gap-3 border-l-2 bg-zinc-900/40 p-4 ${n.severity === "critical" ? "border-l-red-500" : "border-l-zinc-700"} ${!n.read ? "bg-zinc-900" : ""}`}>
              <div className={`border bg-zinc-950 p-2 ${COLOR[n.severity] || COLOR.info}`}><Icon size={16} /></div>
              <div className="flex-1">
                <p className="text-sm text-zinc-200">{n.message}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{n.type} · {String(n.created_at).slice(0, 16).replace("T", " ")}</p>
              </div>
              {!n.read && <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" />}
            </div>
          );
        })}
        {data.notifications.length === 0 && <p className="py-12 text-center text-zinc-500">No notifications</p>}
      </div>
    </div>
  );
}
