const https = require('https');

const supabaseUrl = 'https://qqewusetilxxfvfkmsed.supabase.co/rest/v1/';
const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZXd1c2V0aWx4eGZ2Zmttc2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNjI2NTUsImV4cCI6MjA3MDkzODY1NX0.-x783XXpilPWC3O-cJqmdSTmhpAvObk_MSElfGdrU8s';

const options = {
  headers: {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`
  }
};

https.get(supabaseUrl, options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const schema = JSON.parse(body);
      const leaveRequestsDefinition = schema.definitions && schema.definitions.leave_requests;
      if (leaveRequestsDefinition) {
        console.log("=== leave_requests properties ===");
        console.log(JSON.stringify(leaveRequestsDefinition.properties, null, 2));
      } else {
        console.log("leave_requests definition not found. Definitions available:", Object.keys(schema.definitions || {}));
      }
    } catch (e) {
      console.error("Error parsing JSON:", e.message);
      console.log(body);
    }
  });
}).on('error', (e) => {
  console.error("Request error:", e);
});
