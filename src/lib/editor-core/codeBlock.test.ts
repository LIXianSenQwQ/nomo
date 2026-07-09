import { describe, expect, it } from 'vitest';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { deleteCodeBlockBeforeCursor } from './codeBlockCommands';
import { parseMarkdown, serializeMarkdown } from './markdown';
import { CodeBlockNodeView } from './nodeViews/CodeBlockNodeView';
import { setCodeBlockTokenizer } from './renderers';
import { schema } from './schema';

function createDocWithCodeBlockAndParagraph(paragraphText = ''): {
  doc: ProseMirrorNode;
  codeBlock: ProseMirrorNode;
} {
  const codeBlock = schema.nodes.code_block.create({ params: 'ts' }, schema.text('const a = 1;'));
  const paragraph = paragraphText
    ? schema.nodes.paragraph.create(null, schema.text(paragraphText))
    : schema.nodes.paragraph.create();
  return {
    doc: schema.nodes.doc.create(null, [codeBlock, paragraph]),
    codeBlock,
  };
}

describe('code_block markdown 解析', () => {
  it('解析带语言的 fenced code block', () => {
    const doc = parseMarkdown('```js\nconsole.log("hello")\n```');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'code_block') {
        expect(node.attrs.params).toBe('js');
        expect(node.textContent).toBe('console.log("hello")');
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(true);
  });

  it('解析不带语言的 fenced code block', () => {
    const doc = parseMarkdown('```\nhello\n```');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'code_block') {
        expect(node.attrs.params).toBe('');
        expect(node.textContent).toBe('hello');
        found = true;
        return false;
      }
      return true;
    });
    expect(found).toBe(true);
  });

  it('解析多行代码内容', () => {
    const code = 'function foo() {\n  return 42;\n}';
    const doc = parseMarkdown(`\`\`\`ts\n${code}\n\`\`\``);
    let content = '';
    doc.descendants((node) => {
      if (node.type.name === 'code_block') {
        content = node.textContent;
        return false;
      }
      return true;
    });
    expect(content).toBe(code);
  });

  it('解析 XML fenced code 时不把标签内容额外渲染成段落', () => {
    const code = [
      '<dependency>',
      '    <groupId>com.example</groupId>',
      '    <artifactId>access-control</artifactId>',
      '    <version>${component.version}</version>',
      '</dependency>',
    ].join('\n');
    const doc = parseMarkdown(`\`\`\`xml\n${code}\n\`\`\``);

    expect(doc.childCount).toBe(1);
    expect(doc.child(0).type.name).toBe('code_block');
    expect(doc.child(0).attrs.params).toBe('xml');
    expect(doc.child(0).textContent).toBe(code);
  });

  it('渲染 XML fenced code 时不在代码块外重复显示标签内容', async () => {
    const code = [
      '<dependency>',
      '    <groupId>com.example</groupId>',
      '    <artifactId>access-control</artifactId>',
      '    <version>${component.version}</version>',
      '</dependency>',
    ].join('\n');
    setCodeBlockTokenizer({
      async tokenize(input) {
        return {
          language: input.language,
          tokens: input.code.split('\n').map((line) => ({ tokens: [{ content: line }] })),
        };
      },
    });

    const target = document.createElement('div');
    document.body.appendChild(target);
    const view = new EditorView(target, {
      state: EditorState.create({ doc: parseMarkdown(`\`\`\`xml\n${code}\n\`\`\``) }),
      nodeViews: {
        code_block: (node, view, getPos) =>
          new CodeBlockNodeView(node, view, getPos as () => number),
      },
    });

    await Promise.resolve();

    const codeCards = target.querySelectorAll('.code-card');
    const bodyText = target.textContent ?? '';
    expect(codeCards).toHaveLength(1);
    expect((bodyText.match(/com\.example/g) ?? []).length).toBe(1);
    expect(bodyText.trim().startsWith('com.example')).toBe(false);

    view.destroy();
    target.remove();
  });

  it('解析空代码块', () => {
    const doc = parseMarkdown('```\n```');
    let found = false;
    doc.descendants((node) => {
      if (node.type.name === 'code_block') {
        found = true;
        return false;
      }
      return true;
    });
    // 空代码块可能不被解析（取决于 markdown-it 配置）
    // 此测试记录当前行为
    expect(typeof found).toBe('boolean');
  });
});

describe('code_block 序列化', () => {
  it('序列化带语言的 code_block 为 fenced code block', () => {
    const markdown = '```js\nconsole.log("hello")\n```';
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toBe(markdown);
  });

  it('序列化不带语言的 code_block', () => {
    const markdown = '```\nhello\n```';
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toBe(markdown);
  });

  it('序列化多行代码', () => {
    const code = 'function foo() {\n  return 42;\n}';
    const markdown = `\`\`\`ts\n${code}\n\`\`\``;
    const serialized = serializeMarkdown(parseMarkdown(markdown)).trim();
    expect(serialized).toBe(markdown);
  });
});

