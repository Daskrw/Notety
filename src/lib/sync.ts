/**
 * sync.ts — Simplified. No more polling.
 * Just loads all user data from Supabase into Dexie on login.
 * All ongoing mutations go through data.ts which writes to Supabase immediately.
 */
export { loadUserData } from './data';
