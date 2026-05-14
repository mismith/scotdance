import { https } from 'firebase-functions';
import Typesense from 'typesense';

import { isEmulator } from './utility/env';
import { getConfig } from './utility/config';

let typesenseClient: InstanceType<typeof Typesense.Client>;
function getTypesense() {
  if (!typesenseClient) {
    typesenseClient = new Typesense.Client({
      nodes: [{
        host: isEmulator() ? 'localhost' : getConfig().typesense?.host,
        port: isEmulator() ? 8108 : 443,
        protocol: isEmulator() ? 'http' : 'https',
      }],
      apiKey: isEmulator() ? 'xyz' : getConfig().typesense?.api_key,
      connectionTimeoutSeconds: 60,
    });
  }
  return typesenseClient;
}

type EntityType = 'competitions' | 'dancers' | 'judges';
const ALL_TYPES: EntityType[] = ['competitions', 'dancers', 'judges'];

interface SearchAllParams {
  q?: string;
  perGroup?: number;
  types?: EntityType[];
}

export function getOnSearchAll(db: any) {
  return async function onSearchAll(params: SearchAllParams, ctx: any) {
    const q = (params?.q || '').trim();
    if (!q) {
      return { competitions: null, dancers: null, judges: null };
    }

    const perGroup = Math.min(Math.max(params?.perGroup ?? 5, 1), 50);
    const types = (params?.types && params.types.length ? params.types : ALL_TYPES)
      .filter((t): t is EntityType => ALL_TYPES.includes(t));

    const uid = ctx?.auth?.uid as string | undefined;

    // Permission set: admins see everything; everyone else sees published comps
    // plus any they own. Anonymous users get the published set only.
    const permissions = uid
      ? (await db.child(`users:permissions/${uid}`).get()).val()
      : null;
    const isAdmin = permissions?.admin === true;

    let authorizedCompIds: string[] | null = null;
    if (!isAdmin) {
      const publishedIds = Object.keys(
        (await db.child('competitions:published').get()).val() || {},
      );
      const ownedIds = uid
        ? Object.keys(permissions?.competitions || {})
        : [];
      authorizedCompIds = Array.from(new Set([...publishedIds, ...ownedIds]));
    }

    const idList = (authorizedCompIds || []).join();
    const compFilter = isAdmin ? undefined : `id:[${idList}]`;
    const childFilter = isAdmin ? undefined : `$competitionId:[${idList}]`;

    // Short-circuit: non-admin with no authorized comps → nothing to search.
    if (!isAdmin && (authorizedCompIds || []).length === 0) {
      return { competitions: null, dancers: null, judges: null };
    }

    const searches = types.map((type) => {
      if (type === 'competitions') {
        return {
          collection: 'competitions',
          q,
          query_by: 'name,venue,location,locality,region,country',
          filter_by: compFilter,
          per_page: perGroup,
        };
      }
      // dancers + judges share shape
      return {
        collection: type,
        q,
        query_by: '$name,firstName,lastName',
        filter_by: childFilter,
        per_page: perGroup,
        group_by: '$name',
        group_limit: 5,
      };
    });

    try {
      const response = await getTypesense().multiSearch.perform({ searches });
      const results = response?.results || [];
      const out: Record<EntityType, unknown> = {
        competitions: null,
        dancers: null,
        judges: null,
      };
      types.forEach((type, i) => {
        out[type] = results[i] ?? null;
      });
      return out;
    } catch (error: any) {
      throw new https.HttpsError('invalid-argument', error?.message, error);
    }
  };
}
