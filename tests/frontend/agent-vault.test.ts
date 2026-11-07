import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { clearAgentSecretMemory, createEncryptedBackup, loadBackups, parseEncryptedBackup, restoreEncryptedBackup, saveBackup } from '../../lib/agent-vault';

describe('encrypted agent backups', () => {
  it('clears the referenced in-memory secret buffer on explicit lock/unload', () => {
    const secret = new Uint8Array(64).fill(7);
    clearAgentSecretMemory(secret);
    expect(secret.every(byte => byte === 0)).toBe(true);
  });
  it('uses authenticated encryption with random salt and IV and validates identity metadata', async () => {
    const pair = Keypair.generate();
    const first = await createEncryptedBackup(pair.secretKey, pair.publicKey.toBase58(), 'correct horse battery staple');
    const second = await createEncryptedBackup(pair.secretKey, pair.publicKey.toBase58(), 'correct horse battery staple');
    expect(Object.keys(first).sort()).toEqual(['ciphertext', 'iterations', 'iv', 'publicKey', 'salt', 'version']);
    expect(first.ciphertext).not.toContain(Buffer.from(pair.secretKey).toString('base64'));
    expect(first.salt).not.toBe(first.iv);
    expect(first.iterations).toBe(600_000);
    expect(atob(first.salt).length).toBe(16);
    expect(atob(first.iv).length).toBe(12);
    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(await restoreEncryptedBackup(first, 'correct horse battery staple')).toEqual(pair.secretKey);
    expect(() => parseEncryptedBackup({ ...first, secretKey: Array.from(pair.secretKey) })).toThrow();
    await expect(createEncryptedBackup(pair.secretKey, Keypair.generate().publicKey.toBase58(), 'correct horse battery staple')).rejects.toThrow();
  });
  it('rejects incorrect passphrases, corrupted ciphertext and mismatched restored identity', async () => {
    const pair = Keypair.generate();
    const backup = await createEncryptedBackup(pair.secretKey, pair.publicKey.toBase58(), 'another long passphrase');
    await expect(restoreEncryptedBackup(backup, 'wrong passphrase')).rejects.toThrow(/unlock/);
    await expect(restoreEncryptedBackup({ ...backup, ciphertext: 'AAAA' }, 'another long passphrase')).rejects.toThrow();
    await expect(restoreEncryptedBackup({ ...backup, publicKey: Keypair.generate().publicKey.toBase58() }, 'another long passphrase')).rejects.toThrow(/unlock/);
  });
  it('recovers a saved encrypted backup from IndexedDB in a fresh read session', async () => {
    const pair = Keypair.generate();
    const backup = await createEncryptedBackup(pair.secretKey, pair.publicKey.toBase58(), 'fresh session recovery phrase');
    await saveBackup(backup);
    const reloaded = await loadBackups();
    const found = reloaded.find(entry => entry.publicKey === pair.publicKey.toBase58());
    expect(found).toBeDefined();
    expect(Object.keys(found!).sort()).toEqual(['ciphertext', 'iterations', 'iv', 'publicKey', 'salt', 'version']);
    const secret = await restoreEncryptedBackup(found!, 'fresh session recovery phrase');
    expect(Keypair.fromSecretKey(secret).publicKey.toBase58()).toBe(pair.publicKey.toBase58());
  });
});
