# GitHub Release MD5 updater

Nomo replaces the official Tauri updater signature workflow with a custom Windows installer updater that trusts GitHub Release and HTTPS as the release distribution boundary, then verifies the downloaded NSIS installer against a `checksums.md5` asset before launching it with passive update arguments. This removes local and CI signing key handling from the packaging path, while making MD5 an asset-consistency check rather than a publisher-identity signature; if the Release assets and checksum file are both compromised, MD5 does not provide independent authenticity.

Portable zip self-updates remain out of scope because installer-owned Windows integration, rollback, shortcuts, file associations, and future installer migrations should stay with the NSIS installer path.
