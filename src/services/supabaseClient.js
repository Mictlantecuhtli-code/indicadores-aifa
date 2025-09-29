import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1?bundle&target=es2022';

const SUPABASE_URL = 'https://kxjldzcaeayguiqkqqyh.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4amxkemNhZWF5Z3VpcWtxcXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NTQ5ODksImV4cCI6MjA3MjMzMDk4OX0.7c0s4zFimF4TH5_jyJbeTRUuxhGaSvVsCnamwxuKgbw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export async function signInWithEmail({ email, password }) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return supabase.auth.getUser();
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getDashboardSummary() {
  const { data, error } = await supabase.from('v_dashboard_resumen').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function getDirectorsHighlights() {
  const { data, error } = await supabase.rpc('kpi_resumen_directivos');
  if (error) throw error;
  return data ?? [];
}

export async function getIndicators() {
  const { data, error } = await supabase
    .from('v_indicadores_area')
    .select('*')
    .order('area_nombre', { ascending: true })
    .order('nombre', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getIndicatorHistory(indicadorId, { limit = 24 } = {}) {
  const query = supabase
    .from('mediciones')
    .select('id, indicador_id, periodo, anio, mes, valor, escenario, creado_en')
    .eq('indicador_id', indicadorId)
    .order('anio', { ascending: true })
    .order('mes', { ascending: true })
    .limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getIndicatorTargets(indicadorId, { year } = {}) {
  let query = supabase
    .from('indicador_metas')
    .select('id, indicador_id, anio, mes, escenario, valor, fecha_captura, fecha_ultima_edicion')
    .eq('indicador_id', indicadorId)
    .order('anio', { ascending: true })
    .order('mes', { ascending: true });

  if (year) {
    query = query.eq('anio', year);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function saveMeasurement(payload) {
  const { data, error } = await supabase.from('mediciones').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateMeasurement(id, payload) {
  const { data, error } = await supabase
    .from('mediciones')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertTarget(payload) {
  const { data, error } = await supabase
    .from('indicador_metas')
    .upsert(payload, { onConflict: 'indicador_id,anio,mes,escenario' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
