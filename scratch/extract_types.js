const fs = require('fs');

const content = fs.readFileSync('fets-point/src/types/database.types.ts', 'utf8');

const tables = ['conversations', 'conversation_members', 'messages', 'roster_discussions'];

tables.forEach(table => {
  const regex = new RegExp(`\\b${table}\\b\\s*:\\s*\\{[^\\}]*\\bRow\\b\\s*:\\s*\\{([^\\}]*)\\}`);
  const match = content.match(regex);
  if (match) {
    console.log(`Table ${table} Row columns:`);
    console.log(match[1].trim());
  } else {
    // Try a more general regex if Row is structured differently
    const generalRegex = new RegExp(`\\b${table}\\b\\s*:\\s*\\{\\s*Insert\\b[\\s\\S]*?\\bRow\\b\\s*:\\s*\\{([\\s\\S]*?)\\}\\s*(?:Update|Relationships)\\b`);
    const genMatch = content.match(generalRegex);
    if (genMatch) {
      console.log(`Table ${table} Row columns (general):`);
      console.log(genMatch[1].trim());
    } else {
      console.log(`Table ${table} definition not found`);
    }
  }
  console.log('-----------------------------------');
});
