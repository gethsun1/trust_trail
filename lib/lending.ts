import { z } from 'zod';

const decimal = z.string().regex(/^(0|[1-9]\d*)$/);
export const lendingProposalSchema = z.object({
  proposal_id: z.string().min(1).max(100),
  decision: z.enum(['PROPOSE', 'REJECT', 'NEEDS_REVIEW']),
  asset_mint: z.string().min(32).max(44),
  borrower: z.string().min(32).max(44),
  agent: z.string().min(32).max(44),
  nonce: decimal,
  duration_seconds: z.number().int().positive(),
  loan_asset: z.string().min(1).max(32),
  requested_amount: decimal,
  collateral_value: decimal,
  risk_level: z.enum(['LOW', 'MODERATE', 'HIGH']),
  risk_factors: z.array(z.string().min(1).max(200)).max(12),
  recommendation: z.string().min(1).max(1000),
  requires_verification: z.literal(true),
}).strict();

export type LendingProposal = z.infer<typeof lendingProposalSchema>;
export type LendingEvidence = {
  supportedMints: string[];
  assetMint: string;
  tokenAccountOwner: string;
  owner: string;
  quantityBaseUnits: bigint;
  priceMicrosPerWholeToken: bigint;
  tokenDecimals: number;
  priceObservedAt: number;
  priceSource: string;
  allowedPriceSources: string[];
  now: number;
  maxPriceAgeSeconds: number;
  requestedAmountMicros: bigint;
  borrower: string;
  loanAsset: string;
  durationSeconds: number;
  availableLiquidityMicros: bigint;
  dailyExposureMicros: bigint;
  agent: string;
  mandateAgent: string;
  mandateActive: boolean;
  mandateExpiry: number;
  nonce: bigint;
  usedProposalIds: ReadonlySet<string>;
  policy: {
    maxLtvBps: bigint;
    minCollateralRatioBps: bigint;
    maxLoanMicros: bigint;
    maxDurationSeconds: number;
    maxDailyExposureMicros: bigint;
    allowedBorrowers: string[];
    expiresAt: number;
  };
};
export type LendingVerification = {
  outcome: 'VERIFIED' | 'REJECTED' | 'NEEDS_REVIEW' | 'UNAVAILABLE';
  reasonCodes: string[];
  explanation: string;
  collateralValueMicros?: string;
  ltvBps?: string;
  collateralRatioBps?: string;
};

const explain: Record<string, string> = {
  MALFORMED_PROPOSAL: 'The proposal does not match the required lending schema.',
  UNSUPPORTED_MINT: 'This asset is not in the verified supported-asset list.',
  TOKEN_OWNER_MISMATCH: 'The selected token account does not belong to the connected owner.',
  INVALID_COLLATERAL: 'Collateral quantity and price must both be positive.',
  INVALID_PRICE: 'The price observation is invalid or from the future.',
  STALE_PRICE: 'The price observation is older than the allowed freshness window.',
  EXCESSIVE_LTV: 'The requested loan exceeds the owner policy maximum LTV.',
  INSUFFICIENT_COLLATERAL_RATIO: 'The collateral ratio is below the owner policy minimum.',
  EXCESSIVE_LOAN: 'The loan amount exceeds the owner policy maximum.',
  UNAUTHORIZED_BORROWER: 'The borrower is not permitted by the lending policy.',
  EXPIRED_POLICY: 'The lending policy has expired.',
  REVOKED_AGENT: 'The mandate is inactive, expired, or registered to another agent.',
  MISSING_LIQUIDITY: 'Verified available liquidity does not cover the requested amount.',
  EXCESSIVE_DURATION: 'The requested loan duration exceeds the policy maximum.',
  EXCESSIVE_DAILY_EXPOSURE: 'The proposal exceeds the daily exposure limit.',
  INVALID_INPUT: 'A required financial or identity input is missing or invalid.',
  PROPOSAL_MISMATCH: 'Proposal financial or identity fields do not match verified inputs.',
  REPLAY: 'This proposal identifier has already been used.',
  AI_REJECTED: 'The AI assessment rejected this opportunity.',
  AI_REVIEW: 'The AI assessment requires human review.',
};

function result(outcome: LendingVerification['outcome'], reasonCodes: string[], extra: Partial<LendingVerification> = {}): LendingVerification {
  return { outcome, reasonCodes, explanation: reasonCodes.map(code => explain[code] ?? 'The proposal could not be verified.').join(' '), ...extra };
}

