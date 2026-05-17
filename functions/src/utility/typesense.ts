import Typesense from 'typesense';

import { isEmulator } from './env';
import { getConfig } from './config';

let client: InstanceType<typeof Typesense.Client>;

export function getTypesense() {
  if (!client) {
    client = new Typesense.Client({
      nodes: [{
        host: isEmulator() ? 'localhost' : getConfig().typesense?.host,
        port: isEmulator() ? 8108 : 443,
        protocol: isEmulator() ? 'http' : 'https',
      }],
      apiKey: isEmulator() ? 'xyz' : getConfig().typesense?.api_key,
      connectionTimeoutSeconds: 60,
    });
  }
  return client;
}
