#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'books.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function extractScripts(html) {
  const scripts = [];
  const pattern = /<script(?:\s+src="([^"]+)")?[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = pattern.exec(html))) {
    scripts.push({ src: match[1] || null, body: match[2] || '' });
  }
  return scripts;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function executeDataScript(data, filename) {
  const context = { window: {} };
  vm.createContext(context);
  new vm.Script(data, { filename }).runInContext(context);
  const values = Object.values(context.window);
  assert(values.length === 1, `${filename} 應只掛載一個 window data 變數。`);
  return values[0];
}

function verifyRootIndex(manifest) {
  const indexPath = path.join(ROOT, 'index.html');
  assert(fs.existsSync(indexPath), '缺 index.html。');
  const html = fs.readFileSync(indexPath, 'utf8');
  for (const book of manifest.books) {
    const entry = book.chapters[0]?.reader;
    assert(entry && html.includes(`href="./${entry}"`), `index.html 沒有連到 ${book.title} 的入口。`);
  }
}

function verifyNoLegacyRootHtml() {
  const allowed = new Set(['index.html', 'import-book.html']);
  const rootHtml = fs.readdirSync(ROOT).filter((item) => item.endsWith('.html') && !allowed.has(item));
  assert(rootHtml.length === 0, `根目錄仍有非正式 HTML：${rootHtml.join(', ')}`);
}

