import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  tenant_id: string | null;
  full_name: string | null;
  role: string;
};
type Tenant = {
  id: string;
  name: string;
  plan: string;
  monthly_budget_inr: number;
};

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  tenant: Tenant | null;
  loading: boolean;
  init: () => void;
  loadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  tenant: null,
  loading: true,
  init: () => {
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        setTimeout(() => get().loadProfile(), 0);
      } else {
        set({ profile: null, tenant: null, loading: false });
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) get().loadProfile();
      else set({ loading: false });
    });
  },
  loadProfile: async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", get().user!.id)
      .maybeSingle();
    let tenant: Tenant | null = null;
    if (profile?.tenant_id) {
      const { data } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", profile.tenant_id)
        .maybeSingle();
      tenant = data as Tenant | null;
    }
    set({ profile: profile as Profile | null, tenant, loading: false });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, tenant: null });
  },
}));
