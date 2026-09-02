"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { exportToExcel } from "@/lib/exportExcel";
import { exportElementToPdf } from "@/lib/exportPdf";

type Entry = {
  id: string;
  entry_number: number;
  entry_date: string;
  description: string | null;
  status: string;
};

type Account = { id: string; code: string; name: string };

type Line = { id?: string; account_id: string; debit: string; credit: string; description: string };

const emptyLine = (): Line => ({ account_id: "", debit: "", credit: "", description: "" });

export default function JournalPage() {
  const { org } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!org) return;
    const [entRes, accRes] = await Promise.all([
      supabase
        .from("journal_entries")
        .select("id, entry_number, entry_date, description, status")
        .eq("org_id", org.id)
        .is("deleted_at", null)
        .order("entry_date", { ascending: false }),
      supabase.from("accounts").select("id, code, name").eq("org_id", org.id).is("deleted_at", null).order("code"),
    ]);
    setEntries(entRes.data || []);
    setAccounts(accRes.data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setLines([emptyLine(), emptyLine()]);
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  function openNewForm() {
    resetForm();
    setShowForm(true);
  }

  async function openEditForm(entry: Entry) {
    setError("");
    const { data: entryLines } = await supabase
      .from("journal_lines")
      .select("id, account_id, debit, credit, description")
      .eq("entry_id", entry.id);

    setEditingId(entry.id);
    setDate(entry.entry_date);
    setDescription(entry.description || "");
    setLines(
      (entryLines || []).map((l: any) => ({
        id: l.id,
        account_id: l.account_id,
        debit: l.debit ? String(l.debit) : "",
        credit: l.credit ? String(l.credit) : "",
        description: l.description || "",
      }))
    );
    setShowForm(true);
  }

  async function saveEntry(post: boolean) {
    if (!org) return;
    setError("");
    if (post && !balanced) {
      setError("لا يمكن ترحيل القيد: مجموع المدين يجب أن يساوي مجموع الدائن");
      return;
    }
    setBusy(true);

    const validLines = lines.filter((l) => l.account_id && (parseFloat(l.debit) || parseFloat(l.credit)));

    let entryId = editingId;

    if (editingId) {
      // تعديل قيد موجود: نحدّث بياناته الأساسية، ونستبدل كل الأسطر بالجديدة
      const { error: updErr } = await supabase
        .from("journal_entries")
        .update({ entry_date: date, description })
        .eq("id", editingId);
      if (updErr) {
        setError("خطأ: " + updErr.message);
        setBusy(false);
        return;
      }
      await supabase.from("journal_lines").delete().eq("entry_id", editingId);
    } else {
      const { data: entry, error: entErr } = await supabase
        .from("journal_entries")
        .insert({
          org_id: org.id,
          entry_date: date,
          description,
          status: "مسودة",
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (entErr || !entry) {
        setError("خطأ: " + entErr?.message);
        setBusy(false);
        return;
      }
      entryId = entry.id;
    }

    await supabase.from("journal_lines").insert(
      validLines.map((l) => ({
        entry_id: entryId,
        account_id: l.account_id,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description || null,
      }))
    );

    if (post) {
      const { error: postErr } = await supabase
        .from("journal_entries")
        .update({ status: "مرحل" })
        .eq("id", entryId as string);
      if (postErr) {
        setError("تم الحفظ كمسودة، لكن تعذّر الترحيل: " + postErr.message);
        setBusy(false);
        load();
        return;
      }
    }

    resetForm();
    setBusy(false);
    load();
  }

  async function revertToDraft(id: string) {
    await supabase.from("journal_entries").update({ status: "مسودة" }).eq("id", id);
    load();
  }

  async function deleteEntry(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا القيد؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    await supabase
      .from("journal_entries")
      .update({ deleted_at: new Date().toISOString(), status: "ملغى" })
      .eq("id", id);
    load();
  }

  const statusLabel: Record<string, string> = { "مسودة": "مسودة", "مرحل": "مرحّل", "ملغى": "ملغى" };
  const statusColor: Record<string, string> = {
    "مسودة": "bg-amber-100 text-amber-800",
    "مرحل": "bg-forest-100 text-forest-800",
    "ملغى": "bg-red-100 text-red-800",
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-medium">القيود المحاسبية</h1>
          <p className="text-forest-800/60 text-sm mt-1">كل قيد يجب أن يكون متوازناً (مدين = دائن)</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>طباعة</button>
          <button
            className="btn-secondary"
            onClick={() =>
              exportToExcel(
                "القيود_المحاسبية",
                "القيود",
                entries.map((e) => ({
                  "رقم القيد": e.entry_number,
                  "التاريخ": e.entry_date,
                  "الوصف": e.description || "",
                  "الحالة": statusLabel[e.status],
                }))
              )
            }
          >
            تصدير Excel
          </button>
          <button className="btn-secondary" onClick={() => exportElementToPdf("journal-table", "القيود_المحاسبية")}>
            تصدير PDF
          </button>
          <button className="btn-primary" onClick={() => (showForm ? resetForm() : openNewForm())}>
            {showForm ? "إلغاء" : "+ قيد جديد"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card p-5 mb-6 no-print">
          {editingId && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
              أنت تعدّل قيداً موجوداً. سيتم استبدال كل أسطره بما تكتبه الآن.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-sm text-forest-800/70 block mb-1">التاريخ</label>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-forest-800/70 block mb-1">الوصف</label>
              <input
                className="input"
                placeholder="مثال: دفع إيجار شهر أغسطس"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                <select
                  className="input sm:col-span-2"
                  value={l.account_id}
                  onChange={(e) => updateLine(i, { account_id: e.target.value })}
                >
                  <option value="">اختر الحساب...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  placeholder="مدين"
                  value={l.debit}
                  onChange={(e) => updateLine(i, { debit: e.target.value, credit: "" })}
                />
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  placeholder="دائن"
                  value={l.credit}
                  onChange={(e) => updateLine(i, { credit: e.target.value, debit: "" })}
                />
                <button
                  className="text-red-600 text-sm"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={lines.length <= 2}
                >
                  حذف السطر
                </button>
              </div>
            ))}
          </div>

          <button
            className="text-sm text-forest-600 mt-2"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            + إضافة سطر
          </button>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-forest-50">
            <div className="text-sm">
              <span className="text-forest-800/60">مدين: </span>
              <span className="font-medium">{totalDebit.toLocaleString("ar")}</span>
              <span className="text-forest-800/60 mx-2">|</span>
              <span className="text-forest-800/60">دائن: </span>
              <span className="font-medium">{totalCredit.toLocaleString("ar")}</span>
              {!balanced && totalDebit + totalCredit > 0 && (
                <span className="text-red-600 mr-3">القيد غير متوازن</span>
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={busy} onClick={() => saveEntry(false)}>
                حفظ كمسودة
              </button>
              <button className="btn-primary" disabled={busy || !balanced} onClick={() => saveEntry(true)}>
                {editingId ? "حفظ وترحيل" : "ترحيل القيد"}
              </button>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>
      )}

      <div id="journal-table" className="card overflow-hidden">
        <table className="w-full table-base">
          <thead>
            <tr>
              <th>رقم</th>
              <th>التاريخ</th>
              <th>الوصف</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="font-mono text-forest-800/70">#{e.entry_number}</td>
                <td>{e.entry_date}</td>
                <td>{e.description || "—"}</td>
                <td>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColor[e.status]}`}>
                    {statusLabel[e.status]}
                  </span>
                </td>
                <td>
                  <div className="flex gap-3 text-sm">
                    {e.status === "مسودة" && (
                      <button className="text-forest-600 hover:underline" onClick={() => openEditForm(e)}>
                        تعديل
                      </button>
                    )}
                    {e.status === "مرحل" && (
                      <button className="text-amber-700 hover:underline" onClick={() => revertToDraft(e.id)}>
                        تراجع لمسودة
                      </button>
                    )}
                    <button className="text-red-600 hover:underline" onClick={() => deleteEntry(e.id)}>
                      حذف
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-forest-800/50">
                  لا توجد قيود بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
