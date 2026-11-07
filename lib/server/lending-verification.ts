import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { PROGRAM_ID, RPC_URL } from '../config';
import { deriveMandate } from '../mandate';
import { lendingProposalSchema } from '../lending';

export type LendingDecision = {
  decision: 'LIVE_VERIFIED' | 'DEMO_VERIFIED' | 'REJECTED' | 'NEEDS_REVIEW' | 'UNAVAILABLE';
  mode: 'LIVE' | 'DEMO' | 'NONE';
  reasonCodes: string[];
  explanation: string;
  evidenceSource: string;
  evidenceTimestamp: string;
  calculatedLtvBps?: string;
  collateralValueMicros?: string;
  collateralRatioBps?: string;
  policy?: Record<string, string | number | string[]>;
  ownership?: { verified: boolean; mint: string; authority: string; amount: string; tokenProgram: string };
  mandate?: { active: boolean; agent: string; nonce: string; expiry: number; vaultLamports: string };
};

const explain: Record<string, string> = {
  MALFORMED_PROPOSAL: 'The proposal did not match the required schema.',
  PROPOSAL_MISMATCH: 'The proposal identity or requested amount did not match this assessment request.',
  EXCESSIVE_LTV: 'The requested loan exceeds the configured maximum loan-to-value ratio.',
  UNAUTHORIZED_BORROWER: 'The borrower is not on the configured lending policy allowlist.',
  STALE_PRICE: 'The valuation evidence is outside the allowed freshness window.',
  INVALID_OWNERSHIP: 'The selected token account could not be verified for the requested owner and mint.',
  MANDATE_UNAVAILABLE: 'The current owner mandate could not be verified on Devnet.',
  MANDATE_INACTIVE: 'The mandate is revoked or expired, so its agent is not active.',
  REPLAY: 'This proposal identifier has already been assessed in this server process.',
  AI_REJECTED: 'The AI recommendation rejected this opportunity.',
  AI_REVIEW: 'The AI recommendation requires human review.',
  NO_SUPPORTED_ASSET: 'No issuer-verified Devnet equity asset is configured.',
  NO_TRUSTED_VALUATION: 'No trusted price source is configured; fixture prices cannot establish live collateral value.',
  NO_LENDING_POLICY: 'No live lending policy or liquidity source is configured.',
  RPC_UNAVAILABLE: 'The configured Devnet RPC did not provide the required evidence.',
};

const usedIds = new Set<string>();
const DEMO = {
  mint: '11111111111111111111111111111111',
  borrower: 'Stake11111111111111111111111111111111111111',
  agent: 'Vote111111111111111111111111111111111111111',
  nonce: '7',
  collateralMicros: 1_000_000_000n,
  priceObservedAt: 1_800_000_000,
  maxAgeSeconds: 300,
  maxLtvBps: 6_500n,
  minCollateralRatioBps: 15_000n,
  maxLoanMicros: 800_000_000n,
  liquidityMicros: 800_000_000n,
  maxDurationSeconds: 2_592_000,
  mandateExpiry: 1_900_000_000,
  policyExpiry: 1_900_000_000,
};

function result(decision: LendingDecision['decision'], reasonCodes: string[], extra: Partial<LendingDecision> = {}): LendingDecision {
  return {
    decision, mode: decision === 'DEMO_VERIFIED' ? 'DEMO' : decision === 'LIVE_VERIFIED' ? 'LIVE' : 'NONE',
    reasonCodes, explanation: reasonCodes.map(code => explain[code] ?? 'The proposal could not be verified.').join(' '),
    evidenceSource: decision === 'DEMO_VERIFIED' || extra.mode === 'DEMO' ? 'Server-owned demonstration fixture' : 'Configured Solana Devnet RPC',
    evidenceTimestamp: new Date().toISOString(), ...extra,
  };
}

function replay(proposalId: string): 'DUPLICATE' | 'RECORDED' | 'FULL' {
  if (usedIds.has(proposalId)) return 'DUPLICATE';
  // Process-local duplicate detection only; no durable replay protection is implied.
  if (usedIds.size >= 5_000) return 'FULL';
  usedIds.add(proposalId);
  return 'RECORDED';
}

