"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { user, refreshOrgs, setOrgId } = useAuth();
  const router = useRouter();

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");

    const { data, error } = await supabase
      .from("organizations")
      .insert({ name, created_by: user.id })
      .select()
      .single();

    if (error) {
      setError("حدث خطأ: " + error.message);
      setBusy(false);
      return;
    }

    // إنشاء عملة أساسية افتراضية (ريال سعودي)
    await supabase.from("currencies").insert({
      org_id: data.id,
      code: "SAR",
      name: "ريال سعودي",
      symbol: "ر.س",
      is_base: true,
      exchange_rate: 1,
    });

    await refreshOrgs();
    setOrgId(data.id);
    router.replace("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-medium">مرحباً بك 👋</h1>
          <p className="text-forest-800/60 text-sm mt-1">
            أنشئ مساحة محاسبة عائلتك للبدء
          </p>
        </div>
        <form onSubmit={createOrg} className="card p-6 space-y-3">
          <div>
            <label className="text-sm text-forest-800/70 block mb-1">اسم المساحة</label>
            <input
              className="input"
              placeholder="مثال: محاسبة عائلة الجوكر"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "جارِ الإنشاء..." : "إنشاء المساحة"}
          </button>
        </form>
      </div>
    </div>
  );
}