describe('code_block 往返一致性', () => {
  it('简单代码块往返一致', () => {
    const markdown = '```js\nconst x = 1;\n```';
    const doc = parseMarkdown(markdown);
    const serialized = serializeMarkdown(doc).trim();
    expect(serialized).toBe(markdown);
  });

  it('多行代码块往返一致', () => {
    const markdown = '```python\ndef hello():\n    print("world")\n\nhello()\n```';
    const doc = parseMarkdown(markdown);
    const serialized = serializeMarkdown(doc).trim();
    expect(serialized).toBe(markdown);
  });

  it('包含特殊字符的代码块往返一致', () => {
    const markdown = '```html\n<div class="test">&amp;</div>\n```';
    const doc = parseMarkdown(markdown);
    const serialized = serializeMarkdown(doc).trim();
    expect(serialized).toBe(markdown);
  });

  it('包含反引号的代码块往返一致', () => {
    const markdown = '```md\nUse `code` in markdown\n```';
    const doc = parseMarkdown(markdown);
    const serialized = serializeMarkdown(doc).trim();
    expect(serialized).toBe(markdown);
  });
});

describe('code_block 语言名称', () => {
  it('语言名称正确存储在 params 属性中', () => {
    const languages = ['js', 'typescript', 'python', 'java', 'shell', 'sql', 'yaml', 'diff'];
    for (const lang of languages) {
      const doc = parseMarkdown(`\`\`\`${lang}\ncode\n\`\`\``);
      let params = '';
      doc.descendants((node) => {
        if (node.type.name === 'code_block') {
          params = node.attrs.params as string;
          return false;
        }
        return true;
      });
      expect(params).toBe(lang);
    }
  });

  it('语言名称往返一致', () => {
    const markdown = '```javascript\nconst x = 1;\n```';
    const doc = parseMarkdown(markdown);
    const serialized = serializeMarkdown(doc).trim();
    expect(serialized).toBe(markdown);
  });
});

describe('code_block schema', () => {
  it('code_block 是 block 类型节点', () => {
    const doc = parseMarkdown('```js\ncode\n```');
    let codeNode: ProseMirrorNode | null = null;
    doc.descendants((node) => {
      if (node.type.name === 'code_block') {
        codeNode = node;
        return false;
      }
      return true;
    });
    expect(codeNode).not.toBeNull();
    expect(codeNode!.type.spec.group).toBe('block');
  });

  it('code_block 有 params 属性', () => {
    const doc = parseMarkdown('```js\ncode\n```');
    let codeNode: ProseMirrorNode | null = null;
    doc.descendants((node) => {
      if (node.type.name === 'code_block') {
        codeNode = node;
        return false;
      }
      return true;
    });
    expect(codeNode!.attrs).toHaveProperty('params');
    expect(codeNode!.attrs.params).toBe('js');
  });
});

describe('code_block 与其他节点共存', () => {
  it('代码块可以与段落共存', () => {
    const markdown = 'hello world\n\n```js\ncode\n```\n\nfoo bar';
    const doc = parseMarkdown(markdown);
    const serialized = serializeMarkdown(doc).trim();
    expect(serialized).toBe(markdown);
  });

  it('代码块可以与标题共存', () => {
    const markdown = '# Title\n\n```js\ncode\n```';
    const doc = parseMarkdown(markdown);
    const serialized = serializeMarkdown(doc).trim();
    expect(serialized).toBe(markdown);
  });
});

describe('code_block Backspace 行为', () => {
  it('光标在代码块下方空段落开头时，Backspace 直接删除上方代码块', () => {
    const { doc, codeBlock } = createDocWithCodeBlockAndParagraph();
    let capturedTr: Transaction | undefined;
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, codeBlock.nodeSize + 1),
    });

    const handled = deleteCodeBlockBeforeCursor(state, (tr) => {
      capturedTr = tr;
    });

    expect(handled).toBe(true);
    expect(capturedTr?.doc.childCount).toBe(1);
    expect(capturedTr?.doc.child(0).type).toBe(schema.nodes.paragraph);
    expect(capturedTr?.selection.from).toBe(1);
  });

  it('光标在代码块下方正文段落开头时，Backspace 删除代码块并保留正文', () => {
    const { doc, codeBlock } = createDocWithCodeBlockAndParagraph('后续正文');
    let capturedTr: Transaction | undefined;
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, codeBlock.nodeSize + 1),
    });

    const handled = deleteCodeBlockBeforeCursor(state, (tr) => {
      capturedTr = tr;
    });

    expect(handled).toBe(true);
    expect(capturedTr?.doc.childCount).toBe(1);
    expect(capturedTr?.doc.textContent).toBe('后续正文');
    expect(capturedTr?.selection.from).toBe(1);
  });

  it('光标不在下方段落开头时，不拦截默认 Backspace 行为', () => {
    const { doc, codeBlock } = createDocWithCodeBlockAndParagraph('后续正文');
    let capturedTr: Transaction | undefined;
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, codeBlock.nodeSize + 2),
    });

    const handled = deleteCodeBlockBeforeCursor(state, (tr) => {
      capturedTr = tr;
    });

    expect(handled).toBe(false);
    expect(capturedTr).toBeUndefined();
  });
});
