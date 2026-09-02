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
  currency_id: string | null;
  parent_id: string | null;
  is_active: boolean;
};
type Currency = { id: string; code: string; name: string };

const categories = [
  { value: "اصول", label: "أصول" },
  { value: "خصوم", label: "خصوم" },
  { value: "حقوق_ملكية", label: "حقوق ملكية" },
  { value: "ايرادات", label: "إيرادات" },
  { value: "مصروفات", label: "مصروفات" },
];

const emptyForm = { code: "", name: "", category: "اصول", opening_balance: "0", currency_id: "", parent_id: "" };

// ترتيب الحسابات بحيث يظهر كل حساب فرعي مباشرة تحت أبيه
function buildTree(accounts: Account[]): (Account & { depth: number })[] {
  const byParent: Record<string, Account[]> = {};
  accounts.forEach((a) => {
    const key = a.parent_id || "root";
    if (!byParent[key]) byParent[key] = [];
    byParent[key].push(a);
  });
  const result: (Account & { depth: number })[] = [];
  function walk(parentKey: string, depth: number) {
    (byParent[parentKey] || []).forEach((a) => {
      result.push({ ...a, depth });
      walk(a.id, depth + 1);
    });
  }
  walk("root", 0);
  return result;
}

export default function AccountsPage() {
  const { org } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!org) return;
    const [accRes, curRes] = await Promise.all([
      supabase
        .from("accounts")
        .select("id, code, name, category, opening_balance, currency_id, parent_id, is_active")
        .eq("org_id", org.id)
        .is("deleted_at", null)
        .order("code"),
      supabase.from("currencies").select("id, code, name").eq("org_id", org.id),
    ]);
    setAccounts(accRes.data || []);
    setCurrencies(curRes.data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  function openNewForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(a: Account) {
    setForm({
      code: a.code,
      name: a.name,
      category: a.category,
      opening_balance: String(a.opening_balance),
      currency_id: a.currency_id || "",
      parent_id: a.parent_id || "",
    });
    setEditingId(a.id);
    setShowForm(true);
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setBusy(true);
    const payload = {
      code: form.code,
      name: form.name,
      category: form.category,
      opening_balance: parseFloat(form.opening_balance || "0"),
      currency_id: form.currency_id || null,
      parent_id: form.parent_id || null,
    };

    if (editingId) {
      await supabase.from("accounts").update(payload).eq("id", editingId);
    } else {
      await supabase.from("accounts").insert({ org_id: org.id, ...payload });
    }

    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setBusy(false);
    load();
  }

  async function deleteAccount(id: string) {
    if (accounts.some((a) => a.parent_id === id)) {
      alert("لا يمكن حذف هذا الحساب لأنه يحتوي على حسابات فرعية. احذف الحسابات الفرعية أولاً.");
      return;
    }
    if (!confirm("حذف هذا الحساب؟ لن يظهر في أي قوائم أو تقارير بعد الآن.")) return;
    await supabase.from("accounts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  }

  const currencyName = (id: string | null) => currencies.find((c) => c.id === id)?.code || "—";
  const tree = buildTree(accounts);
  const parentOptions = accounts.filter((a) => a.id !== editingId);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-medium">دليل الحسابات</h1>
          <p className="text-forest-800/60 text-sm mt-1">القائمة الكاملة لحسابات المؤسسة، وتقدر تنشئ حسابات فرعية تحت أي حساب</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>طباعة</button>
          <button className="btn-primary" onClick={() => (showForm ? setShowForm(false) : openNewForm())}>
            {showForm ? "إلغاء" : "+ حساب جديد"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={saveAccount} className="card p-5 mb-6 grid grid-cols-1 sm:grid-cols-5 gap-3 no-print">
          <input
            className="input"
            placeholder="رقم الحساب"
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
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select className="input" value={form.currency_id} onChange={(e) => setForm({ ...form, currency_id: e.target.value })}>
            <option value="">العملة الأساسية</option>
            {currencies.map((c) => (
              <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
            ))}
          </select>

          <select className="input sm:col-span-2" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
            <option value="">لا يوجد (حساب رئيسي)</option>
            {parentOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
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
          <button type="submit" disabled={busy} className="btn-primary sm:col-span-2">
            {busy ? "جارِ الحفظ..." : editingId ? "حفظ التعديل" : "حفظ الحساب"}
          </button>
          <p className="text-xs text-forest-800/50 sm:col-span-5">
            💡 مثال: أنشئ حساباً رئيسياً "الصندوق"، ثم أنشئ "صندوق فرعي 1" واختر "الصندوق" كحساب أب له.
          </p>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr>
              <th>الرقم</th>
              <th>اسم الحساب</th>
              <th>النوع</th>
              <th>العملة</th>
              <th>الرصيد الافتتاحي</th>
              <th className="no-print">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {tree.map((a) => (
              <tr key={a.id}>
                <td className="font-mono text-forest-800/70">{a.code}</td>
                <td className="font-medium" style={{ paddingRight: `${a.depth * 20}px` }}>
                  {a.depth > 0 && <span className="text-forest-800/40 ml-1">↳</span>}
                  {a.name}
                </td>
                <td>{categories.find((c) => c.value === a.category)?.label}</td>
                <td dir="ltr" className="text-left">{currencyName(a.currency_id)}</td>
                <td>{a.opening_balance.toLocaleString("ar")}</td>
                <td className="no-print">
                  <div className="flex gap-3 text-sm">
                    <button className="text-forest-600 hover:underline" onClick={() => openEditForm(a)}>تعديل</button>
                    <button className="text-red-600 hover:underline" onClick={() => deleteAccount(a.id)}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-forest-800/50">
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
