---
id: "settings-drawer"
kind: feature
parent: ""
status: completed
impact_radius:
  - "src/app/components/AppTitleBar.svelte"
  - "src/app/components/SettingsDrawer.svelte"
  - "src/app/App.svelte"
  - "src/app/components/AppShell.svelte"
dependencies:
  - "none"
---

# Specification: Settings Drawer & Workspace Path (Specification)

## 1. Scope
- **In Scope**:
  - Adding a "设置" (Settings) top-level menu button in the AppTitleBar, right next to "查看" (View).
  - Creating a new `SettingsDrawer.svelte` component that acts as a right-side sliding drawer with a backdrop mask.
  - The drawer will have an exit button on the top-left and a save button on the bottom-right.
  - Inside the drawer, a configuration section for "工作区存储路径" (Workspace Storage Path) using the Tauri dialog plugin.
  - Updating the global workspace state and SQLite settings upon saving.
- **Out of Scope**:
  - Other settings (e.g., theme, editor preferences) are not included in this iteration but the drawer structure will allow future additions.

## 2. Functional Requirements

### ADDED
#### Requirement: Settings Menu Button
The system SHALL provide a "Settings" button in the main title bar.

##### Scenario: Open Settings
- **WHEN** the user clicks the "设置" button in the AppTitleBar
- **THEN** the Settings Drawer slides in from the right.

#### Requirement: Settings Drawer UI
The system SHALL display a drawer overlay for application configuration.

##### Scenario: Drawer Layout
- **WHEN** the drawer is open
- **THEN** it displays a semi-transparent background mask covering the main app.
- **THEN** the drawer panel is attached to the right side of the screen.
- **THEN** the top-left corner of the drawer has an exit/close button.
- **THEN** the bottom-right corner of the drawer has a "保存" (Save) button.

#### Requirement: Configure Workspace Path
The system SHALL allow the user to browse and change the workspace root directory.

##### Scenario: Select New Path
- **WHEN** the user clicks the "浏览..." (Browse) button next to the path input
- **THEN** a native OS folder selection dialog opens.
- **WHEN** a folder is selected
- **THEN** the input field updates to show the newly selected path (but it is not yet applied).

##### Scenario: Save Configuration
- **WHEN** the user clicks the "保存" (Save) button
- **THEN** the new `workspaceDir` is saved to the SQLite `app_settings` table.
- **THEN** the left Explorer Sidebar is immediately refreshed to load the new directory.
- **THEN** the Settings Drawer closes.
