# Proposal: Workspace Groups & H1 Title Sync (Proposal)

## 1. Context & Problem Statement
*Describe the current state of the system. What problem is the user facing? Why do we need this feature?*
- **Current State**: The application uses an explicit "Open File/Folder" model where users choose local files and folders directly. This matches the Markdown-first product direction and avoids an application-managed storage root.
- **Pain Points**: After a folder is explicitly opened, users still need efficient local folder navigation, quick file/folder creation, and title synchronization without turning the app into a notebook database or managed workspace.

## 2. Value Proposition
*What are the benefits of building this feature?*
- Improves the local-folder writing experience after the user explicitly opens a folder.
- Reduces the cost of managing files by automatically syncing document H1 titles to actual filenames on disk.
- Automatically saves content with a debounce mechanism, preventing data loss and eliminating the need for manual `Ctrl+S` saving.

## 3. Alternatives Considered
*What alternative solutions were considered before deciding on the final approach? Why were they rejected?*
- **Option A**: Pure SQLite storage for all files. (Cons: Users lose direct access to their raw `.md` files, which breaks the local-first, portable nature of Markdown.)
- **Option B**: Prompting for a filename before creating a file. (Cons: Interrupts the user's flow; users prefer to start writing immediately and have the title inferred from the content.)

## 4. Success Metrics
*How do we measure the success of this feature?*
- [ ] Users can explicitly open a local folder and see it in the Explorer Sidebar.
- [ ] Users can create groups and files seamlessly from the left sidebar.
- [ ] The first H1 in a document automatically becomes the `.md` filename on disk.
- [ ] Content and filename sync happens automatically via debounce without blocking the UI.
