import { InvalidRequestError, OAuthError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { getClient } from './cimd';
import { exchangeCode, exchangeRefresh, revoke } from './tokens';

/**
 * What the SDK's token and revocation handlers need from us. /oauth/authorize is our own handler (authorize.ts),
 * and the MCP endpoint checks bearer tokens itself, so those two methods are never reached.
 */
/** The SDK turns any unexpected error into a bare 500; this leaves a note of what kind in the logs */
const logged =
  <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
  async (...args: A): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (!(error instanceof OAuthError))
        console.error('oauth token request failed', error instanceof Error ? error.name : 'unknown');
      throw error;
    }
  };

export const provider: OAuthServerProvider = {
  clientsStore: { getClient },
  // We check PKCE ourselves, inside the transaction that uses the code up. The SDK's own check reads the code
  // first and would leave it usable after a wrong verifier.
  skipLocalPkceValidation: true,
  async authorize() {
    throw new InvalidRequestError('Not used');
  },
  async challengeForAuthorizationCode() {
    throw new InvalidRequestError('Not used');
  },
  // Every check on the code (client, redirect_uri, resource, verifier) happens inside exchangeCode, after the
  // code is marked used, so any failure burns it
  exchangeAuthorizationCode: logged((client, code, verifier, redirectUri, resource) =>
    exchangeCode(client.client_id, code, verifier, redirectUri, resource),
  ),
  exchangeRefreshToken: logged((client, token, scopes, resource) =>
    exchangeRefresh(client.client_id, token, scopes, resource),
  ),
  async verifyAccessToken() {
    throw new InvalidTokenError('Not used');
  },
  revokeToken: logged((client, request) => revoke(client.client_id, request.token)),
};
