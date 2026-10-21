import { useEffect, useState } from "react";
import {
  Bell,
  ShieldAlert,
  Upload,
  Cpu,
  Search,
  FileText,
  CheckCheck,
  AlertCircle,
  Trash2
} from "lucide-react";
import api from "../lib/api";
import { toast } from "sonner";
import { PageHeader, Loading } from "../components/common";

const ICON = { alert: ShieldAlert, upload: Upload, analysis: Cpu, investigation: Search, report: FileText, error: AlertCircle };
const COLOR = { critical: "text-red-400 border-red-500/30", info: "text-[#374151] border-[#1F2937]" };

export default function Notifications() {
  const [data, setData] = useState(null);

  const load = async () => { const { data } = await api.get("/notifications"); setData(data); };
  useEffect(() => { load(); }, []);

  const deleteNotification = async (id) => {
  try {
    await api.delete(`/notifications/${id}`);
    await load();
    toast.success("Notification deleted");
  } catch (error) {
    toast.error("Failed to delete notification");
  }
};

  const markAll = async () => { await api.post("/notifications/read-all"); load(); toast.success("All notifications marked read"); };

  if (!data) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle={`${data.unread} unread of ${data.notifications.length}`}>
        <button data-testid="mark-all-read-btn" onClick={markAll} className="flex items-center gap-2 border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm text-[#E5E7EB] hover:border-[#374151]">
          <CheckCheck size={15} /> Mark all read
        </button>
      </PageHeader>

      <div className="space-y-2">
        {data.notifications.map((n, i) => {
          const Icon = ICON[n.type] || Bell;
          return (
            <div key={i} data-testid={`notification-${i}`} className={`flex items-start gap-3 border-l-2 bg-[#111827]/10 p-4 ${n.severity === "critical" ? "border-l-red-500" : "border-l-zinc-700"} ${!n.read ? "bg-[#0B0F19]" : ""}`}>
              <div className={`border bg-[#0B0F19] p-2 ${COLOR[n.severity] || COLOR.info}`}><Icon size={16} /></div>
              <div className="flex-1">
                <p className="text-sm text-[#E5E7EB]">{n.message}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#E5E7EB]/55">{n.type} · {String(n.created_at).slice(0, 16).replace("T", " ")}</p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                {!n.read && (
                  <span className="h-2 w-2 rounded-full bg-[#374151]" />
                )}

                <button
                  onClick={() => deleteNotification(n.id)}
                  title="Delete notification"
                  className="flex h-8 w-8 items-center justify-center border border-[#1F2937] text-[#E5E7EB]/50 transition-all hover:border-[#374151] hover:bg-[#111827]/30 hover:text-[#374151]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
        {data.notifications.length === 0 && <p className="py-12 text-center text-[#E5E7EB]/55">No notifications</p>}
      </div>
    </div>
  );
}
