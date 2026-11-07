'use client';

import { useState } from 'react';
import { Activity, ArrowUpRight, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import type { LendingProposal } from '@/lib/lending';

type ServerDecision = {
  decision: 'LIVE_VERIFIED' | 'DEMO_VERIFIED' | 'REJECTED' | 'NEEDS_REVIEW' | 'UNAVAILABLE';
  mode: 'LIVE' | 'DEMO' | 'NONE';
  reasonCodes: string[];
  explanation: string;
  evidenceSource: string;
  evidenceTimestamp: string;
  collateralValueMicros?: string;
  calculatedLtvBps?: string;
  collateralRatioBps?: string;
  policy?: Record<string, string | number | string[]>;
  settlement?: string;
};

const DEMO = {
  mint: '11111111111111111111111111111111',
  borrower: 'Stake11111111111111111111111111111111111111',
  agent: 'Vote111111111111111111111111111111111111111',
  nonce: '7',
};

export function LendingWorkspace({ walletAddress, agentAddress, mandate }: { walletAddress: string; agentAddress: string; mandate: { active: boolean; expiry: number; nonce: string } | null }) {
  const [busy, setBusy] = useState(false);
  const [assessment, setAssessment] = useState<LendingProposal | null>(null);
  const [verification, setVerification] = useState<ServerDecision | null>(null);
  const [error, setError] = useState('');
  const [scenario, setScenario] = useState<'valid' | 'high-ltv' | 'borrower' | 'stale-price'>('valid');

  const assessOpportunity = async () => {
    setBusy(true); setError(''); setAssessment(null); setVerification(null);
    const amount = scenario === 'high-ltv' ? '700000000' : '300000000';
    const borrower = scenario === 'borrower' ? 'Vote111111111111111111111111111111111111111' : DEMO.borrower;
    try {
      const aiResponse = await fetch('/api/lending/assess', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetMint: DEMO.mint, borrower, agent: DEMO.agent, nonce: DEMO.nonce,
          durationSeconds: 86_400, loanAsset: 'DEMO_USD', requestedAmountMicros: amount,
          collateralValueMicros: '1000000000', riskPreferences: 'Demonstration policy fixture: maximum LTV 65%; minimum collateral ratio 150%; duration up to 30 days. Not owner-configured or executable.' }),
      });
      const aiBody = await aiResponse.json();
      if (!aiResponse.ok || !aiBody.proposal) {
        const messages: Record<string, string> = {
          AI_UNAVAILABLE: 'Groq is not configured. No recommendation or verification was substituted.',
          AI_TIMEOUT: 'Groq did not respond before the timeout. No assessment was created.',
          AI_RATE_LIMITED: 'Groq rate limit reached. No assessment was created.',
          AI_SCHEMA_MISMATCH: 'Groq returned a response that did not match the required assessment schema. No assessment was created.',
          AI_MALFORMED_RESPONSE: 'Groq returned an unreadable response. No assessment was created.',
          AI_AUTH_FAILED: 'Groq rejected its server credentials. No assessment was created.',
          AI_PROVIDER_ERROR: 'Groq provider error. No assessment was created.',
          AI_REQUEST_REJECTED: 'Groq rejected the structured assessment request. No assessment was created.',
          ASSESSMENT_UNAVAILABLE: 'The assessment service is unavailable. No fallback assessment was used.',
        };
        throw new Error(messages[aiBody.error] ?? `AI assessment failed (${aiBody.error ?? 'unexpected response'}). No assessment was created.`);
      }
      setAssessment(aiBody.proposal as LendingProposal);

      const verifyResponse = await fetch('/api/lending/verify', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'demo', scenario, proposal: aiBody.proposal }),
      });
      const verifyBody = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(`Server verification failed: ${verifyBody.error ?? 'verification unavailable'}.`);
      setVerification(verifyBody as ServerDecision);
    } catch (e) { setError(e instanceof Error ? e.message : 'Assessment unavailable.'); }
    finally { setBusy(false); }
  };

  return <>
    <section className="lending-section" id="portfolio">
      <div className="section-heading"><div><div className="eyebrow">SELECTIVE DISCLOSURE · ADAPTER STATUS</div><h2>Portfolio eligibility</h2><p>Only a selected position is needed for an ownership check. No wallet inventory is sent to Groq.</p></div><span className="status-chip unavailable">UNAVAILABLE</span></div>
      <div className="portfolio-layout"><div className="portfolio-asset"><div className="asset-mark">EQ</div><div><b>Issuer-verified tokenized equity</b><span>No supported equity mint is configured on Devnet.</span></div></div><div className="portfolio-details">
        <div><span>CONNECTED OWNER</span><b>{walletAddress || 'Not connected'}</b></div>
        <div><span>SELECTED POSITION</span><b>None · asset adapter unavailable</b></div>
        <div><span>OWNERSHIP / QUANTITY</span><b>Not verified</b></div>
        <div><span>VALUATION</span><b>Unavailable · no trusted live source</b></div>
      </div><div className="privacy-note"><LockKeyhole size={15}/><p><b>Selective disclosure.</b> Trust Trail limits portfolio information to the selected asset required for this assessment. Public Solana account and transaction data may still be observable on-chain.</p></div></div>
    </section>
    <section className="lending-section" id="lending-agent">
      <div className="section-heading"><div><div className="eyebrow">GROQ ADVISORY · SERVER VERIFICATION</div><h2>Lending agent</h2><p>Groq returns a structured recommendation; the server independently checks it against fixed demonstration evidence.</p></div><span className="status-chip demo">DEMO ONLY</span></div>
      <div className="lending-grid"><div className="lending-card"><div className="lending-card-head"><Sparkles size={16}/><b>Assessment inputs</b></div><div className="lending-row"><span>CONNECTED WALLET</span><b>{walletAddress || 'Not connected'}</b></div><div className="lending-row"><span>LIVE MANDATE AGENT</span><b>{agentAddress || 'Not loaded'}</b></div><div className="lending-row"><span>LIVE MANDATE</span><b>{mandate ? `${mandate.active ? 'Not revoked' : 'Revoked'} · nonce ${mandate.nonce} · SOL only` : 'Unavailable'}</b></div><div className="lending-row"><span>DEMO POLICY FIXTURE</span><b>Max LTV 65% · min ratio 150% · max 30 days</b></div><div className="scenario-select"><span>NEGATIVE TEST SCENARIO</span>{(['valid', 'high-ltv', 'borrower', 'stale-price'] as const).map(s => <button key={s} className={scenario === s ? 'selected' : ''} onClick={() => setScenario(s)}>{s === 'valid' ? 'Valid · 30% LTV' : s === 'high-ltv' ? 'Excessive LTV' : s === 'borrower' ? 'Unauthorized borrower' : 'Stale valuation'}</button>)}</div><button className="primary-button" onClick={() => void assessOpportunity()} disabled={busy}><Sparkles size={15}/>{busy ? 'Assessing…' : 'Assess lending opportunity'}</button><small>Uses Groq and server-owned fictional fixture values. No asset, loan, transfer, or transaction is created.</small></div>
        <div className="lending-card"><div className="lending-card-head"><ShieldCheck size={16}/><b>Independent server decision</b></div>{verification ? <><div className={`verification-result ${verification.decision === 'DEMO_VERIFIED' ? 'verified' : 'rejected'}`}><b>{verification.decision}</b><span>{verification.mode} · fixture evidence</span><p>{verification.explanation || 'Fixed-point checks passed for the demonstration fixture.'}</p></div><div className="lending-row"><span>CALCULATED COLLATERAL</span><b>{verification.collateralValueMicros ? `$${(Number(verification.collateralValueMicros) / 1_000_000).toFixed(2)} · demo` : '—'}</b></div><div className="lending-row"><span>CALCULATED LTV</span><b>{verification.calculatedLtvBps ? `${(Number(verification.calculatedLtvBps) / 100).toFixed(2)}%` : '—'}</b></div><div className="lending-row"><span>EVIDENCE</span><b>{verification.evidenceSource}</b></div><div className="lending-row"><span>EVIDENCE TIMESTAMP</span><b>{new Date(verification.evidenceTimestamp).toLocaleString()}</b></div>{verification.reasonCodes.length > 0 && <div className="reason-codes">{verification.reasonCodes.map(code => <code key={code}>{code}</code>)}</div>}</> : <div className="lending-empty"><Activity size={18}/><b>Awaiting an assessment</b><span>No new proposal has been assessed.</span></div>}{assessment && <div className="ai-recommendation"><span>GROQ RECOMMENDATION · ADVISORY ONLY</span><p>{assessment.recommendation}</p><small>{assessment.risk_level} · {assessment.decision}</small></div>}</div></div>
      {error && <div className="assessment-error">{error}</div>}
      <div className="execution-boundary"><ArrowUpRight size={15}/><p><b>Assessment prototype only.</b> DEMO_VERIFIED describes deterministic checks of fixture values; it does not establish collateral, authorize a loan, or enable settlement. The existing on-chain mandate controls native SOL payments only.</p></div>
    </section>
  </>;
}
