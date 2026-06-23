import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://royfdmobrwozjtaykvps.supabase.co';
const supabaseAnonKey = 'sb_publishable_RUyy4-5tiJXVQ1Sh-APjDA_UyPT3ngi'; // As provided by user

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
