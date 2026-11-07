import { describe, expect, it } from 'vitest';
import { POST } from '../../app/api/lending/verify/route';

const proposal = (id: string, changes: Record<string, unknown> = {}) => ({
  proposal_id: id, decision: 'PROPOSE', asset_mint: '11111111111111111111111111111111',
  borrower: 'Stake11111111111111111111111111111111111111', agent: 'Vote111111111111111111111111111111111111111',
  nonce: '7', duration_seconds: 86_400, loan_asset: 'DEMO_USD', requested_amount: '300000000',
  collateral_value: '1000000000', risk_level: 'MODERATE', risk_factors: [], recommendation: 'Advisory only.',
  requires_verification: true, ...changes,
});

async function post(body: unknown) {
  return POST(new Request('http://localhost/api/lending/verify', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
}

describe('POST /api/lending/verify', () => {
  it('returns a server-calculated demo decision with explicit settlement boundary', async () => {
    const response = await post({ mode: 'demo', proposal: proposal('route-demo-valid') });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.decision).toBe('DEMO_VERIFIED');
    expect(body.settlement).toBe('NOT_IMPLEMENTED');
    expect(body.calculatedLtvBps).toBe('3000');
  });
  it('rejects client supplied verification claims', async () => {
    const response = await post({ mode: 'demo', proposal: proposal('route-demo-forged', { approved: true, ownership_verified: true }) });
    const body = await response.json();
    expect(body.decision).toBe('REJECTED');
    expect(body.reasonCodes).toContain('MALFORMED_PROPOSAL');
  });
  it('rejects malformed request schemas before using evidence', async () => {
    const response = await post({ mode: 'live', proposal: proposal('route-live-invalid'), ownerPublicKey: 'bad', selectedAssetMint: 'bad', tokenAccountAddress: 'bad', approved: true });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'INVALID_REQUEST' });
  });
});
