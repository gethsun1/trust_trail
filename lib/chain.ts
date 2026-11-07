/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import idl from './tr_mandate.json';
import { PROGRAM_ID } from './config';
import { deriveMandate } from './mandate';

export function createProgram(connection: Connection, wallet: AnchorProvider['wallet']): Program<any> {
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed', preflightCommitment: 'confirmed' });
  return new Program(idl as any, provider);
}
export async function deploymentAvailable(connection: Connection) {
  const info = await connection.getAccountInfo(PROGRAM_ID, 'confirmed');
  return Boolean(info && info.executable);
}
export async function readMandate(connection: Connection, owner: PublicKey) {
  const { mandate, vault } = deriveMandate(owner, PROGRAM_ID);
  const info = await connection.getAccountInfo(mandate, 'confirmed');
  if (!info) return { mandate, vault, state: null };
  if (!info.owner.equals(PROGRAM_ID) || info.data.length !== 154) throw new Error('Mandate account has an unexpected owner or data layout.');
  const data = info.data;
  const discriminator = Buffer.from([113, 216, 98, 159, 185, 63, 55, 18]);
  if (!data.subarray(0, 8).equals(discriminator)) throw new Error('Mandate account discriminator is invalid.');
  const state = {
    owner: new PublicKey(data.subarray(8, 40)), agent: new PublicKey(data.subarray(40, 72)), recipient: new PublicKey(data.subarray(72, 104)),
    maxPerTx: data.readBigUInt64LE(104), dailyLimit: data.readBigUInt64LE(112), spentToday: data.readBigUInt64LE(120),
    dayIndex: data.readBigInt64LE(128), expiresAt: data.readBigInt64LE(136), nonce: data.readBigUInt64LE(144), revoked: data[152] === 1,
  };
  if (!state.owner.equals(owner) || (data[152] !== 0 && data[152] !== 1)) throw new Error('Mandate account data does not match its owner or expected state.');
  const vaultInfo = await connection.getAccountInfo(vault, 'confirmed');
  if (vaultInfo && (!vaultInfo.owner.equals(SystemProgram.programId) || vaultInfo.data.length !== 0)) throw new Error('Vault account ownership or data layout is unexpected.');
  if (!vaultInfo) throw new Error('Mandate exists but its vault account is missing from the RPC response.');
  const reserve = await connection.getMinimumBalanceForRentExemption(0, 'confirmed');
  const slot = await connection.getSlot('confirmed');
  const clusterTime = await connection.getBlockTime(slot);
  const currentDay = clusterTime === null ? state.dayIndex : BigInt(Math.floor(clusterTime / 86_400));
  const effectiveSpentToday = currentDay > state.dayIndex ? 0n : state.spentToday;
  return { mandate, vault, state, vaultLamports: BigInt(vaultInfo.lamports), reserve: BigInt(reserve), effectiveSpentToday };
}
export { SystemProgram };
