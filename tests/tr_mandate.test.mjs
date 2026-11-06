import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

const connection = new Connection('http://127.0.0.1:8899', 'confirmed');
const idl = JSON.parse(readFileSync('target/idl/tr_mandate.json', 'utf8'));
const programId = new PublicKey(idl.address);
const systemId = SystemProgram.programId;
const clockSysvar = new PublicKey('SysvarC1ock11111111111111111111111111111111');
const U64_MAX = (1n << 64n) - 1n;

const u64 = (value) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(value)); return b; };
const i64 = (value) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(value)); return b; };
const keyBytes = (key) => new PublicKey(key).toBuffer();

function derive(ownerKey) {
  const [mandate] = PublicKey.findProgramAddressSync([Buffer.from('mandate'), keyBytes(ownerKey)], programId);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from('vault'), mandate.toBuffer()], programId);
  return { mandate, vault };
}

function instruction(name, accounts, args = []) {
  const spec = idl.instructions.find((ix) => ix.name === name);
  assert(spec, `missing generated IDL instruction ${name}`);
  const keys = spec.accounts.map((account) => {
    const pubkey = accounts[account.name];
    assert(pubkey, `missing account ${account.name} for ${name}`);
    return { pubkey, isSigner: Boolean(account.signer), isWritable: Boolean(account.writable) };
  });
  return { programId, keys, data: Buffer.concat([Buffer.from(spec.discriminator), ...args]) };
}

