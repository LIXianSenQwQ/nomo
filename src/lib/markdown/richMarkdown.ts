export type RichMarkdownBlock =
  | { type: 'heading'; level: number; text: string; line: number }
  | { type: 'paragraph'; text: string; line: number }
  | { type: 'task'; checked: boolean; text: string; line: number }
  | { type: 'list'; ordered: boolean; items: string[]; line: number }
  | { type: 'blockquote'; text: string; line: number }
  | { type: 'table'; headers: string[]; rows: string[][]; line: number }
  | { type: 'code'; language: string; title: string; code: string; isDiff: boolean; line: number }
  | { type: 'math'; tex: string; line: number; renderIndex: number }
  | { type: 'mermaid'; code: string; line: number; renderIndex: number }
  | { type: 'html'; html: string; line: number }
  | { type: 'horizontalRule'; line: number };

export function createRichMarkdownSample(): string {
  return `---
title: NewMd Markdown 渲染验收
---
# NewMd Markdown 渲染验收 🚀

这份样例用于验证语义模式中的 **Markdown-first** 渲染能力，包含 Emoji ✅、行内代码 \`const ok = true\`、行内公式 $a^2 + b^2 = c^2$ 和链接 [NewMd](https://example.com)。

## 1. 标题层级

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题

## 2. Task List / Checkbox List

- [x] 已完成任务可以在语义模式直接切换
- [ ] 未完成任务可以点击勾选
- [ ] 支持 Emoji、中文和英文 Todo item ✨

## 3. 表格

| 能力 | 状态 | 说明 |
| --- | :---: | --- |
| 表格渲染 | ✅ | pipe table 应显示为基础表格 |
| Checkbox | ⏳ | 点击后回写 Markdown |
| Emoji | ✅ | 必须原样显示 |

## 4. 引用块

> 这是引用块。
> 它需要有清晰的左边框和灰色系背景。

## 5. HTML 块

<section class="demo-html-block">
  <strong>HTML 块：</strong><span>允许渲染内联 HTML 内容。</span>
</section>

## 6. 数学公式

$$
E = mc^2
$$

$$
\\int_0^1 x^2 dx = \\frac{1}{3}
$$

## 7. Mermaid 图表

\`\`\`mermaid
flowchart LR
  Open[Open] --> Edit[Edit]
  Edit --> Save[Save]
  Save --> Snapshot[Snapshot]
\`\`\`

## 8. 时序图

\`\`\`mermaid
sequenceDiagram
  participant User
  participant Editor
  participant Renderer
  User->>Editor: 输入 Markdown
  Editor->>Renderer: 请求语义渲染
  Renderer-->>User: 返回灰色系图表
\`\`\`

## 9. 代码块

\`\`\`ts title="src/example.ts"
type Task = {
  title: string;
  done: boolean;
};

const task: Task = { title: 'Markdown 渲染', done: true };
console.log(task);
\`\`\`

\`\`\`diff title="render.diff"
- const oldValue = 'plain code block';
+ const newValue = 'highlighted code block';
+ const canCopy = true;
\`\`\`

\`\`\`text title="long-line.txt"
这是一行很长很长的文本，用于测试自动换行开关与横向滚动行为：abcdefghijklmnopqrstuvwxyz-abcdefghijklmnopqrstuvwxyz-abcdefghijklmnopqrstuvwxyz-abcdefghijklmnopqrstuvwxyz
\`\`\`

## 10. 普通列表

- 第一层项目
  - 第二层项目
- 继续输入时文档结尾必须保留空行

`;
}

