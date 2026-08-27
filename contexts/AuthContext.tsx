"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type Org = { id: string; name: string; role: string };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  org: Org | null;
  orgs: Org[];
  setOrgId: (id: string) => void;
  refreshOrgs: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  org: null,
  orgs: [],
  setOrgId: () => {},
  refreshOrgs: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgIdState] = useState<string | null>(null);

  async function loadOrgs(uid: string) {
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
    if (user) await loadOrgs(user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadOrgs(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadOrgs(session.user.id);
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
    <Ctx.Provider value={{ user, loading, org, orgs, setOrgId, refreshOrgs }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
