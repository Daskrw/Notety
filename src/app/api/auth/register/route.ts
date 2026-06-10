import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

// In-memory mock DB for the boilerplate
// In production, you would use Supabase, e.g.:
// const { error } = await supabase.from('users').insert({ username, pin_hash: hashedPin })
export const mockUserDb = new Map<string, string>();

export async function POST(req: Request) {
  try {
    const { username, pin } = await req.json();

    if (!username || !pin || pin.length < 4) {
      return NextResponse.json({ error: 'Invalid username or PIN (minimum 4 digits)' }, { status: 400 });
    }

    if (mockUserDb.has(username)) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    // Hash the PIN before storing
    const hashedPin = await bcrypt.hash(pin, 10);
    mockUserDb.set(username, hashedPin);

    return NextResponse.json({ success: true, message: 'Account created successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
