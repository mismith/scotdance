/** The version the MCP server reports to assistants */
export const SERVER_VERSION = '0.1.0';

/**
 * The public origin everything is served from (Hosting rewrites to the `mcp` function), with no trailing slash.
 * This is the one place it lives: set MCP_ORIGIN, or change the default, to move it (to https://scotdance.app at
 * launch). In the emulator it is the local web app.
 */
export const issuer = () => (
  process.env.MCP_ORIGIN
  || (process.env.FUNCTIONS_EMULATOR ? 'http://localhost:5273' : 'https://next.scotdance.app')
).replace(/\/+$/, '');

/** The address assistants are given, and the one tokens are for (the OAuth `resource`) */
export const resource = () => `${issuer()}/mcp`;

/**
 * Running in the Functions emulator, never in production: the emulator sets both of these, and `emulated()` unlocks
 * `dev:` tokens and loopback client documents.
 */
export const emulated = () => process.env.FUNCTIONS_EMULATOR === 'true' && Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

/** The web app's API key. It is public (it ships in the app), and Identity Toolkit needs it to sign in with a custom token. */
const WEB_API_KEY = 'AIzaSyCxvA2RMvlCQ3WCzAqPotD8IOhnmCtQ1xM';

/** Where the assistant's session talks to Identity Toolkit and the Realtime Database (mcp/session.ts) */
export function endpoints(): { signIn: string; database: string; } {
  const authHost = emulated() ? process.env.FIREBASE_AUTH_EMULATOR_HOST : undefined;
  const dbHost = emulated() ? process.env.FIREBASE_DATABASE_EMULATOR_HOST : undefined;
  const key = process.env.WEB_API_KEY || (authHost ? 'demo' : WEB_API_KEY);
  return {
    signIn: `${authHost ? `http://${authHost}/` : 'https://'}identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${key}`,
    database: dbHost ? `http://${dbHost}` : 'https://scotdance.firebaseio.com',
  };
}
