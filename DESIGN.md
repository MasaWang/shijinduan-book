# Design System: 海之書 · 古籍頁面

## 0. Source of Truth & Upgrade Rules

This document is the source of truth for all root-level HTML outputs in this project. Do not treat screenshots, temporary previews, or older reconstruction files as design authority once this file defines the rule.

When implementation and visual judgment reveal a stable rule, upgrade this document first or in the same change. Root-level HTML must then be synchronized to this document. If a browser does not support a required typography feature, the fallback must be specified here and verified in Chromium before it is considered accepted.

Current accepted upgrades:
- Engraved-block typography uses `Huiwen-mincho` / `汇文明朝体` as the primary Book Core font.
- Hanging punctuation requires both paginator absorption and a visual fallback; native CSS alone is not sufficient in Chromium.
- The accepted hanging punctuation fallback is `.hang-end-punctuation { inline-size: 0; overflow: visible; transform: translateY(-0.25em); }`.

## 1. Visual Theme & Atmosphere

《海之書》古籍頁面是一套數位線裝書葉視覺語言：一張豎向紙面置於暖米色案几之上，以雙框墨線界定版心，再以水平線切分天頭、版心、地腳三區。版心內含傳統中縫、章回資訊與 SVG 雙魚尾；正文採豎排右起（`vertical-rl`），遇訓詁以雙行夾注嵌入，模擬木刻版畫與舊籍批註節奏。

整體氛圍應保持沉靜、典籍、紙墨。Book Core 僅使用暖米白底、紙白面與純黑墨線，不使用品牌色、圓角、漸層、水印或裝飾插圖。界面不是現代 App 卡片，而是一頁古書的數位版面。

**Key Characteristics:**
- 暖米白視口（`#F5F1E6`）與略亮紙面（`#FFFDF8`）
- 純黑（`#000000`）文字、框線與分隔線
- 雕版感明朝 / 宋體字，全頁單字重 400
- 固定 480×720 書頁，零圓角
- 雙框結構：外框 3px、框間 5px、內框 1px
- 天頭、版心、地腳三段式分區
- 版心左右對開，含 20px 中縫資訊欄與 SVG 雙魚尾
- 正文與頁腳皆豎排，右起左行
- 11px 雙行夾注，保留 `[……]` 與虛線界
- 書頁深度以 Flat 描邊為基線，可選極輕 Resting shadow

## 2. Color Palette & Roles

### Book Core
- **Viewport Beige** (`#F5F1E6`): 頁面外部背景，暖米色案几感
- **Paper Surface** (`#FFFDF8`): 書頁本體，略亮於背景
- **Ink Primary** (`#000000`): 標題、正文、頁腳、外框、內框、分隔線、中縫與魚尾
- **Ink Annotation** (`#1A1A1A`): 夾注小字，可與主墨接近
- **Annotation Border** (`#CCCCCC`): 雙行夾注左右虛線界

### System Shell
- **Ink Disabled** (`#8A8278`): 書頁外部控制區的 disabled 文案
- **Accent Cinnabar** (`#9B3D3D`): 書頁外部控制區的 focus、確認與批校動作
- **Accent Mineral** (`#3D5A6E`): 書頁外部控制區的資訊、連結與次要提示

### Surface & Shadows
- **Flat Baseline**: `0 0 0 1px rgba(0,0,0,0.06)`
- **Resting Optional**: `1px 2px 6px rgba(0,0,0,0.08)`

### Color Principles
- Book Core 僅使用米白、紙白、黑墨與夾注虛線灰。
- Accent 色只能出現在 System Shell，不進入書頁版心。
- 正文與框線保持純黑，層級主要靠字級、方向與版面分區建立。
- Disabled 不使用冷灰，應維持暖灰色溫。

## 3. Typography Rules

### Font Family
- **Primary**: `Huiwen-mincho` / `汇文明朝体`
- **Fallbacks**: `cwTeX 明體`, `cwTeXMing`, `HanWangMingMedium`, `王漢宗中明體繁`, `Songti SC`, `STSong`, `SimSun`, `Noto Serif TC`, `serif`
- **Mono**: `monospace`，僅用於必要的短代碼標記
- **OpenType**: 不強制，保持明朝 / 宋體默認字距

