"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export default function NoAccessPage() {
  const { user } = useAuth();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 bg-forest-600 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl">
          🔒
        </div>
        <h1 className="text-xl font-medium mb-2">لم تُدعَ لأي مساحة بعد</h1>
        <p className="text-forest-800/60 text-sm mb-1">
          حسابك ({user?.email}) لا ينتمي لأي مساحة عائلية حتى الآن.
        </p>
        <p className="text-forest-800/60 text-sm mb-6">
          اطلب من مدير النظام دعوتك عبر البريد الإلكتروني نفسه من صفحة "المستخدمون والصلاحيات".
        </p>
        <button onClick={signOut} className="btn-secondary">
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
