import {
  ArweaveTransaction,
  Storefront,
  ArweaveQueryResponse,
} from '@oyster/common';
import {
  createClient,
  RedisClientOptions,
  RedisModules,
  RedisScripts,
} from 'redis';
import moment from 'moment';
import { maybeCDN } from '../utils/cdn';

const ARWEAVE_URL = process.env.NEXT_PUBLIC_ARWEAVE_URL;
const REDIS_URL = process.env.REDIS_URL;
const REDIS_TLS_ENABLED = process.env.REDIS_TLS_ENABLED === 'true';

const fetchdenyListCacheKey = async () => {
  const res = await fetch('https://api.holaplex.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'getOwnerDenylist',
      params: [],
      id: 1337,
    }),
  });
  // @ts-ignore
  return await res.json();
};

const fetchFromSource = async (
  subdomain: string,
): Promise<Storefront | null> => {
  try {
    const response = await fetch(`${ARWEAVE_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
            query GetStorefrontTheme($subdomain: String!) {
              transactions(tags:[{ name: "holaplex:metadata:subdomain", values: [$subdomain]}], first: 1) {
                edges {
                  node {
                    id
                    tags {
                      name
                      value
                    }
                  }
                }
              }
            }
          `,
        variables: {
          subdomain,
        },
      }),
    });

    const {
      data: {
        transactions: {
          edges: [{ node }],
        },
      },
    } = (await response.json()) as ArweaveQueryResponse;
    const transaction = node as ArweaveTransaction;

    const values = transaction.tags.reduce((acc: any, tag) => {
      acc[tag.name] = tag.value || null;

      return acc;
    }, {});

    const storefront = {
      subdomain,
      pubkey: values['solana:pubkey'],
      theme: {
        logo: maybeCDN(values['holaplex:theme:logo:url']),
        banner: maybeCDN(values['holaplex:theme:banner:url'] || ''),
        stylesheet: maybeCDN(`${ARWEAVE_URL}/${transaction.id}`),
        color: {
          background: values['holaplex:theme:color:background'],
          primary: values['holaplex:theme:color:primary'],
        },
        font: {
          title: values['holaplex:theme:font:title'],
          text: values['holaplex:theme:font:text'],
        },
      },
      meta: {
        favicon: maybeCDN(
          values['holaplex:metadata:favicon:url'] || '/favicon-16x16.png',
        ),
        title:
          values['holaplex:metadata:page:title'] ||
          `Holaplex - ${subdomain} | NFT Marketplace`,
        description:
          values['holaplex:metadata:page:description'] ||
          'A NFT marketplace generated by Holaplex',
          mint:
            values['holaplex:metadata:page:mint'] ||
            `So11111111111111111111111111111111111111112`,
          mintname:
            values['holaplex:metadata:page:mintname'] ||
            'WSOL',
      },
      integrations: {
        crossmintClientId: values['crossmint:clientId'] || null,
      },
    };
    return storefront;
  } catch (err: any) {
    console.error(err);
    return null;
  }
};

const denyListCacheKey = 'ownerdenyListV1';

const denyList = async (client: any) => {
  let pubkeydenyList: Array<String> = [];
  try {
    const cachedValue = (await client.get(denyListCacheKey)) || '[]';
    pubkeydenyList = JSON.parse(cachedValue) || [];

    if (!pubkeydenyList.length) {
      const resp = await fetchdenyListCacheKey();
      pubkeydenyList = resp.result;
      client.set(
        denyListCacheKey,
        // @ts-ignore
        JSON.stringify(pubkeydenyList),
      );
      client.expire(denyListCacheKey, 300); // cache the entire list for 5 minutes
    }
  } catch (error) {
    console.error('failed to fetch denylist', error);
  }

  return pubkeydenyList;
};

export const getStorefront = async (
  subdomain: string,
): Promise<Storefront | undefined> => {
  let cached: Storefront | undefined = undefined;
  const redisClientOptions: RedisClientOptions<RedisModules, RedisScripts> = {
    url: REDIS_URL,
  };

  if (REDIS_TLS_ENABLED) {
    redisClientOptions.socket = {
      tls: true,
      rejectUnauthorized: false,
    };
  }

  const client = createClient(redisClientOptions);

  await client.connect();

  const [storefront, timestamp] = await Promise.all([
    client.get(subdomain),
    client.get(`${subdomain}-timestamp`),
  ]);

  if (storefront) {
    cached = JSON.parse(storefront);
  }

  const now = moment();
  const lastSavedAt = moment(timestamp);

  const duration = moment.duration(now.diff(lastSavedAt)).as('minutes');
  const denies = await denyList(client);

  if (duration < 2 && cached) {
    if (denies.includes(cached.pubkey)) {
      await client.quit();
      return undefined;
    }

    await client.quit();
    return cached;
  }

  const source = await fetchFromSource(subdomain);

  if (source) {
    await client
      .multi()
      .set(subdomain, JSON.stringify(source))
      .set(`${subdomain}-timestamp`, now.format())
      .exec();

    if (denies.includes(source.pubkey)) {
      await client.quit();
      return undefined;
    }

    await client.quit();
    return source;
  }

  await client.quit();

  return cached;
};
