'use client';

import { useState } from 'react';
import { Activity, ArrowUpRight, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { verifyLendingProposal, type LendingEvidence, type LendingProposal } from '@/lib/lending';

// Test-only labels: never sent to RPC, the AI provider, or a wallet.
const fixtureMint = 'TEST_FIXTURE_ASSET_MINT_000000000000000';
const fixtureBorrower = 'TEST_FIXTURE_BORROWER_000000000000000000';
const fixtureAgent = 'TEST_FIXTURE_AGENT_00000000000000000000';
const fixtureUsedProposalIds = new Set<string>();
const fixtureEvidence: LendingEvidence = {
  supportedMints: [fixtureMint], assetMint: fixtureMint, tokenAccountOwner: '11111111111111111111111111111111', owner: '11111111111111111111111111111111',
  quantityBaseUnits: 1_000_000_000n, priceMicrosPerWholeToken: 1_000_000_000n, tokenDecimals: 9,
  priceObservedAt: 1_800_000_000, priceSource: 'fixture-price-v1', allowedPriceSources: ['fixture-price-v1'], now: 1_800_000_100, maxPriceAgeSeconds: 300,
  requestedAmountMicros: 300_000_000n, borrower: fixtureBorrower, loanAsset: 'USDC', durationSeconds: 86_400,
  availableLiquidityMicros: 500_000_000n, dailyExposureMicros: 0n, agent: fixtureAgent, mandateAgent: fixtureAgent, mandateActive: true,
  mandateExpiry: 1_900_000_000, nonce: 7n, usedProposalIds: fixtureUsedProposalIds,
  policy: { maxLtvBps: 6_500n, minCollateralRatioBps: 15_000n, maxLoanMicros: 500_000_000n, maxDurationSeconds: 2_592_000, maxDailyExposureMicros: 1_000_000_000n, allowedBorrowers: [fixtureBorrower], expiresAt: 1_900_000_000 },
};

export function LendingWorkspace({ walletAddress, agentAddress, mandate }: { walletAddress: string; agentAddress: string; mandate: { active: boolean; expiry: number; nonce: string } | null }) {
  const [busy, setBusy] = useState(false);
  const [assessment, setAssessment] = useState<LendingProposal | null>(null);
  const [verification, setVerification] = useState<ReturnType<typeof verifyLendingProposal> | null>(null);
  const [error, setError] = useState('');
  const [scenario, setScenario] = useState<'valid' | 'high-ltv' | 'borrower'>('valid');

  const runDemo = async () => {
    setBusy(true); setError(''); setAssessment(null); setVerification(null);
    const requested = scenario === 'high-ltv' ? '700000000' : '300000000';
    const borrower = scenario === 'borrower' ? 'TEST_FIXTURE_UNAUTHORIZED_BORROWER_0000000' : fixtureBorrower;
    try {
      const proposal: LendingProposal = {
        proposal_id: `fixture-${scenario}`, decision: 'PROPOSE', asset_mint: fixtureMint, borrower, agent: fixtureAgent, nonce: '7', duration_seconds: 86_400,
        loan_asset: 'TEST_USD', requested_amount: requested, collateral_value: '1000000000', risk_level: 'MODERATE',
        risk_factors: ['Test-only fixture; no issuer or market data'], recommendation: 'Illustrative assessment only. No external AI or market data used.', requires_verification: true,
      };
      setAssessment(proposal);
      const e = { ...fixtureEvidence, requestedAmountMicros: BigInt(requested), borrower, availableLiquidityMicros: 800_000_000n, policy: { ...fixtureEvidence.policy, maxLoanMicros: 800_000_000n } };
      setVerification(verifyLendingProposal(proposal, e));
      fixtureUsedProposalIds.add(proposal.proposal_id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Assessment unavailable.'); }
    finally { setBusy(false); }
  };

  return <>
    <section className="lending-section" id="portfolio">
      <div className="section-heading"><div><div className="eyebrow">SELECTIVE DISCLOSURE · ADAPTER STATUS</div><h2>Portfolio eligibility</h2><p>Review one chosen asset position. No wallet inventory is sent to the assessment service.</p></div><span className="status-chip unavailable">UNAVAILABLE</span></div>
      <div className="portfolio-layout"><div className="portfolio-asset"><div className="asset-mark">EQ</div><div><b>Supported tokenized equity assets</b><span>No issuer-verified Devnet mint is configured.</span></div></div><div className="portfolio-details">
        <div><span>CONNECTED WALLET</span><b>{walletAddress || 'Not connected'}</b></div>
        <div><span>SELECTED POSITION</span><b>None · asset adapter unavailable</b></div>
        <div><span>OWNERSHIP / QUANTITY</span><b>Not verified</b></div>
        <div><span>VALUATION / ELIGIBILITY</span><b>Unavailable · no trusted price source</b></div>
      </div><div className="privacy-note"><LockKeyhole size={15}/><p><b>Selective disclosure by design.</b> This view does not scan or upload your full portfolio. A future verifier still needs a supported mint and proof source; hiding balances in the interface alone is not on-chain privacy.</p></div></div>
    </section>
    <section className="lending-section" id="lending-agent">
      <div className="section-heading"><div><div className="eyebrow">ADVISORY ONLY · FIXTURE ASSESSMENT</div><h2>Lending agent</h2><p>AI can assess an opportunity. A fixed-point verifier checks the proposal independently.</p></div><span className="status-chip demo">DEMO DATA</span></div>
      <div className="lending-grid"><div className="lending-card"><div className="lending-card-head"><Sparkles size={16}/><b>Assessment inputs</b></div><div className="lending-row"><span>AGENT IDENTITY</span><b>{agentAddress || 'Not loaded'}</b></div><div className="lending-row"><span>OWNER MANDATE</span><b>{mandate ? mandate.active ? 'Active · payment limits only' : 'Revoked / expired' : 'Unavailable'}</b></div><div className="lending-row"><span>RISK PREFERENCE</span><b>Maximum LTV 65% · minimum ratio 150%</b></div><div className="scenario-select"><span>FIXTURE SCENARIO</span>{(['valid', 'high-ltv', 'borrower'] as const).map(s => <button key={s} className={scenario === s ? 'selected' : ''} onClick={() => setScenario(s)}>{s === 'valid' ? '30% LTV' : s === 'high-ltv' ? 'Excessive LTV' : 'Unauthorized borrower'}</button>)}</div><button className="primary-button" onClick={() => void runDemo()} disabled={busy}><Sparkles size={15}/>{busy ? 'Assessing…' : 'Run illustrative assessment'}</button><small>Uses fictional asset, borrower, liquidity and price fixtures; never triggers a transaction.</small></div>
        <div className="lending-card"><div className="lending-card-head"><ShieldCheck size={16}/><b>Independent verification</b></div>{verification ? <><div className={`verification-result ${verification.outcome === 'VERIFIED' ? 'verified' : 'rejected'}`}><b>{verification.outcome}</b><span>SIMULATED · fixture inputs</span><p>{verification.explanation || 'All fixture policy checks passed.'}</p></div><div className="lending-row"><span>CALCULATED COLLATERAL</span><b>{verification.collateralValueMicros ? `$${(Number(verification.collateralValueMicros) / 1_000_000).toFixed(2)} · fixture` : '—'}</b></div><div className="lending-row"><span>CALCULATED LTV</span><b>{verification.ltvBps ? `${(Number(verification.ltvBps) / 100).toFixed(2)}%` : '—'}</b></div>{verification.reasonCodes.length > 0 && <div className="reason-codes">{verification.reasonCodes.map(code => <code key={code}>{code}</code>)}</div>}</> : <div className="lending-empty"><Activity size={18}/><b>Awaiting an assessment</b><span>No proposal has been verified.</span></div>}{assessment && <div className="ai-recommendation"><span>FIXTURE NOTE · NOT AN AI ASSESSMENT</span><p>{assessment.recommendation}</p></div>}</div></div>
      {error && <div className="assessment-error">{error}</div>}
      <div className="execution-boundary"><ArrowUpRight size={15}/><p><b>Settlement not implemented.</b> The deployed M1 program authorizes native SOL payments. It does not lock equity collateral or issue USDC loans, and this proposal cannot be routed through its payment instruction.</p></div>
    </section>
  </>;
}
