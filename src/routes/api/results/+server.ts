import { createClient } from '@supabase/supabase-js';
import { json } from '@sveltejs/kit';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$env/static/private';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('🔍 Environment check:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Found' : 'Missing');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Found' : 'Missing');
console.log('APP_PASSWORD:', process.env.APP_PASSWORD ? 'Found' : 'Missing');
export const GET = async ({ url }) => {
  const keywordId = url.searchParams.get('keyword_id');
  const days = url.searchParams.get('days');
  
  if (keywordId && days) {
    // Get historical data for specific keyword
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('results')
      .select('date, result_JSON')
      .eq('keyword_id', keywordId)
      .gte('date', startDate)
      .order('date', { ascending: true });
    if (error) return json({ error: error.message }, { status: 500 });
    return json(data);
  } else {
    // Get today's results (existing functionality)
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('results')
      .select('keyword_id, result_JSON')
      .eq('date', today);
    if (error) return json({ error: error.message }, { status: 500 });
    return json(data ?? []);
  }
};

export const POST = async ({ request }) => {
  const { keyword_id, result_JSON, date } = await request.json();
  const { data, error } = await supabase
    .from('results')
    .upsert([{ keyword_id, result_JSON, date }], { onConflict: ['keyword_id', 'date'] })
    .select();
  if (error) return json({ error: error.message }, { status: 500 });
  return json(data[0]);
};