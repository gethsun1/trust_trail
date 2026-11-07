import { NextResponse } from 'next/server';
import { inspectTransaction } from '../../../lib/server/firewall';
import { verifySignedIntent } from '../../../lib/server/intent';
import { readRequestBody } from '../../../lib/server/http';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const raw = await readRequestBody(request, 12_000);
    if (raw === null) return NextResponse.json({ error: 'REQUEST_TOO_LARGE' }, { status: 413 });
    const body: unknown = JSON.parse(raw);
    const data = body as { serializedTransaction?: unknown; owner?: unknown; intent?: unknown; intentToken?: unknown };
    if (typeof data.serializedTransaction !== 'string' || typeof data.owner !== 'string' || !verifySignedIntent(data.intent, data.intentToken)) {
      return NextResponse.json({ error: 'INVALID_FIREWALL_REQUEST' }, { status: 400 });
    }
    const result = await inspectTransaction({ serializedTransaction: data.serializedTransaction, owner: data.owner, intent: data.intent });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ decision: 'REJECT', reasonCodes: ['UNVERIFIABLE_TRANSACTION'], explanation: 'The transaction could not be verified.' }, { status: 200 });
  }
}
