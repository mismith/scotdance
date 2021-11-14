import { config } from 'firebase-functions';
import { ServerClient } from 'postmark';

export const postmark = new ServerClient(config().postmark.server_api_token);
