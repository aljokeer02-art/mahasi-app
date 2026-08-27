"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

type Account = {
  id: string;
  code: string;
  name: string;
  category: string;
  opening_balance: number;
  is_active: boolean;
};

const categories = [
  { value: "اصول", label: "أصول" },
  { value: "خصوم", label: "خصوم" },
  { value: "حقوق_ملكية", label: "حقوق ملكية" },
  { value: "ايرادات", label: "إيرادات" },
  { value: "مصروفات", label: "مصروفات" },
];

export default function AccountsPage() {
  const { org } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", category: "اصول", opening_balance: "0" });
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!org) return;
    const { data } = await supabase
      .from("accounts")
      .select("id, code, name, category, opening_balance, is_active")
      .eq("org_id", org.id)
      .is("deleted_at", null)
      .order("code");
    setAccounts(data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setBusy(true);
    await supabase.from("accounts").insert({
      org_id: org.id,
      code: form.code,
      name: form.name,
      category: form.category,
      opening_balance: parseFloat(form.opening_balance || "0"),
    });
    setForm({ code: "", name: "", category: "اصول", opening_balance: "0" });
    setShowForm(false);
    setBusy(false);
    load();
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">دليل الحسابات</h1>
          <p className="text-forest-800/60 text-sm mt-1">القائمة الكاملة لحسابات المؤسسة</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "إلغاء" : "+ حساب جديد"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addAccount} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            className="input"
            placeholder="رقم الحساب (مثال: 1001)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            required
          />
          <input
            className="input sm:col-span-2"
            placeholder="اسم الحساب"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="الرصيد الافتتاحي"
            value={form.opening_balance}
            onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
          />
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-1">
            {busy ? "جارِ الحفظ..." : "حفظ الحساب"}
          </button>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr>
              <th>الرقم</th>
              <th>اسم الحساب</th>
              <th>النوع</th>
              <th>الرصيد الافتتاحي</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="font-mono text-forest-800/70">{a.code}</td>
                <td className="font-medium">{a.name}</td>
                <td>{categories.find((c) => c.value === a.category)?.label}</td>
                <td>{a.opening_balance.toLocaleString("ar")}</td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-forest-800/50">
                  لا توجد حسابات بعد. أضف أول حساب من الزر أعلاه.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
