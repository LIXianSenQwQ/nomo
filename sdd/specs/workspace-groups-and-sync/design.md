# Design: Workspace Groups & H1 Title Sync (Design)

## 1. Architecture
The feature bridges the Svelte frontend and the Tauri Rust backend:
- **Tauri Settings API**: Stores the default workspace path.
- **Tauri FS API**: Handles creating directories, renaming files/folders, and writing file contents. Supports recursive directory reading.
- **Svelte Store/Controllers**: `folderExplorerController` will manage the abstract "Groups" UI using a recursive tree structure. `documentActionsController` will handle the debounced auto-save and H1 extraction.
- **ProseMirror Editor**: Triggers `onChange` events from which we extract the first heading node to sync the title.

## 2. Data Model & Interfaces

```typescript
// Tauri App Settings
interface AppSettings {
  workspaceDir: string; // The root directory for the workspace
}

// Recursive File Node for Explorer
interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[]; // Populated if isDir is true
  isExpanded?: boolean; // UI state
  isEditing?: boolean;  // UI state
}

// Editor Event extension
interface EditorChangeEvent {
  markdown: string;
  title?: string; // Extracted H1 title
}
```

## 3. Data Flow & Interaction
1. **App Initialization**: App reads `workspaceDir` from SQLite via Tauri. If missing, it resolves default `~/Documents/NewMd` (Mac) or `C:\Users\Username\Documents\NewMd` (Win), creates it, and saves it to settings.
2. **Read Workspace**: Tauri reads the workspace directory recursively (or lazily on expand) and returns a tree structure to Svelte.
3. **Create Folder (Nested)**: 
   - User clicks "Create Folder" on sidebar header or next to a folder -> UI shows an inline input as a child node.
   - On blur/Enter, if empty, defaults to "新建文件夹".
   - Frontend calls Tauri `fs::create_dir` -> Sidebar tree refreshes or locally inserts node.
4. **Create File**: 
   - User clicks "Create File" on a folder -> UI shows an inline input.
   - On blur/Enter, if empty, defaults to "无标题".
   - Frontend calls Tauri to create `.md` file -> Opens new Tab -> Editor is pre-filled with `# 无标题\n\n`.
5. **Auto-Save & Rename**: 
   - User types in editor -> ProseMirror triggers `onChange` -> Extracts first H1.
   - Debouncer waits (e.g., 1000ms).
   - Fires save action: Tauri writes content to disk.
   - If H1 changed, Tauri `fs::rename` is called (filtering invalid OS chars `< > : " / \ | ? *`).
   - UI shows a transient "已保存" toast.

## 4. Error Handling
- **File/Folder Name Conflict**: If the H1 translates to a filename that already exists, or creating a default folder encounters a collision, append a numeric suffix (e.g., `新建文件夹 (1)`).
- **Invalid Characters**: Sanitize the H1 string or input name by replacing or stripping illegal filesystem characters.
- **Empty Inputs**: Automatically fallback to predefined default names to prevent creation failure.
