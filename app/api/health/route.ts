import { NextResponse } from 'next/server';
import { getGroqConfiguration } from '../../../lib/server/groq';

export const runtime = 'nodejs';
export function GET() {
  return NextResponse.json(getGroqConfiguration());
}
