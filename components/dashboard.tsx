/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Keypair, SystemProgram } from '@solana/web3.js';
import { AnchorProvider, BN } from '@coral-xyz/anchor';
import { Activity, ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, CircleAlert, Copy, Fingerprint, KeyRound, Landmark, LockKeyhole, Shield, Wallet, Zap } from 'lucide-react';
import { PROGRAM_ID, hasValidRpcConfiguration } from '@/lib/config';
import { verifyDevnetIdentity, type ClusterIdentity } from '@/lib/network';
import { createProgram, deploymentAvailable, readMandate } from '@/lib/chain';
import { prepareOwnerTransaction, walletErrorMessage } from '@/lib/transactions';
import { getWalletConnectionState } from '@/lib/wallet-state';
import { deriveMandate, formatSol, lamportsToSolInput, validatePolicy, solToLamports } from '@/lib/mandate';
import { clearAgentSecretMemory, createEncryptedBackup, loadBackups, parseEncryptedBackup, restoreEncryptedBackup, saveBackup, type EncryptedBackup } from '@/lib/agent-vault';
import { LendingWorkspace } from '@/components/lending-workspace';

const short = (s: string) => `${s.slice(0, 5)}…${s.slice(-5)}`;
const toBn = (n: bigint) => new BN(n.toString());
type TxStatus = { phase: 'idle' | 'approval' | 'submitted' | 'confirmed' | 'failed' | 'unknown'; message: string; signature?: string };

