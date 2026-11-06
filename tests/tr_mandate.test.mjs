import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';

const endpoint = 'http://127.0.0.1:8899';
const connection = new Connection(endpoint, 'confirmed');
const owner = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync('target/test-wallet.json', 'utf8'))));
const idl = JSON.parse(readFileSync('target/idl/tr_mandate.json', 'utf8'));
const programId = new PublicKey(idl.address);
const systemId = SystemProgram.programId;
let SYSTEM_RENT = 890_880n;

const u64 = (value) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(value)); return b; };
const i64 = (value) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(value)); return b; };
const keyBytes = (key) => new PublicKey(key).toBuffer();
const discriminator = (name) => Buffer.from(idl.instructions.find((ix) => ix.name === name).discriminator);

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

async function submit(ix, signers = [owner]) {
  const transaction = new Transaction().add(ix);
  transaction.feePayer = signers[0].publicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.sign(...signers);
  return connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false }).then(async (signature) => {
    await connection.confirmTransaction(signature, 'confirmed');
    return signature;
  });
}

async function rejects(ix, signers, pattern) {
  await assert.rejects(submit(ix, signers), pattern);
}

test('local validator enforces mandate authorization, limits, nonce and vault reserve', async (t) => {
  const health = await connection.getVersion();
  assert.ok(health['solana-core']);
  SYSTEM_RENT = BigInt(await connection.getMinimumBalanceForRentExemption(0));
  const agent = Keypair.generate();
  const rogue = Keypair.generate();
  const recipient = Keypair.generate().publicKey;
  const wrongRecipient = Keypair.generate().publicKey;
  const { mandate, vault } = derive(owner.publicKey);
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 600);
  const initAccounts = { owner: owner.publicKey, mandate, vault, system_program: systemId };
  await submit(instruction('initialize_mandate', initAccounts, [keyBytes(agent.publicKey), keyBytes(recipient), u64(100_000_000), u64(150_000_000), i64(expiry)]));

  const mandateInfo = await connection.getAccountInfo(mandate);
  const vaultInfo = await connection.getAccountInfo(vault);
  assert.equal(mandateInfo.owner.toBase58(), programId.toBase58());
  assert.equal(mandateInfo.data.length, 154);
  assert.equal(vaultInfo.owner.toBase58(), systemId.toBase58());
  assert.equal(vaultInfo.data.length, 0);
  assert.equal(vaultInfo.lamports, Number(SYSTEM_RENT));
  assert.equal(derive(owner.publicKey).mandate.toBase58(), mandate.toBase58());

  const agentBalance = await connection.getBalance(agent.publicKey);
  const airdrop = await connection.requestAirdrop(agent.publicKey, 1_000_000_000);
  await connection.confirmTransaction(airdrop, 'confirmed');
  const rogueDrop = await connection.requestAirdrop(rogue.publicKey, 1_000_000_000);
  await connection.confirmTransaction(rogueDrop, 'confirmed');
  assert.equal(agentBalance, 0);

  await submit(instruction('deposit', { owner: owner.publicKey, mandate, vault, system_program: systemId }, [u64(1_000_000_000)]));
  const paymentAccounts = { agent: agent.publicKey, mandate, recipient, vault, system_program: systemId };
  const snapshot = async () => {
    const data = (await connection.getAccountInfo(mandate)).data;
    return { spent: data.readBigUInt64LE(8 + 32 * 3 + 8 * 2), nonce: data.readBigUInt64LE(8 + 32 * 3 + 8 * 5), vault: await connection.getBalance(vault) };
  };
  const beforeRejected = await snapshot();

  await rejects(instruction('execute_payment', { ...paymentAccounts, recipient: wrongRecipient }, [u64(1), u64(0)]), [agent], /custom program error|Recipient|Error/);
  await rejects(instruction('execute_payment', { ...paymentAccounts, vault: Keypair.generate().publicKey }, [u64(1), u64(0)]), [agent], /custom program error|Constraint|Error/);
  await rejects(instruction('execute_payment', paymentAccounts, [u64(0), u64(0)]), [agent], /custom program error|Amount|Error/);
  await rejects(instruction('execute_payment', paymentAccounts, [u64(100_000_001), u64(0)]), [agent], /custom program error|limit|Error/);
  await rejects(instruction('execute_payment', paymentAccounts, [u64(1), u64(0)]), [agent], /custom program error|nonce|Error/);
  const afterRejected = await snapshot();
  assert.deepEqual(afterRejected, beforeRejected, 'failed payments must not mutate nonce, spending, or vault balance');

  await submit(instruction('execute_payment', paymentAccounts, [u64(60_000_000), u64(1)]), [agent]);
  const afterPayment = await snapshot();
  assert.equal(afterPayment.spent, 60_000_000n);
  assert.equal(afterPayment.nonce, 2n);
  await rejects(instruction('execute_payment', paymentAccounts, [u64(100_000_000), u64(2)]), [agent], /custom program error|allowance|Error/);
  await rejects(instruction('execute_payment', { ...paymentAccounts, agent: rogue.publicKey }, [u64(1), u64(2)]), [rogue], /custom program error|Constraint|Error/);
  assert.deepEqual(await snapshot(), afterPayment);

  const ownerAccounts = { owner: owner.publicKey, mandate, vault, system_program: systemId };
  const availableBeforeDrain = BigInt(await connection.getBalance(vault)) - SYSTEM_RENT;
  await submit(instruction('withdraw', ownerAccounts, [u64(availableBeforeDrain)]));
  await rejects(instruction('execute_payment', paymentAccounts, [u64(1), u64(3)]), [agent], /custom program error|fund|Error/);
  assert.equal((await snapshot()).spent, afterPayment.spent);
  await submit(instruction('deposit', { owner: owner.publicKey, mandate, vault, system_program: systemId }, [u64(10_000_000)]));

  await rejects(instruction('withdraw', { ...ownerAccounts, owner: rogue.publicKey }, [u64(1)]), [rogue], /custom program error|Constraint|Error/);
  await rejects(instruction('update_mandate', { owner: rogue.publicKey, mandate }, [keyBytes(agent.publicKey), keyBytes(recipient), u64(100), u64(100), i64(expiry)]), [rogue], /custom program error|Constraint|Error/);

  await submit(instruction('update_mandate', { owner: owner.publicKey, mandate }, [keyBytes(agent.publicKey), keyBytes(recipient), u64(100_000_000), u64(150_000_000), i64(expiry)]));
  const updated = await snapshot();
  assert.equal(updated.spent, 0n);
  assert.equal(updated.nonce, 5n);

  await submit(instruction('revoke_agent', { owner: owner.publicKey, mandate }));
  await rejects(instruction('execute_payment', paymentAccounts, [u64(1), u64(6)]), [agent], /custom program error|revoked|Error/);

  // The owner can recover spendable funds after revocation, while preserving rent.
  const spendable = BigInt(await connection.getBalance(vault)) - SYSTEM_RENT;
  assert.ok(spendable > 0n);
  await submit(instruction('withdraw', ownerAccounts, [u64(spendable)]));
  assert.equal(await connection.getBalance(vault), Number(SYSTEM_RENT));
  await rejects(instruction('execute_payment', paymentAccounts, [u64(1), u64(3)]), [agent], /custom program error|revoked|Error/);

  const nearExpiry = BigInt(Math.floor(Date.now() / 1000) + 2);
  await submit(instruction('update_mandate', { owner: owner.publicKey, mandate }, [keyBytes(agent.publicKey), keyBytes(recipient), u64(100_000_000), u64(150_000_000), i64(nearExpiry)]));
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  await rejects(instruction('execute_payment', paymentAccounts, [u64(1), u64(8)]), [agent], /custom program error|expired|Error/);
  t.diagnostic(`mandate=${mandate.toBase58()} vault=${vault.toBase58()}`);
});
