import { useEffect, useState } from "react";
import { UserPlus, Trash2, Shield, User, X } from "lucide-react";
import api, { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { PageHeader, Loading, StatusPill } from "../components/common";

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "analyst" });

  const load = async () => { const { data } = await api.get("/users"); setUsers(data); };
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api.post("/users", form);
      toast.success("User created");
      setShow(false); setForm({ name: "", email: "", password: "", role: "analyst" });
      load();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const del = async (id) => {
    if (!window.confirm("Remove this user?")) return;
    try { await api.delete(`/users/${id}`); toast.success("User removed"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const changeRole = async (id, role) => {
    try { await api.patch(`/users/${id}`, { role }); toast.success("Role updated"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  if (!users) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" subtitle="Manage analysts and administrators">
        <button data-testid="add-user-btn" onClick={() => setShow(true)} className="flex items-center gap-2 bg-[#374151] px-4 py-2 text-sm font-semibold text-white hover:bg-[#111827]">
          <UserPlus size={15} /> Add User
        </button>
      </PageHeader>

      <div className="overflow-x-auto border border-[#1F2937]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1F2937] bg-[#0B0F19] text-left font-mono text-[10px] uppercase tracking-wider text-[#E5E7EB]/55">
              <th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-testid={`user-row-${u.email}`} className="border-b border-[#1F2937]/60 hover:bg-[#0B0F19]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {u.role === "admin" ? <Shield size={15} className="text-[#374151]" /> : <User size={15} className="text-[#E5E7EB]/55" />}
                    <span className="text-[#E5E7EB]">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#E5E7EB]/70">{u.email}</td>
                <td className="px-4 py-3">
                  <select data-testid={`role-select-${u.email}`} value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} disabled={u.id === user.id}
                    className="border border-[#1F2937] bg-[#0B0F19] px-2 py-1 text-xs text-[#E5E7EB]/90 focus:border-[#374151] disabled:opacity-60">
                    <option value="admin">admin</option><option value="analyst">analyst</option>
                  </select>
                </td>
                <td className="px-4 py-3"><StatusPill status={u.status || "Active"} /></td>
                <td className="px-4 py-3 font-mono text-xs text-[#E5E7EB]/55">{String(u.created_at).slice(0, 10)}</td>
                <td className="px-4 py-3">
                  {u.id !== user.id && (
                    <button data-testid={`delete-user-${u.email}`} onClick={() => del(u.id)} className="text-[#E5E7EB]/55 hover:text-red-400"><Trash2 size={15} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShow(false)}>
          <div className="w-full max-w-md border border-[#1F2937] bg-[#0B0F19] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold">Add User</h2>
              <button onClick={() => setShow(false)} className="text-[#E5E7EB]/55 hover:text-[#E5E7EB]"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input data-testid="new-user-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="w-full border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm outline-none focus:border-[#374151]" />
              <input data-testid="new-user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="w-full border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm outline-none focus:border-[#374151]" />
              <input data-testid="new-user-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" className="w-full border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm outline-none focus:border-[#374151]" />
              <select data-testid="new-user-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-[#1F2937] bg-[#0B0F19] px-3 py-2 text-sm text-[#E5E7EB]/90 focus:border-[#374151]">
                <option value="analyst">Security Analyst</option><option value="admin">Administrator</option>
              </select>
              <button data-testid="create-user-submit" onClick={create} className="w-full bg-[#374151] py-2.5 text-sm font-semibold text-white hover:bg-[#111827]">Create User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
