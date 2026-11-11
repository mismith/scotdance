import type { Scope } from '../oauth/common';

/** What a verified access token stands for: one account's connection of one assistant (ADR 0018) */
export interface Access {
  /** users:connections/{uid}/{connection} */
  connection: string;
  uid: string;
  scope: Scope;
  client: { id: string; name: string };
}
