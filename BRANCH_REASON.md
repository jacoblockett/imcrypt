# Security patch 6 — retire Wails v2 file dropping

Addresses audit finding F07. Wails v2's WebView drop-disabling API interferes with native drop callbacks on Windows and Linux; leaving WebView drops enabled risks navigation to hostile local content.

- https://github.com/wailsapp/wails/issues/3563
- https://github.com/wailsapp/wails/issues/3782

Disable native file dropping, preserve the former configuration and callback as commented migration evidence, and prevent default file navigation in the root renderer if native WebView2 protection fails. Users retain the file-picker path for images and extensionless encrypted recovery journals. Reconsider drag-and-drop only after a Wails v3 migration.

Validate with `go test -count=1 ./...`, `npm run build` in `frontend`, and Windows `wails dev`: select image and standalone journal; dropping a file must not navigate. Main remains untouched until approval. Remove this branch-only note before merge.
