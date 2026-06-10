import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { mockUserDb } from '../register/route';

// In-memory rate limiting map: username -> { attempts, lockedUntil }
const rateLimitMap = new Map<string, { attempts: number; lockedUntil: number | null }>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: Request) {
  try {
    const { username, pin } = await req.json();

    if (!username || !pin) {
      return NextResponse.json({ error: 'Username and PIN are required' }, { status: 400 });
    }

    // Rate Limiting Check
    const rateLimit = rateLimitMap.get(username) || { attempts: 0, lockedUntil: null };
    if (rateLimit.lockedUntil && Date.now() < rateLimit.lockedUntil) {
      const remainingTime = Math.ceil((rateLimit.lockedUntil - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Account locked. Try again after ${remainingTime} minutes.` },
        { status: 429 }
      );
    }

    // Retrieve hashed PIN from mock DB (Replace with Supabase query in prod)
    const storedHash = mockUserDb.get(username);
    
    // As a fallback for boilerplate testing without registering first, allow 'test' user with '1234'
    const fallbackHash = await bcrypt.hash('1234', 10);
    const hashToCompare = storedHash || (username === 'test' ? fallbackHash : null);

    if (!hashToCompare) {
       return NextResponse.json({ error: 'Invalid username or PIN' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(pin, hashToCompare);

    if (!isValid) {
      rateLimit.attempts += 1;
      if (rateLimit.attempts >= MAX_ATTEMPTS) {
        rateLimit.lockedUntil = Date.now() + LOCKOUT_MS;
      }
      rateLimitMap.set(username, rateLimit);
      return NextResponse.json({ error: 'Invalid username or PIN' }, { status: 401 });
    }

    // Success: Reset rate limit
    rateLimitMap.delete(username);

    // Create JWT Session
    const token = jwt.sign(
      { username },
      process.env.JWT_SECRET || 'super_secret_quiet_luxury_key',
      { expiresIn: '7d' }
    );

    const response = NextResponse.json({ success: true, username });
    
    // Set HTTP-Only Cookie
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
