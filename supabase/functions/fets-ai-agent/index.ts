import { createClient } from 'npm:@supabase/supabase-js@2.55.0';
import { createHandler } from './handler.ts';
const env=Object.fromEntries(['FETS_AI_ALLOWED_ORIGINS','GEMINI_API_KEY','ANTHROPIC_API_KEY','GEMINI_TEXT_MODEL','GEMINI_LIVE_MODEL'].map(name=>[name,Deno.env.get(name)]));
Deno.serve(createHandler(env,authorization=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}})));
