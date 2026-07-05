import { Client } from 'ssh2';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const config = {
  host: '72.61.171.192',
  port: 22,
  username: 'root',
  password: 'Suspended00@'
};

const REMOTE_DIR = '/var/www/html/fets.live/public_html';
const LOCAL_DIR = './fets-point/dist';

// Recursively find files
function getFiles(dir) {
  const files = [];
  function walk(currentDir) {
    const list = readdirSync(currentDir);
    for (const item of list) {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  walk(dir);
  return files;
}

const localFiles = getFiles(LOCAL_DIR);
console.log(`Found ${localFiles.length} files to upload.`);

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection ready. Starting SFTP...');
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP Error:', err);
      conn.end();
      process.exit(1);
    }

    let completed = 0;
    const errors = [];

    // Helper to ensure remote directory exists
    function ensureRemoteDir(remotePath) {
      return new Promise((resolve) => {
        const parts = remotePath.split('/');
        let current = '';
        
        const next = (index) => {
          if (index >= parts.length - 1) { // Skip filename
            return resolve();
          }
          current += (current === '/' ? '' : '/') + parts[index];
          if (!current || current === '/') {
            return next(index + 1);
          }
          sftp.mkdir(current, (mkdirErr) => {
            // Ignore error if directory already exists
            next(index + 1);
          });
        };
        
        // Start from index 1 if absolute path
        next(remotePath.startsWith('/') ? 1 : 0);
      });
    }

    async function uploadNext(index) {
      if (index >= localFiles.length) {
        console.log(`\nUpload finished. Total files: ${completed}/${localFiles.length}`);
        if (errors.length > 0) {
          console.error(`Encountered ${errors.length} errors:`, errors);
          process.exit(1);
        } else {
          console.log('✅ Deployment successful!');
          conn.end();
          process.exit(0);
        }
        return;
      }

      const localPath = localFiles[index];
      const relPath = relative(LOCAL_DIR, localPath).replace(/\\/g, '/');
      const remotePath = `${REMOTE_DIR}/${relPath}`;

      console.log(`[${index + 1}/${localFiles.length}] Uploading: ${relPath} ...`);
      await ensureRemoteDir(remotePath);

      sftp.fastPut(localPath, remotePath, (putErr) => {
        if (putErr) {
          console.error(`❌ Failed: ${relPath}`, putErr);
          errors.push({ file: relPath, error: putErr.message });
        } else {
          completed++;
        }
        uploadNext(index + 1);
      });
    }

    uploadNext(0);
  });
}).on('error', (err) => {
  console.error('Connection error:', err);
  process.exit(1);
}).connect(config);
