import { json } from '@sveltejs/kit';
import { APP_PASSWORD } from '$env/static/private';

// Use the SvelteKit way to import env vars, with fallback
const SIMPLE_PASSWORD = APP_PASSWORD || 'your-team-password';

export const POST = async ({ request, cookies }) => {
  const { password } = await request.json();
  
  // Debug logging
  console.log('🔐 Login attempt:');
  console.log('Received password:', password);
  console.log('Expected password:', SIMPLE_PASSWORD);
  console.log('APP_PASSWORD from env:', APP_PASSWORD);
  console.log('Match:', password === SIMPLE_PASSWORD);
  
  if (password === SIMPLE_PASSWORD) {
    cookies.set('app-auth', password, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: true,
      secure: false,
      sameSite: 'strict'
    });
    
    return json({ success: true });
  }
  
  return json({ error: 'Invalid password' }, { status: 401 });
};