# Proposal: Workspace Groups & H1 Title Sync (Proposal)

## 1. Context & Problem Statement
*Describe the current state of the system. What problem is the user facing? Why do we need this feature?*
- **Current State**: The application currently uses a traditional "Open File/Folder" model where users must manually navigate the local file system to open directories and files. New tabs are created as empty files but do not automatically persist to a specific workspace directory without manual "Save As" actions.
- **Pain Points**: Users want a notebook-like experience (similar to Notion or Bear) where they can quickly create "Groups" (folders) and "Files" (.md files) without worrying about file system dialogs. Furthermore, having to manually type a file name and then type an H1 title inside the document is redundant.

## 2. Value Proposition
*What are the benefits of building this feature?*
- Improves the experience of note-taking by providing a seamless, out-of-the-box Workspace mode.
- Reduces the cost of managing files by automatically syncing document H1 titles to actual filenames on disk.
- Automatically saves content with a debounce mechanism, preventing data loss and eliminating the need for manual `Ctrl+S` saving.

## 3. Alternatives Considered
*What alternative solutions were considered before deciding on the final approach? Why were they rejected?*
- **Option A**: Pure SQLite storage for all files. (Cons: Users lose direct access to their raw `.md` files, which breaks the local-first, portable nature of Markdown.)
- **Option B**: Prompting for a filename before creating a file. (Cons: Interrupts the user's flow; users prefer to start writing immediately and have the title inferred from the content.)

## 4. Success Metrics
*How do we measure the success of this feature?*
- [ ] Users can define a default storage directory.
- [ ] Users can create groups and files seamlessly from the left sidebar.
- [ ] The first H1 in a document automatically becomes the `.md` filename on disk.
- [ ] Content and filename sync happens automatically via debounce without blocking the UI.
