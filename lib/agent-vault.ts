import { Keypair } from '@solana/web3.js';
import { z } from 'zod';

const DB_NAME = 'tr-agent-backups';
const STORE = 'identities';
const ITERATIONS = 600_000;
const encoder = new TextEncoder();
const source = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer as ArrayBuffer;
const backupSchema = z.object({
  version: z.literal(1), publicKey: z.string().min(32).max(44), salt: z.string().length(24).regex(/^[A-Za-z0-9+/]{22}==$/),
  iv: z.string().length(16).regex(/^[A-Za-z0-9+/]{16}$/), iterations: z.literal(ITERATIONS), ciphertext: z.string().length(108).regex(/^[A-Za-z0-9+/]{107}=$/),
}).strict();
export type EncryptedBackup = z.infer<typeof backupSchema>;
export function clearAgentSecretMemory(secret: Uint8Array) { secret.fill(0); }
const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
export function parseEncryptedBackup(value: unknown): EncryptedBackup { return backupSchema.parse(value); }
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'publicKey' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not open encrypted identity storage.'));
  });
}
async function deriveKey(passphrase: string, salt: Uint8Array) {
  if (passphrase.length < 12) throw new Error('Use a passphrase with at least 12 characters.');
  const material = await crypto.subtle.importKey('raw', source(encoder.encode(passphrase)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: source(salt), iterations: ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function createEncryptedBackup(secretKey: Uint8Array, publicKey: string, passphrase: string): Promise<EncryptedBackup> {
  if (secretKey.length !== 64) throw new Error('Agent secret key must contain 64 bytes.');
  const pair = Keypair.fromSecretKey(secretKey);
  if (pair.publicKey.toBase58() !== publicKey) throw new Error('Agent public key does not match its secret key.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: source(iv) }, key, source(secretKey));
  return parseEncryptedBackup({ version: 1, publicKey, salt: toBase64(salt), iv: toBase64(iv), iterations: ITERATIONS, ciphertext: toBase64(new Uint8Array(ciphertext)) });
}
export async function restoreEncryptedBackup(value: EncryptedBackup, passphrase: string): Promise<Uint8Array> {
  const backup = parseEncryptedBackup(value);
  try {
    const key = await deriveKey(passphrase, fromBase64(backup.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: source(fromBase64(backup.iv)) }, key, source(fromBase64(backup.ciphertext)));
    const secret = new Uint8Array(plain);
    const pair = Keypair.fromSecretKey(secret);
    if (pair.publicKey.toBase58() !== backup.publicKey) throw new Error();
    return secret;
  } catch { throw new Error('Could not unlock backup. Check the passphrase or backup integrity.'); }
}
export async function saveBackup(value: EncryptedBackup) {
  const backup = parseEncryptedBackup(value);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(backup); tx.oncomplete = () => resolve(); tx.onerror = () => reject(new Error('Could not save encrypted backup.')); });
  db.close();
}
export async function loadBackups(): Promise<EncryptedBackup[]> {
  const db = await openDb();
  const result = await new Promise<unknown[]>((resolve, reject) => { const req = db.transaction(STORE).objectStore(STORE).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(new Error('Could not read saved backups.')); });
  db.close(); return result.map(parseEncryptedBackup);
}
export async function exportBackup(backup: EncryptedBackup) {
  return new Blob([JSON.stringify(parseEncryptedBackup(backup), null, 2)], { type: 'application/json' });
}
