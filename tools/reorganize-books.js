#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'books.json');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function moveIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  ensureDir(path.dirname(to));
  fs.renameSync(from, to);
  return true;
}

function bookPaths(slug, id) {
  return {
    reader: `books/${slug}/${slug}-${id}-reader.html`,
    data: `books/${slug}/data/${slug}-${id}-data.js`,
  };
}

function writeBookIndex(slug, title, firstReader) {
  const bookRoot = path.join(ROOT, 'books', slug);
  const entry = path.basename(firstReader);
  const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=./${entry}">
  <title>${title}</title>
</head>
<body>
  <p><a href="./${entry}">進入《${title}》</a></p>
</body>
</html>
`;
  fs.writeFileSync(path.join(bookRoot, 'index.html'), html);
}

function writeMetadata(book) {
  const metadata = {
    title: book.title,
    slug: book.slug,
    source: book.source,
    entry: book.chapters[0]?.reader || null,
    chapters: book.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      reader: chapter.reader,
      data: chapter.data,
    })),
  };
  const file = path.join(ROOT, 'books', book.slug, 'data', 'metadata.json');
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(metadata, null, 2)}\n`);
}

function migrateSlug(slug, oldReaderDir = ROOT) {
  const destRoot = path.join(ROOT, 'books', slug);
  ensureDir(path.join(destRoot, 'data'));
  ensureDir(path.join(destRoot, 'assets'));

  const assetsKeep = path.join(destRoot, 'assets', '.gitkeep');
  if (!fs.existsSync(assetsKeep)) {
    fs.writeFileSync(assetsKeep, '');
  }

  for (const name of fs.readdirSync(oldReaderDir)) {
    if (!name.startsWith(`${slug}-`)) continue;
    if (name.endsWith('-reader.html')) {
      moveIfExists(path.join(oldReaderDir, name), path.join(destRoot, name));
    }
    if (name.endsWith('-data.js')) {
      moveIfExists(path.join(oldReaderDir, name), path.join(destRoot, 'data', name));
    }
  }
}

function main() {
  ensureDir(path.join(ROOT, 'books'));

  migrateSlug('jinpingmei', path.join(ROOT, 'jinpingmei'));
  if (fs.existsSync(path.join(ROOT, 'jinpingmei'))) {
    const left = fs.readdirSync(path.join(ROOT, 'jinpingmei'));
    if (left.length === 0) fs.rmdirSync(path.join(ROOT, 'jinpingmei'));
  }

  migrateSlug('shijinduan', ROOT);

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  for (const book of manifest.books) {
    for (const chapter of book.chapters) {
      const next = bookPaths(book.slug, chapter.id);
      chapter.reader = next.reader;
      chapter.data = next.data;
    }
    writeMetadata(book);
    writeBookIndex(book.slug, book.title, book.chapters[0].reader);
  }

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('Reorganized books into books/{slug}/ layout.');
}

main();
