'use client';

import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { CircleAlert, Fingerprint, ScanSearch, Sparkles } from 'lucide-react';
import { deriveMandate, formatSol } from '@/lib/mandate';
import { PROGRAM_ID } from '@/lib/config';
import idl from '@/lib/tr_mandate.json';

type Intent = { action: string; asset: string; recipient: string | null; amountLamports: string | null; missingFields: string[]; originalInstruction: string; status: string };
type Decision = { decision: 'APPROVE' | 'REJECT'; reasonCodes: string[]; explanation: string };
type RecordState = { agent: PublicKey; recipient: PublicKey; nonce: { toString(): string }; maxPerTx: { toString(): string }; revoked: boolean };
type MandateRecord = { state?: RecordState | null } | null;

export function IntentFirewall({ record, agentPublic }: { record: MandateRecord; agentPublic: string }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [instruction, setInstruction] = useState('');
  const [intent, setIntent] = useState<Intent | null>(null);
  const [token, setToken] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [scenario, setScenario] = useState<'match' | 'tampered_recipient' | 'over_limit'>('match');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const state = record?.state;
  const solText = (lamports: bigint) => `${lamports / 1_000_000_000n}.${(lamports % 1_000_000_000n).toString().padStart(9, '0')}`;

  const think = async () => {
    setBusy(true); setError(''); setDecision(null); setIntent(null);
    try {
      const response = await fetch('/api/intent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ instruction }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Intent interpretation unavailable.');
      setIntent(result.intent); setToken(result.intentToken);
    } catch (e) { setError(e instanceof Error ? e.message : 'Intent interpretation unavailable.'); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    if (!intent || intent.status !== 'ready' || !wallet.publicKey || !agentPublic || !state) return;
    setBusy(true); setError(''); setDecision(null);
    try {
      const instruction = idl.instructions.find(item => item.name === 'execute_payment')!;
      const transactionAmount = scenario === 'over_limit' ? BigInt(state.maxPerTx.toString()) + 1n : BigInt(intent.amountLamports!);
      const transactionRecipient = scenario === 'tampered_recipient' ? SystemProgram.programId : new PublicKey(intent.recipient!);
      const amount = Buffer.alloc(8); amount.writeBigUInt64LE(transactionAmount);
      const nonce = Buffer.alloc(8); nonce.writeBigUInt64LE(BigInt(state.nonce.toString()));
      const { mandate, vault } = deriveMandate(wallet.publicKey, PROGRAM_ID);
      const instructionIx = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: new PublicKey(agentPublic), isSigner: true, isWritable: true },
          { pubkey: mandate, isSigner: false, isWritable: true },
          { pubkey: transactionRecipient, isSigner: false, isWritable: true },
          { pubkey: vault, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([Buffer.from(instruction.discriminator), amount, nonce]),
      });
      const latest = await connection.getLatestBlockhash('confirmed');
      const tx = new Transaction({ feePayer: new PublicKey(agentPublic), ...latest }).add(instructionIx);
      const serializedTransaction = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
      const response = await fetch('/api/firewall', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ serializedTransaction, owner: wallet.publicKey.toBase58(), intent, intentToken: token }) });
      const result = await response.json();
      setDecision(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Transaction verification failed.'); }
    finally { setBusy(false); }
  };

  return <section className="panel m3-panel" id="intent-firewall">
    <div className="panel-head"><div><div className="eyebrow">M3 · AI INTENT + DETERMINISTIC FIREWALL</div><h2>Think, then verify</h2></div><span className="identity-icon"><ScanSearch size={18}/></span></div>
    <div className="m3-gates">
      <div className="m3-gate"><span className="gate-number">01</span><div><div className="eyebrow">GATE 1 · THINK</div><h3>Interpret your instruction</h3><p>Groq extracts a payment intent. The server validates its fields before showing them.</p></div></div>
      <textarea className="text-input m3-textarea" value={instruction} onChange={e => setInstruction(e.target.value)} maxLength={4000} placeholder="For example: Send 0.01 SOL to the recipient in my mandate" aria-label="Natural language payment instruction" />
      {state && <div className="scenario-row intent-presets"><span>Try a request</span><button onClick={() => { setScenario('match'); setInstruction(`Send ${solText(1n)} SOL to ${state.recipient.toBase58()}`); }}>Matching request</button><button onClick={() => { setScenario('tampered_recipient'); setInstruction(`Send ${solText(1n)} SOL to ${state.recipient.toBase58()}`); }}>Then tamper recipient</button><button onClick={() => { setScenario('match'); setInstruction(`Send ${solText(BigInt(state.maxPerTx.toString()) + 1n)} SOL to ${state.recipient.toBase58()}`); }}>Exceed mandate cap</button></div>}
      <button className="primary-button" onClick={() => void think()} disabled={busy || instruction.trim().length < 3}><Sparkles size={15}/>{busy ? 'Working…' : 'Interpret instruction'}</button>
      {intent && <div className={`intent-result ${intent.status}`}><b>{intent.status.replaceAll('_', ' ')}</b><div>Action: {intent.action}</div><div>Asset: {intent.asset}</div><div>Recipient: {intent.recipient || 'Needs clarification'}</div><div>Amount: {intent.amountLamports ? `${formatSol(BigInt(intent.amountLamports))} SOL (${intent.amountLamports} lamports)` : 'Needs clarification'}</div>{intent.missingFields.length > 0 && <div>Missing: {intent.missingFields.join(', ')}</div>}</div>}
    </div>
    <div className="m3-gates second">
      <div className="m3-gate"><span className="gate-number">02</span><div><div className="eyebrow">GATE 2 · VERIFY</div><h3>Inspect actual transaction bytes</h3><p>The unsigned transaction is decoded server-side and compared with current mandate data from the configured Devnet RPC.</p></div></div>
      <div className="firewall-facts"><div><span>Program</span><b>{PROGRAM_ID.toBase58()}</b></div><div><span>Instruction</span><b>execute_payment · IDL checked</b></div><div><span>Mandate</span><b>{state ? state.revoked ? 'Revoked' : 'Loaded from current account' : 'Unavailable'}</b></div><div><span>Agent signer</span><b>{agentPublic || 'Load existing agent identity'}</b></div></div>
      <div className="scenario-row"><span>Transaction scenario</span><button className={scenario === 'match' ? 'selected' : ''} onClick={() => setScenario('match')}>Matching intent</button><button className={scenario === 'tampered_recipient' ? 'selected' : ''} onClick={() => setScenario('tampered_recipient')}>Tamper recipient</button><button className={scenario === 'over_limit' ? 'selected' : ''} onClick={() => setScenario('over_limit')} disabled={!state}>Exceed mandate cap</button></div>
      <button className="secondary-button" onClick={() => void verify()} disabled={busy || intent?.status !== 'ready' || !state || !wallet.publicKey || !agentPublic}><Fingerprint size={15}/>{busy ? 'Verifying…' : 'Prepare unsigned transaction and verify'}</button>
      <small className="form-hint">This only prepares and inspects an unsigned transaction. No signing, submission, or execution occurs.</small>
      {decision && <div className={`firewall-decision ${decision.decision.toLowerCase()}`}><div className="decision-heading"><b>{decision.decision}</b><span>Off-chain checks only</span></div><p>{decision.explanation}</p>{decision.reasonCodes.map(code => <code key={code}>{code}</code>)}{decision.decision === 'APPROVE' && <small>Eligible for a future M4 workflow; Anchor remains the final authority.</small>}</div>}
    </div>
    {error && <div className="m3-error"><CircleAlert size={15}/>{error}</div>}
    <p className="m3-disclaimer">The AI is an interpreter, not an authorization source. A valid intent does not authorize funds; the firewall checks transaction data and live mandate policy. No execution button is available in M3.</p>
  </section>;
}
