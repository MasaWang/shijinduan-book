#!/usr/bin/env node

const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const url = require('url');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number.parseInt(process.env.PORT || process.argv[2] || '8787', 10);
const IMPORT_DIR = path.join(ROOT, '.book-imports');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function corsHeaders(request) {
  const origin = request.headers.origin || '';
  const allowedOrigins = new Set([
    'null',
    `http://127.0.0.1:${PORT}`,
    `http://localhost:${PORT}`,
  ]);
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : `http://127.0.0.1:${PORT}`,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function send(request, response, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': type,
    ...corsHeaders(request),
  });
  response.end(body);
}

function sendHead(request, response, status, type = 'text/html; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': type,
    ...corsHeaders(request),
  });
  response.end();
}

function safeSegment(value) {
  return String(value || 'book')
    .replace(/[\\/:"*?<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'book';
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 30 * 1024 * 1024) {
        reject(new Error('檔案太大，請先用 CLI 導入。'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function handleImport(request, response) {
  try {
    const payload = JSON.parse(await readBody(request));
    if (!payload.title || !payload.slug || !payload.content) {
      send(request, response, 400, JSON.stringify({ error: '缺少書名、slug 或 Markdown 內容。' }), 'application/json; charset=utf-8');
      return;
    }

    fs.mkdirSync(IMPORT_DIR, { recursive: true });
    const sourceName = `${safeSegment(payload.slug)}-${safeSegment(path.basename(payload.fileName || 'book.md'))}`;
    const sourcePath = path.join(IMPORT_DIR, sourceName.endsWith('.md') ? sourceName : `${sourceName}.md`);
    fs.writeFileSync(sourcePath, payload.content);

    const args = [
      path.join(ROOT, 'tools/import-book.js'),
      '--source', sourcePath,
      '--title', payload.title,
      '--slug', payload.slug,
      '--start', String(payload.start || '1'),
      '--sync-existing',
    ];
    if (payload.limit) args.push('--limit', String(payload.limit));
    if (payload.force === true) args.push('--force');

    const result = childProcess.spawnSync(process.execPath, args, {
      cwd: ROOT,
      encoding: 'utf8',
    });

    if (result.status !== 0) {
      send(request, response, 500, JSON.stringify({
        error: result.stderr || result.stdout || '生成失敗。',
      }), 'application/json; charset=utf-8');
      return;
    }

    send(request, response, 200, JSON.stringify({
      message: '新書已生成，書目側欄已同步。',
      output: result.stdout.trim(),
    }), 'application/json; charset=utf-8');
  } catch (error) {
    send(request, response, 500, JSON.stringify({ error: error.message || String(error) }), 'application/json; charset=utf-8');
  }
}

function serveStatic(request, response) {
  const parsed = url.parse(request.url);
  const pathname = decodeURIComponent(parsed.pathname === '/' ? '/import-book.html' : parsed.pathname);
  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (request.method === 'HEAD') sendHead(request, response, 404);
    else send(request, response, 404, 'Not found');
    return;
  }
  if (request.method === 'HEAD') {
    sendHead(request, response, 200, MIME[path.extname(filePath)] || 'application/octet-stream');
    return;
  }
  send(request, response, 200, fs.readFileSync(filePath), MIME[path.extname(filePath)] || 'application/octet-stream');
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    send(request, response, 204, '');
    return;
  }
  if (request.method === 'POST' && request.url === '/api/import-book') {
    await handleImport(request, response);
    return;
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    serveStatic(request, response);
    return;
  }
  send(request, response, 405, 'Method not allowed');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Book workshop: http://127.0.0.1:${PORT}/import-book.html`);
});
