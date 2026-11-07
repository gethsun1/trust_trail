import { NextResponse } from 'next/server';
import { interpretInstruction } from '../../../lib/server/groq';
import { signIntent } from '../../../lib/server/intent';
import { readRequestBody } from '../../../lib/server/http';

export const runtime = 'nodejs';
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
    const raw = await readRequestBody(request, 4_500);
    if (raw === null) return NextResponse.json({ error: 'REQUEST_TOO_LARGE' }, { status: 413 });
    const body: unknown = JSON.parse(raw);
    const instruction = (body as { instruction?: unknown })?.instruction;
    if (typeof instruction !== 'string' || instruction.trim().length < 3 || instruction.length > 4_000) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    const intent = await interpretInstruction(instruction.trim());
    return NextResponse.json({ intent, intentToken: signIntent(intent) });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'AI_ERROR';
    const internalCode = /^AI_PROVIDER_HTTP_\d{3}$/.test(code) || /^AI_REQUEST_REJECTED_[A-Z0-9_]{1,40}$/.test(code) || ['AI_NOT_CONFIGURED', 'AI_MODEL_UNSUPPORTED', 'AI_RATE_LIMITED', 'AI_PROVIDER_ERROR', 'AI_TIMEOUT', 'AI_MALFORMED_RESPONSE', 'AI_AUTH_FAILED', 'AI_REQUEST_REJECTED', 'INVALID_RECIPIENT', 'INVALID_AMOUNT', 'INVALID_INTENT'].includes(code) ? code : 'UNEXPECTED_ERROR';
    console.error('Intent processing failed:', internalCode);
    const invalidIntent = ['INVALID_RECIPIENT', 'INVALID_AMOUNT', 'INVALID_INTENT'].includes(code);
    const status = code === 'AI_NOT_CONFIGURED' || code === 'AI_MODEL_UNSUPPORTED' ? 503 : code === 'AI_RATE_LIMITED' ? 429 : invalidIntent ? 422 : 502;
    const errorCode = status === 429 ? 'RATE_LIMITED' : status === 503 ? 'AI_UNAVAILABLE' : invalidIntent ? 'INVALID_INTENT' : 'INTENT_UNAVAILABLE';
    return NextResponse.json({ error: errorCode }, { status });
  }
}
