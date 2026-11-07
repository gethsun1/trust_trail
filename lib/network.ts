import { DEVNET_GENESIS_HASH } from './config';

export type ClusterIdentity = 'verified' | 'wrong-cluster' | 'unavailable';
export type GenesisHashReader = { getGenesisHash: () => Promise<string> };

export async function verifyDevnetIdentity(connection: GenesisHashReader, timeoutMs = 5_000): Promise<{ status: ClusterIdentity; genesisHash?: string }> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return { status: 'unavailable' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const genesisHash = await Promise.race([
      connection.getGenesisHash(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('RPC identity check timed out')), timeoutMs); }),
    ]);
    return genesisHash === DEVNET_GENESIS_HASH ? { status: 'verified', genesisHash } : { status: 'wrong-cluster', genesisHash };
  } catch { return { status: 'unavailable' }; }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
