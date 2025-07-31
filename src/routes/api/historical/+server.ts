import { createClient } from '@supabase/supabase-js';
import { json } from '@sveltejs/kit';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$env/static/private';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const GET = async ({ url }) => {
  const type = url.searchParams.get('type');
  const days = url.searchParams.get('days');
  const clientId = url.searchParams.get('client_id');
  const dateFrom = url.searchParams.get('date_from');
  const dateTo = url.searchParams.get('date_to');

  try {
    let startDate: string;
    let endDate: string;

    // Determine date range
    if (dateFrom && dateTo) {
      // Custom date range
      startDate = dateFrom;
      endDate = dateTo;
    } else if (days === 'all') {
      // All time - go back 2 years max
      startDate = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      endDate = new Date().toISOString().slice(0, 10);
    } else {
      // Days-based range
      const daysNum = parseInt(days || '30');
      startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      endDate = new Date().toISOString().slice(0, 10);
    }

    console.log('📅 Date range:', { startDate, endDate, type, clientId });

    if (type === 'purplefish') {
      // Get Purplefish data
      const { data, error } = await supabase
        .from('results')
        .select(`
          date,
          result_JSON,
          keywords!inner (
            id,
            keyword
          )
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .not('result_JSON', 'is', null)
        .order('date', { ascending: true });

      if (error) throw error;
      return json(data || []);

    } else if (type === 'client' && clientId) {
      // Get client data
      const { data, error } = await supabase
        .from('client_results')
        .select(`
          date,
          result_JSON,
          client_keywords!inner (
            id,
            keyword,
            client_id
          )
        `)
        .eq('client_keywords.client_id', parseInt(clientId))
        .gte('date', startDate)
        .lte('date', endDate)
        .not('result_JSON', 'is', null)
        .order('date', { ascending: true });

      if (error) throw error;
      return json(data || []);
    }

    return json({ error: 'Invalid parameters' }, { status: 400 });

  } catch (error) {
    console.error('Historical data error:', error);
    return json({ error: error.message }, { status: 500 });
  }
};