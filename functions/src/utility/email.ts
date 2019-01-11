import { config } from 'firebase-functions';
import { ServerClient } from 'postmark';

const postmark = new ServerClient(config().postmark.server_api_token);

export {
  postmark,
};
