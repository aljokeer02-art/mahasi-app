"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // رابط الإيميل ينشئ جلسة مؤقتة تلقائياً تسمح بتغيير كلمة المرور
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    setNotice("تم تغيير كلمة المرور بنجاح! جارِ تحويلك...");
    setTimeout(() => router.replace("/"), 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-forest-600 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold">
            م
          </div>
          <h1 className="text-xl font-medium">تعيين كلمة مرور جديدة</h1>
        </div>

        <div className="card p-6">
          {!ready ? (
            <p className="text-forest-800/60 text-sm text-center">جارِ التحقق من الرابط...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm text-forest-800/70 block mb-1">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-sm text-forest-800/70 block mb-1">تأكيد كلمة المرور</label>
                <input
                  type="password"
                  className="input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  dir="ltr"
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              {notice && <p className="text-forest-600 text-sm">{notice}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? "جارِ الحفظ..." : "حفظ كلمة المرور"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
