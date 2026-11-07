import { describe, expect, it, vi } from 'vitest';
import { DEVNET_GENESIS_HASH } from '../../lib/config';
import { verifyDevnetIdentity } from '../../lib/network';
import { hasValidRpcConfiguration, validateRpcUrl } from '../../lib/config';

describe('authoritative network identity checks', () => {
  it('accepts the known Devnet genesis hash', async () => {
    await expect(verifyDevnetIdentity({ getGenesisHash: vi.fn().mockResolvedValue(DEVNET_GENESIS_HASH) })).resolves.toMatchObject({ status: 'verified', genesisHash: DEVNET_GENESIS_HASH });
  });
  it('rejects a Mainnet or Localnet genesis hash regardless of URL', async () => {
    await expect(verifyDevnetIdentity({ getGenesisHash: vi.fn().mockResolvedValue('mainnet-or-localnet-hash') })).resolves.toMatchObject({ status: 'wrong-cluster' });
  });
  it('fails closed for rejected, hung and timed-out RPC identity checks', async () => {
    await expect(verifyDevnetIdentity({ getGenesisHash: vi.fn().mockRejectedValue(new Error('offline')) })).resolves.toMatchObject({ status: 'unavailable' });
    await expect(verifyDevnetIdentity({ getGenesisHash: () => new Promise(() => {}) }, 5)).resolves.toMatchObject({ status: 'unavailable' });
  });
  it('rejects malformed and insecure endpoint configuration without accepting URL-name hints', () => {
    expect(validateRpcUrl('https://api.devnet.solana.com')).toBe(true);
    expect(validateRpcUrl('https://user:password@rpc.example')).toBe(false);
    expect(validateRpcUrl('http://localhost:8899')).toBe(false);
    expect(validateRpcUrl('not a URL')).toBe(false);
    expect(hasValidRpcConfiguration(undefined)).toBe(true);
    expect(hasValidRpcConfiguration('malformed')).toBe(false);
    expect(hasValidRpcConfiguration('https://api.mainnet-beta.solana.com')).toBe(true);
  });
});
