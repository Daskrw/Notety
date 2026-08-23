import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pupgawjvgglcwnnwcmsz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1cGdhd2p2Z2dsY3dubndjbXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzU5MzAsImV4cCI6MjA5NjY1MTkzMH0.ghq4F2alRS5fM2Nxfqa3UWbmIr_TtLQemyPMdKPtjFw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


