import pg from 'pg';
const { Client } = pg;

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTM2MjY1NSwiZXhwIjoyMDcwOTM4NjU1fQ.LJePJfsskt3HvoJvo9cWWDGaE0fOstb0tlmyYm5sWPo';

const query = `
CREATE OR REPLACE FUNCTION notify_leave_status()
RETURNS TRIGGER AS $$
DECLARE
  requester_profile_id UUID;
  approver_profile_id UUID;
  requester_name TEXT;
  approver_name TEXT;
  request_branch TEXT;
BEGIN
  -- Only notify on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only notify for approved or rejected
  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- Map auth user IDs (from leave_requests) to staff profile IDs
  SELECT id, full_name, branch_assigned INTO requester_profile_id, requester_name, request_branch
  FROM staff_profiles
  WHERE user_id = NEW.user_id;

  SELECT id, full_name INTO approver_profile_id, approver_name
  FROM staff_profiles
  WHERE user_id = NEW.approved_by;

  -- Create notification
  INSERT INTO notifications (
    recipient_id,
    type,
    title,
    message,
    link,
    priority,
    metadata,
    branch_location
  ) VALUES (
    requester_profile_id, -- MUST be the profile ID (id in staff_profiles)
    CASE
      WHEN NEW.status = 'approved' THEN 'leave_approved'
      ELSE 'leave_rejected'
    END,
    CASE
      WHEN NEW.status = 'approved' THEN 'Leave Request Approved'
      ELSE 'Leave Request Rejected'
    END,
    'Your ' || NEW.request_type || ' request has been ' || NEW.status ||
    CASE WHEN approver_name IS NOT NULL THEN ' by ' || approver_name ELSE '' END,
    'fets-roster',
    'high',
    jsonb_build_object(
      'request_id', NEW.id,
      'request_type', NEW.request_type,
      'status', NEW.status,
      'approved_by', NEW.approved_by
    ),
    request_branch
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function run() {
  console.log("Connecting to PostgreSQL...");
  const client = new Client({
    connectionString: `postgresql://postgres.qqewusetilxxfvfkmsed:${SERVICE_KEY}@aws-1-ap-south-1.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully! Executing trigger DDL...");
    await client.query(query);
    console.log("✅ Trigger function notify_leave_status() updated in database!");
  } catch (err) {
    console.error("❌ SQL execution failed:", err);
  } finally {
    await client.end();
  }
}
run();
