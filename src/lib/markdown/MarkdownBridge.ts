export interface MarkdownDocument {
  markdown: string;
  frontMatter?: string;
}

export interface MarkdownBridge {
  parse(markdown: string): MarkdownDocument;
  serialize(document: MarkdownDocument): string;
}

export function createMarkdownBridge(): MarkdownBridge {
  return {
    parse(markdown) {
      const frontMatter = extractFrontMatter(markdown);

      return {
        markdown: frontMatter ? markdown.slice(frontMatter.length).trimStart() : markdown,
        frontMatter
      };
    },
    serialize(document) {
      if (!document.frontMatter) {
        return document.markdown;
      }

      return `${document.frontMatter}${document.markdown}`;
    }
  };
}

function extractFrontMatter(markdown: string): string | undefined {
  if (!markdown.startsWith('---\n')) {
    return undefined;
  }

  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) {
    return undefined;
  }

  return markdown.slice(0, end + 5);
}
