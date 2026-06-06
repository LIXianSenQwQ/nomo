import { ProseMirrorEditorCore } from './ProseMirrorEditorCore';
import type { EditorCore, EditorCoreOptions } from './types';

export {
  setCodeBlockDiagramRenderer,
  setCodeBlockMathRenderer,
  setCodeBlockTokenizer,
  getImageLoader,
  setImageLoader,
} from './renderers';

export function createEditorCore(options: EditorCoreOptions): EditorCore {
  return new ProseMirrorEditorCore(options);
}
