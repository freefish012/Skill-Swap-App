import { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  userId: number | null; // Integer id (e.g., 1001) for your tables
  authId: string | null; // Supabase Auth UUID
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  userId: null,
  authId: null,
  session: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchDbUserId(authUuid: string | undefined) {
    if (!authUuid) {
      setUserId(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authUuid)
      .maybeSingle();

    setUserId(data?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchDbUserId(session?.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      fetchDbUserId(session?.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        userId,
        authId: session?.user.id ?? null,
        session,
        loading,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);