### Engraved Typography Rule
- `Huiwen-mincho` / `汇文明朝体` is the formal Book Core typeface because its heavier Ming-style strokes better match carved-block printing.
- `Songti SC` is only a fallback, not the design target.
- Do not replace the Book Core with modern sans-serif, UI serif, web display fonts, or generic system defaults.
- Font changes must be re-verified because font metrics affect sandbox pagination, column fit, and hanging punctuation.

### Writing Direction
| Area | Direction | Notes |
|------|-----------|-------|
| Chapter Title | `vertical-rl` split columns | 天頭內居中，章號與回目分欄直排，如「第一回」與「出山」 |
| Body Text | `vertical-rl` | 正文右起左行 |
| Annotation | `vertical-rl` | 11px 小字，嵌入正文流 |
| Footer Meta | `vertical-rl` | 書名與頁碼分列 |

### Hierarchy
| Role | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|--------|-------------|----------------|-------|
| Chapter Title | 18px | 400 | 1 | 0.04em | 天頭章名，分欄直排 |
| Opening Chapter Title | 19px | 600 | 1.55 | 0.03em | 長回目置於正文開篇，作章題層級 |
| Body Column | 17px | 400 | 1.76 | 0.02em | 正文主欄 |
| Annotation | 11px | 400 | 1.2 | 0.01em | 雙行夾注 |
| Footer Meta | 15px | 400 | 1.4 | 0.1em | 書名 / 頁碼 |
| Spine Meta | 14px | 400 | 1.1 | 0.08em | 中縫章號、回目 |

### Principles
- 全頁使用單字重 400，避免現代 UI 的粗細層級。
- 標題、正文、夾注、頁腳皆以字級與位置建立層級。
- 天頭章名必須拆成直排小欄；不要把 `第一回 出山` 作為一整串文字塞入 64px 高的單一直排容器。
- 版心內不使用 sans-serif、不使用西文 display 字體。
- 標點隨直排正文流動，不另起橫排。
- 頁碼使用中文數字格式，如「百初一」，不使用阿拉伯數字。

### Hanging Punctuation
Native CSS:
- Use `hanging-punctuation: allow-end last`.
- Use `line-break: strict`.
- Use `overflow-wrap: normal` and `word-break: normal`.
- Body columns may use visible overflow so terminal punctuation can hang beyond the column boundary.

Chromium fallback:
- Current Chromium may not apply native `hanging-punctuation` to this vertical layout, so native CSS alone is not accepted.
- The paginator must absorb punctuation immediately after a full measured body column. In code this is the role of `absorbHangingPunctuation()`.
- Only punctuation at the end of a measured column may be wrapped in `.hang-end-punctuation`.
- `.hang-end-punctuation` must use zero inline occupation: `inline-size: 0`.
- `.hang-end-punctuation` must allow paint outside its box: `overflow: visible`.
- Accepted offset: `transform: translateY(-0.25em)`.

Forbidden hanging-punctuation approaches:
- Do not rely only on `hanging-punctuation`; Chromium verification has shown that it is not enough here.
- Do not use positive `translateY()` for the fallback; it pushes punctuation farther from the final character in vertical writing.
- Do not hang punctuation in the middle of a column.
- Do not shrink body font, widen columns, or change the five-column rhythm to create punctuation space.

## 4. Component Stylings

### Page Card
- Width: 480px
- Height: 720px
- Background: `#FFFDF8`
- Radius: 0
- Shadow baseline: `0 0 0 1px rgba(0,0,0,0.06)`
- Optional shadow: `1px 2px 6px rgba(0,0,0,0.08)`
- Alignment: viewport center

### Double Frame
- Outer frame: 3px solid `#000000`
- Frame gap: 5px paper surface
- Inner frame: 1px solid `#000000`
- Inner frame contains header, body, and footer

