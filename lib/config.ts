import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY');
export const CLUSTER = 'devnet' as const;
export const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export const DEFAULT_DEVNET_RPC_URL = 'https://api.devnet.solana.com';
const configuredRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
export const RPC_URL = validateRpcUrl(configuredRpcUrl ?? DEFAULT_DEVNET_RPC_URL) ? (configuredRpcUrl ?? DEFAULT_DEVNET_RPC_URL) : DEFAULT_DEVNET_RPC_URL;

export function validateRpcUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password && !parsed.hash;
  } catch { return false; }
}
export function hasValidRpcConfiguration(value: string | undefined): boolean {
  return value === undefined || validateRpcUrl(value);
}
