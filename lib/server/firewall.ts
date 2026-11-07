import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import idl from '../tr_mandate.json';
import { readMandate } from '../chain';
import { PROGRAM_ID } from '../config';
import { deriveMandate } from '../mandate';
import type { Intent } from './intent';

export type FirewallResult = { decision: 'APPROVE' | 'REJECT'; reasonCodes: string[]; explanation: string };
const reject = (reason: string): FirewallResult => ({ decision: 'REJECT', reasonCodes: [reason], explanation: explanations[reason] ?? 'The transaction could not be verified.' });
const explanations: Record<string, string> = {
  INTENT_TRANSACTION_MISMATCH: 'The proposed transaction does not match the validated payment intent.',
  UNSUPPORTED_PROGRAM: 'The transaction targets a program outside the supported mandate program.',
  UNEXPECTED_INSTRUCTION: 'Only one execute_payment instruction is allowed.',
  WRONG_RECIPIENT: 'The transaction recipient does not match the intent and active mandate.',
  AMOUNT_MISMATCH: 'The transaction amount does not match the intent.',
  INVALID_AGENT_SIGNER: 'The agent must be the only required signer and fee payer.',
  INVALID_MANDATE: 'The mandate or vault accounts do not match the derived addresses.',
  MANDATE_REVOKED: 'The mandate has been revoked.',
  MANDATE_EXPIRED: 'The mandate has expired.',
  PER_TRANSACTION_LIMIT_EXCEEDED: 'The payment exceeds the per-transaction mandate limit.',
  DAILY_LIMIT_EXCEEDED: 'The payment exceeds the remaining daily allowance.',
  NONCE_MISMATCH: 'The transaction nonce is stale.',
  INSUFFICIENT_VAULT_BALANCE: 'The vault does not have enough spendable SOL above its rent reserve.',
  UNVERIFIABLE_TRANSACTION: 'The unsigned transaction is malformed or uses an unsupported format.',
  MANDATE_STATE_UNAVAILABLE: 'Current mandate state could not be verified from the configured RPC.',
};

const paymentIdl = idl.instructions.find(item => item.name === 'execute_payment')!;
const discriminator = Buffer.from(paymentIdl.discriminator);

type MandateSnapshot = Awaited<ReturnType<typeof readMandate>>;
export async function inspectTransaction(input: { serializedTransaction: string; owner: string; intent: Intent; connection?: Connection; nowSeconds?: number; loadRecord?: (owner: PublicKey) => Promise<MandateSnapshot> }): Promise<FirewallResult> {
  try {
    if (input.intent.status !== 'ready' || input.intent.action !== 'native_sol_payment' || input.intent.asset !== 'SOL') return reject('INTENT_TRANSACTION_MISMATCH');
    const owner = new PublicKey(input.owner);
    const raw = Buffer.from(input.serializedTransaction, 'base64');
    if (raw.length === 0 || raw.length > 1232 || raw.toString('base64') !== input.serializedTransaction) return reject('UNVERIFIABLE_TRANSACTION');
    const transaction = Transaction.from(raw);
    if (!transaction.feePayer || transaction.instructions.length !== 1) return reject('UNEXPECTED_INSTRUCTION');
    if (transaction.signatures.some(item => item.signature !== null && !Buffer.from(item.signature).equals(Buffer.alloc(64)))) return reject('UNVERIFIABLE_TRANSACTION');
    const ix = transaction.instructions[0];
    if (!ix.programId.equals(PROGRAM_ID)) return reject('UNSUPPORTED_PROGRAM');
    const message = transaction.compileMessage();
    const requiredSigners = message.accountKeys.slice(0, message.header.numRequiredSignatures);
    if (requiredSigners.length !== 1 || !requiredSigners[0].equals(ix.keys[0]?.pubkey) || !transaction.feePayer.equals(ix.keys[0]?.pubkey) || !ix.keys[0]?.isSigner || !ix.keys[0]?.isWritable) return reject('INVALID_AGENT_SIGNER');
    if (ix.data.length !== 24 || !ix.data.subarray(0, 8).equals(discriminator)) return reject('UNVERIFIABLE_TRANSACTION');
    const accounts = paymentIdl.accounts;
    if (ix.keys.length !== accounts.length) return reject('INVALID_MANDATE');
    for (let index = 0; index < accounts.length; index++) {
      const expected = accounts[index];
      const actual = ix.keys[index];
      if (actual.isSigner !== Boolean(expected.signer) || actual.isWritable !== Boolean(expected.writable)) return reject('INVALID_MANDATE');
      if ('address' in expected && expected.address && !actual.pubkey.equals(new PublicKey(expected.address))) return reject('INVALID_MANDATE');
    }
    const amount = ix.data.readBigUInt64LE(8);
    const nonce = ix.data.readBigUInt64LE(16);
    if (amount.toString() !== input.intent.amountLamports) return reject('AMOUNT_MISMATCH');
    if (ix.keys[2].pubkey.toBase58() !== input.intent.recipient) return reject('WRONG_RECIPIENT');
    const { mandate, vault } = deriveMandate(owner, PROGRAM_ID);
    if (!ix.keys[1].pubkey.equals(mandate) || !ix.keys[3].pubkey.equals(vault) || !ix.keys[4].pubkey.equals(SystemProgram.programId)) return reject('INVALID_MANDATE');
    const connection = input.connection ?? new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
    const record = input.loadRecord ? await input.loadRecord(owner) : await readMandate(connection, owner);
    const state = record.state;
    if (!state) return reject('MANDATE_STATE_UNAVAILABLE');
    const agent = ix.keys[0].pubkey;
    if (!agent.equals(state.agent)) return reject('INVALID_AGENT_SIGNER');
    if (!state.recipient.equals(ix.keys[2].pubkey)) return reject('WRONG_RECIPIENT');
    if (state.revoked) return reject('MANDATE_REVOKED');
    let now = input.nowSeconds;
    if (now === undefined) {
      const slot = await connection.getSlot('confirmed');
      const blockTime = await connection.getBlockTime(slot);
      if (blockTime === null) return reject('MANDATE_STATE_UNAVAILABLE');
      now = blockTime;
    }
    if (BigInt(now) >= state.expiresAt) return reject('MANDATE_EXPIRED');
    if (nonce !== state.nonce || nonce === (1n << 64n) - 1n) return reject('NONCE_MISMATCH');
    if (amount > state.maxPerTx) return reject('PER_TRANSACTION_LIMIT_EXCEEDED');
    if (record.effectiveSpentToday + amount > state.dailyLimit) return reject('DAILY_LIMIT_EXCEEDED');
    if (amount > (record.vaultLamports > record.reserve ? record.vaultLamports - record.reserve : 0n)) return reject('INSUFFICIENT_VAULT_BALANCE');
    return { decision: 'APPROVE', reasonCodes: [], explanation: 'The unsigned transaction matches the intent and current mandate policy. It has not been signed or executed.' };
  } catch {
    return reject('MANDATE_STATE_UNAVAILABLE');
  }
}
