import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { keyword, apiKey } = await request.json();

        const params = new URLSearchParams({
            q: keyword,
            engine: 'google',
            api_key: apiKey,
            gl: 'uk',
            hl: 'en'
        });

        let resp;

        try {
            resp = await fetch(`https://serpapi.com/search.json?${params}`);
        } catch (err) {
            console.error('SerpApi fetch error:', err);
            return new Response(
                JSON.stringify({ error: 'SerpApi fetch failed', details: String(err) }),
                { status: 500 }
            );
        }

        if (!resp.ok) {
            return new Response(
                JSON.stringify({ error: 'SerpApi error', status: resp.status }),
                { status: 500 }
            );
        }
        const data = await resp.json();

        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: String(err) }),
            { status: 500 }
        );
    }
};