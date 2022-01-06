import { Connection, PublicKey } from '@solana/web3.js';
import {
  getHandleAndRegistryKey,
  performReverseLookup,
} from '@bonfida/spl-name-service';

import { toPublicKey, StringPublicKey } from '../utils';

export const getTwitterHandle = async (
  connection: Connection,
  pubkey: StringPublicKey,
): Promise<string | undefined> => {
  try {
    const [twitterHandle] = await getHandleAndRegistryKey(
      connection,
      toPublicKey(pubkey),
    );
    return twitterHandle;
  } catch (err) {
    return undefined;
  }
};

export async function findOwnedNameAccountsForUser(
  connection: Connection,
  userAccount: PublicKey,
): Promise<PublicKey[]> {
  const NAME_PROGRAM_ID = new PublicKey(
    'namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX',
  );

  const filters = [
    {
      memcmp: {
        offset: 32,
        bytes: userAccount.toBase58(),
      },
    },
  ];
  const accounts = await connection.getProgramAccounts(NAME_PROGRAM_ID, {
    filters,
  });
  return accounts.map(a => a.pubkey);
}

export const getSolDomain = async (
  connection: Connection,
  pubkey: StringPublicKey,
): Promise<string | undefined> => {
  const allDomainsForPubkey = await findOwnedNameAccountsForUser(
    connection,
    new PublicKey(pubkey),
  );

  for (const domainPk of allDomainsForPubkey) {
    try {
      const solDomain = await performReverseLookup(connection, domainPk);
      if (solDomain) {
        return solDomain;
      }
    } catch (error) {
      continue;
    }
  }

  return undefined;

  //  alt implementation depending on the answer from BonFida
  // try {
  //   const solDomain = await performReverseLookup(
  //     connection,
  //     allDomainsForPubkey[1],
  //   );
  //   if (solDomain) {
  //     return solDomain;
  //   }
  // } catch (error) {
  //   return undefined;
  // }
};
