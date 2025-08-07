import { createClient } from '@supabase/supabase-js';
import { json } from '@sveltejs/kit';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$env/static/private';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const GET = async ({ url }) => {
  const clientId = url.searchParams.get('client_id');
  const keywordId = url.searchParams.get('keyword_id');
  const days = url.searchParams.get('days');
  
  if (keywordId && days) {
    // Get historical data for specific client keyword
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('client_results')
      .select('date, result_JSON')
      .eq('client_keyword_id', keywordId)
      .gte('date', startDate)
      .order('date', { ascending: true });
    if (error) return json({ error: error.message }, { status: 500 });
    return json(data);
  } else if (clientId) {
    // Get today's results for client (existing functionality)
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('client_results')
      .select(`
        client_keyword_id,
        result_JSON,
        client_keywords!inner(keyword, client_id)
      `)
      .eq('client_keywords.client_id', clientId)
      .eq('date', today);
      
    if (error) return json({ error: error.message }, { status: 500 });
    return json(data ?? []);
  } else {
    return json({ error: 'client_id is required' }, { status: 400 });
  }
};

export const POST = async ({ request }) => {
  const { client_keyword_id, result_JSON, date } = await request.json();
  const { data, error } = await supabase
    .from('client_results')
    .upsert([{ client_keyword_id, result_JSON, date }], { onConflict: 'client_keyword_id,date' })
    .select();
  if (error) return json({ error: error.message }, { status: 500 });
  return json(data[0]);
};