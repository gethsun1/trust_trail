import { PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const intentSchema = z.object({
  action: z.enum(['native_sol_payment', 'unsupported', 'clarification_required']),
  asset: z.enum(['SOL', 'unsupported', 'unspecified']),
  recipient: z.string().nullable(),
  amountLamports: z.string().nullable(),
  missingFields: z.array(z.enum(['recipient', 'amount'])),
}).strict();

export type Intent = z.infer<typeof intentSchema> & {
  originalInstruction: string;
  status: 'ready' | 'clarification_required' | 'unsupported';
};

function canonicalIntent(intent: Intent): string {
  return JSON.stringify({ action: intent.action, asset: intent.asset, recipient: intent.recipient, amountLamports: intent.amountLamports, missingFields: intent.missingFields, status: intent.status, originalInstruction: intent.originalInstruction });
}

export function signIntent(intent: Intent): string {
  const secret = process.env.GROQ_API_KEY;
  if (!secret) throw new Error('AI_NOT_CONFIGURED');
  return createHmac('sha256', secret).update(canonicalIntent(intent)).digest('base64url');
}

export function verifySignedIntent(intent: unknown, token: unknown): intent is Intent {
  if (typeof token !== 'string' || token.length > 128) return false;
  try {
    const parsed = intentSchema.extend({ originalInstruction: z.string().min(1).max(4_000), status: z.enum(['ready', 'clarification_required', 'unsupported']) }).strict().parse(intent);
    const normalized = validateIntent({ action: parsed.action, asset: parsed.asset, recipient: parsed.recipient, amountLamports: parsed.amountLamports, missingFields: parsed.missingFields }, parsed.originalInstruction);
    if (canonicalIntent(normalized) !== canonicalIntent(parsed) || normalized.status !== 'ready') return false;
    const expected = Buffer.from(signIntent(normalized));
    const supplied = Buffer.from(token);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  } catch { return false; }
}

const U64_MAX = (1n << 64n) - 1n;
const KEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function validateIntent(value: unknown, originalInstruction: string): Intent {
  const parsed = intentSchema.parse(value);
  const mentionedKeys = [...new Set(originalInstruction.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g) ?? [])];
  if (/\b(swap|exchange|token|spl|usdc|usdt|nft|contract call|smart contract|multiple recipients)\b/i.test(originalInstruction) || mentionedKeys.length > 1) {
    return { ...parsed, action: 'unsupported', asset: 'unsupported', status: 'unsupported', originalInstruction };
  }
  if (parsed.action === 'unsupported' || parsed.asset === 'unsupported') {
    return { ...parsed, status: 'unsupported', originalInstruction };
  }
  if (parsed.action === 'clarification_required' || parsed.asset === 'unspecified') {
    return { ...parsed, status: 'clarification_required', originalInstruction };
  }
  const missing = new Set(parsed.missingFields);
  if (parsed.recipient !== null) {
    if (!KEY.test(parsed.recipient)) throw new Error('INVALID_RECIPIENT');
    try {
      if (new PublicKey(parsed.recipient).equals(PublicKey.default)) throw new Error('INVALID_RECIPIENT');
    } catch { throw new Error('INVALID_RECIPIENT'); }
  }
  if (parsed.amountLamports !== null) {
    if (!/^[1-9]\d*$/.test(parsed.amountLamports)) throw new Error('INVALID_AMOUNT');
    const amount = BigInt(parsed.amountLamports);
    if (amount <= 0n || amount > U64_MAX) throw new Error('INVALID_AMOUNT');
  }
  if (parsed.recipient === null) missing.add('recipient');
  if (parsed.amountLamports === null) missing.add('amount');
  if (parsed.recipient && (!originalInstruction.includes(parsed.recipient) || (mentionedKeys.length === 1 && mentionedKeys[0] !== parsed.recipient))) {
    parsed.recipient = null;
    missing.add('recipient');
  }
  if (parsed.amountLamports !== null) {
    const spokenAmounts = [...originalInstruction.matchAll(/(?:^|\s)(\d+(?:\.\d{1,9})?)\s*SOL\b/gi)];
    if (spokenAmounts.length !== 1) {
      parsed.amountLamports = null;
      missing.add('amount');
    } else {
      const [whole, fraction = ''] = spokenAmounts[0][1].split('.');
      const explicitLamports = BigInt(whole) * 1_000_000_000n + BigInt((fraction + '000000000').slice(0, 9));
      if (explicitLamports.toString() !== parsed.amountLamports) {
        parsed.amountLamports = null;
        missing.add('amount');
      }
    }
  }
  if (missing.size > 0) return { ...parsed, missingFields: [...missing], status: 'clarification_required', originalInstruction };
  if (parsed.missingFields.length !== 0) throw new Error('INVALID_INTENT');
  return { ...parsed, status: 'ready', originalInstruction };
}
