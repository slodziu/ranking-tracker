import { createClient } from '@supabase/supabase-js';
import { json } from '@sveltejs/kit';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$env/static/private';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const GET = async () => {
  const { data, error } = await supabase.from('clients').select('*');
  if (error) return json({ error: error.message }, { status: 500 });
  return json(data);
};

export const POST = async ({ request }) => {
  const { name, website_url, google_business_name } = await request.json();
  const { data, error } = await supabase
    .from('clients')
    .insert([{ name, website_url, google_business_name }])
    .select();
  if (error) return json({ error: error.message }, { status: 500 });
  return json(data[0]);
};