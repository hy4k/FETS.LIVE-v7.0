const SUPABASE_URL = 'https://qqewusetilxxfvfkmsed.supabase.co';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = 'qqewusetilxxfvfkmsed';

if (!ACCESS_TOKEN) { console.error('Set SUPABASE_ACCESS_TOKEN env var'); process.exit(1); }

async function runSql(query) {
  const res = await fetch('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return res.json();
}

async function verify() {
  const lrPolicies = await runSql("SELECT policyname, cmd FROM pg_policies WHERE tablename = 'leave_requests' ORDER BY cmd;");
  console.log('leave_requests RLS policies:');
  (lrPolicies || []).forEach(p => console.log('  ' + p.cmd + ' - ' + p.policyname));

  const saPolicies = await runSql("SELECT policyname, cmd FROM pg_policies WHERE tablename = 'staff_applications' ORDER BY cmd;");
  console.log('\nstaff_applications RLS policies:');
  (saPolicies || []).forEach(p => console.log('  ' + p.cmd + ' - ' + p.policyname));

  const saCols = await runSql("SELECT column_name FROM information_schema.columns WHERE table_name = 'staff_applications' ORDER BY ordinal_position;");
  console.log('\nstaff_applications columns: ' + (saCols || []).map(c => c.column_name).join(', '));

  const lrCols = await runSql("SELECT column_name FROM information_schema.columns WHERE table_name = 'leave_requests' AND column_name IN ('admin_reply','approved_by','approved_at');");
  console.log('leave_requests new columns: ' + (lrCols || []).map(c => c.column_name).join(', '));

  console.log('\n✅ All checks done!');
}
verify().catch(console.error);
