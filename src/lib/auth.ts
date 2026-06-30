const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const REFRESH_TOKEN_KEY = 'goog_refresh_token';

let _token: string | null = null;

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function exchangeToken(body: Record<string, string>): Promise<{ access_token: string; refresh_token?: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...body }),
  });
  if (!response.ok) {
    const err = await response.json() as { error?: string; error_description?: string };
    throw new Error(err.error_description ?? err.error ?? 'Token exchange failed');
  }
  return response.json();
}

export async function redirectToSignIn(): Promise<void> {
  const verifier = generateCodeVerifier();
  sessionStorage.setItem('pkce_verifier', verifier);
  const challenge = await generateCodeChallenge(verifier);

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', window.location.origin);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');

  window.location.href = url.toString();
}

export async function handleOAuthCallback(): Promise<string | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    window.history.replaceState({}, '', window.location.pathname);
    throw new Error(error === 'access_denied' ? 'Sign-in cancelled' : `OAuth error: ${error}`);
  }

  if (!code) return null;

  const verifier = sessionStorage.getItem('pkce_verifier');
  if (!verifier) throw new Error('Session expired — please try signing in again');

  sessionStorage.removeItem('pkce_verifier');
  window.history.replaceState({}, '', window.location.pathname);

  const data = await exchangeToken({
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: window.location.origin,
  });

  if (data.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
  }
  _token = data.access_token;
  return _token;
}

// Silently restores the session using the stored refresh token.
// Returns the access token if successful, null if no refresh token is stored.
export async function restoreSession(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const data = await exchangeToken({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    _token = data.access_token;
    return _token;
  } catch {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return null;
  }
}

export function getToken(): string | null {
  return _token;
}

export function clearToken(): void {
  _token = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
