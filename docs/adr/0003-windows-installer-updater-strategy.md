# Windows installer updater strategy

Nomo will implement the first software update capability with the official Tauri updater, GitHub Release stable-channel metadata, and signed Windows NSIS installer artifacts. The settings window exposes one update entry point, but the first version only promises automatic updates for the Windows installer build.

This keeps the update lifecycle aligned with the installer, which owns registry entries, uninstall metadata, shortcuts, file associations, context menu integration, and future installer migrations. We intentionally do not use zip overwrite updates for installer builds because that would bypass installer-managed Windows integration and force Nomo to duplicate rollback, permissions, and migration behavior in a custom helper.

Portable zip self-updates may be added later as a separate distribution path with its own helper process, manifest validation, write-permission checks, rollback behavior, and user-facing support boundary.
