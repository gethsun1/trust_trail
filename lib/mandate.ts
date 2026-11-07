import { PublicKey } from '@solana/web3.js';
import { z } from 'zod';

export const U64_MAX = (1n << 64n) - 1n;
export const I64_MAX = (1n << 63n) - 1n;
export const policySchema = z.object({
  agent: z.string().min(1), recipient: z.string().min(1),
  maxPerTxSol: z.string().regex(/^\d+(\.\d{1,9})?$/),
  dailyLimitSol: z.string().regex(/^\d+(\.\d{1,9})?$/), expiresAt: z.string().min(1),
});
export function parsePublicKey(value: string): PublicKey {
  try { return new PublicKey(value); } catch { throw new Error('Enter a valid Solana public key.'); }
}
export function solToLamports(value: string): bigint {
  if (!/^\d+(\.\d{1,9})?$/.test(value)) throw new Error('Enter a positive SOL amount with up to 9 decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * 1_000_000_000n + BigInt((fraction + '000000000').slice(0, 9));
  if (amount <= 0n) throw new Error('Amount must be greater than zero.');
  if (amount > U64_MAX) throw new Error('Amount exceeds the program u64 limit.');
  return amount;
}
export function parseExpiry(value: string, now = Math.floor(Date.now() / 1000)): bigint {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Choose a valid expiry date and time.');
  const seconds = BigInt(Math.floor(date.getTime() / 1000));
  if (seconds <= BigInt(now)) throw new Error('Expiry must be in the future.');
  if (seconds > I64_MAX) throw new Error('Expiry exceeds the program i64 limit.');
  return seconds;
}
export function validatePolicy(input: z.infer<typeof policySchema>, now?: number, owner?: PublicKey) {
  const data = policySchema.parse(input);
  const agent = parsePublicKey(data.agent);
  const recipient = parsePublicKey(data.recipient);
  if (agent.equals(PublicKey.default) || recipient.equals(PublicKey.default)) throw new Error('Agent and recipient public keys must be nonzero.');
  if (owner && agent.equals(owner)) throw new Error('Agent identity must be separate from the owner wallet.');
  const maxPerTx = solToLamports(data.maxPerTxSol);
  const dailyLimit = solToLamports(data.dailyLimitSol);
  if (maxPerTx > dailyLimit) throw new Error('Daily limit must be at least the per-transaction limit.');
  return { agent, recipient, maxPerTx, dailyLimit, expiresAt: parseExpiry(data.expiresAt, now) };
}
export function deriveMandate(owner: PublicKey, programId: PublicKey) {
  const [mandate] = PublicKey.findProgramAddressSync([Buffer.from('mandate'), owner.toBuffer()], programId);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from('vault'), mandate.toBuffer()], programId);
  return { mandate, vault };
}
export function lamportsToSolInput(lamports: bigint | number) {
  const value = BigInt(lamports);
  const whole = value / 1_000_000_000n;
  const fraction = (value % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
export function formatSol(lamports: bigint | number) {
  const value = BigInt(lamports);
  const whole = value / 1_000_000_000n;
  const fraction = (value % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  const localized = new Intl.NumberFormat().format(whole);
  return fraction ? `${localized}.${fraction}` : localized;
}
