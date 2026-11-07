/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { BN, type AnchorProvider } from '@coral-xyz/anchor';
import { Connection, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import { createProgram, deploymentAvailable, readMandate } from '../../lib/chain';
import { PROGRAM_ID } from '../../lib/config';
import { deriveMandate } from '../../lib/mandate';
import { prepareOwnerTransaction } from '../../lib/transactions';

const endpoint = process.env.TR_LOCAL_VALIDATOR_URL;
const localSuite = endpoint ? describe : describe.skip;

localSuite('M2 client local-validator lifecycle', () => {
  it('initializes, reads, deposits, updates, revokes, reactivates and withdraws through client builders', async () => {
    const connection = new Connection(endpoint!, 'confirmed');
    expect(await deploymentAvailable(connection)).toBe(true);
    const owner = Keypair.generate();
    const airdrop = await connection.requestAirdrop(owner.publicKey, 3_000_000_000);
    const airdropBlock = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction({ signature: airdrop, ...airdropBlock }, 'confirmed');
    const wallet = {
      publicKey: owner.publicKey,
      signTransaction: async <T extends Transaction>(tx: T): Promise<T> => { tx.partialSign(owner); return tx; },
      signAllTransactions: async <T extends Transaction>(txs: T[]): Promise<T[]> => txs.map(tx => { tx.partialSign(owner); return tx; }),
    } as AnchorProvider['wallet'];
    const program = createProgram(connection, wallet);
    const methods = (program as any).methods;
    const agent = Keypair.generate().publicKey;
    const recipient = Keypair.generate().publicKey;
    const { mandate, vault } = deriveMandate(owner.publicKey, PROGRAM_ID);
    const clusterNow = await connection.getBlockTime(await connection.getSlot('confirmed')) ?? Math.floor(Date.now() / 1000);
    const expiresAt = BigInt(clusterNow + 3_600);

    const send = async (instruction: any) => {
      const prepared = await prepareOwnerTransaction(connection, owner.publicKey, instruction);
      prepared.transaction.partialSign(owner);
      const signature = await connection.sendRawTransaction(prepared.transaction.serialize());
      const result = await connection.confirmTransaction({ signature, ...prepared.latest }, 'confirmed');
      if (result.value.err) throw new Error(`Local transaction failed: ${JSON.stringify(result.value.err)}`);
      return signature;
    };

    await send(await methods.initializeMandate(agent, recipient, new BN('100000000'), new BN('300000000'), new BN(expiresAt.toString())).accounts({ owner: owner.publicKey, mandate, vault, systemProgram: SystemProgram.programId }).instruction());
    const initialized = await readMandate(connection, owner.publicKey);
    if (!initialized.state || initialized.reserve === undefined) throw new Error('Initialized mandate state did not decode.');
    expect(initialized.state.agent.equals(agent)).toBe(true);
    expect(initialized.state.recipient.equals(recipient)).toBe(true);
    expect(initialized.state.nonce).toBe(0n);

    await send(await methods.deposit(new BN('500000000')).accounts({ owner: owner.publicKey, mandate, vault, systemProgram: SystemProgram.programId }).instruction());
    const deposited = await readMandate(connection, owner.publicKey);
    expect(deposited.vaultLamports).toBe(initialized.reserve + 500_000_000n);
    expect(deposited.state?.nonce).toBe(1n);

    await send(await methods.updateMandate(agent, recipient, new BN('150000000'), new BN('400000000'), new BN((expiresAt + 3_600n).toString())).accounts({ owner: owner.publicKey, mandate }).instruction());
    const updated = await readMandate(connection, owner.publicKey);
    expect(updated.state?.maxPerTx).toBe(150_000_000n);
    expect(updated.state?.dailyLimit).toBe(400_000_000n);
    expect(updated.state?.nonce).toBe(2n);

    await send(await methods.revokeAgent().accounts({ owner: owner.publicKey, mandate }).instruction());
    expect((await readMandate(connection, owner.publicKey)).state?.revoked).toBe(true);
    await send(await methods.reactivateAgent().accounts({ owner: owner.publicKey, mandate }).instruction());
    const reactivated = await readMandate(connection, owner.publicKey);
    expect(reactivated.state?.revoked).toBe(false);
    expect(reactivated.state?.nonce).toBe(4n);

    await send(await methods.withdraw(new BN('100000000')).accounts({ owner: owner.publicKey, mandate, vault, systemProgram: SystemProgram.programId }).instruction());
    const withdrawn = await readMandate(connection, owner.publicKey);
    expect(withdrawn.vaultLamports).toBe(initialized.reserve + 400_000_000n);
    if (withdrawn.vaultLamports === undefined || withdrawn.reserve === undefined) throw new Error('Withdrawn vault state did not decode.');
    expect(withdrawn.vaultLamports).toBeGreaterThanOrEqual(withdrawn.reserve);
    expect(withdrawn.state?.nonce).toBe(5n);
  }, 60_000);
});
