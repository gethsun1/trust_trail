import { describe, expect, it } from 'vitest';
import { verifyDemoProposal } from '../../lib/server/lending-verification';

const base = {
  proposal_id: 'server-demo-test-valid', decision: 'PROPOSE', asset_mint: '11111111111111111111111111111111',
  borrower: 'Stake11111111111111111111111111111111111111', agent: 'Vote111111111111111111111111111111111111111',
  nonce: '7', duration_seconds: 86_400, loan_asset: 'DEMO_USD', requested_amount: '300000000',
  collateral_value: '1000000000', risk_level: 'MODERATE', risk_factors: ['Fixture evidence'],
  recommendation: 'Illustrative recommendation.', requires_verification: true,
};

describe('server-owned lending demonstration verifier', () => {
  it('recalculates a valid demonstration proposal using fixed-point arithmetic', () => {
    const decision = verifyDemoProposal(base);
    expect(decision.decision).toBe('DEMO_VERIFIED');
    expect(decision.mode).toBe('DEMO');
    expect(decision.calculatedLtvBps).toBe('3000');
    expect(decision.collateralRatioBps).toBe('33333');
    expect(decision.evidenceSource).toContain('not an asset');
  });
  it('rejects excessive LTV', () => {
    const decision = verifyDemoProposal({ ...base, proposal_id: 'server-demo-test-ltv', requested_amount: '700000000' });
    expect(decision.decision).toBe('REJECTED');
    expect(decision.reasonCodes).toContain('EXCESSIVE_LTV');
  });
  it('rejects a zero amount without attempting division', () => {
    const decision = verifyDemoProposal({ ...base, proposal_id: 'server-demo-test-zero', requested_amount: '0' });
    expect(decision.decision).toBe('REJECTED');
    expect(decision.reasonCodes).toContain('PROPOSAL_MISMATCH');
  });
  it('rejects a borrower outside the fixture allowlist', () => {
    const decision = verifyDemoProposal({ ...base, proposal_id: 'server-demo-test-borrower', borrower: 'Vote111111111111111111111111111111111111111' });
    expect(decision.decision).toBe('REJECTED');
    expect(decision.reasonCodes).toContain('UNAUTHORIZED_BORROWER');
  });
  it('rejects a server-selected stale valuation fixture', () => {
    const decision = verifyDemoProposal({ ...base, proposal_id: 'server-demo-test-stale' }, 'stale-price');
    expect(decision.decision).toBe('REJECTED');
    expect(decision.reasonCodes).toContain('STALE_PRICE');
  });
  it('rejects caller supplied approval claims and replayed identifiers', () => {
    const malformed = verifyDemoProposal({ ...base, proposal_id: 'server-demo-test-extra', approved: true });
    expect(malformed.decision).toBe('REJECTED');
    expect(malformed.reasonCodes).toContain('MALFORMED_PROPOSAL');
    const id = 'server-demo-test-replay';
    expect(verifyDemoProposal({ ...base, proposal_id: id }).decision).toBe('DEMO_VERIFIED');
    const replayed = verifyDemoProposal({ ...base, proposal_id: id });
    expect(replayed.decision).toBe('REJECTED');
    expect(replayed.reasonCodes).toContain('REPLAY');
  });
});
