import { ServerClient } from 'postmark';
import { getConfig } from './config';

let postmarkClient: ServerClient;
export function getPostmark() {
  if (!postmarkClient) {
    postmarkClient = new ServerClient(getConfig().postmark?.server_api_token ?? 'MISSING');
  }
  return postmarkClient;
}
