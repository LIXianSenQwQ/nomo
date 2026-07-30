import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
});

markdown.renderer.rules.image = () => '';

const ALLOWED_TAGS = new Set([
  'A',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'DEL',
  'EM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HR',
  'LI',
  'OL',
  'P',
  'PRE',
  'STRONG',
  'UL',
]);

export function renderSoftwareUpdateReleaseNotes(
  body: string | undefined,
  fallback: string,
): string {
  const content = stripInstallationPackageSection(body ?? '').trim();
  const rendered = markdown.render(content || fallback);
  return sanitizeReleaseNotesHtml(rendered);
}

export function createSoftwareUpdateSummary(body: string | undefined, fallback: string): string {
  const content = stripInstallationPackageSection(body ?? '');
  const firstItem = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^[-*+]\s+\S/.test(line));
  const summary = (firstItem ?? '')
    .replace(/^[-*+]\s+/, '')
    .replace(/[`*_~[\]#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!summary) {
    return fallback;
  }
  return summary.length > 86 ? `${summary.slice(0, 85).trimEnd()}…` : summary;
}

function stripInstallationPackageSection(body: string): string {
  const lines = body.split(/\r?\n/);
  const sectionIndex = lines.findIndex((line) =>
    /^#{1,6}\s+.*(?:安装包|安裝包|installation packages?|downloads?).*$/i.test(line.trim()),
  );
  return (sectionIndex >= 0 ? lines.slice(0, sectionIndex) : lines).join('\n');
}

function sanitizeReleaseNotesHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  sanitizeNode(template.content);
  return template.innerHTML;
}

function sanitizeNode(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove();
      continue;
    }
    if (!(child instanceof HTMLElement)) {
      continue;
    }
    if (!ALLOWED_TAGS.has(child.tagName)) {
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }

    const sourceHref = child.tagName === 'A' ? child.getAttribute('href') : null;
    for (const attribute of Array.from(child.attributes)) {
      child.removeAttribute(attribute.name);
    }
    if (child.tagName === 'A') {
      if (sourceHref && /^https:\/\//i.test(sourceHref)) {
        child.setAttribute('href', sourceHref);
        child.setAttribute('rel', 'noopener noreferrer');
      } else {
        child.removeAttribute('href');
      }
    }
    sanitizeNode(child);
  }
}
