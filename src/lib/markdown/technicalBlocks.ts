export interface TaskListItem {
  checked: boolean;
  text: string;
  line: number;
}

export interface MarkdownTable {
  headers: string[];
  rows: string[][];
  line: number;
}

export interface MathBlock {
  tex: string;
  displayMode: boolean;
  line: number;
}

export interface MermaidBlock {
  code: string;
  line: number;
}

export interface TechnicalBlocks {
  tasks: TaskListItem[];
  tables: MarkdownTable[];
  mathBlocks: MathBlock[];
  mermaidBlocks: MermaidBlock[];
}

export function extractTechnicalBlocks(markdown: string): TechnicalBlocks {
  return {
    tasks: extractTasks(markdown),
    tables: extractTables(markdown),
    mathBlocks: extractMathBlocks(markdown),
    mermaidBlocks: extractMermaidBlocks(markdown)
  };
}

function extractTasks(markdown: string): TaskListItem[] {
  return markdown
    .split(/\r?\n/)
    .map((line, index) => {
      const match = /^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/.exec(line);
      if (!match) {
        return null;
      }

      return {
        checked: match[1].toLowerCase() === 'x',
        text: match[2].trim(),
        line: index + 1
      };
    })
    .filter((item): item is TaskListItem => item !== null);
}

function extractTables(markdown: string): MarkdownTable[] {
  const lines = markdown.split(/\r?\n/);
  const tables: MarkdownTable[] = [];

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!isTableRow(lines[index]) || !isSeparatorRow(lines[index + 1])) {
      continue;
    }

    const headers = splitTableRow(lines[index]);
    const rows: string[][] = [];
    let cursor = index + 2;

    while (cursor < lines.length && isTableRow(lines[cursor])) {
      rows.push(splitTableRow(lines[cursor]));
      cursor += 1;
    }

    tables.push({
      headers,
      rows,
      line: index + 1
    });
    index = cursor - 1;
  }

  return tables;
}

function extractMathBlocks(markdown: string): MathBlock[] {
  const blocks: MathBlock[] = [];
  const lines = markdown.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() !== '$$') {
      continue;
    }

    const start = index;
    const body: string[] = [];
    index += 1;
    while (index < lines.length && lines[index].trim() !== '$$') {
      body.push(lines[index]);
      index += 1;
    }

    if (index < lines.length) {
      blocks.push({
        tex: body.join('\n'),
        displayMode: true,
        line: start + 1
      });
    }
  }

  return blocks;
}

function extractMermaidBlocks(markdown: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  const lines = markdown.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^```mermaid\s*$/i.test(lines[index].trim())) {
      continue;
    }

    const start = index;
    const body: string[] = [];
    index += 1;
    while (index < lines.length && lines[index].trim() !== '```') {
      body.push(lines[index]);
      index += 1;
    }

    if (index < lines.length) {
      blocks.push({
        code: body.join('\n'),
        line: start + 1
      });
    }
  }

  return blocks;
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
