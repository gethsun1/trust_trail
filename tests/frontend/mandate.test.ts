import { describe, expect, it } from 'vitest';
import { Keypair, PublicKey } from '@solana/web3.js';
import { deriveMandate, parseExpiry, parsePublicKey, solToLamports, validatePolicy } from '../../lib/mandate';
import { PROGRAM_ID } from '../../lib/config';

const pubkey = () => Keypair.generate().publicKey.toBase58();
const validPolicy = () => ({ agent: pubkey(), recipient: pubkey(), maxPerTxSol: '0.1', dailyLimitSol: '0.5', expiresAt: new Date(Date.now() + 300_000).toISOString() });

describe('mandate client validation', () => {
  it('converts SOL decimal strings to exact integer lamports', () => { expect(solToLamports('1.000000001')).toBe(1_000_000_001n); });
  it('rejects zero, negative, precision overflow and u64 overflow', () => {
    for (const value of ['0', '-1', '1.0000000001', '18446744074']) expect(() => solToLamports(value)).toThrow();
  });
  it('rejects malformed public keys and validates policy fields', () => {
    expect(() => parsePublicKey('not a key')).toThrow();
    const policy = validPolicy();
    expect(validatePolicy(policy).agent).toBeInstanceOf(PublicKey);
    expect(() => validatePolicy({ ...policy, agent: '11111111111111111111111111111111' })).toThrow(/nonzero/);
    expect(() => validatePolicy(policy, undefined, new PublicKey(policy.agent))).toThrow(/separate/);
  });
  it('rejects per transaction limits above daily limit and nonfuture expiry', () => {
    expect(() => validatePolicy({ ...validPolicy(), maxPerTxSol: '2', dailyLimitSol: '1' })).toThrow(/Daily limit/);
    expect(() => parseExpiry('2020-01-01T00:00', 2_000_000_000)).toThrow(/future/);
  });
  it('derives mandate then vault from the program seed contract', () => {
    const owner = Keypair.generate().publicKey;
    const addresses = deriveMandate(owner, PROGRAM_ID);
    expect(addresses.mandate).toEqual(PublicKey.findProgramAddressSync([Buffer.from('mandate'), owner.toBuffer()], PROGRAM_ID)[0]);
    expect(addresses.vault).toEqual(PublicKey.findProgramAddressSync([Buffer.from('vault'), addresses.mandate.toBuffer()], PROGRAM_ID)[0]);
  });
});
