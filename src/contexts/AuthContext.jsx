import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../utils/supabase";
import { getRolePermissions } from "../config/roles";
import { setUserScope, clearUserScope } from "../utils/storage";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(true);
  // Guard: prevents onAuthStateChange from restoring a session after manual sign-out
  const signedOutRef = useRef(false);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (!error && data) return data.role;
    } catch {}
    return "user";
  }, []);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && window.location.hash.includes("access_token")) {
        window.history.replaceState(null, "", window.location.pathname);
      }

      if (session?.user && !signedOutRef.current) {
        const r = await fetchProfile(session.user.id);
        if (!mounted) return;
        setUser(session.user);
        setRole(r);
        setUserScope(session.user.id);
      } else if (!session?.user || signedOutRef.current) {
        setUser(null);
        setRole("user");
        clearUserScope();
      }

      setLoading(false);
    });

    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [fetchProfile]);

  // Use raw fetch instead of SDK for email auth — sb_publishable_ keys cause
  // the SDK's signInWithPassword/signUp to hang without making a network request
  const signIn = useCallback(async (email, password) => {
    try {
      const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: { message: json.error_description || json.msg || "Invalid email or password." } };
      // Store session so supabase.auth.signOut() can revoke it
      const storageKey = `sb-${SUPA_URL.split("//")[1].split(".")[0]}-auth-token`;
      localStorage.setItem(storageKey, JSON.stringify({ access_token: json.access_token, refresh_token: json.refresh_token, expires_at: json.expires_at, token_type: json.token_type, user: json.user }));
      signedOutRef.current = false;
      setUser(json.user);
      setUserScope(json.user.id);
      fetchProfile(json.user.id).then(r => setRole(r));
      return { data: json, error: null };
    } catch (err) {
      return { data: null, error: { message: "Something went wrong. Please try again." } };
    }
  }, []);

  const signUp = useCallback(async (email, password) => {
    try {
      const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) return { data: null, error: { message: json.error_description || json.msg || "Signup failed.", status: res.status } };
      if (json.access_token && json.user) {
        const storageKey = `sb-${SUPA_URL.split("//")[1].split(".")[0]}-auth-token`;
        localStorage.setItem(storageKey, JSON.stringify({ access_token: json.access_token, refresh_token: json.refresh_token, expires_at: json.expires_at, token_type: json.token_type, user: json.user }));
        signedOutRef.current = false;
        setUser(json.user);
        setUserScope(json.user.id);
        fetchProfile(json.user.id).then(r => setRole(r));
      }
      return { data: json, error: null };
    } catch (err) {
      return { data: null, error: { message: "Something went wrong. Please try again." } };
    }
  }, []);

  const signOut = useCallback(() => {
    // Prevent onAuthStateChange from re-setting user from SDK's in-memory cache
    signedOutRef.current = true;
    // Clear state immediately — don't await Supabase SDK which hangs with sb_publishable_ keys
    const storageKey = `sb-${SUPA_URL.split("//")[1].split(".")[0]}-auth-token`;
    localStorage.removeItem(storageKey);
    setUser(null);
    setRole("user");
    clearUserScope();
    // Fire-and-forget — best effort server-side session revocation
    supabase.auth.signOut().catch(() => {});
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    return { data, error };
  }, []);

  const signInWithOAuth = useCallback(async (provider) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    return { data, error };
  }, []);

  const permissions = getRolePermissions(role);

  return (
    <AuthContext.Provider value={{ user, role, permissions, loading, signUp, signIn, signOut, resetPassword, signInWithOAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
