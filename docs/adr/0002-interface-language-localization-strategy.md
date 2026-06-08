# Interface language localization strategy

Nomo will localize the application interface with Paraglide JS / inlang on the Svelte side, a small mirrored Rust message table for native menus and shell text, and `sys-locale` for Rust-side system language detection. This keeps the Markdown-first document model untouched while giving future languages a typed message pipeline and avoiding a front-end-only locale source that would make native menus start in the wrong language.

