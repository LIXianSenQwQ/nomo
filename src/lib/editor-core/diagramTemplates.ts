export type DiagramType =
  | 'flowchart'
  | 'sequenceDiagram'
  | 'classDiagram'
  | 'stateDiagram'
  | 'pie'
  | 'gantt'
  | 'erDiagram';

export interface DiagramTemplate {
  type: DiagramType;
  label: string;
  code: string;
}

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    type: 'flowchart',
    label: '流程图',
    code: 'flowchart TD\n  A[开始] --> B{是否继续}\n  B -- 是 --> C[处理]\n  B -- 否 --> D[结束]\n  C --> D',
  },
  {
    type: 'sequenceDiagram',
    label: '时序图',
    code: 'sequenceDiagram\n  participant User as 用户\n  participant App as 应用\n  User->>App: 发起操作\n  App-->>User: 返回结果',
  },
  {
    type: 'classDiagram',
    label: '类图',
    code: 'classDiagram\n  class Document {\n    +string title\n    +save()\n  }\n  class Editor {\n    +render()\n  }\n  Document --> Editor',
  },
  {
    type: 'stateDiagram',
    label: '状态图',
    code: 'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review\n  Review --> Published\n  Published --> [*]',
  },
  {
    type: 'pie',
    label: '饼图',
    code: 'pie title 内容占比\n  "写作" : 45\n  "编辑" : 30\n  "整理" : 25',
  },
  {
    type: 'gantt',
    label: '甘特图',
    code: 'gantt\n  title 项目计划\n  dateFormat  YYYY-MM-DD\n  section 第一阶段\n  设计 :a1, 2026-06-01, 3d\n  实现 :after a1, 5d',
  },
  {
    type: 'erDiagram',
    label: 'ER 图',
    code: 'erDiagram\n  USER ||--o{ DOCUMENT : owns\n  DOCUMENT ||--o{ ASSET : references\n  USER {\n    string id\n    string name\n  }\n  DOCUMENT {\n    string id\n    string title\n  }',
  },
];

export function getDiagramTemplate(type: DiagramType): DiagramTemplate {
  const template = DIAGRAM_TEMPLATES.find((item) => item.type === type);
  if (!template) {
    throw new Error(`Unknown diagram type: ${type}`);
  }
  return template;
}

export function isDiagramType(value: string): value is DiagramType {
  return DIAGRAM_TEMPLATES.some((item) => item.type === value);
}
