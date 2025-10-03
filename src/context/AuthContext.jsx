import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

function normalizeAccountState(value) {
  if (value == null) return null;
  return value.toString().trim().toUpperCase();
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      setLoading(true);
      const {
        data: { session: currentSession }
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession);

      if (currentSession) {
        await loadProfile(currentSession);
      } else {
        setProfile(null);
      }

      setLoading(false);
    }

    async function loadProfile(currentSession) {
      try {
        const { data, error } = await supabase
          .from('perfiles')
          .select(
            [
              'id',
              'nombre_completo',
              'nombre',
              'puesto',
              'rol',
              'rol_principal',
              'estado',
              'avatar_url',
              'area_id',
              'subdireccion_id',
              'area:areas(id,nombre,clave,parent_area_id)',
              'usuario:usuarios(email)'
            ].join(',')
          )
          .eq('usuario_id', currentSession.user.id)
          .maybeSingle();

        if (error) throw error;

        const normalizedState = normalizeAccountState(data?.estado);

        if (!data || (normalizedState && normalizedState !== 'ACTIVO')) {
          await supabase.auth.signOut().catch(() => {});
          setSession(null);
          setProfile(null);
          return;
        }

        setProfile(
          data
            ? {
                ...data,
                nombre: data.nombre_completo ?? data.nombre,
                rol_principal: data.rol_principal ?? data.rol ?? null,
                area_id: data.area_id ?? data.area?.id ?? null,
                area: data.area ?? null,
                subdireccion_id: data.subdireccion_id ?? null
              }
            : null
        );
      } catch (err) {
        console.error('Error cargando perfil', err);
        setProfile(null);
      }
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile(newSession);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          return { data, error };
        }

        const userId = data?.user?.id;

        if (userId) {
          const { data: profileData, error: profileError } = await supabase
            .from('perfiles')
            .select('estado')
            .eq('usuario_id', userId)
            .maybeSingle();

          if (profileError && profileError.code !== 'PGRST116') {
            await supabase.auth.signOut().catch(() => {});
            return { data: null, error: profileError };
          }

          const normalizedState = normalizeAccountState(profileData?.estado);

          if (!profileData || (normalizedState && normalizedState !== 'ACTIVO')) {
            await supabase.auth.signOut().catch(() => {});
            return {
              data: null,
              error: new Error('Tu cuenta está desactivada. Contacta al administrador para restablecer el acceso.')
            };
          }
        }

        return { data, error: null };
      },
      signOut: () => supabase.auth.signOut()
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
}
