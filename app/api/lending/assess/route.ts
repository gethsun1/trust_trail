import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assessLendingOpportunity } from '../../../../lib/server/groq';
import { readRequestBody } from '../../../../lib/server/http';

export const runtime = 'nodejs';
const inputSchema = z.object({
  assetMint: z.string().min(32).max(44), borrower: z.string().min(32).max(44),
  agent: z.string().min(32).max(44), nonce: z.string().regex(/^(0|[1-9]\d*)$/),
  durationSeconds: z.number().int().positive().max(31_536_000), loanAsset: z.string().min(1).max(32),
  requestedAmountMicros: z.string().regex(/^[1-9]\d{0,30}$/), collateralValueMicros: z.string().regex(/^[1-9]\d{0,30}$/),
  riskPreferences: z.string().max(500),
}).strict();
const WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; start: number }>();

export async function POST(request: Request) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const entry = hits.get(address);
  if (entry && now - entry.start < WINDOW_MS && entry.count >= 8) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
  hits.set(address, !entry || now - entry.start >= WINDOW_MS ? { count: 1, start: now } : { ...entry, count: entry.count + 1 });
  try {
    const raw = await readRequestBody(request, 3_000);
    if (raw === null) return NextResponse.json({ error: 'REQUEST_TOO_LARGE' }, { status: 413 });
    const input = inputSchema.parse(JSON.parse(raw));
    const proposal = await assessLendingOpportunity(input);
    return NextResponse.json({ proposal, authority: 'ADVISORY_ONLY', settlement: 'NOT_IMPLEMENTED' });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'AI_ERROR';
    const known = ['AI_NOT_CONFIGURED', 'AI_MODEL_UNSUPPORTED', 'AI_RATE_LIMITED', 'AI_PROVIDER_ERROR', 'AI_TIMEOUT', 'AI_MALFORMED_RESPONSE', 'AI_AUTH_FAILED', 'AI_REQUEST_REJECTED', 'AI_SCHEMA_MISMATCH'];
    console.error('Lending assessment failed:', known.includes(code) ? code : error instanceof z.ZodError ? 'INVALID_INPUT' : 'UNEXPECTED_ERROR');
    const status = code === 'AI_NOT_CONFIGURED' || code === 'AI_MODEL_UNSUPPORTED' ? 503 : code === 'AI_RATE_LIMITED' ? 429 : error instanceof z.ZodError ? 400 : 502;
    return NextResponse.json({ error: status === 429 ? 'RATE_LIMITED' : status === 503 ? 'AI_UNAVAILABLE' : status === 400 ? 'INVALID_INPUT' : 'ASSESSMENT_UNAVAILABLE' }, { status });
  }
}
