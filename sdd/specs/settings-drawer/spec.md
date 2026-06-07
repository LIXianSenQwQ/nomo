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

# Specification: Settings Drawer (Specification)

## 1. Scope
- **In Scope**:
  - Adding a "设置" (Settings) top-level menu button in the AppTitleBar, right next to "查看" (View).
  - Creating a new `SettingsDrawer.svelte` component that acts as a right-side sliding drawer with a backdrop mask.
  - The drawer will have an exit button on the top-left and a save button on the bottom-right.
  - Inside the drawer, preference sections for editor appearance, image handling, and file/window behavior.
  - Saving preference changes to the existing application settings layer.
- **Out of Scope**:
  - Application-level default storage roots or workspace path configuration.

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

#### Requirement: Save Preferences
The system SHALL save editor appearance, image handling, and file/window behavior preferences without changing the user's current folder.

##### Scenario: Save Configuration
- **WHEN** the user changes settings and clicks the "保存" (Save) button
- **THEN** the changed preferences are saved to the application settings layer.
- **THEN** the left Explorer Sidebar keeps showing only the folder the user explicitly opened.
- **THEN** the Settings Drawer closes.
