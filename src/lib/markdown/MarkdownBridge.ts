import { extractFrontMatterBlock } from './frontMatter';

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
        frontMatter,
      };
    },
    serialize(document) {
      if (!document.frontMatter) {
        return document.markdown;
      }

      return `${document.frontMatter}${document.markdown}`;
    },
  };
}

function extractFrontMatter(markdown: string): string | undefined {
  return extractFrontMatterBlock(markdown)?.raw;
}
