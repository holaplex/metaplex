import { Connection, Transaction } from '@solana/web3.js';

export const cleanName = (name?: string): string | undefined => {
  if (!name) {
    return undefined;
  }

  return name.replace(/\s+/g, '-');
};

export const getLast = <T>(arr: T[]) => {
  if (arr.length <= 0) {
    return undefined;
  }

  return arr[arr.length - 1];
};

export const calculateTransactionCost = async (
  connection: Connection,
  transaction: Transaction,
) => {
  const recentBlockhash = await connection.getRecentBlockhash();
  const lamportsPerSignature =
    recentBlockhash.feeCalculator.lamportsPerSignature; // Signature Cost
  const signatureCount = 1; // Let's assume only 1 signature is needed
  const initialCost = lamportsPerSignature * signatureCount;
  const allCosts = await Promise.all(
    transaction.instructions.map(instruction =>
      connection.getMinimumBalanceForRentExemption(instruction.data.byteLength),
    ),
  );
  return initialCost + allCosts.reduce((acc, curr) => acc + curr, 0);
};
