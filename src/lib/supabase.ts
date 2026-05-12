import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// We use the service role key for the backend to bypass RLS and perform admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