function staticVerify(manifest) {
  const results = [];
  verifyRootIndex(manifest);
  verifyNoLegacyRootHtml();
  for (const book of manifest.books) {
    assert(book.chapters.length > 0, `${book.title} 沒有章回。`);
    for (const chapter of book.chapters) {
      const readerPath = path.join(ROOT, chapter.reader);
      const dataPath = path.join(ROOT, chapter.data);
      assert(fs.existsSync(readerPath), `缺 reader：${chapter.reader}`);
      assert(fs.existsSync(dataPath), `缺 data：${chapter.data}`);

      const html = fs.readFileSync(readerPath, 'utf8');
      const data = fs.readFileSync(dataPath, 'utf8');
      const chapterData = executeDataScript(data, chapter.data);
      assert(chapterData.bookTitle === book.title, `${chapter.data} 書名與 books.json 不一致。`);
      assert(chapterData.chapterTitle === chapter.title, `${chapter.data} 章名與 books.json 不一致。`);
      assert(Array.isArray(chapterData.paragraphs), `${chapter.data} paragraphs 不是陣列。`);

      const scripts = extractScripts(html);
      const srcScripts = scripts.filter((script) => script.src);
      const expectedDataSrc = path.relative(path.dirname(chapter.reader), chapter.data).replace(/\\/g, '/');
      const dataHref = expectedDataSrc.startsWith('.') ? expectedDataSrc : `./${expectedDataSrc}`;
      assert(srcScripts.some((script) => script.src === dataHref), `${chapter.reader} 沒有掛載 ${dataHref}`);
      scripts.filter((script) => !script.src && script.body.trim()).forEach((script, index) => {
        new vm.Script(script.body, { filename: `${chapter.reader}#inline-${index}` });
      });

      assert(/--body-font-size:\s*17px/.test(html), `${chapter.reader} 正文字號不是 17px。`);
      assert(/--leaf-columns:\s*5/.test(html), `${chapter.reader} 不是左右五欄設定。`);
      assert(/--page-width:\s*480px/.test(html) && /--page-height:\s*720px/.test(html), `${chapter.reader} 書頁尺寸變數不符合設計系統。`);
      assert(/--font-serif:\s*"Huiwen-mincho",\s*"汇文明朝体"/.test(html), `${chapter.reader} Book Core 首選字體不是 Huiwen-mincho / 汇文明朝体。`);
      assert(/margin-inline-end:\s*50px/.test(html), `${chapter.reader} 側欄距書頁不是 50px。`);
      assert(/transform:\s*translateY\(-0\.25em\)/.test(html), `${chapter.reader} 懸掛標點位移不符合設計系統。`);
      assert(/function absorbHangingPunctuation/.test(html), `${chapter.reader} 缺少 paginator 層級標點吸收。`);
      assert(/function scanBookImportDirectory/.test(html), `${chapter.reader} 添加新書入口不是遞迴掃描。`);
      assert(!/<a class="book-link" href="\//.test(html), `${chapter.reader} 書目側欄含有絕對路徑。`);
      if (chapter.id === '000') {
        assert(/<span id="headerChapterNumber">序<\/span>/.test(html), `${chapter.reader} 前置篇天頭短題不是「序」。`);
        assert(/<div id="spineChapterNumber" class="spine-text">序<\/div>/.test(html), `${chapter.reader} 前置篇魚尾短題不是「序」。`);
      }
      const bodyHtml = html.slice(html.indexOf('<body'));
      assert((bodyHtml.match(/aria-current="page"/g) || []).length === 2, `${chapter.reader} 應只有一個當前書目與一個當前章回。`);

      results.push(chapter.reader);
    }
  }
  return results;
}

async function browserVerify(manifest) {
  let chromium;
  try {
    ({ chromium } = require('/Users/kriswong/.npm/_npx/5e2e484947874241/node_modules/playwright'));
  } catch (error) {
    console.warn(`跳過 Chromium：${error.message}`);
    return [];
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 860 } });
  const checked = [];
  try {
    for (const book of manifest.books) {
      const chapter = book.chapters
        .filter((item) => fs.existsSync(path.join(ROOT, item.data)))
        .sort((a, b) => fs.statSync(path.join(ROOT, a.data)).size - fs.statSync(path.join(ROOT, b.data)).size)[0];
      if (!chapter) continue;
      const url = `file://${path.join(ROOT, chapter.reader)}`;
      const consoleErrors = [];
      page.removeAllListeners('console');
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForFunction(() => document.querySelectorAll('.stage .right-text .vcol').length === 5 && document.querySelectorAll('.stage .left-text .vcol').length === 5, null, { timeout: 60000 });
      await page.waitForFunction(() => document.querySelector('#pageCounter')?.textContent.includes('/'), null, { timeout: 60000 });
      const info = await page.evaluate(() => ({
        right: document.querySelectorAll('.stage .right-text .vcol').length,
        left: document.querySelectorAll('.stage .left-text .vcol').length,
        current: document.querySelectorAll('[aria-current="page"]').length,
        pageSize: {
          width: getComputedStyle(document.documentElement).getPropertyValue('--page-width').trim(),
          height: getComputedStyle(document.documentElement).getPropertyValue('--page-height').trim(),
        },
        sidebarGap: getComputedStyle(document.querySelector('.library-sidebar')).marginInlineEnd,
        hangingInlineSize: getComputedStyle(document.querySelector('.hang-end-punctuation') || document.body).inlineSize,
        status: document.querySelector('#status')?.textContent || '',
      }));
      assert(consoleErrors.length === 0, `${chapter.reader} console error: ${consoleErrors.join('; ')}`);
      assert(info.right === 5 && info.left === 5, `${chapter.reader} 欄數不正確。`);
      assert(info.current === 2, `${chapter.reader} aria-current 數量不正確。`);
      assert(info.pageSize.width === '480px' && info.pageSize.height === '720px', `${chapter.reader} 書頁尺寸不正確。`);
      assert(info.sidebarGap === '50px', `${chapter.reader} 側欄距書頁不是 50px。`);
      checked.push(`${chapter.reader}: ${info.status}`);
    }
  } finally {
    await browser.close();
  }
  return checked;
}

async function main() {
  const manifest = readJson(MANIFEST_PATH);
  const staticResults = staticVerify(manifest);
  console.log(`靜態驗證通過：${staticResults.length} 頁`);
  if (process.argv.includes('--browser')) {
    const browserResults = await browserVerify(manifest);
    if (browserResults.length > 0) {
      console.log('Chromium 驗證通過：');
      browserResults.forEach((line) => console.log(`- ${line}`));
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
