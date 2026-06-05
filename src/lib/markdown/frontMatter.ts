export interface FrontMatterFields {
  title: string;
  created: string;
  updated: string;
  tags: string[];
  status: string;
  extraFieldCount: number;
  parseWarning: string;
}

export interface FrontMatterBlock {
  raw: string;
  content: string;
  lineEnding: '\n' | '\r\n';
  start: number;
  end: number;
  body: string;
  fields: FrontMatterFields;
}

const KNOWN_FIELDS = new Set(['title', 'created', 'updated', 'tags', 'status']);

export function extractFrontMatterBlock(markdown: string): FrontMatterBlock | null {
  if (!markdown.startsWith('---\n') && !markdown.startsWith('---\r\n')) {
    return null;
  }

  const lineEnding = markdown.startsWith('---\r\n') ? '\r\n' : '\n';
  const delimiter = `${lineEnding}---${lineEnding}`;
  const endDelimiterStart = markdown.indexOf(delimiter, 3);
  if (endDelimiterStart === -1) {
    return null;
  }

  const end = endDelimiterStart + delimiter.length;
  const raw = markdown.slice(0, end);
  const content = markdown.slice(3 + lineEnding.length, endDelimiterStart);

  return {
    raw,
    content,
    lineEnding,
    start: 0,
    end,
    body: markdown.slice(end).replace(/^\s+/, ''),
    fields: parseFrontMatterFields(content),
  };
}

export function splitFrontMatterBlock(markdown: string): { frontMatter: string; body: string } {
  const block = extractFrontMatterBlock(markdown);
  if (!block) {
    return { frontMatter: '', body: markdown };
  }

  return { frontMatter: block.raw, body: block.body };
}

export function createDefaultFrontMatterBlock(date = formatLocalDate(new Date())): string {
  return [
    '---',
    'title: 文档标题',
    `created: ${date}`,
    `updated: ${date}`,
    'tags:',
    '  - 笔记',
    '  - Markdown',
    'status: draft',
    '---',
    '',
  ].join('\n');
}

export function ensureFrontMatter(markdown: string, date?: string): string {
  if (extractFrontMatterBlock(markdown)) {
    return markdown;
  }

  const template = createDefaultFrontMatterBlock(date);
  if (!markdown.trim()) {
    return template;
  }

  return `${template}\n${markdown.replace(/^\s+/, '')}`;
}

export function replaceFrontMatterContent(markdown: string, content: string): string {
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\s+$/, '');
  const current = extractFrontMatterBlock(markdown);
  const lineEnding = current?.lineEnding ?? '\n';
  const body = current ? markdown.slice(current.end).replace(/^\s+/, '') : markdown.replace(/^\s+/, '');
  const lines = ['---', ...normalizedContent.split('\n'), '---', ''];
  const block = lines.join(lineEnding);

  if (!body) {
    return block;
  }

  return `${block}${lineEnding}${body}`;
}

export function removeFrontMatter(markdown: string): string {
  const current = extractFrontMatterBlock(markdown);
  if (!current) {
    return markdown;
  }

  return markdown.slice(current.end).replace(/^\s+/, '');
}

function parseFrontMatterFields(content: string): FrontMatterFields {
  const fields: FrontMatterFields = {
    title: '',
    created: '',
    updated: '',
    tags: [],
    status: '',
    extraFieldCount: 0,
    parseWarning: '',
  };
  const seenExtraFields = new Set<string>();
  let activeListKey = '';

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith('#')) {
      continue;
    }

    const listMatch = /^\s*-\s+(.+)$/.exec(line);
    if (listMatch && activeListKey === 'tags') {
      fields.tags.push(unquoteYamlValue(listMatch[1].trim()));
      continue;
    }

    const keyMatch = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line);
    if (!keyMatch) {
      fields.parseWarning = '部分元数据暂无法结构化展示，原文已保留';
      activeListKey = '';
      continue;
    }

    const key = keyMatch[1];
    const value = unquoteYamlValue(keyMatch[2]?.trim() ?? '');
    activeListKey = value ? '' : key;

    if (key === 'title') fields.title = value;
    else if (key === 'created') fields.created = value;
    else if (key === 'updated') fields.updated = value;
    else if (key === 'status') fields.status = value;
    else if (key === 'tags') {
      if (value.startsWith('[') && value.endsWith(']')) {
        fields.tags = value
          .slice(1, -1)
          .split(',')
          .map((tag) => unquoteYamlValue(tag.trim()))
          .filter(Boolean);
      }
    } else if (!KNOWN_FIELDS.has(key)) {
      seenExtraFields.add(key);
    }
  }

  fields.extraFieldCount = seenExtraFields.size;
  return fields;
}

function unquoteYamlValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
