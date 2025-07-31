import { createClient } from '@supabase/supabase-js';
import { json } from '@sveltejs/kit';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$env/static/private';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const GET = async ({ url }) => {
  const clientId = url.searchParams.get('client_id');
  const { data, error } = await supabase
    .from('client_keywords')
    .select('*')
    .eq('client_id', clientId);
  if (error) return json({ error: error.message }, { status: 500 });
  return json(data);
};

export const POST = async ({ request }) => {
  const { client_id, keyword } = await request.json();
  const { data, error } = await supabase
    .from('client_keywords')
    .insert([{ client_id, keyword }])
    .select();
  if (error) return json({ error: error.message }, { status: 500 });
  return json(data[0]);
};

// Add DELETE method
export const DELETE = async ({ request }) => {
  const { id } = await request.json();
  
  // First delete all related client results (if cascade doesn't work)
  await supabase
    .from('client_results')
    .delete()
    .eq('client_keyword_id', id);
  
  // Then delete the client keyword
  const { error } = await supabase
    .from('client_keywords')
    .delete()
    .eq('id', id);
    
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ success: true });
};