export function verifyDemoProposal(input: unknown, scenario: 'valid' | 'high-ltv' | 'borrower' | 'stale-price' = 'valid'): LendingDecision {
  const parsed = lendingProposalSchema.safeParse(input);
  if (!parsed.success) return result('REJECTED', ['MALFORMED_PROPOSAL']);
  const p = parsed.data;
  const replayState = replay(p.proposal_id);
  if (replayState === 'DUPLICATE') return result('REJECTED', ['REPLAY'], { mode: 'DEMO' });
  if (replayState === 'FULL') return result('UNAVAILABLE', ['REPLAY_STORE_FULL'], { mode: 'DEMO' });
  const now = Math.floor(Date.now() / 1000);
  const reasons: string[] = [];
  if (p.asset_mint !== DEMO.mint || p.borrower !== DEMO.borrower || p.agent !== DEMO.agent || p.nonce !== DEMO.nonce || p.loan_asset !== 'DEMO_USD') reasons.push('PROPOSAL_MISMATCH');
  if (p.decision === 'REJECT') reasons.push('AI_REJECTED');
  if (p.collateral_value !== DEMO.collateralMicros.toString()) reasons.push('PROPOSAL_MISMATCH');
  if (p.duration_seconds > DEMO.maxDurationSeconds || p.requested_amount === '0') reasons.push('PROPOSAL_MISMATCH');
  if (now > DEMO.policyExpiry || now > DEMO.mandateExpiry) reasons.push('MANDATE_INACTIVE');
  const priceNow = Math.floor(Date.now() / 1000);
  const observedAt = scenario === 'stale-price' ? priceNow - DEMO.maxAgeSeconds - 1 : priceNow - 100;
  if (priceNow - observedAt > DEMO.maxAgeSeconds) reasons.push('STALE_PRICE');
  const amount = BigInt(p.requested_amount);
  if (amount <= 0n) return result('REJECTED', ['PROPOSAL_MISMATCH'], { mode: 'DEMO' });
  if (amount > DEMO.maxLoanMicros) reasons.push('EXCESSIVE_LTV');
  if (p.borrower !== DEMO.borrower) reasons.push('UNAUTHORIZED_BORROWER');
  if (amount > DEMO.liquidityMicros) reasons.push('NO_LENDING_POLICY');
  const ltv = (amount * 10_000n + DEMO.collateralMicros - 1n) / DEMO.collateralMicros;
  const ratio = DEMO.collateralMicros * 10_000n / amount;
  const policy = { maxLtvBps: DEMO.maxLtvBps.toString(), minCollateralRatioBps: DEMO.minCollateralRatioBps.toString(), maxLoanMicros: DEMO.maxLoanMicros.toString(), allowedBorrowers: [DEMO.borrower], maxDurationSeconds: DEMO.maxDurationSeconds };
  if (p.decision === 'NEEDS_REVIEW') return result('NEEDS_REVIEW', ['AI_REVIEW'], { mode: 'DEMO', collateralValueMicros: DEMO.collateralMicros.toString(), calculatedLtvBps: ltv.toString(), collateralRatioBps: ratio.toString(), policy });
  if (amount * 10_000n > DEMO.collateralMicros * DEMO.maxLtvBps) reasons.push('EXCESSIVE_LTV');
  if (DEMO.collateralMicros * 10_000n < amount * DEMO.minCollateralRatioBps) reasons.push('EXCESSIVE_LTV');
  if (reasons.length) return result('REJECTED', [...new Set(reasons)], {
    mode: 'DEMO', evidenceSource: 'Demonstration fixture · not an asset, quote, mandate, or liquidity attestation', evidenceTimestamp: new Date(observedAt * 1000).toISOString(),
    collateralValueMicros: DEMO.collateralMicros.toString(), calculatedLtvBps: ltv.toString(), collateralRatioBps: ratio.toString(),
    policy,
  });
  return result('DEMO_VERIFIED', [], {
    mode: 'DEMO', evidenceSource: 'Demonstration fixture · not an asset, quote, mandate, or liquidity attestation', evidenceTimestamp: new Date(observedAt * 1000).toISOString(),
    collateralValueMicros: DEMO.collateralMicros.toString(), calculatedLtvBps: ltv.toString(), collateralRatioBps: ratio.toString(),
    policy,
  });
}

function parseKey(value: string): PublicKey | null {
  try { return new PublicKey(value); } catch { return null; }
}

