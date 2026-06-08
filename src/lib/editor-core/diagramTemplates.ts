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
    label: 'Flowchart',
    code: 'flowchart TD\n  A[Start] --> B{Continue?}\n  B -- Yes --> C[Process]\n  B -- No --> D[End]\n  C --> D',
  },
  {
    type: 'sequenceDiagram',
    label: 'Sequence diagram',
    code: 'sequenceDiagram\n  participant User\n  participant App\n  User->>App: Request action\n  App-->>User: Return result',
  },
  {
    type: 'classDiagram',
    label: 'Class diagram',
    code: 'classDiagram\n  class Document {\n    +string title\n    +save()\n  }\n  class Editor {\n    +render()\n  }\n  Document --> Editor',
  },
  {
    type: 'stateDiagram',
    label: 'State diagram',
    code: 'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review\n  Review --> Published\n  Published --> [*]',
  },
  {
    type: 'pie',
    label: 'Pie chart',
    code: 'pie title Content share\n  "Writing" : 45\n  "Editing" : 30\n  "Organizing" : 25',
  },
  {
    type: 'gantt',
    label: 'Gantt chart',
    code: 'gantt\n  title Project plan\n  dateFormat  YYYY-MM-DD\n  section Phase one\n  Design :a1, 2026-06-01, 3d\n  Build :after a1, 5d',
  },
  {
    type: 'erDiagram',
    label: 'ER diagram',
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
