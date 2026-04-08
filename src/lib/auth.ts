const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TokenClient = any;

let _tokenClient: TokenClient = null;
let _token: string | null = null;

export function initAuth(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const google = (window as any).google;
  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: () => {},
  });
}

export function getToken(): string | null {
  return _token;
}

export function requestToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!_tokenClient) {
      reject(new Error('Google sign-in not ready yet — please try again'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Sign-in timed out — check that this origin is authorised in your Google OAuth client'));
    }, 30_000);

    _tokenClient.callback = (resp: { error?: string; access_token: string }) => {
      clearTimeout(timeout);
      if (resp.error) return reject(new Error(`OAuth error: ${resp.error}`));
      _token = resp.access_token;
      resolve(_token);
    };
    // Prompt only on first sign-in; silent refresh thereafter
    _tokenClient.requestAccessToken({ prompt: _token ? '' : 'consent' });
  });
}

export function clearToken(): void {
  if (_token) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).google.accounts.oauth2.revoke(_token, () => {});
    _token = null;
  }
}
