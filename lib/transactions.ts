import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

export async function prepareOwnerTransaction(connection: Connection, owner: PublicKey, instruction: TransactionInstruction) {
  const latest = await connection.getLatestBlockhash('confirmed');
  const transaction = new Transaction({ feePayer: owner, ...latest }).add(instruction);
  const fee = await connection.getFeeForMessage(transaction.compileMessage(), 'confirmed');
  if (fee.value === null) throw new Error('Could not estimate the transaction fee.');
  return { transaction, latest, feeLamports: fee.value };
}
export function walletErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /reject|declin|cancel/i.test(message) ? 'Wallet approval was rejected.' : message;
}
