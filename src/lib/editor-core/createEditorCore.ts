import { ProseMirrorEditorCore } from './ProseMirrorEditorCore';
import type { EditorCore, EditorCoreOptions } from './types';

export {
  setCodeBlockDiagramRenderer,
  setCodeBlockMathRenderer,
  setCodeBlockTokenizer,
} from './renderers';

export function createEditorCore(options: EditorCoreOptions): EditorCore {
  return new ProseMirrorEditorCore(options);
}
