import { createClient } from '@supabase/supabase-js';
import { json } from '@sveltejs/kit';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$env/static/private';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const GET = async () => {
  const { data, error } = await supabase.from('keywords').select('id, keyword');
  if (error) return json({ error: error.message }, { status: 500 });
  return json(data);
};

export const POST = async ({ request }) => {
  const { keyword } = await request.json();
  const { data, error } = await supabase
    .from('keywords')
    .insert([{ keyword }])
    .select();
  if (error) return json({ error: error.message }, { status: 500 });
  return json(data[0]);
};

export const DELETE = async ({ request }) => {
  const { id } = await request.json();
  
  // First delete all related results (if cascade doesn't work)
  await supabase
    .from('results')
    .delete()
    .eq('keyword_id', id);
  
  // Then delete the keyword
  const { error } = await supabase
    .from('keywords')
    .delete()
    .eq('id', id);
    
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ success: true });

};