import { redirect } from '@sveltejs/kit';
import { APP_PASSWORD } from '$env/static/private';

const SIMPLE_PASSWORD = APP_PASSWORD || 'your-team-password';

export async function handle({ event, resolve }) {
  const url = event.url;
  
  // Skip auth for login page AND API routes
  if (url.pathname === '/login' || url.pathname.startsWith('/api/')) {
    return resolve(event);
  }
  
  // Check if user is authenticated
  const sessionPassword = event.cookies.get('app-auth');
  
  if (sessionPassword !== SIMPLE_PASSWORD) {
    throw redirect(302, '/login');
  }
  
  return resolve(event);
}