export function Dashboard() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [deployed, setDeployed] = useState<boolean | null>(null);
  const [clusterStatus, setClusterStatus] = useState<ClusterIdentity | 'checking' | 'invalid-config'>('checking');
  const [chainError, setChainError] = useState('');
  const [record, setRecord] = useState<any>(null);
  const [agentSecret, setAgentSecret] = useState<Uint8Array | null>(null);
  const [agentPublic, setAgentPublic] = useState('');
  const [saved, setSaved] = useState<EncryptedBackup[]>([]);
  const [passphrase, setPassphrase] = useState('');
  const [tx, setTx] = useState<TxStatus>({ phase: 'idle', message: '' });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('Overview');
  const [form, setForm] = useState({ agent: '', recipient: '', maxPerTxSol: '', dailyLimitSol: '', expiresAt: '' });
  const [amount, setAmount] = useState('');
  const owner = wallet.publicKey;
  const rpcConfigOkay = hasValidRpcConfiguration(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);
  const canAdminister = clusterStatus === 'verified' && deployed === true;

  const refresh = useCallback(async () => {
    setChainError('');
    setClusterStatus('checking');
    if (!rpcConfigOkay) { setClusterStatus('invalid-config'); setDeployed(null); setRecord(null); setChainError('RPC configuration is malformed. Use a valid HTTPS RPC endpoint.'); return; }
    const identity = await verifyDevnetIdentity(connection);
    setClusterStatus(identity.status);
    if (identity.status !== 'verified') {
      setDeployed(null); setRecord(null);
      setChainError(identity.status === 'wrong-cluster' ? 'The configured RPC genesis hash does not match Solana Devnet.' : 'Could not verify the RPC cluster identity. The endpoint may be unavailable or timed out.');
      return;
    }
    let available = false;
    try { available = await deploymentAvailable(connection); setDeployed(available); }
    catch { setDeployed(null); setChainError('Devnet identity is verified, but the program deployment check failed.'); return; }
    if (!available) { setRecord(null); return; }
    if (owner) { try { setRecord(await readMandate(connection, owner)); } catch (error) { setRecord(null); setChainError(error instanceof Error ? `Mandate state could not be loaded: ${error.message}` : 'Mandate state could not be loaded.'); } }
    else setRecord(null);
  }, [connection, owner, rpcConfigOkay]);
  // The refresh function synchronizes this component with the external RPC.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { void loadBackups().then(setSaved).catch(() => setSaved([])); }, []);
  useEffect(() => {
    if (!agentSecret) return;
    const clearMemoryBestEffort = () => clearAgentSecretMemory(agentSecret);
    window.addEventListener('pagehide', clearMemoryBestEffort);
    return () => window.removeEventListener('pagehide', clearMemoryBestEffort);
  }, [agentSecret]);
  useEffect(() => {
    if (!record?.state) return;
    const date = new Date(Number(record.state.expiresAt.toString()) * 1000);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    // Seed editable fields when an on-chain account is loaded or refreshed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({ agent: record.state.agent.toBase58(), recipient: record.state.recipient.toBase58(), maxPerTxSol: lamportsToSolInput(record.state.maxPerTx), dailyLimitSol: lamportsToSolInput(record.state.dailyLimit), expiresAt: local });
  }, [record]);

  const agentLoaded = Boolean(agentSecret && agentPublic);
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); setToast('Copied to clipboard'); window.setTimeout(() => setToast(''), 1800); };
  const generateAgent = () => {
    if (record?.state?.agent) { setToast('This mandate already references an agent. Restore that identity before replacing it.'); return; }
    const pair = Keypair.generate(); setAgentSecret(pair.secretKey); setAgentPublic(pair.publicKey.toBase58()); setForm(f => ({ ...f, agent: pair.publicKey.toBase58() }));
  };
  const lockAgent = () => {
    if (agentSecret && !saved.some(backup => backup.publicKey === agentPublic) && !window.confirm('No encrypted backup is saved in this browser. Locking will discard this identity. Continue?')) return;
    if (agentSecret) clearAgentSecretMemory(agentSecret);
    setAgentSecret(null); setAgentPublic(''); setPassphrase('');
  };
  const backupAgent = async () => {
    if (!agentSecret || !passphrase) return;
    try { const backup = await createEncryptedBackup(agentSecret, agentPublic, passphrase); await saveBackup(backup); setSaved(await loadBackups()); setToast('Encrypted backup saved in this browser'); }
    catch (e) { setToast(e instanceof Error ? e.message : 'Could not encrypt backup'); }
    setPassphrase('');
  };
  const unlockAgent = async (backup: EncryptedBackup) => {
    try { const secret = await restoreEncryptedBackup(backup, passphrase); const key = Keypair.fromSecretKey(secret); if (key.publicKey.toBase58() !== backup.publicKey) throw new Error('Backup public key does not match its secret.'); setAgentSecret(secret); setAgentPublic(key.publicKey.toBase58()); setForm(f => ({ ...f, agent: key.publicKey.toBase58() })); setPassphrase(''); }
    catch (e) { setToast(e instanceof Error ? e.message : 'Could not restore agent identity'); }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try { const b = parseEncryptedBackup(JSON.parse(await file.text())); const secret = await restoreEncryptedBackup(b, passphrase); const key = Keypair.fromSecretKey(secret); if (key.publicKey.toBase58() !== b.publicKey) throw new Error('Backup public key does not match its secret.'); await saveBackup(b); setSaved(await loadBackups()); setAgentSecret(secret); setAgentPublic(key.publicKey.toBase58()); setForm(f => ({ ...f, agent: key.publicKey.toBase58() })); setPassphrase(''); setToast('Agent identity restored in memory'); }
    catch (e) { setToast(e instanceof Error ? e.message : 'Backup could not be restored'); }
  };
  const exportBackup = (backup: EncryptedBackup) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `tr-agent-${backup.publicKey.slice(0, 8)}.encrypted.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const submit = async (label: string, build: (program: ReturnType<typeof createProgram>) => Promise<any>) => {
    if (!wallet.publicKey || !wallet.sendTransaction || !canAdminister || busy) return;
    setBusy(true); setTx({ phase: 'approval', message: `Preparing ${label.toLowerCase()} for wallet review.` });
    let signature: string | undefined;
    try {
      const providerWallet = { publicKey: wallet.publicKey, signTransaction: wallet.signTransaction, signAllTransactions: wallet.signAllTransactions } as AnchorProvider['wallet'];
      const program = createProgram(connection, providerWallet);
      const instruction = await build(program);
      const prepared = await prepareOwnerTransaction(connection, wallet.publicKey, instruction);
      setTx({ phase: 'approval', message: `${label}: estimated fee ${formatSol(prepared.feeLamports)} SOL. Approve in your wallet.` });
      signature = await wallet.sendTransaction(prepared.transaction, connection);
      setTx({ phase: 'submitted', message: `${label} submitted. Waiting for Devnet confirmation.`, signature });
      const result = await connection.confirmTransaction({ signature, ...prepared.latest }, 'confirmed');
      if (result.value.err) throw new Error('Devnet reported a transaction error.');
      setTx({ phase: 'confirmed', message: `${label} confirmed on Devnet.`, signature });
      await refresh();
    } catch (error) {
      const message = walletErrorMessage(error);
      const rejected = message === 'Wallet approval was rejected.';
      let phase: TxStatus['phase'] = rejected ? 'failed' : 'unknown';
      if (signature) {
        try {
          const status = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
          if (status.value[0]?.err) { phase = 'failed'; }
          else if (status.value[0]?.confirmationStatus === 'confirmed' || status.value[0]?.confirmationStatus === 'finalized') { phase = 'confirmed'; await refresh(); }
        } catch { /* Keep the status unknown when the RPC cannot resolve an ambiguous signature. */ }
      }
      const detail = phase === 'failed' ? `Transaction failed: ${message}` : phase === 'confirmed' ? `${label} confirmed on Devnet.` : rejected ? message : `Confirmation unknown; inspect the signature before retrying. ${message}`;
      setTx({ phase, message: detail, signature });
    } finally { setBusy(false); }
  };
  const accounts = () => { if (!owner) throw new Error('Connect the owner wallet.'); const { mandate, vault } = deriveMandate(owner, PROGRAM_ID); return { owner, mandate, vault, systemProgram: SystemProgram.programId }; };
  const init = async () => {
    if (!owner) return;
    try { const policy = validatePolicy(form, undefined, owner!); await submit(`Initialize mandate · agent ${short(policy.agent.toBase58())} · recipient ${short(policy.recipient.toBase58())} · ${formatSol(policy.maxPerTx)}/${formatSol(policy.dailyLimit)} SOL daily · expires ${new Date(Number(policy.expiresAt) * 1000).toLocaleString()}`,  (program) => (program as any).methods.initializeMandate(policy.agent, policy.recipient, toBn(policy.maxPerTx), toBn(policy.dailyLimit), toBn(policy.expiresAt)).accounts({ ...accounts() }).instruction()); }
    catch (e) { setToast(e instanceof Error ? e.message : 'Review mandate inputs'); }
  };
  const act = async (label: string, action: (program: ReturnType<typeof createProgram>) => Promise<any>) => submit(label, action);
  const deposit = async () => { try { const value = solToLamports(amount); await act(`Deposit ${formatSol(value)} SOL into vault ${short(deriveMandate(owner!, PROGRAM_ID).vault.toBase58())}`,  p => (p as any).methods.deposit(toBn(value)).accounts(accounts()).instruction()); } catch (e) { setToast(e instanceof Error ? e.message : 'Invalid amount'); } };
  const withdraw = async () => { try { const value = solToLamports(amount); if (!owner) throw new Error('Connect the owner wallet.'); const fresh = await readMandate(connection, owner); if (!fresh.state) throw new Error('Mandate account is unavailable.'); if (value > (fresh.vaultLamports > fresh.reserve ? fresh.vaultLamports - fresh.reserve : 0n)) throw new Error('Withdrawal exceeds the balance available above the vault rent reserve.'); await act(`Withdraw ${formatSol(value)} SOL to owner ${short(owner.toBase58())}`,  p => (p as any).methods.withdraw(toBn(value)).accounts(accounts()).instruction()); } catch (e) { setToast(e instanceof Error ? e.message : 'Invalid amount'); } };
  const update = async () => { if (!owner) return; try { const policy = validatePolicy(form, undefined, owner!); const fresh = await readMandate(connection, owner); if (!fresh.state) throw new Error('Mandate account is no longer available.'); if (!policy.agent.equals(fresh.state.agent) && !window.confirm('This changes the registered agent identity. Confirm the existing key is backed up and authorize the new agent.')) return; await act(`Update policy · nonce currently ${fresh.state.nonce}`,   p => (p as any).methods.updateMandate(policy.agent, policy.recipient, toBn(policy.maxPerTx), toBn(policy.dailyLimit), toBn(policy.expiresAt)).accounts({ owner, mandate: deriveMandate(owner, PROGRAM_ID).mandate }).instruction()); } catch (e) { setToast(e instanceof Error ? e.message : 'Invalid policy'); } };
  const toggleRevoke = async () => {
    if (!owner) return;
    try {
      const fresh = await readMandate(connection, owner);
      if (!fresh.state) throw new Error('Mandate account is unavailable.');
      setRecord(fresh);
      if (!fresh.state.revoked && !window.confirm('Revoke this agent? Existing requests become invalid. Reactivation is a separate owner action.')) return;
      if (fresh.state.revoked && !window.confirm('Reactivate this agent? This does not reset spending or nonce history. If expired, extend the policy expiry first.')) return;
      await act(fresh.state.revoked ? 'Agent reactivation' : 'Agent revocation', p => (fresh.state!.revoked ? (p as any).methods.reactivateAgent() : (p as any).methods.revokeAgent()).accounts({ owner, mandate: fresh.mandate }).instruction());
    } catch (e) { setToast(e instanceof Error ? e.message : 'Could not read mandate state.'); }
  };
  const state = record?.state;
  const expiry = state ? new Date(Number(state.expiresAt.toString()) * 1000).toLocaleString() : '—';
  const spent = state ? (record.effectiveSpentToday ?? BigInt(state.spentToday.toString())) : 0n;
  const daily = state ? BigInt(state.dailyLimit.toString()) : 0n;
  const reserve = record?.reserve ?? 0n;
  const remaining = daily > spent ? daily - spent : 0n;
  const bannerTitle = clusterStatus === 'checking' ? 'Verifying RPC cluster identity' : clusterStatus === 'invalid-config' ? 'Invalid RPC configuration' : clusterStatus === 'unavailable' ? 'Devnet identity unavailable' : clusterStatus === 'wrong-cluster' ? 'Wrong Solana cluster' : deployed === true ? 'Devnet program verified' : deployed === false ? 'Devnet verified · program not deployed' : 'Program deployment check unavailable';
  const bannerDescription = chainError || (clusterStatus === 'verified' && deployed === true ? `Program ${short(PROGRAM_ID.toBase58())} is executable on verified Devnet.` : clusterStatus === 'verified' ? 'Devnet identity is verified, but no executable program is deployed at the configured program ID.' : 'Administrative actions remain disabled until Devnet identity is verified.');

  return <main className="shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">t<span>r</span></div><div><b>trust trail</b><small>CONTROL PLANE</small></div></div>
      <div className="side-label">WORKSPACE</div><nav>{[['Overview', Activity, 'overview-panel'], ['Portfolio', Landmark, 'portfolio'], ['Lending Agent', Zap, 'lending-agent'], ['Mandate', Shield, 'mandate-actions'], ['Activity', Activity, 'activity-panel']].map(([label, Icon, target]: any) => <button key={label} onClick={() => { setTab(label); document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className={`nav-item ${tab === label ? 'active' : ''}`}><Icon size={17}/>{label}</button>)}</nav>
      <div className="side-bottom"><div className="secure-chip"><LockKeyhole size={14}/><span>Owner controlled</span></div><span className="version">MVP · DEVNET</span></div></aside>
    <section className="main-area"><header className="topbar"><div className="mobile-brand">tr <span>trust trail</span></div><div className="breadcrumb">Workspace <span>/</span> <b>{tab}</b></div><div className="top-actions"><div className="network"><i/> {clusterStatus === 'verified' ? 'Solana Devnet verified' : clusterStatus === 'wrong-cluster' ? 'Wrong cluster' : clusterStatus === 'unavailable' ? 'RPC unavailable' : clusterStatus === 'invalid-config' ? 'Invalid RPC' : 'Checking Devnet'} <ChevronDown size={13}/></div><WalletConnect/></div></header>
      <div className="content"><div className="welcome"><div><div className="eyebrow">ASSESS. VERIFY. KEEP OWNER CONTROL.</div><h1>{tab === 'Overview' ? 'Private Equity. Autonomous Intelligence. Verifiable Trust.' : tab}</h1><p>Assess a lending opportunity with server-checked evidence. Equity ownership, live valuation and loan settlement remain unavailable until their providers exist.</p></div><div className="date-pill">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div></div>
      <div className={`deployment-banner ${canAdminister ? 'live' : ''}`}><div className="banner-icon">{canAdminister ? <Check size={18}/> : <CircleAlert size={18}/>}</div><div><b>{bannerTitle}</b><p>{bannerDescription}</p></div><button className="icon-button" aria-label="Refresh network status" onClick={() => void refresh()}><Activity size={16}/></button></div>
      <div className="stats-grid"><Stat label="ELIGIBLE COLLATERAL" value="Unavailable" detail="No supported equity mint" icon={<Landmark/>}/><Stat label="PENDING PROPOSALS" value="0 live" detail="Fixture assessment only" icon={<Activity/>}/><Stat label="AUTHORIZED / REJECTED" value="Not available" detail="No live lending policy" icon={<Shield/>}/><Stat label="WALLET / NETWORK" value={owner ? (clusterStatus === 'verified' ? 'Connected · Devnet' : 'Connected') : 'Not connected'} detail={owner ? short(owner.toBase58()) : 'Connect to administer'} icon={<Wallet/>} accent={Boolean(owner)}/></div>
      <div className="dashboard-grid"><div className="panel overview-panel" id="overview-panel"><div className="panel-head"><div><div className="eyebrow">ON-CHAIN ACCOUNT</div><h2>Mandate overview</h2></div><span className={`state-badge ${state?.revoked ? 'red' : state ? 'green' : ''}`}><i/>{state ? state.revoked ? 'REVOKED' : 'ACTIVE' : 'NOT FOUND'}</span></div>
        {state ? <><div className="account-grid"><Info label="OWNER WALLET" value={state.owner.toBase58()} onCopy={() => void copy(state.owner.toBase58())}/><Info label="AGENT PUBLIC KEY" value={state.agent.toBase58()} onCopy={() => void copy(state.agent.toBase58())}/><Info label="APPROVED RECIPIENT" value={state.recipient.toBase58()} onCopy={() => void copy(state.recipient.toBase58())}/><Info label="EXPIRY" value={expiry}/><Info label="PER-TRANSACTION CAP" value={`${formatSol(BigInt(state.maxPerTx.toString()))} SOL`}/><Info label="DAILY SPENDING LIMIT" value={`${formatSol(daily)} SOL`}/></div><div className="allowance"><div><div className="allowance-label">SPENDING TODAY <span>{formatSol(spent)} / {formatSol(daily)} SOL</span></div><div className="progress"><i style={{ width: `${daily ? Math.min(100, Number(spent * 100n / daily)) : 0}%` }}/></div></div><div className="remaining"><span>REMAINING</span><b>{formatSol(remaining)} <small>SOL</small></b></div></div><div className="panel-foot"><span>Mandate nonce</span><b>{state.nonce.toString()}</b><span>Vault rent reserve</span><b>{formatSol(reserve)} SOL</b></div></> : <div className="empty-state"><div className="empty-icon"><Shield size={21}/></div><b>{owner ? deployed ? 'No mandate found for this owner' : 'Waiting for Devnet deployment' : 'Connect an owner wallet'}</b><p>{owner ? deployed ? 'Create a mandate with a dedicated agent identity and an approved recipient.' : 'Account data is not available until the program is verified on Devnet.' : 'Connect your Solana wallet to inspect or administer your mandate.'}</p>{owner && canAdminister && <button className="primary-button" onClick={() => setTab('Mandate')}>Set up mandate</button>}</div>}</div>
        <div className="panel identity-panel" id="agent-identity"><div className="panel-head"><div><div className="eyebrow">SEPARATE SIGNING IDENTITY</div><h2>Agent identity</h2></div><span className="identity-icon"><Fingerprint size={18}/></span></div><p className="panel-copy">A dedicated public identity for the mandate. Its secret stays in this browser and is never sent to a server.</p>{agentLoaded ? <div className="loaded-identity"><div className="loaded-dot"/><div><b>{short(agentPublic)}</b><small>Secret held in memory only</small></div><button className="small-icon" onClick={() => void copy(agentPublic)} aria-label="Copy agent public key"><Copy size={14}/></button><button className="small-icon" onClick={lockAgent} aria-label="Lock agent identity"><LockKeyhole size={14}/></button></div> : <button className="secondary-button full" onClick={generateAgent}><KeyRound size={15}/> Generate agent identity</button>}<div className="backup-box"><b>Encrypted backup</b><span>PBKDF2 · AES-GCM</span></div><input className="text-input" type="password" autoComplete="new-password" placeholder="Backup passphrase (12+ characters)" value={passphrase} onChange={e => setPassphrase(e.target.value)}/>{agentLoaded && <button className="secondary-button full" onClick={() => void backupAgent()} disabled={passphrase.length < 12}><LockKeyhole size={14}/> Save encrypted backup</button>}{saved.map(b => <div className="backup-row" key={b.publicKey}><span>{short(b.publicKey)}</span><div><button onClick={() => exportBackup(b)}>Export</button><button onClick={() => void unlockAgent(b)} disabled={passphrase.length < 12}>Unlock</button></div></div>)}<label className="file-link">Restore encrypted backup file<input type="file" accept="application/json,.json" onChange={e => void importFile(e.target.files?.[0])}/></label><small className="warning-note">If you lose both the backup and passphrase, this identity cannot be recovered. Closing the page or using Lock clears the in-memory buffer on a best-effort basis; JavaScript and browser tooling may retain copies. Encryption does not protect against malware, malicious extensions or an active same-origin attack.</small></div></div>
      <LendingWorkspace walletAddress={owner?.toBase58() ?? ''} agentAddress={agentPublic} mandate={state ? { active: !state.revoked, expiry: Number(state.expiresAt.toString()), nonce: state.nonce.toString() } : null}/>
      <div className="lower-grid"><div className="panel action-panel" id="mandate-actions"><div className="panel-head"><div><div className="eyebrow">OWNER AUTHORIZATION · NATIVE SOL ONLY</div><h2>{state ? 'Mandate and vault' : 'Create mandate'}</h2></div><span className="action-count">{state ? 'LIVE M1' : 'DEVNET'}</span></div>{!state ? <><label>Agent public key<input className="text-input" value={form.agent} onChange={e => setForm({...form, agent:e.target.value})} placeholder="Generate or paste a public key"/></label><label>Approved recipient<input className="text-input" value={form.recipient} onChange={e => setForm({...form, recipient:e.target.value})} placeholder="Solana public key"/></label><div className="form-row"><label>Max per transaction<input className="text-input" value={form.maxPerTxSol} onChange={e => setForm({...form,maxPerTxSol:e.target.value})} placeholder="0.10 SOL"/></label><label>Daily limit<input className="text-input" value={form.dailyLimitSol} onChange={e => setForm({...form,dailyLimitSol:e.target.value})} placeholder="0.50 SOL"/></label></div><label>Expiry date and time<input className="text-input" type="datetime-local" value={form.expiresAt} onChange={e => setForm({...form,expiresAt:e.target.value})}/></label><button className="primary-button full" onClick={() => void init()} disabled={!owner || !canAdminister || busy || !agentLoaded}><Shield size={15}/> Initialize mandate</button><small className="form-hint">Owner wallet signs initialization. Amounts are converted to integer lamports.</small></> : <><label>Amount in SOL<input className="text-input" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.05" inputMode="decimal"/></label><div className="button-row"><button className="primary-button" onClick={() => void deposit()} disabled={!canAdminister || !owner || busy}><ArrowDownToLine size={15}/> Deposit</button><button className="secondary-button" onClick={() => void withdraw()} disabled={!canAdminister || !owner || busy}><ArrowUpFromLine size={15}/> Withdraw</button></div><div className="action-divider"/><details className="policy-editor"><summary>Edit mandate policy</summary><label>Agent public key<input className="text-input" value={form.agent} onChange={e => setForm({...form,agent:e.target.value})}/></label><label>Approved recipient<input className="text-input" value={form.recipient} onChange={e => setForm({...form,recipient:e.target.value})}/></label><div className="form-row"><label>Max per transaction<input className="text-input" value={form.maxPerTxSol} onChange={e => setForm({...form,maxPerTxSol:e.target.value})}/></label><label>Daily limit<input className="text-input" value={form.dailyLimitSol} onChange={e => setForm({...form,dailyLimitSol:e.target.value})}/></label></div><label>Expiry<input className="text-input" type="datetime-local" value={form.expiresAt} onChange={e => setForm({...form,expiresAt:e.target.value})}/></label><button className="secondary-button full" disabled={!canAdminister || !owner || busy} onClick={() => void update()}>Update policy</button></details><button className={`secondary-button full ${state.revoked ? '' : 'danger-button'}`} disabled={!canAdminister || !owner || busy} onClick={() => void toggleRevoke()}>{state.revoked ? 'Reactivate agent' : 'Revoke agent'}</button><small className="form-hint">Withdrawals preserve the vault rent reserve. Policy edits increment nonce and do not reactivate a revoked mandate.</small></>}</div>
        <div className="panel activity-panel" id="activity-panel"><div className="panel-head"><div><div className="eyebrow">TRANSACTION MONITOR</div><h2>Recent activity</h2></div><Activity size={17} className="muted-icon"/></div><div className="activity-placeholder">{tx.phase === 'idle' ? <><div className="activity-empty"><Activity size={18}/></div><b>No recent transactions</b><p>Confirmed owner actions will appear here.</p></> : <div className={`tx-status ${tx.phase}`}><div className="tx-status-icon">{tx.phase === 'confirmed' ? <Check size={16}/> : tx.phase === 'failed' ? <CircleAlert size={16}/> : <Activity size={16}/>}</div><div><b>{tx.message}</b>{tx.signature && <a href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`} target="_blank" rel="noreferrer">View on Solana Explorer ↗</a>}</div></div>}</div><div className="activity-footer"><span>CLUSTER</span><b>Solana Devnet</b><span>PROGRAM</span><b>{short(PROGRAM_ID.toBase58())}</b></div></div></div>
      <footer className="page-footer"><span>tr <i/> TRUST TRAIL · SOLANA DEVNET</span><span>AI proposes. Deterministic checks verify. Owner mandate controls supported native SOL actions.</span><a href="https://explorer.solana.com/address/7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY?cluster=devnet" target="_blank" rel="noreferrer">Program explorer ↗</a></footer></div></section>{toast && <div className="toast"><Check size={15}/>{toast}</div>}
  </main>;
}
function Stat({ label, value, detail, icon, accent = false }: {label:string;value:string;detail:string;icon:React.ReactNode;accent?:boolean}) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={accent ? 'stat-icon accent' : 'stat-icon'}>{icon}</div></div><b className="stat-value">{value}</b><span className="stat-detail">{detail}</span></div>; }
function Info({ label, value, onCopy }: {label:string;value:string;onCopy?:()=>void}) { return <div className="info-cell"><span>{label}</span><b>{value}{onCopy && <button className="copy-button" onClick={onCopy} aria-label={`Copy ${label}`}><Copy size={12}/></button>}</b></div>; }
function WalletConnect() {
  const { connected, connecting, wallets, wallet, select, connect, disconnect, publicKey } = useWallet();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [pendingConnect, setPendingConnect] = useState(false);
  const connectionState = getWalletConnectionState({ providerCount: wallets.length, connecting, connected, address: publicKey?.toBase58() });
  useEffect(() => {
    if (!pendingConnect || !wallet) return;
    // Wait until wallet-adapter has replaced its selected adapter before connecting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingConnect(false);
    void connect().catch(e => setError(walletErrorMessage(e)));
  }, [pendingConnect, wallet, connect]);
  const choose = (name: typeof wallets[number]['adapter']['name']) => {
    setError(''); select(name); setOpen(false); setPendingConnect(true);
  };
  return <div className="wallet-connect-wrap"><button className="wallet-button" onClick={() => connected ? void disconnect() : setOpen(!open)}>{connectionState.status === 'connecting' ? 'Connecting…' : connectionState.status === 'connected' ? short(connectionState.address!) : 'Connect wallet'}</button>{open && <div className="wallet-menu">{wallets.length ? wallets.map(w => <button key={w.adapter.name} onClick={() => void choose(w.adapter.name)}>{w.adapter.name}</button>) : <span>No Wallet Standard wallet detected</span>}{error && <small>{error}</small>}</div>}</div>;
}
