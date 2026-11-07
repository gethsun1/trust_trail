import { describe, expect, it } from 'vitest';
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import idl from '../../lib/tr_mandate.json';
import { deriveMandate } from '../../lib/mandate';
import { PROGRAM_ID } from '../../lib/config';
import { inspectTransaction } from '../../lib/server/firewall';
import type { readMandate } from '../../lib/chain';
import type { Intent } from '../../lib/server/intent';

const owner = Keypair.generate().publicKey;
const agent = Keypair.generate().publicKey;
const recipient = Keypair.generate().publicKey;
const { mandate, vault } = deriveMandate(owner, PROGRAM_ID);
const intent: Intent = { action: 'native_sol_payment', asset: 'SOL', recipient: recipient.toBase58(), amountLamports: '100', missingFields: [], originalInstruction: 'send 100 lamports', status: 'ready' };
const instructionIdl = idl.instructions.find(item => item.name === 'execute_payment')!;

function makeTransaction(options: { programId?: PublicKey; amount?: bigint; nonce?: bigint; recipientKey?: PublicKey; order?: number[]; extra?: boolean; data?: Buffer } = {}) {
  const amount = Buffer.alloc(8); amount.writeBigUInt64LE(options.amount ?? 100n);
  const nonce = Buffer.alloc(8); nonce.writeBigUInt64LE(options.nonce ?? 4n);
  const accountKeys = [
    { pubkey: agent, isSigner: true, isWritable: true },
    { pubkey: mandate, isSigner: false, isWritable: true },
    { pubkey: options.recipientKey ?? recipient, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  const ix = new TransactionInstruction({
    programId: options.programId ?? PROGRAM_ID,
    keys: (options.order ?? [0, 1, 2, 3, 4]).map(index => accountKeys[index]),
    data: options.data ?? Buffer.concat([Buffer.from(instructionIdl.discriminator), amount, nonce]),
  });
  const tx = new Transaction({ feePayer: agent, recentBlockhash: Keypair.generate().publicKey.toBase58() }).add(ix);
  if (options.extra) tx.add(SystemProgram.transfer({ fromPubkey: agent, toPubkey: recipient, lamports: 1 }));
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
}

const state = (overrides: Record<string, unknown> = {}) => ({
  owner, agent, recipient, maxPerTx: 500n, dailyLimit: 1_000n, spentToday: 0n, dayIndex: 0n,
  expiresAt: 20_000n, nonce: 4n, revoked: false, ...overrides,
});
const fixture = (overrides: Record<string, unknown> = {}): Awaited<ReturnType<typeof readMandate>> => ({ state: state(overrides), vaultLamports: 2_000n, reserve: 100n, effectiveSpentToday: 100n } as unknown as Awaited<ReturnType<typeof readMandate>>);
const inspect = (serializedTransaction: string, record: Awaited<ReturnType<typeof readMandate>> = fixture()) => inspectTransaction({ serializedTransaction, owner: owner.toBase58(), intent, nowSeconds: 10_000, loadRecord: async () => record });
const reason = async (tx: string, record?: ReturnType<typeof fixture>) => (await inspect(tx, record)).reasonCodes[0];

describe('deterministic unsigned transaction firewall', () => {
  it('approves only the exact matching instruction and current policy', async () => expect((await inspect(makeTransaction())).decision).toBe('APPROVE'));
  it('rejects tampered instruction data', async () => expect(await reason(makeTransaction({ data: Buffer.alloc(24) }))).toBe('UNVERIFIABLE_TRANSACTION'));
  it('rejects changed account order', async () => expect(await reason(makeTransaction({ order: [1, 0, 2, 3, 4] }))).toBe('INVALID_AGENT_SIGNER'));
  it('rejects wrong program id and direct system transfer bypass', async () => {
    expect(await reason(makeTransaction({ programId: SystemProgram.programId }))).toBe('UNSUPPORTED_PROGRAM');
    expect(await reason(makeTransaction({ programId: SystemProgram.programId, extra: true }))).toBe('UNEXPECTED_INSTRUCTION');
  });
  it('rejects extra top-level instructions', async () => expect(await reason(makeTransaction({ extra: true }))).toBe('UNEXPECTED_INSTRUCTION'));
  it('rejects recipient and amount substitution', async () => {
    expect(await reason(makeTransaction({ recipientKey: Keypair.generate().publicKey }))).toBe('WRONG_RECIPIENT');
    expect(await reason(makeTransaction({ amount: 101n }))).toBe('AMOUNT_MISMATCH');
  });
  it('rejects stale nonce, revoked and expired mandate state', async () => {
    expect(await reason(makeTransaction({ nonce: 3n }))).toBe('NONCE_MISMATCH');
    expect(await reason(makeTransaction(), fixture({ revoked: true }))).toBe('MANDATE_REVOKED');
    expect(await reason(makeTransaction(), fixture({ expiresAt: 10_000n }))).toBe('MANDATE_EXPIRED');
  });
  it('rejects per transaction limit, daily allowance and insufficient spendable vault', async () => {
    expect(await reason(makeTransaction(), fixture({ maxPerTx: 99n }))).toBe('PER_TRANSACTION_LIMIT_EXCEEDED');
    expect(await reason(makeTransaction(), fixture({ dailyLimit: 150n }))).toBe('DAILY_LIMIT_EXCEEDED');
    expect(await reason(makeTransaction(), { ...fixture(), vaultLamports: 100n } as Awaited<ReturnType<typeof readMandate>>)).toBe('INSUFFICIENT_VAULT_BALANCE');
  });
  it('rejects missing mandate state', async () => expect(await reason(makeTransaction(), { ...fixture(), state: null } as Awaited<ReturnType<typeof readMandate>>)).toBe('MANDATE_STATE_UNAVAILABLE'));
});
