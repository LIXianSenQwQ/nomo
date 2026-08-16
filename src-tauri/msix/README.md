# Nomo MSIX build

`package-identity.json` is the only committed source of MSIX identity values. It contains the
Partner Center identity and reserved display name `Nomo Markdown` for Store product `9P1G24GK650Z`. `ApplicationId` remains `Nomo`, so the
runtime AUMID is always calculated as `<current PFN>!Nomo`.

Development package:

```powershell
pnpm run build:win64:msix:dev
```

The output is written to `.artifacts/msix/output`. The package is signed with a locally generated
self-signed certificate. To trust that certificate for the current user and install the package,
run the explicit install script shown in the build report; the build itself never changes a trust
store or installs the package.

To build the Store upload, run:

```powershell
pnpm run build:win64:msix:store
```

Store mode validates the Partner Center Name, DisplayName, Publisher, PublisherDisplayName, PFN and Product ID,
then creates an unsigned `.msix`, `.appxsym` and `.msixupload` for manual upload. Microsoft Store
signs the certified package. PFX files, passwords, and generated artifacts must remain under
`.artifacts` and are ignored by Git. The Package SID is derived by Windows and is not written into
`AppxManifest.xml`.

The build accepts only the explicit `x86_64-pc-windows-msvc/release` Tauri output. Before packaging
and again after unpacking the MSIX, it verifies that `nomo.exe` embeds every production entry referenced
by `dist/index.html` and that the executable SHA-256 remains unchanged. This prevents a stale or
development executable that still loads `devUrl` from being published as a Store package. The verified
application hash and frontend entry list are recorded in `msix-validation-report.json`.
