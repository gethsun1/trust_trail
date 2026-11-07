import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readRequestBody } from '../../../../lib/server/http';
import { verifyDemoProposal, verifyLiveProposal } from '../../../../lib/server/lending-verification';

export const runtime = 'nodejs';
const schema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('demo'), scenario: z.enum(['valid', 'high-ltv', 'borrower', 'stale-price']).default('valid'), proposal: z.unknown() }).strict(),
  z.object({
    mode: z.literal('live'), proposal: z.unknown(), ownerPublicKey: z.string().min(32).max(44),
    selectedAssetMint: z.string().min(32).max(44), tokenAccountAddress: z.string().min(32).max(44),
  }).strict(),
]);
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
const hits = new Map<string, { count: number; start: number }>();

export async function POST(request: Request) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const entry = hits.get(address);
  if (entry && now - entry.start < WINDOW_MS && entry.count >= MAX_REQUESTS) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
  hits.set(address, !entry || now - entry.start >= WINDOW_MS ? { count: 1, start: now } : { ...entry, count: entry.count + 1 });
  try {
    const raw = await readRequestBody(request, 8_000);
    if (raw === null) return NextResponse.json({ error: 'REQUEST_TOO_LARGE' }, { status: 413 });
    const input = schema.parse(JSON.parse(raw));
    const decision = input.mode === 'demo'
      ? verifyDemoProposal(input.proposal, input.scenario)
      : await verifyLiveProposal(input);
    return NextResponse.json({ ...decision, settlement: 'NOT_IMPLEMENTED' });
  } catch (error) {
    const status = error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ error: status === 400 ? 'INVALID_REQUEST' : 'VERIFICATION_UNAVAILABLE' }, { status });
  }
}