### Section Header
- Height: 64px
- Bottom divider: 1px solid `#000000`
- Content: vertical split title columns, no single-flow wrapping
- Typography: 18px engraved Ming/Song stack, weight 400
- Example: right column `第一回`, left column `出山`
- Long chapter titles: when the回目 exceeds eight CJK characters, the header must show only the chapter number, e.g. `第一回`. Do not shrink the header font, increase header height, or allow the title to overflow the page.
- Full long回目 belongs at the beginning of the chapter text flow on the first page, so it is paginated by the same sandbox method as body text.
- Opening long回目 in the body must be visually promoted: 19px, weight 600, line-height 1.55, and the same engraved Ming/Song stack. This is the only accepted heavier text inside Book Core.

### Section Body
- Layout: `position: relative`
- Grid: `grid-template-columns: 1fr 1fr`
- Writing: `writing-mode: vertical-rl`
- Text alignment: justify
- Body text: 17px
- Body padding: 16px vertical, 30px outer side, 16px middle-spine side
- Columns: five vertical columns per leaf, right leaf first then left leaf
- Hanging punctuation: follow the dedicated Typography rule above; do not implement this as CSS-only in Chromium.

**正式閱讀版欄序（右至左）**
| Area | Columns | Flow |
|------|---------|------|
| Right Leaf | 5 | First body segment |
| Middle Spine | 20px | Chapter meta and SVG double fish tail |
| Left Leaf | 5 | Continuation body segment |

### Middle Spine
- Position: absolute in body area
- Horizontal position: 50%
- Vertical span: full body height
- Width: 20px
- Z-index: above body text
- Background: transparent
- Internal center line: 1px solid `#000000`, visually centered
- Text direction: spine text uses `vertical-rl`
- Structure: chapter number, upper fish tail, chapter title, lower fish tail
- Vertical placement: upper body spine, not centered over the full body area

### SVG Double Fish Tail
- Implemented as inline SVG inside the middle spine
- Shape: black geometric fish tail, not font-dependent
- Width: 16px
- ViewBox: `0 0 100 28`
- Upper fish tail points downward into the spine text area
- Lower fish tail mirrors the upper fish tail with `rotate(180deg)`
- Fill: `#000000`
- SVG must remain crisp and must not rely on rotated text glyphs

### Spine Meta
- Chapter number: 14px vertical text, e.g. `第一回`
- Chapter title: 14px vertical text, e.g. `出山`
- Text color: `#000000`
- Spacing: 5px between text and fish-tail group
- Spine meta belongs to the body spine, not the footer
- Long chapter titles: the spine may use a shortened cue, usually the first phrase before punctuation or ideographic space, capped at three CJK characters. It must not carry the full long回目.

### Double-row Annotation
- Font size: 11px
- Line height: 1.2
- Color: `#1A1A1A`
- Wrapper: `[……]`
- Border: left and right `1px dashed #CCCCCC`
- Padding: `4px 0`
- Margin: `0 2px`
- Display: `inline-block`
- Alignment: inline with vertical body text

### Section Footer
- Height: 52px
- Top divider: 1px solid `#000000`
- Layout: two vertical meta columns
- Right column: `海之書`
- Left column: `百初一`
- Typography: 15px engraved Ming/Song stack, weight 400

### System Shell Library Sidebar
- Position: outside Book Core, to the left side of the page card on desktop.
- Mobile fallback: below the page card and above the measurement status when the viewport is too narrow.
- Purpose: support multiple books and navigate chapters within the current book.
- Layout: top-aligned vertical sidebar on desktop, wrapping horizontal controls on narrow screens.
- Spacing: keep 50px between the sidebar and the page card on desktop.
- Sections: `書目` first, `章回` second, separated by a thin muted divider.
- Book links and chapter links: 14px engraved Ming/Song stack, 1px black border, zero radius, paper surface background.
- Long chapter lists: chapter selector may scroll within System Shell, with a maximum height near the book page body height. Scrolling must not move, resize, or enter Book Core.
- Chapter selector alignment: numbered chapter links should be structured as fixed-width回次 plus a two-column回目 pair. For example, `第一回` occupies the回次 column, while `景陽岡武松打虎` and `潘金蓮嫌夫賣風月` occupy equal phrase columns.
- Single-phrase chapters may span the phrase area. Front matter such as `前言與序跋` may span the full chapter-link width.
- Add-new-book entry: place `添加新書` inside the `書目` section after existing book links. It is a System Shell action, not a book link and not part of Book Core.
- Add-new-book interaction: clicking the entry should open a folder picker when the browser supports it, then route to the import workbench for Markdown inspection and generation.
- Add-new-book styling: use the same 14px engraved Ming/Song stack, paper background, zero radius, and 1px black border as other shell controls; use dashed border or muted ink to indicate an action rather than the current book.
- Current book and current chapter: mark each with `aria-current="page"` and render as black background with paper-colored text.
- Do not place book or chapter navigation inside the page card, double frame, header, body, middle spine, or footer.
- The import workbench may use a larger System Shell panel, but it must not alter the 480×720 Book Core rules or redefine typography, spacing, fish-tail, pagination, or hanging punctuation.
- Books with front matter before the first numbered chapter must keep that material as a `000` entry, usually titled `前言與序跋`. The book link should open this front-matter entry before `第一回`.

