"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(translateError(error.message));
      else router.replace("/");
    } else {
      if (password.length < 6) {
        setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
        setBusy(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) setError(translateError(error.message));
      else setNotice("تم إنشاء الحساب! يمكنك الآن تسجيل الدخول مباشرة.");
    }
    setBusy(false);
  }

  function translateError(msg: string) {
    if (msg.includes("Invalid login credentials")) return "بيانات الدخول غير صحيحة";
    if (msg.includes("already registered")) return "هذا البريد مسجّل بالفعل";
    return msg;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-forest-600 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold">
            م
          </div>
          <h1 className="text-xl font-medium">محاسي</h1>
          <p className="text-forest-800/60 text-sm mt-1">نظام المحاسبة العائلية</p>
        </div>

        <div className="card p-6">
          <div className="flex gap-2 mb-6 bg-forest-50 rounded-lg p-1">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2 rounded-md text-sm transition-colors ${
                mode === "login" ? "bg-white shadow-sm font-medium" : "text-forest-800/60"
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 rounded-md text-sm transition-colors ${
                mode === "signup" ? "bg-white shadow-sm font-medium" : "text-forest-800/60"
              }`}
            >
              حساب جديد
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="text-sm text-forest-800/70 block mb-1">الاسم الكامل</label>
                <input
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div>
              <label className="text-sm text-forest-800/70 block mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-sm text-forest-800/70 block mb-1">كلمة المرور</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}
            {notice && <p className="text-forest-600 text-sm">{notice}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full mt-2">
              {busy ? "جارِ التنفيذ..." : mode === "login" ? "دخول" : "إنشاء حساب"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
