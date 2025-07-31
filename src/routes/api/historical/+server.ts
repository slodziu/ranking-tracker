import { createClient } from '@supabase/supabase-js';
import { json } from '@sveltejs/kit';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$env/static/private';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const GET = async ({ url }) => {
  const type = url.searchParams.get('type'); // 'purplefish' or 'client'
  const clientId = url.searchParams.get('client_id');
  const days = parseInt(url.searchParams.get('days') || '30');

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  if (type === 'purplefish') {
    const { data, error } = await supabase
      .from('results')
      .select(`
        date,
        result_JSON,
        keywords!inner(id, keyword)
      `)
      .gte('date', startDate)
      .order('date', { ascending: true });
    
    if (error) return json({ error: error.message }, { status: 500 });
    return json(data);
  } else if (type === 'client' && clientId) {
    const { data, error } = await supabase
      .from('client_results')
      .select(`
        date,
        result_JSON,
        client_keywords!inner(id, keyword, client_id)
      `)
      .eq('client_keywords.client_id', clientId)
      .gte('date', startDate)
      .order('date', { ascending: true });
    
    if (error) return json({ error: error.message }, { status: 500 });
    return json(data);
  }

  return json({ error: 'Invalid parameters' }, { status: 400 });
};