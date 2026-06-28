#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'books.json');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    if (key === 'force' || key === 'dry-run' || key === 'sync-existing' || key === 'sync-existing-only') {
      args[key] = true;
    } else {
      args[key] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node tools/import-book.js --source /path/book.md --title 書名 --slug book-slug [--limit 3] [--start 1] [--force] [--sync-existing]',
    '  node tools/import-book.js --sync-existing-only',
    '',
    'Notes:',
    '  - Markdown chapters are detected from headings like "## 第一回 出山", "## 第一章 章名", or "## 卷一 章名".',
    '  - Existing files are not overwritten unless --force is set.',
    '  - --sync-existing updates library sidebars in manifest-listed reader pages.',
  ].join('\n');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function toJsIdentifier(slug, index) {
  const safeSlug = slug.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase() || 'UNTITLED';
  return `BOOK_${safeSlug}_CHAPTER_${String(index).padStart(3, '0')}`;
}

function linesToParagraphs(lines) {
  const normalizedLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const isListItem = /^\s*[-*+]\s+/.test(line);
    const isMetadataLine = /^\s*\*\*[^*]+\*\*：/.test(line) || /^\s*[^：\s　]{1,12}(?:\s+[^：\s　]{1,12})?：/.test(line);
    let text = line.trimEnd();

    if (/^\s*-{3,}\s*$/.test(text)) {
      normalizedLines.push('');
      continue;
    }

    text = text
      .replace(/^#{1,6}\s+/, '')
      .replace(/^>\s?/, '')
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .trim();

    normalizedLines.push(text);
    if ((isListItem || isMetadataLine) && trimmed) normalizedLines.push('');
  }

  return normalizedLines
    .join('\n')
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, '').trim())
    .map((paragraph) => paragraph
      .replace(/^《([^》]+)》[（(]([^）)]+)[）)]$/u, '《$1》 $2')
      .replace(/^(版本：[^（(]+)[（(]([^）)]+)[）)]$/u, '$1 $2'))
    .filter(Boolean);
}

