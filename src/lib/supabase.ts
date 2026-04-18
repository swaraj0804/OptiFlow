import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://aiijcfdtfgtjyumdahhp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpaWpjZmR0Zmd0anl1bWRhaGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NDE2ODMsImV4cCI6MjA5MjAxNzY4M30.sH5aYi78Om3nCEHmcrSERXx4DD27wT1LEPq-2rMPWuw";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Authentication will fail.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