export async function verifyLiveProposal(input: {
  proposal: unknown; ownerPublicKey: string; selectedAssetMint: string; tokenAccountAddress: string;
}): Promise<LendingDecision> {
  const parsed = lendingProposalSchema.safeParse(input.proposal);
  if (!parsed.success) return result('REJECTED', ['MALFORMED_PROPOSAL']);
  const replayState = replay(parsed.data.proposal_id);
  if (replayState === 'DUPLICATE') return result('REJECTED', ['REPLAY']);
  if (replayState === 'FULL') return result('UNAVAILABLE', ['REPLAY_STORE_FULL']);
  const owner = parseKey(input.ownerPublicKey);
  const mint = parseKey(input.selectedAssetMint);
  const tokenAddress = parseKey(input.tokenAccountAddress);
  if (!owner || !mint || !tokenAddress) return result('REJECTED', ['INVALID_OWNERSHIP']);
  if (parsed.data.asset_mint !== mint.toBase58()) return result('REJECTED', ['PROPOSAL_MISMATCH']);

  const connection = new Connection(RPC_URL, 'confirmed');
  try {
    const tokenInfo = await connection.getAccountInfo(tokenAddress, 'confirmed');
    if (!tokenInfo || (tokenInfo.data.length < 165) || ![new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')].some(program => tokenInfo.owner.equals(program))) return result('REJECTED', ['INVALID_OWNERSHIP']);
    const tokenData = tokenInfo.data;
    const accountMint = new PublicKey(tokenData.subarray(0, 32));
    const authority = new PublicKey(tokenData.subarray(32, 64));
    const amount = tokenData.readBigUInt64LE(64);
    const state = tokenData[108];
    const ownership = { verified: accountMint.equals(mint) && authority.equals(owner) && amount > 0n && state === 1, mint: accountMint.toBase58(), authority: authority.toBase58(), amount: amount.toString(), tokenProgram: tokenInfo.owner.toBase58() };
    if (!ownership.verified) return result('REJECTED', ['INVALID_OWNERSHIP'], { ownership });

    const { mandate: mandateKey, vault: vaultKey } = deriveMandate(owner, PROGRAM_ID);
    const mandateInfo = await connection.getAccountInfo(mandateKey, 'confirmed');
    if (!mandateInfo || !mandateInfo.owner.equals(PROGRAM_ID) || mandateInfo.data.length !== 154) return result('UNAVAILABLE', ['MANDATE_UNAVAILABLE'], { ownership });
    const d = mandateInfo.data;
    if (!d.subarray(0, 8).equals(Buffer.from([113, 216, 98, 159, 185, 63, 55, 18])) || !new PublicKey(d.subarray(8, 40)).equals(owner)) return result('UNAVAILABLE', ['MANDATE_UNAVAILABLE'], { ownership });
    const agent = new PublicKey(d.subarray(40, 72));
    const expiry = Number(d.readBigInt64LE(136));
    const nonce = d.readBigUInt64LE(144);
    if (d[152] !== 0 && d[152] !== 1) return result('UNAVAILABLE', ['MANDATE_UNAVAILABLE'], { ownership });
    const revoked = d[152] === 1;
    const vaultInfo = await connection.getAccountInfo(vaultKey, 'confirmed');
    if (!vaultInfo || !vaultInfo.owner.equals(SystemProgram.programId) || vaultInfo.data.length !== 0) return result('UNAVAILABLE', ['MANDATE_UNAVAILABLE'], { ownership });
    const mandate = { active: !revoked && expiry > Math.floor(Date.now() / 1000), agent: agent.toBase58(), nonce: nonce.toString(), expiry, vaultLamports: vaultInfo.lamports.toString() };
    if (!mandate.active) return result('REJECTED', ['MANDATE_INACTIVE'], { ownership, mandate });
    if (parsed.data.agent !== mandate.agent || parsed.data.nonce !== mandate.nonce || !parseKey(parsed.data.borrower)) return result('REJECTED', ['PROPOSAL_MISMATCH'], { ownership, mandate });

    // Account ownership is independently read, but there is no issuer allowlist, live price,
    // application lending policy, borrower registry, or lending liquidity configured.
    return result('UNAVAILABLE', ['NO_SUPPORTED_ASSET', 'NO_TRUSTED_VALUATION', 'NO_LENDING_POLICY'], {
      mode: 'LIVE', ownership, mandate, evidenceSource: 'Solana Devnet RPC for token account, mandate, and vault; valuation/policy sources unavailable',
    });
  } catch {
    return result('UNAVAILABLE', ['RPC_UNAVAILABLE']);
  }
}
