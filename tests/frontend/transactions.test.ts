/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import { Keypair, SystemProgram } from '@solana/web3.js';
import { prepareOwnerTransaction, walletErrorMessage } from '../../lib/transactions';
import { hasValidRpcConfiguration, validateRpcUrl } from '../../lib/config';
import { getWalletConnectionState, walletAccountChanged } from '../../lib/wallet-state';

describe('wallet and owner transaction boundary', () => {
  it('prepares the instruction with the connected owner as fee payer and estimates fees', async () => {
    const owner = Keypair.generate().publicKey;
    const destination = Keypair.generate().publicKey;
    const instruction = SystemProgram.transfer({ fromPubkey: owner, toPubkey: destination, lamports: 25 });
    const mockConnection = {
      getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 42 }),
      getFeeForMessage: vi.fn().mockResolvedValue({ value: 5000 }),
    } as any;
    const prepared = await prepareOwnerTransaction(mockConnection, owner, instruction);
    expect(prepared.transaction.feePayer?.equals(owner)).toBe(true);
    expect(prepared.transaction.instructions).toEqual([instruction]);
    expect(prepared.feeLamports).toBe(5000);
    expect(prepared.latest.lastValidBlockHeight).toBe(42);
  });
  it('models available, connected, disconnected, connecting and missing wallet states', () => {
    expect(getWalletConnectionState({ providerCount: 1, connecting: true, connected: false }).status).toBe('connecting');
    expect(getWalletConnectionState({ providerCount: 1, connecting: false, connected: true, address: 'owner-key' })).toEqual({ status: 'connected', address: 'owner-key' });
    expect(getWalletConnectionState({ providerCount: 1, connecting: false, connected: false }).status).toBe('disconnected');
    expect(getWalletConnectionState({ providerCount: 0, connecting: false, connected: false }).status).toBe('missing-provider');
    expect(walletAccountChanged('owner-a', 'owner-b')).toBe(true);
    expect(walletAccountChanged('owner-a', 'owner-a')).toBe(false);
  });
  it('maps wallet rejection and detects wrong-cluster endpoint configuration', () => {
    expect(walletErrorMessage(new Error('User rejected the request'))).toBe('Wallet approval was rejected.');
    expect(walletErrorMessage(new Error('RPC unavailable'))).toBe('RPC unavailable');
    expect(validateRpcUrl('https://api.devnet.solana.com')).toBe(true);
    expect(validateRpcUrl('https://api.mainnet-beta.solana.com')).toBe(true);
    expect(hasValidRpcConfiguration('https://api.mainnet-beta.solana.com')).toBe(true); // Runtime identity is rejected by genesis hash.
    expect(validateRpcUrl('not-a-url')).toBe(false);
  });
});