export function parseRichMarkdown(markdown: string): RichMarkdownBlock[] {
  const { body, lineOffset } = stripFrontMatter(markdown);
  const lines = body.split(/\r?\n/);
  const blocks: RichMarkdownBlock[] = [];
  let index = 0;
  let mermaidIndex = 0;
  let mathIndex = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const codeFence = /^```([^\s`]*)?(.*)$/.exec(trimmed);
    if (codeFence) {
      const start = index;
      const bodyLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== '```') {
        bodyLines.push(lines[index]);
        index += 1;
      }
      index += index < lines.length ? 1 : 0;

      const language = (codeFence[1] || 'text').trim().toLowerCase();
      const title = extractCodeTitle(codeFence[2] ?? '');
      const code = bodyLines.join('\n');

      if (language === 'mermaid') {
        blocks.push({ type: 'mermaid', code, line: start + 1 + lineOffset, renderIndex: mermaidIndex });
        mermaidIndex += 1;
      } else {
        blocks.push({ type: 'code', language, title, code, isDiff: language === 'diff', line: start + 1 + lineOffset });
      }
      continue;
    }

    if (trimmed === '$$') {
      const start = index;
      const bodyLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== '$$') {
        bodyLines.push(lines[index]);
        index += 1;
      }
      index += index < lines.length ? 1 : 0;
      blocks.push({ type: 'math', tex: bodyLines.join('\n'), line: start + 1 + lineOffset, renderIndex: mathIndex });
      mathIndex += 1;
      continue;
    }

    if (isHtmlStart(trimmed)) {
      const start = index;
      const htmlLines = [line];
      index += 1;
      while (index < lines.length && lines[index].trim()) {
        htmlLines.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'html', html: htmlLines.join('\n'), line: start + 1 + lineOffset });
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim(), line: index + 1 + lineOffset });
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'horizontalRule', line: index + 1 + lineOffset });
      index += 1;
      continue;
    }

    const task = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)$/.exec(line);
    if (task) {
      blocks.push({ type: 'task', checked: task[2].toLowerCase() === 'x', text: task[3].trim(), line: index + 1 + lineOffset });
      index += 1;
      continue;
    }

    if (isTableRow(line) && index + 1 < lines.length && isSeparatorRow(lines[index + 1])) {
      const start = index;
      const headers = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', headers, rows, line: start + 1 + lineOffset });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const start = index;
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n'), line: start + 1 + lineOffset });
      continue;
    }

    if (/^\s*(?:[-*+]\s+|\d+\.\s+)/.test(line)) {
      const start = index;
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && /^\s*(?:[-*+]\s+|\d+\.\s+)/.test(lines[index]) && !/^\s*[-*+]\s+\[[ xX]\]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/, '').trim());
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items, line: start + 1 + lineOffset });
      continue;
    }

    const start = index;
    const paragraphLines = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index].trim())) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' '), line: start + 1 + lineOffset });
  }

  return blocks;
}

export function ensureEditableTrailingBlankLine(markdown: string): string {
  return markdown.endsWith('\n\n') ? markdown : `${markdown.replace(/\s*$/, '')}\n\n`;
}

function stripFrontMatter(markdown: string): { body: string; lineOffset: number } {
  if (!markdown.startsWith('---\n')) {
    return { body: markdown, lineOffset: 0 };
  }
  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) {
    return { body: markdown, lineOffset: 0 };
  }

  const frontMatter = markdown.slice(0, end + 5);
  const bodyWithWhitespace = markdown.slice(frontMatter.length);
  const leadingWhitespace = /^\s*/.exec(bodyWithWhitespace)?.[0] ?? '';
  return {
    body: bodyWithWhitespace.replace(/^\s+/, ''),
    lineOffset: frontMatter.split(/\r?\n/).length - 1 + leadingWhitespace.split(/\r?\n/).length - 1
  };
}

function extractCodeTitle(meta: string): string {
  const trimmed = meta.trim();
  const quoted = /title=(?:"([^"]+)"|'([^']+)')/.exec(trimmed);
  if (quoted) {
    return quoted[1] || quoted[2] || '';
  }
  const bare = /title=([^\s]+)/.exec(trimmed);
  return bare?.[1] ?? '';
}

function isBlockStart(trimmed: string): boolean {
  return (
    !trimmed ||
    /^#{1,6}\s+/.test(trimmed) ||
    /^```/.test(trimmed) ||
    trimmed === '$$' ||
    /^>\s?/.test(trimmed) ||
    /^\s*(?:[-*+]\s+|\d+\.\s+)/.test(trimmed) ||
    isHtmlStart(trimmed) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)
  );
}

function isHtmlStart(trimmed: string): boolean {
  return /^<\/?[A-Za-z][^>]*>/.test(trimmed);
}

function isTableRow(line: string): boolean {
  return /^\s*\|.+\|\s*$/.test(line);
}

function isSeparatorRow(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}
