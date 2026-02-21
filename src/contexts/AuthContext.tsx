import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  org_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextValue {
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchOrCreateProfile(userId: string, email: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (data) {
    logger.info("user_profile_fetched", { userId, orgId: data.org_id });
    return data as UserProfile;
  }

  // No row found — create one
  if (error && error.code === "PGRST116") {
    const { data: inserted, error: insertError } = await supabase
      .from("users")
      .insert({ id: userId, email, role: "owner" })
      .select()
      .single();

    if (insertError) {
      logger.error("user_profile_create_error", { userId, message: insertError.message });
      throw insertError;
    }

    logger.info("user_profile_created", { userId });
    return inserted as UserProfile;
  }

  // Some other error
  logger.error("user_profile_fetch_error", { userId, message: error?.message });
  throw error;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    async function resolveSession(currentSession: Session | null) {
      if (!currentSession) {
        setSession(null);
        setUserProfile(null);
        logger.clearContext();
        setLoading(false);
        return;
      }

      setSession(currentSession);

      try {
        const profile = await fetchOrCreateProfile(
          currentSession.user.id,
          currentSession.user.email ?? "",
        );
        if (!ignore) {
          setUserProfile(profile);
          logger.setContext({ userId: profile.id, orgId: profile.org_id });
        }
      } catch {
        // Profile fetch/create failed — still set session so user isn't stuck
        if (!ignore) {
          setUserProfile(null);
        }
      }

      if (!ignore) {
        setLoading(false);
      }
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initial } }) => {
      if (ignore) return;
      if (initial) {
        logger.info("auth_session_restored", { userId: initial.user.id });
      }
      resolveSession(initial);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (ignore) return;

        if (!newSession) {
          logger.info("auth_session_ended");
          resolveSession(null);
          return;
        }

        // Session changed (login, token refresh, etc.)
        resolveSession(newSession);
      },
    );

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function handleRefreshProfile() {
    if (!session) return;
    try {
      const profile = await fetchOrCreateProfile(
        session.user.id,
        session.user.email ?? "",
      );
      setUserProfile(profile);
      logger.setContext({ userId: profile.id, orgId: profile.org_id });
    } catch {
      // Refresh failed — keep existing profile
    }
  }

  return (
    <AuthContext.Provider value={{ session, userProfile, loading, signOut: handleSignOut, refreshProfile: handleRefreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
