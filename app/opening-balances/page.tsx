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
};

const categoryLabels: Record<string, string> = {
  اصول: "الأصول",
  خصوم: "الخصوم",
  حقوق_ملكية: "حقوق الملكية",
  ايرادات: "الإيرادات",
  مصروفات: "المصروفات",
};

const categoryOrder = ["اصول", "خصوم", "حقوق_ملكية", "ايرادات", "مصروفات"];

export default function OpeningBalancesPage() {
  const { org } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!org) return;
    setLoading(true);
    const { data } = await supabase
      .from("accounts")
      .select("id, code, name, category, opening_balance")
      .eq("org_id", org.id)
      .is("deleted_at", null)
      .order("code");
    setAccounts(data || []);
    setEdits({});
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  function valueFor(a: Account) {
    return edits[a.id] !== undefined ? edits[a.id] : String(a.opening_balance);
  }

  function updateEdit(id: string, value: string) {
    setEdits((prev) => ({ ...prev, [id]: value }));
  }

  const changedIds = Object.keys(edits).filter((id) => {
    const acc = accounts.find((a) => a.id === id);
    return acc && parseFloat(edits[id] || "0") !== Number(acc.opening_balance);
  });

  async function saveAll() {
    setSaving(true);
    setMessage("");
    for (const id of changedIds) {
      const value = parseFloat(edits[id] || "0");
      await supabase.from("accounts").update({ opening_balance: value }).eq("id", id);
    }
    setMessage(`تم حفظ ${changedIds.length} حساب بنجاح`);
    setSaving(false);
    load();
  }

  function totalFor(category: string) {
    return accounts
      .filter((a) => a.category === category)
      .reduce((sum, a) => sum + parseFloat(valueFor(a) || "0"), 0);
  }

  const totalAssets = totalFor("اصول");
  const totalLiabilities = totalFor("خصوم");
  const totalEquity = totalFor("حقوق_ملكية");
  const balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium">الأرصدة الافتتاحية</h1>
          <p className="text-forest-800/60 text-sm mt-1">
            حدّد رصيد كل حساب قبل بدء استخدام النظام (المبالغ التي كانت لديك مسبقاً)
          </p>
        </div>
        <button onClick={saveAll} disabled={saving || changedIds.length === 0} className="btn-primary">
          {saving ? "جارِ الحفظ..." : `حفظ التغييرات ${changedIds.length > 0 ? `(${changedIds.length})` : ""}`}
        </button>
      </div>

      {message && <p className="text-forest-600 text-sm mb-4">{message}</p>}

      {loading ? (
        <p className="text-forest-800/50 text-center py-8">جارِ التحميل...</p>
      ) : (
        <div className="space-y-6">
          {categoryOrder.map((cat) => {
            const catAccounts = accounts.filter((a) => a.category === cat);
            if (catAccounts.length === 0) return null;
            return (
              <div key={cat} className="card overflow-hidden">
                <div className="px-4 py-3 bg-forest-50 font-medium flex justify-between">
                  <span>{categoryLabels[cat]}</span>
                  <span>{totalFor(cat).toLocaleString("ar")}</span>
                </div>
                <table className="w-full table-base">
                  <thead>
                    <tr><th>الرقم</th><th>اسم الحساب</th><th>الرصيد الافتتاحي</th></tr>
                  </thead>
                  <tbody>
                    {catAccounts.map((a) => (
                      <tr key={a.id}>
                        <td className="font-mono text-forest-800/70">{a.code}</td>
                        <td className="font-medium">{a.name}</td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="input max-w-[160px]"
                            value={valueFor(a)}
                            onChange={(e) => updateEdit(a.id, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {accounts.length === 0 && (
            <div className="card p-8 text-center text-forest-800/50">
              لا توجد حسابات بعد. أنشئ دليل الحسابات أولاً.
            </div>
          )}

          {accounts.length > 0 && (
            <div className={`card p-5 ${balanced ? "bg-forest-50" : "bg-amber-50"}`}>
              <div className="flex justify-between text-sm mb-1">
                <span>إجمالي الأصول</span>
                <span className="font-medium">{totalAssets.toLocaleString("ar")}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>إجمالي الخصوم + حقوق الملكية</span>
                <span className="font-medium">{(totalLiabilities + totalEquity).toLocaleString("ar")}</span>
              </div>
              <div className="border-t border-forest-100 mt-2 pt-2 text-sm">
                {balanced ? (
                  <span className="text-forest-800">✓ الأرصدة الافتتاحية متوازنة</span>
                ) : (
                  <span className="text-amber-800">
                    ⚠ فرق قدره {(totalAssets - (totalLiabilities + totalEquity)).toLocaleString("ar")} — راجع الأرقام (الفرق يُسجَّل عادة في حساب "رأس المال")
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