export function verifyLendingProposal(proposalInput: unknown, e: LendingEvidence): LendingVerification {
  const parsed = lendingProposalSchema.safeParse(proposalInput);
  if (!parsed.success) return result('REJECTED', ['MALFORMED_PROPOSAL']);
  const p = parsed.data;
  const reasons: string[] = [];
  if (e.requestedAmountMicros <= 0n || e.availableLiquidityMicros < 0n || e.dailyExposureMicros < 0n || e.nonce < 0n || e.policy.maxLtvBps <= 0n || e.policy.maxLtvBps > 10_000n || e.policy.minCollateralRatioBps <= 0n || e.policy.maxLoanMicros <= 0n || e.policy.maxDailyExposureMicros < 0n || e.maxPriceAgeSeconds <= 0 || e.durationSeconds <= 0) reasons.push('INVALID_INPUT');
  if (!e.supportedMints.includes(e.assetMint)) reasons.push('UNSUPPORTED_MINT');
  if (!e.owner || e.tokenAccountOwner !== e.owner) reasons.push('TOKEN_OWNER_MISMATCH');
  if (e.quantityBaseUnits <= 0n || e.priceMicrosPerWholeToken <= 0n || !Number.isInteger(e.tokenDecimals) || e.tokenDecimals < 0 || e.tokenDecimals > 18) reasons.push('INVALID_COLLATERAL');
  if (!Number.isSafeInteger(e.priceObservedAt) || !Number.isSafeInteger(e.now) || e.priceObservedAt <= 0 || e.priceObservedAt > e.now) reasons.push('INVALID_PRICE');
  else if (e.now - e.priceObservedAt > e.maxPriceAgeSeconds) reasons.push('STALE_PRICE');
  if (!e.priceSource || !e.allowedPriceSources.includes(e.priceSource)) reasons.push('INVALID_PRICE');
  if (e.policy.expiresAt <= e.now || e.policy.expiresAt <= 0) reasons.push('EXPIRED_POLICY');
  if (!e.mandateActive || e.mandateExpiry <= e.now || e.agent !== e.mandateAgent) reasons.push('REVOKED_AGENT');
  if (e.usedProposalIds.has(p.proposal_id)) reasons.push('REPLAY');
  if (p.asset_mint !== e.assetMint || p.borrower !== e.borrower || p.agent !== e.agent || p.nonce !== e.nonce.toString() || p.duration_seconds !== e.durationSeconds || p.loan_asset !== e.loanAsset || p.requested_amount !== e.requestedAmountMicros.toString()) reasons.push('PROPOSAL_MISMATCH');
  if (!e.policy.allowedBorrowers.includes(p.borrower)) reasons.push('UNAUTHORIZED_BORROWER');
  if (!Number.isSafeInteger(e.durationSeconds) || e.durationSeconds <= 0 || e.durationSeconds > e.policy.maxDurationSeconds) reasons.push('EXCESSIVE_DURATION');
  if (e.availableLiquidityMicros < e.requestedAmountMicros || e.availableLiquidityMicros <= 0n) reasons.push('MISSING_LIQUIDITY');
  if (e.requestedAmountMicros > e.policy.maxLoanMicros) reasons.push('EXCESSIVE_LOAN');
  if (e.dailyExposureMicros + e.requestedAmountMicros > e.policy.maxDailyExposureMicros) reasons.push('EXCESSIVE_DAILY_EXPOSURE');
  if (reasons.length) return result('REJECTED', [...new Set(reasons)]);

  const scale = 10n ** BigInt(e.tokenDecimals);
  const collateralValueMicros = e.quantityBaseUnits * e.priceMicrosPerWholeToken / scale;
  if (collateralValueMicros <= 0n || e.requestedAmountMicros <= 0n) return result('REJECTED', ['INVALID_COLLATERAL']);
  const ltvBps = (e.requestedAmountMicros * 10_000n + collateralValueMicros - 1n) / collateralValueMicros;
  const collateralRatioBps = collateralValueMicros * 10_000n / e.requestedAmountMicros;
  const metrics = { collateralValueMicros: collateralValueMicros.toString(), ltvBps: ltvBps.toString(), collateralRatioBps: collateralRatioBps.toString() };
  if (e.requestedAmountMicros * 10_000n > collateralValueMicros * e.policy.maxLtvBps) reasons.push('EXCESSIVE_LTV');
  if (collateralValueMicros * 10_000n < e.requestedAmountMicros * e.policy.minCollateralRatioBps) reasons.push('INSUFFICIENT_COLLATERAL_RATIO');
  if (p.collateral_value !== collateralValueMicros.toString()) reasons.push('PROPOSAL_MISMATCH');
  if (p.decision === 'REJECT') reasons.push('AI_REJECTED');
  if (p.decision === 'NEEDS_REVIEW') return result('NEEDS_REVIEW', ['AI_REVIEW'], metrics);
  return reasons.length ? result('REJECTED', [...new Set(reasons)], metrics) : result('VERIFIED', [], metrics);
}