function parseMarkdownChapters(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const chapters = [];
  let current = null;
  const frontMatterLines = [];
  const headingPattern = /^#{2,6}\s+((?:第[一二三四五六七八九十百千〇零兩]+[回章卷]|卷[一二三四五六七八九十百千〇零兩]+)\s*.*)$/u;

  for (const line of lines) {
    const match = line.match(headingPattern);
    if (match) {
      if (current) chapters.push(current);
      current = { title: match[1].trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
    else frontMatterLines.push(line);
  }
  if (current) chapters.push(current);

  const parsedChapters = chapters.map((chapter, index) => {
    const paragraphs = linesToParagraphs(chapter.lines);
    return { title: chapter.title, order: index + 1, paragraphs };
  });

  const frontParagraphs = linesToParagraphs(frontMatterLines);

  const frontMatterTextLength = frontParagraphs.join('').replace(/[#*\-[\]()\s　]/g, '').length;
  if (frontMatterTextLength > 80) {
    parsedChapters.unshift({
      title: '前言與序跋',
      order: 0,
      frontMatter: true,
      paragraphs: frontParagraphs,
    });
  }

  return parsedChapters;
}

function splitChapterTitle(title) {
  const match = title.match(/^((?:第.+?[回章卷]|卷.+?))\s*(.*)$/u);
  return {
    number: match ? match[1] : title,
    name: match && match[2] ? match[2] : '',
  };
}

function chapterDisplayMeta(title) {
  const parts = splitChapterTitle(title);
  const isNumberedChapter = /^第.+?[回章卷]$|^卷.+/u.test(parts.number);
  if (!isNumberedChapter) {
    const shortTitle = parts.number.includes('序') || parts.number.includes('跋') ? '序' : parts.number.slice(0, 1);
    return {
      ...parts,
      number: shortTitle,
      headerName: '',
      spineName: '',
      shouldPrependFullTitle: false,
    };
  }

  const isLongName = parts.name.length > 8;
  const shortName = parts.name
    .split(/[　\s，。、；：！？]/u)
    .filter(Boolean)[0] || parts.name.slice(0, 4);
  return {
    ...parts,
    headerName: isLongName ? '' : parts.name,
    spineName: isLongName ? shortName.slice(0, 3) : parts.name,
    shouldPrependFullTitle: isLongName,
  };
}

function renderSidebar(manifest, currentBookSlug, currentReader) {
  const bookLinks = manifest.books.map((book) => {
    const firstReader = book.chapters[0] ? book.chapters[0].reader : '#';
    const current = book.slug === currentBookSlug ? ' aria-current="page"' : '';
    return `      <a class="book-link" href="./${escapeHtml(firstReader)}"${current}>${escapeHtml(book.title)}</a>`;
  }).join('\n');

  const currentBook = manifest.books.find((book) => book.slug === currentBookSlug);
  const chapterLinks = currentBook.chapters.map((chapter) => {
    const current = chapter.reader === currentReader ? ' aria-current="page"' : '';
    const parts = splitChapterTitle(chapter.title);
    const phrases = parts.name.split(/[　\s]{1,}/u).filter(Boolean);
    const titleHtml = phrases.length >= 2
      ? `<span>${escapeHtml(phrases[0])}</span><span>${escapeHtml(phrases.slice(1).join('　'))}</span>`
      : `<span class="single-phrase">${escapeHtml(parts.name)}</span>`;
    const label = parts.name
      ? `<span class="chapter-index">${escapeHtml(parts.number)}</span><span class="chapter-title-pair">${titleHtml}</span>`
      : `<span class="chapter-index chapter-index-wide">${escapeHtml(parts.number)}</span>`;
    return `      <a class="chapter-link" href="./${escapeHtml(chapter.reader)}"${current}>${label}</a>`;
  }).join('\n');

  return `  <aside class="library-sidebar" aria-label="書庫與章回選擇">
    <nav class="book-selector" aria-label="書目選擇">
      <span class="selector-label">書目</span>
${bookLinks}
      <button class="add-book-button" type="button" data-import-book>添加新書</button>
    </nav>
    <hr class="sidebar-divider">
    <nav class="chapter-selector" aria-label="章回選擇">
      <span class="selector-label">章回</span>
${chapterLinks}
    </nav>
  </aside>`;
}

function renderImportLauncherScript() {
  return `  <script>
    async function openBookImport() {
      if (!window.showDirectoryPicker) {
        window.location.href = './import-book.html';
        return;
      }

      try {
        const directoryHandle = await window.showDirectoryPicker({ mode: 'read' });
        const markdownFiles = [];
        for await (const [name, handle] of directoryHandle.entries()) {
          if (handle.kind !== 'file' || !/\\.m(?:d|arkdown)$/i.test(name)) continue;
          const file = await handle.getFile();
          const text = await file.text();
          const chapters = (text.match(/^#{2,6}\\s+(?:第[一二三四五六七八九十百千〇零兩]+[回章卷]|卷[一二三四五六七八九十百千〇零兩]+)\\s*.*$/gmu) || []).length;
          markdownFiles.push({
            name,
            size: file.size,
            chapters,
            modified: file.lastModified,
            text,
          });
        }

        window.sessionStorage.setItem('pendingBookImport', JSON.stringify({
          folderName: directoryHandle.name,
          files: markdownFiles,
        }));
        window.location.href = './import-book.html';
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        window.sessionStorage.setItem('pendingBookImportError', error && error.message ? error.message : String(error));
        window.location.href = './import-book.html';
      }
    }

    document.querySelector('[data-import-book]')?.addEventListener('click', openBookImport);
  </script>`;
}

function renderData({ variable, bookTitle, chapterTitle, source, paragraphs }) {
  return `window.${variable} = ${JSON.stringify({
    bookTitle,
    chapterTitle,
    footerBook: bookTitle,
    source,
    paragraphs,
  }, null, 2)};\n`;
}

function renderReader({ manifest, book, chapter, chapterIndex, dataFile, dataVariable }) {
  const titleParts = chapterDisplayMeta(chapter.title);
  const sidebar = renderSidebar(manifest, book.slug, chapter.reader);
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(book.title)} · ${escapeHtml(chapter.title)}</title>
  <style>
    :root {
      --viewport-bg: #F5F1E6;
      --paper-surface: #FFFDF8;
      --ink-primary: #000000;
      --ink-muted: #5F574F;
      --font-serif: "Huiwen-mincho", "汇文明朝体", "cwTeX 明體", "cwTeXMing", "HanWangMingMedium", "王漢宗中明體繁", "Songti SC", STSong, SimSun, "Noto Serif TC", serif;
      --page-width: 480px;
      --page-height: 720px;
      --page-padding: 24px;
      --frame-outer: 3px;
      --frame-gap: 5px;
      --frame-inner: 1px;
      --header-height: 64px;
      --footer-height: 52px;
      --body-font-size: 17px;
      --body-line-height: 1.76;
      --line-advance: 30px;
      --leaf-columns: 5;
      --leaf-text-width: 150px;
      --body-padding-inline: 30px;
      --body-padding-block: 16px;
      --spine-width: 20px;
      --fold-gutter: 16px;
      --column-gap: 28px;
      --paragraph-gap: 0.65em;
    }

    * { box-sizing: border-box; }

    html,
    body {
      min-height: 100%;
      margin: 0;
      background: var(--viewport-bg);
      color: var(--ink-primary);
      font-family: var(--font-serif);
      -webkit-font-smoothing: antialiased;
    }

    body {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(120px, 1fr) auto minmax(120px, 1fr);
      grid-template-rows: auto auto auto;
      align-content: center;
      gap: 10px;
      padding: 24px;
    }

    .toolbar {
      grid-column: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      min-height: 40px;
    }

    .toolbar button {
      appearance: none;
      border: 1px solid #000;
      border-radius: 0;
      background: var(--paper-surface);
      color: #000;
      font: 15px/1 var(--font-serif);
      padding: 8px 12px;
      cursor: pointer;
    }

    .toolbar button:disabled {
      color: var(--ink-muted);
      border-color: #8A8278;
      cursor: default;
    }

    .counter {
      min-width: 8em;
      text-align: center;
      font-size: 14px;
      color: var(--ink-muted);
      letter-spacing: 0.08em;
    }

    .library-sidebar {
      grid-column: 1;
      grid-row: 2;
      justify-self: end;
      align-self: start;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 18px;
      min-width: 124px;
      margin-inline-end: 40px;
    }

    .book-selector,
    .chapter-selector {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .chapter-selector {
      max-block-size: 520px;
      overflow: auto;
      padding-inline-end: 2px;
    }

    .selector-label {
      color: var(--ink-muted);
      font-size: 13px;
      letter-spacing: 0.08em;
      text-align: center;
    }

    .book-link,
    .add-book-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 32px;
      border: 1px solid #000;
      border-radius: 0;
      background: var(--paper-surface);
      color: #000;
      font: 14px/1 var(--font-serif);
      letter-spacing: 0.04em;
      padding: 7px 10px;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
    }

    .chapter-link {
      display: grid;
      grid-template-columns: 4.6em minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      min-height: 32px;
      border: 1px solid #000;
      border-radius: 0;
      background: var(--paper-surface);
      color: #000;
      font: 14px/1.15 var(--font-serif);
      letter-spacing: 0.04em;
      padding: 7px 10px;
      text-decoration: none;
    }

    .chapter-index {
      text-align: end;
      white-space: nowrap;
    }

    .chapter-index-wide {
      grid-column: 1 / -1;
      text-align: center;
    }

    .chapter-title-pair {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: center;
      gap: 12px;
      min-width: 0;
      text-align: center;
    }

    .chapter-title-pair span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chapter-title-pair .single-phrase {
      grid-column: 1 / -1;
    }

    .add-book-button {
      border-style: dashed;
      color: var(--ink-muted);
    }

    .book-link[aria-current="page"],
    .chapter-link[aria-current="page"] {
      background: #000;
      color: var(--paper-surface);
    }

    .sidebar-divider {
      border: 0;
      border-top: 1px solid rgba(0, 0, 0, 0.28);
      inline-size: 100%;
      margin: 0;
    }

    .stage {
      grid-column: 2;
      grid-row: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: 0;
    }

    .page-card {
      width: var(--page-width);
      height: var(--page-height);
      padding: var(--page-padding);
      background: var(--paper-surface);
      box-shadow: 1px 2px 6px rgba(0, 0, 0, 0.08);
      flex-shrink: 0;
    }

    .border-wrapper {
      width: 100%;
      height: 100%;
      border: var(--frame-outer) solid var(--ink-primary);
      padding: var(--frame-gap);
    }

    .border-inner {
      width: 100%;
      height: 100%;
      border: var(--frame-inner) solid var(--ink-primary);
      display: grid;
      grid-template-rows: var(--header-height) 1fr var(--footer-height);
      background: var(--paper-surface);
    }

    .margin-top {
      border-bottom: 1px solid var(--ink-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 400;
    }

    .header-title {
      display: flex;
      flex-direction: row-reverse;
      align-items: center;
      justify-content: center;
      gap: 16px;
      transform: translateX(-2px);
    }

    .header-title span {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      white-space: nowrap;
      font-size: 18px;
      line-height: 1;
      letter-spacing: 0.04em;
    }

    .grid-body {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 1fr;
      overflow: hidden;
    }

    .middle-spine {
      position: absolute;
      inset-block: 0;
      inset-inline-start: 50%;
      inline-size: var(--spine-width);
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 5px;
      padding-block-start: 112px;
      z-index: 4;
    }

    .middle-spine::before {
      content: "";
      position: absolute;
      inset-inline-start: 50%;
      inset-block: 0;
      inline-size: 1px;
      background: var(--ink-primary);
      transform: translateX(-50%);
      z-index: 0;
    }

    .spine-text {
      position: relative;
      z-index: 1;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      background: var(--paper-surface);
      color: var(--ink-primary);
      font-size: 14px;
      line-height: 1.1;
      letter-spacing: 0.08em;
      padding-block: 2px;
    }

    .yuwei {
      position: relative;
      z-index: 1;
      inline-size: 16px;
      block-size: auto;
      display: block;
      background: var(--paper-surface);
    }

    .lower-yuwei { transform: rotate(180deg); }

    .leaf-text {
      position: relative;
      display: flex;
      flex-direction: row-reverse;
      inline-size: calc(var(--leaf-text-width) + var(--body-padding-inline) + var(--fold-gutter));
      block-size: 100%;
      overflow: hidden;
      gap: 0;
    }

    .right-text {
      grid-column: 2;
      justify-self: end;
      padding: var(--body-padding-block) var(--body-padding-inline) var(--body-padding-block) var(--fold-gutter);
    }

    .left-text {
      grid-column: 1;
      justify-self: start;
      padding: var(--body-padding-block) var(--fold-gutter) var(--body-padding-block) var(--body-padding-inline);
    }

    .vcol {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      flex: 0 0 var(--line-advance);
      block-size: var(--line-advance);
      inline-size: 100%;
      overflow: hidden;
      font-size: var(--body-font-size);
      font-weight: 400;
      line-height: var(--body-line-height);
      letter-spacing: 0.02em;
      text-align: justify;
      text-justify: inter-ideograph;
      line-break: strict;
      hanging-punctuation: allow-end last;
      overflow-wrap: normal;
      word-break: normal;
      overflow: visible;
    }

    .vcol p {
      margin: 0;
      padding: 0;
      hanging-punctuation: allow-end last;
      line-break: strict;
      overflow-wrap: normal;
      word-break: normal;
    }

    .hang-end-punctuation {
      display: inline-block;
      inline-size: 0;
      overflow: visible;
      transform: translateY(-0.25em);
    }

    .chapter-opening-title {
      font-size: 19px;
      font-weight: 600;
      line-height: 1.55;
      letter-spacing: 0.03em;
    }

    .annotation {
      display: inline-block;
      color: #1A1A1A;
      font-size: 11px;
      line-height: 1.2;
      letter-spacing: 0.01em;
      margin-inline: 2px;
      padding-block: 4px;
      border-inline-start: 1px dashed #CCCCCC;
      border-inline-end: 1px dashed #CCCCCC;
      vertical-align: middle;
    }

    .margin-bottom {
      border-top: 1px solid var(--ink-primary);
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: center;
      padding-inline: 28px;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.4;
      letter-spacing: 0.1em;
    }

    .footer-book,
    .footer-page {
      writing-mode: vertical-rl;
      justify-self: center;
    }

    .footer-book { grid-column: 2; }
    .footer-page { grid-column: 1; }

    .status {
      grid-column: 2;
      grid-row: 3;
      min-height: 18px;
      text-align: center;
      color: var(--ink-muted);
      font-size: 13px;
      letter-spacing: 0.04em;
    }

    .measure-root {
      position: fixed;
      left: -200vw;
      top: 0;
      visibility: hidden;
      pointer-events: none;
      contain: layout style paint;
    }

    @media (max-width: 560px) {
      body {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto auto auto;
        padding: 12px;
      }

      .toolbar,
      .stage,
      .library-sidebar,
      .status { grid-column: 1; }

      .toolbar { grid-row: 1; }
      .stage { grid-row: 2; }

      .library-sidebar {
        grid-row: 3;
        justify-self: center;
        align-self: center;
        margin-inline-end: 0;
        min-width: 0;
      }

      .book-selector,
      .chapter-selector {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: center;
      }

      .sidebar-divider { display: none; }
      .status { grid-row: 4; }

      .page-card {
        transform: scale(0.84);
        transform-origin: center;
      }
    }
  </style>
</head>
<body>
  <nav class="toolbar" aria-label="翻頁控制">
    <button id="prevPage" type="button">上一頁</button>
    <div id="pageCounter" class="counter">測量中</div>
    <button id="nextPage" type="button">下一頁</button>
  </nav>

  <main class="stage">
    <article class="page-card" aria-label="${escapeHtml(book.title)} ${escapeHtml(chapter.title)}">
      <div class="border-wrapper">
        <div class="border-inner">
          <header id="chapterTitle" class="margin-top" aria-label="${escapeHtml(chapter.title)}">
            <div class="header-title">
              <span id="headerChapterNumber">${escapeHtml(titleParts.number)}</span>
              <span id="headerChapterTitle">${escapeHtml(titleParts.headerName)}</span>
            </div>
          </header>

          <section class="grid-body">
            <div class="middle-spine" aria-hidden="true">
              <div id="spineChapterNumber" class="spine-text">${escapeHtml(titleParts.number)}</div>
              <svg class="yuwei upper-yuwei" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 28">
                <path d="M 50,0 L 100,20 L 100,28 L 95,28 L 50,7 L 5,28 L 0,28 L 0,20 Z" fill="black"/>
              </svg>
              <div id="spineChapterTitle" class="spine-text">${escapeHtml(titleParts.spineName)}</div>
              <svg class="yuwei lower-yuwei" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 28">
                <path d="M 50,0 L 100,20 L 100,28 L 95,28 L 50,7 L 5,28 L 0,28 L 0,20 Z" fill="black"/>
              </svg>
            </div>
            <div id="leftText" class="leaf-text left-text"></div>
            <div id="rightText" class="leaf-text right-text"></div>
          </section>

          <footer class="margin-bottom">
            <span id="pageNumber" class="footer-page">初一</span>
            <span id="bookTitle" class="footer-book">${escapeHtml(book.title)}</span>
          </footer>
        </div>
      </div>
    </article>
  </main>

${sidebar}

  <div id="status" class="status">正在建立測量沙盒。</div>
  <div id="measureRoot" class="measure-root" aria-hidden="true"></div>

  <script src="./${escapeHtml(dataFile)}"></script>
  <script>
    const chapter = window.${dataVariable};
    const state = {
      pages: [],
      index: 0,
    };

    const els = {
      prev: document.getElementById('prevPage'),
      next: document.getElementById('nextPage'),
      counter: document.getElementById('pageCounter'),
      leftText: document.getElementById('leftText'),
      rightText: document.getElementById('rightText'),
      pageNumber: document.getElementById('pageNumber'),
      bookTitle: document.getElementById('bookTitle'),
      chapterTitle: document.getElementById('chapterTitle'),
      headerChapterNumber: document.getElementById('headerChapterNumber'),
      headerChapterTitle: document.getElementById('headerChapterTitle'),
      spineChapterNumber: document.getElementById('spineChapterNumber'),
      spineChapterTitle: document.getElementById('spineChapterTitle'),
      status: document.getElementById('status'),
      measureRoot: document.getElementById('measureRoot'),
    };

    function escapeHtml(value) {
      return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    }

    const hangingEndPunctuation = /([，。、；：！？」』）》】〕〗〙〛〉》）］｝,.!?;:]+)$/u;
    const hangingPunctuationSegment = /^[，。、；：！？」』）》】〕〗〙〛〉》）］｝,.!?;:]+$/u;

    function renderInline(text, shouldHangEnd = false) {
      const html = escapeHtml(text).replace(/(\\[[^\\]]+\\])/g, '<span class="annotation">$1</span>');
      if (!shouldHangEnd) return html;
      return html.replace(hangingEndPunctuation, '<span class="hang-end-punctuation">$1</span>');
    }

    function renderParagraphs(text) {
      const paragraphs = text
        .split(/\\n{2,}/)
        .filter(Boolean);

      return paragraphs
        .map((paragraph, index) => {
          const className = paragraph === chapter.chapterTitle ? ' class="chapter-opening-title"' : '';
          return \`<p\${className}>\${renderInline(paragraph, index === paragraphs.length - 1)}</p>\`;
        })
        .join('');
    }

    function chapterDisplayMeta(title) {
      const match = title.match(/^((?:第.+?[回章卷]|卷.+?))\\s*(.*)$/);
      const number = match ? match[1] : title;
      const name = match && match[2] ? match[2] : '';
      const isNumberedChapter = /^第.+?[回章卷]$|^卷.+/u.test(number);
      if (!isNumberedChapter) {
        const shortTitle = number.includes('序') || number.includes('跋') ? '序' : number.slice(0, 1);
        return {
          number: shortTitle,
          name,
          headerName: '',
          spineName: '',
          shouldPrependFullTitle: false,
        };
      }

      const isLongName = name.length > 8;
      const shortName = name
        .split(/[　\\s，。、；：！？]/u)
        .filter(Boolean)[0] || name.slice(0, 4);

      return {
        number,
        name,
        headerName: isLongName ? '' : name,
        spineName: isLongName ? shortName.slice(0, 3) : name,
        shouldPrependFullTitle: isLongName,
      };
    }

    function pageLabel(pageIndex) {
      const n = pageIndex + 1;
      const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
      if (n === 1) return '初一';
      if (n < 10) return \`初\${digits[n]}\`;
      if (n < 20) return \`十\${digits[n - 10]}\`;
      if (n < 100) {
        const tens = Math.floor(n / 10);
        const ones = n % 10;
        return \`\${digits[tens]}十\${digits[ones]}\`;
      }
      return \`百\${digits[n - 100] || ''}\`;
    }

    function createColumn() {
      const column = document.createElement('div');
      column.className = 'vcol';
      return column;
    }

    function createColumns(count) {
      return Array.from({ length: count }, createColumn);
    }

    function createMeasureColumn() {
      const card = document.querySelector('.page-card').cloneNode(true);
      card.querySelector('#leftText').id = 'measureLeftText';
      card.querySelector('#rightText').id = 'measureRightText';
      card.querySelector('#chapterTitle').removeAttribute('id');
      card.querySelector('#headerChapterNumber').removeAttribute('id');
      card.querySelector('#headerChapterTitle').removeAttribute('id');
      card.querySelector('#spineChapterNumber').removeAttribute('id');
      card.querySelector('#spineChapterTitle').removeAttribute('id');
      card.querySelector('#pageNumber').removeAttribute('id');
      card.querySelector('#bookTitle').removeAttribute('id');
      const measureRight = card.querySelector('#measureRightText');
      measureRight.replaceChildren(createColumn());
      els.measureRoot.replaceChildren(card);
      return measureRight.querySelector('.vcol');
    }

    function getSegments(text) {
      if (window.Intl && Intl.Segmenter) {
        return Array.from(new Intl.Segmenter('zh-Hant', { granularity: 'grapheme' }).segment(text), (item) => item.segment);
      }
      return Array.from(text);
    }

    function absorbHangingPunctuation(segments, end) {
      let next = end;
      while (next < segments.length && hangingPunctuationSegment.test(segments[next])) {
        next += 1;
      }
      return next;
    }

    function fitsColumn(measureColumn, text) {
      measureColumn.innerHTML = renderParagraphs(text);
      const inlineOverflow = measureColumn.scrollHeight - measureColumn.clientHeight;
      const blockOverflow = measureColumn.scrollWidth - measureColumn.clientWidth;
      return inlineOverflow <= 1 && blockOverflow <= 1;
    }

    function takeFittingText(measureColumn, segments, start) {
      if (start >= segments.length) {
        return { end: start, text: '' };
      }

      let best = start + 1;
      let step = 48;
      let probe = Math.min(start + step, segments.length);

      while (probe < segments.length) {
        const candidate = segments.slice(start, probe).join('').replace(/^\\n+/, '');
        if (!fitsColumn(measureColumn, candidate)) {
          break;
        }
        best = probe;
        step *= 2;
        probe = Math.min(start + step, segments.length);
      }

      if (probe === segments.length) {
        const candidate = segments.slice(start, probe).join('').replace(/^\\n+/, '');
        if (fitsColumn(measureColumn, candidate)) {
          return {
            end: probe,
            text: candidate.replace(/\\n+$/, ''),
          };
        }
      }

      let low = best + 1;
      let high = probe;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = segments.slice(start, mid).join('').replace(/^\\n+/, '');
        if (fitsColumn(measureColumn, candidate)) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (best <= start) best = start + 1;

      let leafText = segments.slice(start, best).join('').replace(/^\\n+/, '').replace(/\\n+$/, '');
      const lastBreak = leafText.lastIndexOf('\\n\\n');
      const remaining = segments.length - best;
      if (lastBreak > 0 && remaining > 80) {
        const adjusted = leafText.slice(0, lastBreak).trimEnd();
        if (adjusted.length > 80 && fitsColumn(measureColumn, adjusted)) {
          best = start + getSegments(adjusted).length;
          leafText = adjusted;
        }
      }

      const hangingEnd = absorbHangingPunctuation(segments, best);
      if (hangingEnd > best) {
        best = hangingEnd;
        leafText = segments.slice(start, best).join('').replace(/^\\n+/, '').replace(/\\n+$/, '');
      }

      return { end: best, text: leafText };
    }

    function paginate(text) {
      const measureColumn = createMeasureColumn();
      const segments = getSegments(text);
      const pages = [];
      let start = 0;
      const leafColumns = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--leaf-columns'), 10) || 4;

      while (start < segments.length) {
        const right = [];
        const left = [];
        for (let i = 0; i < leafColumns; i += 1) {
          const result = takeFittingText(measureColumn, segments, start);
          right.push(result.text);
          start = result.end > start ? result.end : start + 1;
        }
        for (let i = 0; i < leafColumns; i += 1) {
          const result = takeFittingText(measureColumn, segments, start);
          left.push(result.text);
          start = result.end > start ? result.end : start + 1;
        }
        pages.push({ right, left });
      }

      return pages;
    }

    function renderColumns(container, columns) {
      const columnNodes = createColumns(Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--leaf-columns'), 10) || 4);
      columnNodes.forEach((column, index) => {
        column.innerHTML = renderParagraphs(columns[index] || '');
      });
      container.replaceChildren(...columnNodes);
    }

    function renderPage() {
      const page = state.pages[state.index] || { right: [], left: [] };
      renderColumns(els.rightText, page.right);
      renderColumns(els.leftText, page.left);
      els.pageNumber.textContent = pageLabel(state.index);
      els.counter.textContent = \`\${state.index + 1} / \${state.pages.length}\`;
      els.status.textContent = \`沙盒測量完成：\${chapter.paragraphs.length} 段，\${state.pages.length} 頁；右葉 \${els.rightText.children.length} 欄，左葉 \${els.leftText.children.length} 欄。\`;
      els.prev.disabled = state.index === 0;
      els.next.disabled = state.index >= state.pages.length - 1;
    }

    function nextPage() {
      if (state.index < state.pages.length - 1) {
        state.index += 1;
        renderPage();
      }
    }

    function prevPage() {
      if (state.index > 0) {
        state.index -= 1;
        renderPage();
      }
    }

    async function init() {
      els.prev.disabled = true;
      els.next.disabled = true;
      els.chapterTitle.setAttribute('aria-label', chapter.chapterTitle);
      els.bookTitle.textContent = chapter.footerBook;
      const displayTitle = chapterDisplayMeta(chapter.chapterTitle);
      els.headerChapterNumber.textContent = displayTitle.number;
      els.headerChapterTitle.textContent = displayTitle.headerName;
      els.spineChapterNumber.textContent = displayTitle.number;
      els.spineChapterTitle.textContent = displayTitle.spineName;
      await document.fonts.ready;
      const fullText = [
        displayTitle.shouldPrependFullTitle ? chapter.chapterTitle : '',
        chapter.paragraphs.join('\\n\\n'),
      ].filter(Boolean).join('\\n\\n');
      state.pages = paginate(fullText);
      state.index = 0;
      renderPage();
    }

    els.prev.addEventListener('click', prevPage);
    els.next.addEventListener('click', nextPage);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') nextPage();
      if (event.key === 'ArrowRight') prevPage();
    });

    init();
  </script>
${renderImportLauncherScript()}
</body>
</html>
`;
}

function replaceSidebar(html, sidebar) {
  const pattern = /  <aside class="library-sidebar"[\s\S]*?<\/aside>/;
  if (!pattern.test(html)) {
    throw new Error('找不到 library-sidebar，無法同步章回選擇器。');
  }
  return html.replace(pattern, sidebar);
}

function ensureImportShell(html) {
  let nextHtml = html;
  if (!nextHtml.includes('max-block-size: 520px')) {
    nextHtml = nextHtml.replace(
      '    .book-selector,\n    .chapter-selector {\n      display: flex;\n      flex-direction: column;\n      align-items: stretch;\n      gap: 8px;\n    }',
      '    .book-selector,\n    .chapter-selector {\n      display: flex;\n      flex-direction: column;\n      align-items: stretch;\n      gap: 8px;\n    }\n\n    .chapter-selector {\n      max-block-size: 520px;\n      overflow: auto;\n      padding-inline-end: 2px;\n    }',
    );
  }

  if (!nextHtml.includes('.chapter-title-pair')) {
    nextHtml = nextHtml.replace(
      '    .book-link[aria-current="page"],\n    .chapter-link[aria-current="page"] {',
      `    .chapter-link {
      display: grid;
      grid-template-columns: 4.6em minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      min-height: 32px;
      border: 1px solid #000;
      border-radius: 0;
      background: var(--paper-surface);
      color: #000;
      font: 14px/1.15 var(--font-serif);
      letter-spacing: 0.04em;
      padding: 7px 10px;
      text-decoration: none;
    }

    .chapter-index {
      text-align: end;
      white-space: nowrap;
    }

    .chapter-index-wide {
      grid-column: 1 / -1;
      text-align: center;
    }

    .chapter-title-pair {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: center;
      gap: 12px;
      min-width: 0;
      text-align: center;
    }

    .chapter-title-pair span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chapter-title-pair .single-phrase {
      grid-column: 1 / -1;
    }

    .book-link[aria-current="page"],
    .chapter-link[aria-current="page"] {`,
    );
  }

  if (!nextHtml.includes('.add-book-button')) {
    nextHtml = nextHtml
      .replace(
        '    .book-link,\n    .chapter-link {',
        '    .book-link,\n    .chapter-link,\n    .add-book-button {',
      )
      .replace(
        '      white-space: nowrap;\n    }',
        '      white-space: nowrap;\n      cursor: pointer;\n    }\n\n    .add-book-button {\n      border-style: dashed;\n      color: var(--ink-muted);\n    }',
      );
  }

  if (!nextHtml.includes('function openBookImport()')) {
    nextHtml = nextHtml.replace('\n</body>', `\n${renderImportLauncherScript()}\n</body>`);
  }

  return nextHtml;
}

function syncExistingSidebars(manifest, dryRun = false) {
  const synced = [];
  for (const book of manifest.books) {
    for (const chapter of book.chapters) {
      const readerPath = path.join(ROOT, chapter.reader);
      if (!fs.existsSync(readerPath)) continue;
      const html = fs.readFileSync(readerPath, 'utf8');
      const nextHtml = ensureImportShell(replaceSidebar(html, renderSidebar(manifest, book.slug, chapter.reader)));
      if (nextHtml !== html) {
        synced.push(chapter.reader);
        if (!dryRun) fs.writeFileSync(readerPath, nextHtml);
      }
    }
  }
  return synced;
}

function main() {
  const args = parseArgs(process.argv);
  if (args['sync-existing-only']) {
    const manifest = readJson(MANIFEST_PATH);
    const synced = syncExistingSidebars(manifest, false);
    console.log(`已同步側欄：${synced.length} 頁`);
    return;
  }

  if (!args.source || !args.title || !args.slug) {
    console.error(usage());
    process.exit(1);
  }

  const sourcePath = path.resolve(args.source);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`找不到來源 Markdown：${sourcePath}`);
  }

  const manifest = fs.existsSync(MANIFEST_PATH) ? readJson(MANIFEST_PATH) : { books: [] };
  const markdown = fs.readFileSync(sourcePath, 'utf8');
  const allChapters = parseMarkdownChapters(markdown);
  if (allChapters.length === 0) {
    throw new Error('來源 Markdown 沒有偵測到章回標題。');
  }

  const start = Number.parseInt(args.start || '1', 10);
  const limit = args.limit ? Number.parseInt(args.limit, 10) : allChapters.length;
  const selected = allChapters.slice(start - 1, start - 1 + limit);
  const book = {
    title: args.title,
    slug: args.slug,
    source: path.relative(ROOT, sourcePath),
    chapters: selected.map((chapter, index) => {
      const chapterNumber = Number.isInteger(chapter.order) ? chapter.order : start + index;
      const id = String(chapterNumber).padStart(3, '0');
      return {
        id,
        title: chapter.title,
        reader: `${args.slug}-${id}-reader.html`,
        data: `${args.slug}-${id}-data.js`,
      };
    }),
  };

  const existingIndex = manifest.books.findIndex((item) => item.slug === book.slug);
  if (existingIndex >= 0) {
    manifest.books[existingIndex] = book;
  } else {
    manifest.books.push(book);
  }

  const plannedFiles = [];
  selected.forEach((chapter, index) => {
    const meta = book.chapters[index];
    plannedFiles.push(meta.reader, meta.data);
    if (!args.force) {
      for (const filename of [meta.reader, meta.data]) {
        const outputPath = path.join(ROOT, filename);
        if (fs.existsSync(outputPath)) {
          throw new Error(`已存在 ${filename}；如確定重生，請加 --force。`);
        }
      }
    }
  });

  if (args['dry-run']) {
    console.log(`將導入：${book.title} (${book.slug})`);
    console.log(`章回：${selected.length} / ${allChapters.length}`);
    console.log(plannedFiles.join('\n'));
    return;
  }

  writeJson(MANIFEST_PATH, manifest);

  selected.forEach((chapter, index) => {
    const meta = book.chapters[index];
    const chapterNumber = Number.isInteger(chapter.order) ? chapter.order : start + index;
    const dataVariable = toJsIdentifier(book.slug, chapterNumber);
    fs.writeFileSync(path.join(ROOT, meta.data), renderData({
      variable: dataVariable,
      bookTitle: book.title,
      chapterTitle: chapter.title,
      source: book.source,
      paragraphs: chapter.paragraphs,
    }));
    fs.writeFileSync(path.join(ROOT, meta.reader), renderReader({
      manifest,
      book,
      chapter: meta,
      chapterIndex: chapterNumber,
      dataFile: meta.data,
      dataVariable,
    }));
  });

  const synced = args['sync-existing'] ? syncExistingSidebars(manifest, false) : [];
  console.log(`已導入：${book.title} (${book.slug})`);
  console.log(`已生成：${selected.length} 章`);
  if (synced.length > 0) console.log(`已同步側欄：${synced.length} 頁`);
}

main();
