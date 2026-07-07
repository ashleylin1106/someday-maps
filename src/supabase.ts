// Supabase client — accounts + cloud sync, so the list survives phone changes.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vpexvdoutbyroymhvucc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NWqqhAEdJ8CoC94QMr7yrg_BnNQTI3I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