## 5. Layout Principles

### Spacing System
- Base unit: 8px
- Scale: 4px, 8px, 16px, 24px, 28px, 32px, 48px, 64px
- Special frame values: 3px outer frame, 5px frame gap, 1px inner frame

### Grid & Container
- Page card remains fixed at 480×720.
- Body uses a two-column split to express a folded book leaf.
- Middle spine stays in the visual center of the body area.
- Body text must avoid the 20px middle spine; left and right leaf text areas need explicit inner gutter.
- For the 17px / five-column reader, each leaf should occupy about 196px within a 207px half body area, reducing loose white mouth while preserving middle-spine clearance.
- Header and footer are full-width bands inside the inner frame.
- Body text flows vertically from right to left.
- Formal reader content uses five columns per leaf, ten columns per page.

### Whitespace Philosophy
- Header and footer are narrow, quiet bands that frame the body.
- Body padding prevents characters from touching the inner frame.
- Column gaps must be wider than letter spacing so each vertical column remains legible.
- Body text should continue across the right and left leaves whenever content length requires it; the middle spine divides the leaves but must not block the reading flow.
- End punctuation should be allowed to hang outside a body column boundary; do not compensate by shrinking the font, widening columns, or changing the five-column rhythm.
- Do not apply hanging transforms to punctuation in the middle of a column.

### Border Radius Scale
- Entire Book Core uses 0px radius.
- Do not round page corners, frames, annotation boxes, or section dividers.

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | No shadow | Viewport background |
| Page Baseline | `0 0 0 1px rgba(0,0,0,0.06)` | Default page card |
| Resting | `1px 2px 6px rgba(0,0,0,0.08)` | Optional paper lift |

**Shadow Philosophy:** The page should feel flat, printed, and archival. Depth exists only to separate paper from background. Avoid modern card elevation, multi-layer shadows, hover lift, or strong blur.

## 7. Do's and Don'ts

### Do
- Use `#F5F1E6`, `#FFFDF8`, and `#000000` as the Book Core color structure.
- Keep the page fixed at 480×720.
- Use double frame: 3px outer frame, 5px gap, 1px inner frame.
- Keep header, body, and footer separated by 1px dividers.
- Use vertical writing for title, body, annotation, and footer.
- Use `Huiwen-mincho` / `汇文明朝体` as the first Book Core font.
- Keep the middle spine and SVG double fish tail in the body area.
- Use double-row annotation with 11px text and dashed borders.
- Keep footer meta split into `海之書` and `百初一`.
- Use one typographic weight: 400.
- Use paginator-level punctuation absorption plus `.hang-end-punctuation` for Chromium hanging punctuation.
- Keep book and chapter navigation in the System Shell beside the page card on desktop, not inside Book Core.

### Don't
- Don't use pure white viewport background or cold gray surfaces.
- Don't add rounded corners, gradients, watermarks, illustrations, or decorative textures.
- Don't use sans-serif typography in the Book Core.
- Don't demote `Huiwen-mincho` / `汇文明朝体` behind generic Songti fallbacks.
- Don't remove the middle spine or SVG double fish tail.
- Don't replace annotation with footnotes, side panels, tooltips, or hover reveals.
- Don't merge footer meta into one horizontal line.
- Don't change `百初一` into Arabic numerals.
- Don't introduce accent color inside the page card.
- Don't add interactive hover or focus styling inside the Book Core.
- Don't rely on native `hanging-punctuation` alone in Chromium.
- Don't use positive `translateY()` for hanging punctuation fallback.
- Don't put book or chapter selector controls inside the book page frame.

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <544px | Scale the full page card proportionally or allow horizontal scroll |
| Tablet | 544-1023px | Keep card centered with reduced viewport padding |
| Desktop | >=1024px | Keep 480×720 card centered with 32px viewport padding |