async function submit(ix, signers) {
  const transaction = new Transaction().add(ix);
  transaction.feePayer = signers[0].publicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.sign(...signers);
  const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

async function reject(ix, signers, description = 'instruction should fail') {
  await assert.rejects(submit(ix, signers), undefined, description);
}

async function airdrop(key, lamports = 2_000_000_000) {
  const publicKey = key.publicKey ?? key;
  const signature = await connection.requestAirdrop(publicKey, lamports);
  await connection.confirmTransaction(signature, 'confirmed');
}

async function validatorTimestamp() {
  const info = await connection.getAccountInfo(clockSysvar);
  assert(info, 'validator Clock sysvar should be available');
  return info.data.readBigInt64LE(32);
}

async function fixture({ fund = 0n, maxPerTx = 100_000_000n, dailyLimit = 150_000_000n, recipient, expirySeconds = 600 } = {}) {
  const owner = Keypair.generate();
  const agent = Keypair.generate();
  const rogue = Keypair.generate();
  await Promise.all([airdrop(owner), airdrop(agent, 500_000_000), airdrop(rogue, 500_000_000)]);
  const { mandate, vault } = derive(owner.publicKey);
  const approvedRecipient = recipient ?? Keypair.generate().publicKey;
  const expiresAt = (await validatorTimestamp()) + BigInt(expirySeconds);
  await submit(instruction('initialize_mandate', {
    owner: owner.publicKey, mandate, vault, system_program: systemId,
  }, [keyBytes(agent.publicKey), keyBytes(approvedRecipient), u64(maxPerTx), u64(dailyLimit), i64(expiresAt)]), [owner]);
  const accounts = { owner: owner.publicKey, mandate, vault, system_program: systemId };
  if (fund > 0n) await submit(instruction('deposit', accounts, [u64(fund)]), [owner]);
  const paymentAccounts = { agent: agent.publicKey, mandate, recipient: approvedRecipient, vault, system_program: systemId };
  return { owner, agent, rogue, mandate, vault, approvedRecipient, expiresAt, accounts, paymentAccounts };
}

async function state(f) {
  const info = await connection.getAccountInfo(f.mandate);
  assert(info, 'mandate account should exist');
  const data = info.data;
  return {
    spentToday: data.readBigUInt64LE(120),
    dayIndex: data.readBigInt64LE(128),
    nonce: data.readBigUInt64LE(144),
    revoked: data[152] === 1,
    vaultLamports: BigInt(await connection.getBalance(f.vault)),
  };
}

test('initialization derives the mandate and creates a system-owned zero-data rent-exempt vault', async () => {
  const f = await fixture();
  const mandateInfo = await connection.getAccountInfo(f.mandate);
  const vaultInfo = await connection.getAccountInfo(f.vault);
  assert.equal(mandateInfo.owner.toBase58(), programId.toBase58());
  assert.equal(mandateInfo.data.length, 154);
  assert.equal(vaultInfo.owner.toBase58(), systemId.toBase58());
  assert.equal(vaultInfo.data.length, 0);
  assert.equal(vaultInfo.lamports, await connection.getMinimumBalanceForRentExemption(0));
  assert.deepEqual(derive(f.owner.publicKey), { mandate: f.mandate, vault: f.vault });
});

test('initialization and policy updates reject expired timestamps without changing mandate state', async () => {
  const owner = Keypair.generate();
  const agent = Keypair.generate();
  const recipient = Keypair.generate().publicKey;
  await Promise.all([airdrop(owner), airdrop(agent)]);
  const { mandate, vault } = derive(owner.publicKey);
  await reject(instruction('initialize_mandate', {
    owner: owner.publicKey, mandate, vault, system_program: systemId,
  }, [keyBytes(agent.publicKey), keyBytes(recipient), u64(100), u64(100), i64(0)]), [owner], 'expired initialization policy');
  assert.equal(await connection.getAccountInfo(mandate), null);

  const f = await fixture();
  const before = await state(f);
  await reject(instruction('update_mandate', { owner: f.owner.publicKey, mandate: f.mandate }, [
    keyBytes(f.agent.publicKey), keyBytes(f.approvedRecipient), u64(100), u64(100), i64(0),
  ]), [f.owner], 'expired updated policy');
  assert.deepEqual(await state(f), before);
});

test('authorized agent payment transfers only to the approved recipient', async () => {
  const f = await fixture({ fund: 1_000_000_000n });
  const recipientBefore = BigInt(await connection.getBalance(f.approvedRecipient));
  const reserve = BigInt(await connection.getMinimumBalanceForRentExemption(0));
  await submit(instruction('execute_payment', f.paymentAccounts, [u64(25_000_000), u64(1)]), [f.agent]);
  const after = await state(f);
  assert.equal(BigInt(await connection.getBalance(f.approvedRecipient)), recipientBefore + 25_000_000n);
  assert.equal(after.spentToday, 25_000_000n);
  assert.equal(after.nonce, 2n);
  assert.ok(after.vaultLamports >= reserve);
});

test('agent, recipient, PDA, amount, limit, and nonce failures preserve payment state', async () => {
  const f = await fixture({ fund: 1_000_000_000n });
  const before = await state(f);
  const badRecipient = { ...f.paymentAccounts, recipient: Keypair.generate().publicKey };
  const badVault = { ...f.paymentAccounts, vault: Keypair.generate().publicKey };
  const badAgent = { ...f.paymentAccounts, agent: f.rogue.publicKey };
  await reject(instruction('execute_payment', badAgent, [u64(1), u64(1)]), [f.rogue], 'unauthorized agent');
  await reject(instruction('execute_payment', badRecipient, [u64(1), u64(1)]), [f.agent], 'wrong recipient');
  await reject(instruction('execute_payment', badVault, [u64(1), u64(1)]), [f.agent], 'substituted vault PDA');
  await reject(instruction('execute_payment', f.paymentAccounts, [u64(0), u64(1)]), [f.agent], 'zero payment');
  await reject(instruction('execute_payment', f.paymentAccounts, [u64(100_000_001), u64(1)]), [f.agent], 'per-transaction limit');
  await reject(instruction('execute_payment', f.paymentAccounts, [u64(1), u64(0)]), [f.agent], 'stale nonce');
  assert.deepEqual(await state(f), before);

  await submit(instruction('execute_payment', f.paymentAccounts, [u64(100_000_000), u64(1)]), [f.agent]);
  const afterAllowedPayment = await state(f);
  await reject(instruction('execute_payment', f.paymentAccounts, [u64(50_000_001), u64(2)]), [f.agent], 'daily limit');
  assert.deepEqual(await state(f), afterAllowedPayment);
});

test('policy updates and repeated same-day updates preserve accumulated spending', async () => {
  const f = await fixture({ fund: 1_000_000_000n });
  await submit(instruction('execute_payment', f.paymentAccounts, [u64(60_000_000), u64(1)]), [f.agent]);
  const update = (max, daily) => instruction('update_mandate', { owner: f.owner.publicKey, mandate: f.mandate }, [
    keyBytes(f.agent.publicKey), keyBytes(f.approvedRecipient), u64(max), u64(daily), i64(f.expiresAt),
  ]);
  await submit(update(90_000_000n, 120_000_000n), [f.owner]);
  assert.equal((await state(f)).spentToday, 60_000_000n);
  await submit(update(80_000_000n, 100_000_000n), [f.owner]);
  const afterRepeatedUpdate = await state(f);
  assert.equal(afterRepeatedUpdate.spentToday, 60_000_000n);
  await reject(instruction('execute_payment', f.paymentAccounts, [u64(40_000_001), u64(afterRepeatedUpdate.nonce)]), [f.agent], 'updated policy cannot reset daily allowance');
  assert.deepEqual(await state(f), afterRepeatedUpdate);
});

test('revocation persists through policy edits and only explicit owner reactivation restores agent authority', async () => {
  const f = await fixture({ fund: 1_000_000_000n });
  await submit(instruction('execute_payment', f.paymentAccounts, [u64(10_000_000), u64(1)]), [f.agent]);
  await submit(instruction('revoke_agent', { owner: f.owner.publicKey, mandate: f.mandate }), [f.owner]);
  const revoked = await state(f);
  assert.equal(revoked.revoked, true);
  await reject(instruction('execute_payment', f.paymentAccounts, [u64(1), u64(revoked.nonce)]), [f.agent], 'revoked agent');
  await reject(instruction('reactivate_agent', { owner: f.rogue.publicKey, mandate: f.mandate }), [f.rogue], 'only owner can reactivate');

  await submit(instruction('update_mandate', { owner: f.owner.publicKey, mandate: f.mandate }, [
    keyBytes(f.agent.publicKey), keyBytes(f.approvedRecipient), u64(100_000_000), u64(150_000_000), i64(f.expiresAt),
  ]), [f.owner]);
  const afterEdit = await state(f);
  assert.equal(afterEdit.revoked, true);
  assert.equal(afterEdit.spentToday, 10_000_000n);
  await reject(instruction('execute_payment', f.paymentAccounts, [u64(1), u64(afterEdit.nonce)]), [f.agent], 'policy edit must not reactivate');

  await submit(instruction('reactivate_agent', { owner: f.owner.publicKey, mandate: f.mandate }), [f.owner]);
  const reactivated = await state(f);
  assert.equal(reactivated.revoked, false);
  assert.equal(reactivated.spentToday, 10_000_000n);
  await submit(instruction('execute_payment', f.paymentAccounts, [u64(1), u64(reactivated.nonce)]), [f.agent]);
  assert.equal((await state(f)).spentToday, 10_000_001n);
});

test('exact rent-reserve boundary is spendable only above reserve and owner can withdraw after revocation', async () => {
  const f = await fixture({ fund: 1n });
  const reserve = BigInt(await connection.getMinimumBalanceForRentExemption(0));
  await airdrop(f.approvedRecipient, Number(reserve));
  assert.equal((await state(f)).vaultLamports, reserve + 1n);
  await submit(instruction('execute_payment', f.paymentAccounts, [u64(1), u64(1)]), [f.agent]);
  assert.equal((await state(f)).vaultLamports, reserve);
  const afterPayment = await state(f);
  await reject(instruction('execute_payment', f.paymentAccounts, [u64(1), u64(afterPayment.nonce)]), [f.agent], 'insufficient spendable funds at reserve');
  assert.deepEqual(await state(f), afterPayment);

  await submit(instruction('revoke_agent', { owner: f.owner.publicKey, mandate: f.mandate }), [f.owner]);
  await reject(instruction('withdraw', f.accounts, [u64(0)]), [f.owner], 'zero withdrawal');
  assert.equal((await state(f)).vaultLamports, reserve);
});

test('owner withdrawal drains only spendable balance and preserves the reserve', async () => {
  const f = await fixture({ fund: 40_000_000n });
  const reserve = BigInt(await connection.getMinimumBalanceForRentExemption(0));
  await submit(instruction('revoke_agent', { owner: f.owner.publicKey, mandate: f.mandate }), [f.owner]);
  await submit(instruction('withdraw', f.accounts, [u64(40_000_000)]), [f.owner]);
  assert.equal((await state(f)).vaultLamports, reserve);
  await reject(instruction('withdraw', f.accounts, [u64(1)]), [f.owner], 'withdrawal cannot consume reserve');
  assert.equal((await state(f)).vaultLamports, reserve);
  await reject(instruction('withdraw', { ...f.accounts, owner: f.rogue.publicKey }, [u64(1)]), [f.rogue], 'unauthorized withdrawal');
  await reject(instruction('update_mandate', { owner: f.rogue.publicKey, mandate: f.mandate }, [
    keyBytes(f.agent.publicKey), keyBytes(f.approvedRecipient), u64(10), u64(10), i64(f.expiresAt),
  ]), [f.rogue], 'unauthorized policy update');
});

test('an expired mandate rejects agent payments', async () => {
  const f = await fixture({ fund: 1_000_000n, expirySeconds: 8 });
  while (await validatorTimestamp() < f.expiresAt) await delay(250);
  await reject(instruction('execute_payment', f.paymentAccounts, [u64(1), u64(1)]), [f.agent], 'expired mandate');
  assert.equal((await state(f)).spentToday, 0n);
  await submit(instruction('revoke_agent', { owner: f.owner.publicKey, mandate: f.mandate }), [f.owner]);
  const revoked = await state(f);
  await reject(instruction('reactivate_agent', { owner: f.owner.publicKey, mandate: f.mandate }), [f.owner], 'expired mandate requires policy extension');
  assert.deepEqual(await state(f), revoked);
  const extendedExpiry = (await validatorTimestamp()) + 600n;
  await submit(instruction('update_mandate', { owner: f.owner.publicKey, mandate: f.mandate }, [
    keyBytes(f.agent.publicKey), keyBytes(f.approvedRecipient), u64(100_000_000), u64(150_000_000), i64(extendedExpiry),
  ]), [f.owner]);
  await submit(instruction('reactivate_agent', { owner: f.owner.publicKey, mandate: f.mandate }), [f.owner]);
  assert.equal((await state(f)).revoked, false);
});

test('a later instruction failure rolls back a successful payment CPI and all payment effects', async () => {
  const f = await fixture({ fund: 10_000_000n });
  const before = await state(f);
  const recipientBefore = BigInt(await connection.getBalance(f.approvedRecipient));
  const paymentIx = instruction('execute_payment', f.paymentAccounts, [u64(1), u64(before.nonce)]);
  const lateRecipient = Keypair.generate().publicKey;
  const failingIx = SystemProgram.transfer({
    fromPubkey: f.agent.publicKey,
    toPubkey: lateRecipient,
    lamports: 1_000_000_000,
  });
  const transaction = new Transaction().add(paymentIx, failingIx);
  transaction.feePayer = f.agent.publicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.sign(f.agent);
  const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true });
  const confirmation = await connection.confirmTransaction(signature, 'confirmed');
  assert.notEqual(confirmation.value.err, null, 'second instruction should fail on the validator');

  let metadata = null;
  for (let attempt = 0; attempt < 10 && metadata === null; attempt += 1) {
    metadata = await connection.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (metadata === null) await delay(200);
  }
  assert(metadata?.meta, 'failed transaction metadata should be available');
  assert.equal(metadata.meta.err?.InstructionError?.[0], 1, 'transaction should fail at the second instruction');
  assert.deepEqual(metadata.meta.err?.InstructionError?.[1], { Custom: 1 },
    'second System Program transfer should fail for insufficient funds');
  const accountKeys = metadata.transaction.message.accountKeys;
  const instructions = metadata.transaction.message.instructions;
  assert.equal(accountKeys[instructions[0].programIdIndex].toBase58(), programId.toBase58());
  assert.equal(accountKeys[instructions[1].programIdIndex].toBase58(), systemId.toBase58());
  assert(metadata.meta.innerInstructions?.some((group) => group.index === 0 && group.instructions.length > 0),
    'payment instruction should contain its System Program transfer CPI');
  const logs = metadata.meta.logMessages ?? [];
  const cpiSucceeded = logs.indexOf(`Program ${systemId.toBase58()} success`);
  const paymentSucceeded = logs.indexOf(`Program ${programId.toBase58()} success`);
  const laterTransferInvoked = logs.findIndex((line, index) => index > paymentSucceeded &&
    line === `Program ${systemId.toBase58()} invoke [1]`);
  const laterTransferFailed = logs.findIndex((line, index) => index > laterTransferInvoked &&
    line.startsWith(`Program ${systemId.toBase58()} failed:`));
  assert(cpiSucceeded >= 0, 'payment CPI should complete successfully');
  assert(paymentSucceeded > cpiSucceeded, 'payment instruction should complete after its successful CPI');
  assert(paymentSucceeded >= 0, 'payment program instruction should complete successfully');
  assert(laterTransferInvoked > paymentSucceeded, 'second System Program instruction should run after payment succeeds');
  assert(laterTransferFailed > laterTransferInvoked, 'second System Program instruction should fail');
  assert(logs.some((line) => line.includes('Transfer: insufficient lamports')),
    'validator logs should identify the second transfer as exceeding the agent balance');

  assert.deepEqual(await state(f), before);
  assert.equal(BigInt(await connection.getBalance(f.approvedRecipient)), recipientBefore);
});

test('maximum lamport amount does not overflow and fails on available balance', async () => {
  const f = await fixture({ fund: 1_000_000n, maxPerTx: U64_MAX, dailyLimit: U64_MAX });
  const before = await state(f);
  await reject(instruction('execute_payment', f.paymentAccounts, [u64(U64_MAX), u64(1)]), [f.agent], 'u64 maximum exceeds available vault funds');
  assert.deepEqual(await state(f), before);
});
