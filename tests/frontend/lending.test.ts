import { describe, expect, it } from 'vitest';
import { verifyLendingProposal, type LendingEvidence, type LendingProposal } from '../../lib/lending';

const owner = 'TEST_FIXTURE_OWNER';
const agent = 'TEST_FIXTURE_AGENT_00000000000000000000';
const mint = 'TEST_FIXTURE_ASSET_MINT_000000000000000';
const borrower = 'TEST_FIXTURE_BORROWER_000000000000000000';
const evidence: LendingEvidence = {
  supportedMints: [mint], assetMint: mint, tokenAccountOwner: owner, owner,
  quantityBaseUnits: 1_000_000_000n, priceMicrosPerWholeToken: 1_000_000_000n, tokenDecimals: 9,
  priceObservedAt: 1_800_000_000, priceSource: 'fixture-price-v1', allowedPriceSources: ['fixture-price-v1'],
  now: 1_800_000_100, maxPriceAgeSeconds: 300, requestedAmountMicros: 300_000_000n,
  borrower, loanAsset: 'USDC', durationSeconds: 86_400, availableLiquidityMicros: 500_000_000n,
  dailyExposureMicros: 0n, agent, mandateAgent: agent, mandateActive: true, mandateExpiry: 1_900_000_000,
  nonce: 7n, usedProposalIds: new Set(),
  policy: { maxLtvBps: 6_500n, minCollateralRatioBps: 15_000n, maxLoanMicros: 500_000_000n, maxDurationSeconds: 2_592_000, maxDailyExposureMicros: 1_000_000_000n, allowedBorrowers: [borrower], expiresAt: 1_900_000_000 },
};
const proposal: LendingProposal = {
  proposal_id: 'fixture-1', decision: 'PROPOSE', asset_mint: mint, borrower, agent, nonce: '7', duration_seconds: 86_400,
  loan_asset: 'USDC', requested_amount: '300000000', collateral_value: '1000000000', risk_level: 'MODERATE',
  risk_factors: [], recommendation: 'Fixture assessment only.', requires_verification: true,
};

describe('deterministic lending verifier (fixture data)', () => {
  it('verifies an illustrative 30% LTV proposal using integer arithmetic', () => {
    const r = verifyLendingProposal(proposal, evidence);
    expect(r.outcome).toBe('VERIFIED');
    expect(r.ltvBps).toBe('3000');
    expect(r.collateralRatioBps).toBe('33333');
  });
  it.each([
    ['unsupported mint', { ...evidence, supportedMints: [] }, 'UNSUPPORTED_MINT'],
    ['wrong owner', { ...evidence, tokenAccountOwner: borrower }, 'TOKEN_OWNER_MISMATCH'],
    ['zero collateral', { ...evidence, quantityBaseUnits: 0n }, 'INVALID_COLLATERAL'],
    ['invalid price', { ...evidence, priceMicrosPerWholeToken: 0n }, 'INVALID_COLLATERAL'],
    ['future price', { ...evidence, priceObservedAt: evidence.now + 1 }, 'INVALID_PRICE'],
    ['stale price', { ...evidence, priceObservedAt: evidence.now - 301 }, 'STALE_PRICE'],
    ['excessive LTV', { ...evidence, requestedAmountMicros: 700_000_000n, availableLiquidityMicros: 800_000_000n, policy: { ...evidence.policy, maxLoanMicros: 800_000_000n } }, 'EXCESSIVE_LTV'],
    ['insufficient collateral ratio', { ...evidence, policy: { ...evidence.policy, minCollateralRatioBps: 40_000n } }, 'INSUFFICIENT_COLLATERAL_RATIO'],
    ['excessive loan', { ...evidence, policy: { ...evidence.policy, maxLoanMicros: 200_000_000n } }, 'EXCESSIVE_LOAN'],
    ['unauthorized borrower', evidence, 'UNAUTHORIZED_BORROWER'],
    ['expired policy', { ...evidence, policy: { ...evidence.policy, expiresAt: evidence.now } }, 'EXPIRED_POLICY'],
    ['revoked agent', { ...evidence, mandateActive: false }, 'REVOKED_AGENT'],
    ['missing liquidity', { ...evidence, availableLiquidityMicros: 0n }, 'MISSING_LIQUIDITY'],
    ['excessive duration', { ...evidence, durationSeconds: 3_000_000 }, 'EXCESSIVE_DURATION'],
    ['tampered proposal', evidence, 'PROPOSAL_MISMATCH', { ...proposal, requested_amount: '301000000' }],
    ['replay', { ...evidence, usedProposalIds: new Set(['fixture-1']) }, 'REPLAY'],
    ['unknown price source', { ...evidence, priceSource: 'unknown' }, 'INVALID_PRICE'],
  ] as Array<[string, LendingEvidence, string, LendingProposal?]>)('rejects %s', (_name, changedEvidence, code, changedProposal) => {
    const p = code === 'EXCESSIVE_LTV' ? { ...proposal, requested_amount: '700000000' }
      : code === 'UNAUTHORIZED_BORROWER' ? { ...proposal, borrower: 'Stake11111111111111111111111111111111111111' }
      : changedProposal ?? proposal;
    const e = code === 'UNAUTHORIZED_BORROWER' ? { ...changedEvidence as LendingEvidence, borrower: (p as LendingProposal).borrower } : changedEvidence;
    const r = verifyLendingProposal(p, e as LendingEvidence);
    expect(r.outcome).toBe('REJECTED');
    expect(r.reasonCodes).toContain(code);
  });
  it('rejects malformed AI output, including an attempted approval field', () => {
    const r = verifyLendingProposal({ ...proposal, approved: true }, evidence);
    expect(r.outcome).toBe('REJECTED');
    expect(r.reasonCodes).toContain('MALFORMED_PROPOSAL');
  });
  it('preserves needs-review as a non-authorizing review outcome', () => {
    const r = verifyLendingProposal({ ...proposal, decision: 'NEEDS_REVIEW' }, evidence);
    expect(r.outcome).toBe('NEEDS_REVIEW');
    expect(r.reasonCodes).toContain('AI_REVIEW');
  });
});
