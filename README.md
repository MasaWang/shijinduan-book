# 古籍閱讀器製作流程

本專案以 `DESIGN.md` 為唯一正式設計系統。所有根目錄正式 HTML、預覽頁、樣張頁與自動生成的書頁，都必須遵守 `DESIGN.md`；截圖、舊 HTML、臨時重建頁不得作為新的設計權威。

## 目錄結構

```text
shijinduan-book/
├── .github/workflows/     # GitHub Pages 部署
├── tools/                   # 導入、驗證、整理工具
├── index.html               # 書架入口
├── DESIGN.md
├── books.json               # 全庫清單（工具用）
└── books/
    ├── shijinduan/          # 十景緞
    │   ├── index.html
    │   ├── data/
    │   │   ├── metadata.json
    │   │   └── shijinduan-*-data.js
    │   ├── assets/
    │   └── shijinduan-*-reader.html
    └── jinpingmei/          # 金瓶梅詞話
        ├── index.html
        ├── data/
        │   ├── metadata.json
        │   └── jinpingmei-*-data.js
        ├── assets/
        └── jinpingmei-*-reader.html
```

## 目前文件

| 文件 | 用途 |
| --- | --- |
| `DESIGN.md` | 正式設計系統與驗收規則 |
| `books.json` | 書庫與章回清單，自動化生成與側欄同步依此執行 |
| `preview.html` | 設計系統預覽頁 |
| `ancient_book-v2.html` | 正式版視覺樣張 |
| `books/shijinduan/` | 《十景緞》正式閱讀版 |
| `books/jinpingmei/` | 《金瓶梅詞話》正式閱讀版 |
| `tools/import-book.js` | 從 Markdown 導入新書並生成 reader/data |
| `tools/verify-readers.js` | 自查 reader/data 是否符合基本規則 |
| `import-book.html` | 添加新書工作台 |
| `tools/book-workshop-server.js` | 本機書籍製作伺服器，讓介面可以寫入生成文件 |

## 導入新書

新書來源先整理為 Markdown。章回標題使用二級到六級標題，例如：

```md
## 第一回 出山

正文第一段。

正文第二段。
```

`### 第一回 出山` 這類標題也可以導入；單一 `#` 保留給書名，不作章回切分。

長回目會自動特殊處理：

- 天頭只顯示章號，例如 `第一回`。
- 中縫顯示三字短題，例如 `景陽岡`。
- 完整回目放入正文第一頁開頭，使用 19px / 600 作章題層級，跟正文一起沙盒分頁。
- 左側章回選擇器保留完整標題，並按 `回次 + 上句 + 下句` 對齊。

如果第一回前有前言、序、跋、凡例、目錄等實質內容，導入器會保留為 `000` 前置篇：

- reader：`book-slug-000-reader.html`
- data：`book-slug-000-data.js`
- 標題：`前言與序跋`
- 天頭與中縫短題顯示為 `序`，避免前置篇長題溢出。
- 書名版本括號會清理為空格分隔，例如 `《金瓶梅詞話》 夢梅館校本`。
- 書目連結會先進入 `000`，再進 `第一回`。

執行導入前先預覽：

```bash
node tools/import-book.js --source /path/to/book.md --title 書名 --slug book-slug --dry-run
```

確認後正式生成：

```bash
node tools/import-book.js --source /path/to/book.md --title 書名 --slug book-slug --sync-existing
```

也可以使用介面導入。先啟動本機工作台：

```bash
node tools/book-workshop-server.js
```

打開：

```text
http://127.0.0.1:8787/import-book.html
```

在正式閱讀頁左側 `書目` 區點擊 `添加新書`，或直接進入工作台，選擇新書資料夾。工作台會掃描 Markdown、顯示章回數，並提交到本機製作流程生成正式書頁。

常用選項：

- `--limit 3`：只生成前三章，適合先做樣章。
- `--start 5 --limit 1`：從第五章開始，只生成一章。
- `--force`：覆蓋已存在的同名 reader/data，只有明確要重生時使用。
- `--sync-existing`：同步既有正式頁的左側書目與章回側欄。

## 自查驗證

每次導入或調整後，先跑靜態驗證：

```bash
node tools/verify-readers.js
```

需要瀏覽器抽測時：

```bash
node tools/verify-readers.js --browser
```

驗證器會檢查：

- `books.json` 中 reader/data 是否存在。
- data 與 inline script 是否可編譯。
- 正文字號是否維持 `17px`。
- 欄數設定是否維持左右各五欄。
- 懸掛標點是否使用 `translateY(-0.25em)`。
- 每頁是否只有一個當前書目與一個當前章回。
- Chromium 抽測是否能完成沙盒分頁並渲染左右五欄。

## 本機閱讀

```bash
./start-reader.sh
```

預設打開《金瓶梅詞話》前言。Cursor 內嵌瀏覽器請用 `http://127.0.0.1:8080/...`，不要用 `file://`。

## GitHub Pages

推送到 `main` 後，GitHub Actions 會自動部署靜態閱讀站。

- 首頁：`index.html`（書目入口）
- 金瓶梅：`books/jinpingmei/`
- 十景緞：`books/shijinduan/`
- 十景緞：`shijinduan-000-reader.html`

首次使用請在 GitHub repo 的 **Settings → Pages → Build and deployment** 中，將 Source 設為 **GitHub Actions**。

## 工作流

1. 整理來源 Markdown，先保證文本可靠，不急著美化。
2. 使用 `tools/import-book.js --dry-run` 檢查章回切分。
3. 生成新書 reader/data，必要時只先生成一章樣章。
4. 執行 `tools/verify-readers.js`。
5. 用 `--browser` 做至少一次 Chromium 抽測。
6. 目視檢查正式頁；若形成穩定規則，先更新 `DESIGN.md`，再同步頁面。
