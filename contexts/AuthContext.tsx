"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PLATFORM_ADMIN_EMAIL } from "@/lib/config";
import type { User } from "@supabase/supabase-js";

type Org = { id: string; name: string; role: string };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  org: Org | null;
  orgs: Org[];
  isPlatformAdmin: boolean;
  setOrgId: (id: string) => void;
  refreshOrgs: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  org: null,
  orgs: [],
  isPlatformAdmin: false,
  setOrgId: () => {},
  refreshOrgs: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgIdState] = useState<string | null>(null);

  const isPlatformAdmin = !!user && user.email === PLATFORM_ADMIN_EMAIL;

  async function loadOrgs(uid: string, email: string | undefined) {
    const admin = email === PLATFORM_ADMIN_EMAIL;

    if (admin) {
      const { data } = await supabase.from("organizations").select("id, name").order("created_at");
      const list: Org[] = (data || []).map((o: any) => ({ id: o.id, name: o.name, role: "مدير النظام" }));
      setOrgs(list);
      if (list.length && !orgId) {
        const saved = typeof window !== "undefined" ? localStorage.getItem("org_id") : null;
        const match = list.find((o) => o.id === saved);
        setOrgIdState(match ? match.id : list[0].id);
      }
      return;
    }

    const { data } = await supabase
      .from("org_members")
      .select("role, organizations(id, name)")
      .eq("user_id", uid);

    const list: Org[] = (data || []).map((r: any) => ({
      id: r.organizations.id,
      name: r.organizations.name,
      role: r.role,
    }));
    setOrgs(list);
    if (list.length && !orgId) {
      const saved = typeof window !== "undefined" ? localStorage.getItem("org_id") : null;
      const match = list.find((o) => o.id === saved);
      setOrgIdState(match ? match.id : list[0].id);
    }
  }

  async function refreshOrgs() {
    if (user) await loadOrgs(user.id, user.email);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadOrgs(data.session.user.id, data.session.user.email);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadOrgs(session.user.id, session.user.email);
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setOrgId(id: string) {
    setOrgIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("org_id", id);
  }

  const org = orgs.find((o) => o.id === orgId) || null;

  return (
    <Ctx.Provider value={{ user, loading, org, orgs, isPlatformAdmin, setOrgId, refreshOrgs }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