### Touch Targets
- Book Core is primarily a reading surface and has no internal controls.
- System Shell controls outside the page should use accessible hit areas.

### Collapsing Strategy
- Do not reflow vertical text into horizontal text.
- Do not split the double frame structure on small screens.
- Preserve page proportions by scaling the entire card.
- Preserve title, body, middle spine, SVG fish tails, annotation, and footer positions.

### Image Behavior
- This design system does not require image content inside Book Core.
- If a System Shell preview uses images, images must not enter the page card.

## 9. Agent Prompt Guide

### Quick Color Reference
- Viewport background: `#F5F1E6`
- Paper surface: `#FFFDF8`
- Ink and frame: `#000000`
- Annotation ink: `#1A1A1A`
- Annotation border: `#CCCCCC`
- Optional shell accent: `#9B3D3D`

### Example Component Prompts
- "Create a 480×720 ancient book page with #FFFDF8 paper on #F5F1E6 background. Use 0 radius, a 3px black outer frame, 5px paper gap, and 1px black inner frame."
- "Build the page body as a two-column folded book leaf. Add a centered 20px middle spine with a 1px center line, SVG upper/lower fish tails, vertical chapter number, and vertical chapter title."
- "Use `Huiwen-mincho` / `汇文明朝体` as the primary Book Core font, with Ming/Song fallbacks only after it."
- "Set the chapter title as split vertical columns in the 64px header band: right column `第一回`, left column `出山`, 18px engraved Ming/Song stack, weight 400, line-height 1, letter-spacing 0.04em."
- "Typeset the body in vertical-rl engraved Ming/Song stack, 17px, weight 400, line-height 1.76. Use five measured columns per leaf, right leaf first then left leaf."
- "For hanging punctuation in Chromium, absorb terminal punctuation during pagination, then render only final column punctuation as `.hang-end-punctuation` with `inline-size: 0`, `overflow: visible`, and `transform: translateY(-0.25em)`."
- "Embed the annotation `[此謂界其共生之理，不亦分毫環中歟。]` as 11px inline vertical text with dashed borders."
- "Create a 52px footer band with vertical `海之書` on the right and `百初一` on the left."
- "Add a System Shell library sidebar to the left of the page card on desktop, with `書目` book links above `章回` chapter links; mark the current book and current chapter with `aria-current=\"page\"`."

### Iteration Guide
1. Start with the page card size, paper color, and double frame.
2. Add header, body, and footer bands with 1px dividers.
3. Add the middle spine and SVG double fish tail before placing body text.
4. Typeset the vertical body columns and inline annotation.
5. Place footer meta as two separate vertical columns.
6. Add paginator-level hanging punctuation absorption before accepting the body flow.
7. Verify zero radius, no modern UI colors, no decorative imagery, and no Book Core interactivity.
8. Verify in Chromium: no console errors, right leaf 5 columns, left leaf 5 columns, `.hang-end-punctuation` has `inline-size: 0px`, and the fallback transform is negative.

### Verification Checklist
- Root-level HTML files follow the same formal template unless intentionally documented otherwise.
- Chromium loads the formal reader without console errors.
- First visible page reports right leaf 5 columns and left leaf 5 columns.
- Library sidebar is left of the page card on desktop, with graceful bottom fallback on narrow screens, and outside Book Core.
- Exactly one book link and one chapter link have `aria-current="page"`.
- Computed Book Core `font-family` starts with `Huiwen-mincho` / `汇文明朝体`.
- Hanging punctuation is not CSS-only: paginator absorption exists and `.hang-end-punctuation` appears where terminal punctuation is absorbed.
- `.hang-end-punctuation` computes to `inline-size: 0px`.
- Hanging punctuation fallback uses `translateY(-0.25em)` or an explicitly approved negative adjustment.
- No old screenshot/reconstruction references are used as visual authority.
