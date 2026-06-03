#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

// Port configuration
const PORT = process.env.PORT || 3030;

// Path configuration
const currentDir = process.cwd();
const sddPath = path.join(currentDir, 'sdd');
const specsPath = path.join(sddPath, 'specs');
const archivePath = path.join(sddPath, 'archive');

// Simple YAML Frontmatter parser
function parseYamlFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  
  const lines = match[1].split('\n');
  const data = {};
  let currentKey = null;
  let currentArray = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    if (line.startsWith('- ')) {
      if (currentKey) {
        currentArray.push(line.substring(2).replace(/['"]/g, '').trim());
      }
    } else if (line.includes(':')) {
      if (currentKey && currentArray.length > 0) {
        data[currentKey] = currentArray;
      }
      const parts = line.split(':');
      currentKey = parts[0].trim();
      const val = parts.slice(1).join(':').trim();
      
      if (val) {
        // Strip inline comments starting with #
        let cleanVal = val.split('#')[0].trim();
        data[currentKey] = cleanVal.replace(/['"]/g, '');
        currentKey = null;
        currentArray = [];
      } else {
        currentArray = [];
      }
    }
  }
  if (currentKey && currentArray.length > 0) {
    data[currentKey] = currentArray;
  }
  return data;
}

// Simple Task list parser for markdown
function parseTasksProgress(content) {
  const lines = content.split('\n');
  let total = 0;
  let completed = 0;
  const items = [];
  
  for (const line of lines) {
    if (line.match(/- \[[ xX]\]/)) {
      total++;
      const isCompleted = !!line.match(/- \[[xX]\]/);
      if (isCompleted) {
        completed++;
      }
      
      // Extract task text, removing the `- [ ]` part
      const taskTextMatch = line.match(/- \[[ xX]\]\s*(.*)/);
      if (taskTextMatch && taskTextMatch[1]) {
        items.push({
          text: taskTextMatch[1].trim(),
          completed: isCompleted
        });
      }
    }
  }
  return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0, items };
}

// Scan SDD directory and aggregate data
function getRequirements() {
  const requirements = [];
  
  const parseFeatureDir = (dirPath, featureName, isArchived, parentId = null, kind = 'feature') => {
    const featurePath = path.join(dirPath, featureName);
    const specFile = path.join(featurePath, 'spec.md');
    const tasksFile = path.join(featurePath, 'tasks.md');
    
    let meta = { status: isArchived ? 'archived' : 'pending' };
    let progress = { total: 0, completed: 0, percentage: 0, items: [] };
    
    if (fs.existsSync(specFile)) {
      const content = fs.readFileSync(specFile, 'utf8');
      const parsedMeta = parseYamlFrontmatter(content);
      meta = { ...meta, ...parsedMeta };
    }
    
    if (fs.existsSync(tasksFile)) {
      const content = fs.readFileSync(tasksFile, 'utf8');
      progress = parseTasksProgress(content);
    }
    
    let id;
    if (parentId) {
      id = kind === 'kr'
        ? `${parentId}/krs/${featureName}`
        : `${parentId}/changes/${featureName}`;
    } else {
      id = featureName;
    }

    const reqData = {
      id,
      name: featureName.replace(/-/g, ' '),
      kind: meta.kind || kind,
      status: meta.status || (isArchived ? 'archived' : 'pending'),
      progress,
      impact: meta.impact_radius || [],
      dependencies: meta.dependencies || [],
      subtasks: []
    };

    // Scan for KRs and changes (subtasks) if it's a root requirement
    if (!parentId) {
      const krsDir = path.join(featurePath, 'krs');
      if (fs.existsSync(krsDir)) {
        const krEntries = fs.readdirSync(krsDir, { withFileTypes: true });
        for (const krEntry of krEntries) {
          if (krEntry.isDirectory()) {
            reqData.subtasks.push(parseFeatureDir(krsDir, krEntry.name, isArchived, featureName, 'kr'));
          }
        }
      }

      const changesDir = path.join(featurePath, 'changes');
      if (fs.existsSync(changesDir)) {
        const changeEntries = fs.readdirSync(changesDir, { withFileTypes: true });
        for (const changeEntry of changeEntries) {
          if (changeEntry.isDirectory()) {
             reqData.subtasks.push(parseFeatureDir(changesDir, changeEntry.name, isArchived, featureName, 'change'));
          }
        }
      }
    }
    return reqData;
  };

  const readSpecs = (dirPath, isArchived = false) => {
    if (!fs.existsSync(dirPath)) return;
    
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        requirements.push(parseFeatureDir(dirPath, entry.name, isArchived));
      }
    }
  };
  
  readSpecs(specsPath, false);
  readSpecs(archivePath, true);
  
  return requirements;
}

// SSE Clients
let sseClients = [];

function broadcastRequirements() {
    const data = getRequirements();
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => client.res.write(payload));
}

// File Watcher
if (fs.existsSync(sddPath)) {
    let debounceTimer;
    fs.watch(sddPath, { recursive: true }, (eventType, filename) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            console.log(`[File Watcher] Changes detected, broadcasting to ${sseClients.length} clients.`);
            broadcastRequirements();
        }, 200);
    });
}

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Requirement Manager Dashboard</title>
    <link href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600&f[]=satoshi@400,500,700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        :root {
            --bg-base: #060608;
            --card-bg: rgba(255, 255, 255, 0.02);
            --card-border: rgba(255, 255, 255, 0.06);
            --text-main: #f9fafb;
            --text-muted: #8b92a1;
            
            --accent-pending: #fcd34d;
            --accent-progress: #60a5fa;
            --accent-completed: #34d399;
            --accent-archived: #6b7280;
            
            --font-display: 'Clash Display', sans-serif;
            --font-body: 'Satoshi', sans-serif;
        }

        * { box-sizing: border-box; }
        
        body {
            font-family: var(--font-body);
            background-color: var(--bg-base);
            color: var(--text-main);
            margin: 0;
            padding: 0;
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background-image: 
                radial-gradient(circle at 0% 0%, rgba(96, 165, 250, 0.08), transparent 40%),
                radial-gradient(circle at 100% 100%, rgba(52, 211, 153, 0.05), transparent 40%);
            background-attachment: fixed;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding: 32px 40px 24px 40px;
            border-bottom: 1px solid var(--card-border);
            flex-shrink: 0;
            background: rgba(6, 6, 8, 0.8);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            z-index: 10;
        }

        h1 {
            font-family: var(--font-display);
            font-size: 2.2rem;
            font-weight: 600;
            margin: 0;
            letter-spacing: -0.03em;
            background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .refresh-status {
            font-size: 0.85rem;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(255,255,255,0.03);
            padding: 6px 12px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.05);
        }
        
        .refresh-status::before {
            content: '';
            display: block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--accent-completed);
            box-shadow: 0 0 8px var(--accent-completed);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { opacity: 0.5; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1); }
            100% { opacity: 0.5; transform: scale(0.8); }
        }

        .kanban {
            flex: 1;
            min-height: 0;
            display: flex;
            gap: 24px;
            overflow-x: auto;
            overflow-y: hidden;
            padding: 32px 40px 40px 40px;
            align-items: stretch;
        }

        .kanban::-webkit-scrollbar {
            height: 8px;
        }
        .kanban::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.02);
            border-radius: 4px;
        }
        .kanban::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.1);
            border-radius: 4px;
        }

        .column {
            flex: 1;
            min-width: 320px;
            max-height: 100%;
            display: flex;
            flex-direction: column;
            background: rgba(255,255,255,0.01);
            border: 1px solid rgba(255,255,255,0.04);
            border-radius: 16px;
            padding: 20px 16px 16px 20px;
            position: relative;
        }

        .col-pending { --col-theme: var(--accent-pending); }
        .col-in_progress { --col-theme: var(--accent-progress); }
        .col-completed { --col-theme: var(--accent-completed); }
        .col-archived { --col-theme: var(--accent-archived); }

        .column-header {
            margin: 0 0 20px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0;
            flex-shrink: 0;
        }

        .column-title {
            font-family: var(--font-display);
            font-size: 1.1rem;
            font-weight: 500;
            color: var(--text-main);
            display: flex;
            align-items: center;
            letter-spacing: 0.02em;
        }

        .column-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--col-theme);
            margin-right: 10px;
            box-shadow: 0 0 8px var(--col-theme);
        }

        .column-content {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding-right: 8px;
            margin-right: -8px; /* Offset for padding */
            padding-bottom: 20px; /* Prevent last card from being cut off by scrollbar/container */
        }

        .column-content::-webkit-scrollbar {
            width: 6px;
        }
        .column-content::-webkit-scrollbar-track {
            background: transparent;
        }
        .column-content::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.08);
            border-radius: 4px;
        }
        .column-content::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.15);
        }

        .count-badge {
            background: rgba(255,255,255,0.1);
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 0.85rem;
            font-family: var(--font-body);
        }

        .card {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 16px;
            transition: all 0.2s ease;
            position: relative;
            flex-shrink: 0;
            animation: slideUp 0.4s ease backwards;
            overflow: hidden;
        }

        .card:hover {
            transform: translateY(-2px);
            border-color: rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.03);
            box-shadow: 0 8px 24px -4px rgba(0,0,0,0.5);
        }

        .card h3 {
            margin: 0 0 12px 0;
            font-size: 1rem;
            font-weight: 500;
            letter-spacing: 0;
            line-height: 1.4;
            color: #fff;
        }

        .progress-container {
            margin-bottom: 16px;
        }

        .progress-bar {
            height: 4px;
            background: rgba(255,255,255,0.06);
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 12px;
        }

        .progress-fill {
            height: 100%;
            background: var(--col-theme);
            border-radius: 4px;
            transition: width 0.5s ease;
        }

        .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 20px;
        }

        .tag {
            font-size: 0.7rem;
            background: transparent;
            color: var(--text-muted);
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid rgba(255,255,255,0.1);
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .tag:hover {
            background: rgba(255,255,255,0.05);
            color: #fff;
            border-color: rgba(255,255,255,0.2);
            transform: none;
            box-shadow: none;
        }

        .tag:hover svg {
            stroke: #fff;
        }

        /* Subtasks UI */
        .subtasks-container {
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid rgba(255,255,255,0.04);
        }
        
        .subtasks-header {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            user-select: none;
            transition: color 0.2s;
        }

        .subtasks-header:hover {
            color: #fff;
        }

        .subtask-toggle-icon {
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .subtasks-list {
            display: grid;
            grid-template-rows: 0fr;
            transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .subtasks-list.open {
            grid-template-rows: 1fr;
        }

        .subtasks-list-inner {
            overflow: hidden;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .subtask-item {
            background: rgba(255, 255, 255, 0.01);
            border: 1px solid rgba(255, 255, 255, 0.03);
            border-radius: 6px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            transition: all 0.2s;
            cursor: pointer;
        }

        .subtask-item:hover {
            background: rgba(255, 255, 255, 0.03);
            border-color: rgba(255, 255, 255, 0.08);
        }

        .subtask-item.status-pending { --sub-col-theme: var(--accent-pending); }
        .subtask-item.status-in_progress { --sub-col-theme: var(--accent-progress); }
        .subtask-item.status-completed { --sub-col-theme: var(--accent-completed); }
        .subtask-item.status-archived { --sub-col-theme: var(--accent-archived); }

        .subtask-item .progress-fill {
            background: var(--sub-col-theme);
        }

        .subtask-name {
            font-size: 0.9rem;
            font-weight: 500;
            color: var(--text-main);
        }
        
        .subtask-progress-text {
            font-size: 0.75rem;
            color: var(--text-muted);
        }

        /* Task List Styles */
        .task-toggle {
            background: transparent;
            border: 1px solid rgba(255,255,255,0.05);
            color: var(--text-muted);
            cursor: pointer;
            font-size: 0.8rem;
            padding: 8px 12px;
            border-radius: 6px;
            width: 100%;
            text-align: left;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s;
            font-family: var(--font-body);
        }

        .task-toggle:hover {
            background: rgba(255,255,255,0.02);
            color: #fff;
        }

        .task-toggle .toggle-icon {
            font-size: 0.7rem;
            transition: transform 0.3s ease;
        }
        
        .task-toggle[aria-expanded="true"] .toggle-icon {
            transform: rotate(180deg);
        }

        .task-list-wrapper {
            display: grid;
            grid-template-rows: 0fr;
            transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .task-list-wrapper.open {
            grid-template-rows: 1fr;
        }

        .task-list {
            overflow: hidden;
            margin: 0;
            padding: 0;
            list-style-type: none;
        }
        
        .task-list-inner {
            padding: 12px 4px 4px 4px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .task-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            font-size: 0.85rem;
            color: var(--text-muted);
            line-height: 1.5;
        }

        .task-checkbox {
            margin-top: 2px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            border-radius: 4px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.2);
            flex-shrink: 0;
            transition: all 0.2s;
        }

        .task-item.is-completed .task-checkbox {
            background: var(--col-theme);
            border-color: var(--col-theme);
        }
        
        .task-item.is-completed .task-checkbox::after {
            content: '';
            width: 4px;
            height: 8px;
            border: solid var(--bg-base);
            border-width: 0 2px 2px 0;
            transform: rotate(45deg) translate(-1px, -1px);
        }

        .task-item.is-completed .task-text {
            text-decoration: line-through;
            opacity: 0.5;
        }

        .empty-state {
            text-align: center;
            color: rgba(255,255,255,0.2);
            font-size: 0.9rem;
            padding: 32px 0;
            border: 1px dashed rgba(255,255,255,0.1);
            border-radius: 12px;
        }

        /* Modal Styles */
        .modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
        }
        
        .modal-overlay.active {
            opacity: 1;
            pointer-events: auto;
        }

        .modal-container {
            background: var(--bg-base);
            border: 1px solid var(--card-border);
            border-radius: 24px;
            width: 90%;
            max-width: 900px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 24px 48px rgba(0,0,0,0.5);
            transform: translateY(20px) scale(0.98);
            transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
            overflow: hidden;
        }

        .modal-overlay.active .modal-container {
            transform: translateY(0) scale(1);
        }

        .modal-header {
            padding: 24px 32px;
            border-bottom: 1px solid var(--card-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255,255,255,0.02);
        }

        .modal-title {
            font-family: var(--font-display);
            font-size: 1.5rem;
            font-weight: 600;
            margin: 0;
            color: #fff;
        }

        .close-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            display: flex;
            transition: all 0.2s;
        }

        .close-btn:hover {
            background: rgba(255,255,255,0.1);
            color: #fff;
        }

        .modal-tabs {
            display: flex;
            padding: 0 32px;
            border-bottom: 1px solid var(--card-border);
            background: rgba(255,255,255,0.01);
            gap: 24px;
        }

        .tab-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            padding: 16px 0;
            font-family: var(--font-display);
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            position: relative;
            transition: color 0.2s;
        }

        .tab-btn:hover {
            color: var(--text-main);
        }

        .tab-btn.active {
            color: var(--accent-progress);
        }

        .tab-btn.active::after {
            content: '';
            position: absolute;
            bottom: -1px;
            left: 0; right: 0;
            height: 2px;
            background: var(--accent-progress);
            box-shadow: 0 0 8px var(--accent-progress);
        }

        .modal-content-area {
            padding: 32px;
            overflow-y: auto;
            flex: 1;
        }
        
        .modal-content-area::-webkit-scrollbar {
            width: 8px;
        }
        .modal-content-area::-webkit-scrollbar-track {
            background: transparent;
        }
        .modal-content-area::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.1);
            border-radius: 4px;
        }

        /* Markdown Styles */
        .markdown-body {
            font-family: var(--font-body);
            color: var(--text-main);
            line-height: 1.7;
            font-size: 0.95rem;
        }
        .markdown-body h1, .markdown-body h2, .markdown-body h3 {
            font-family: var(--font-display);
            color: #fff;
            margin-top: 2em;
            margin-bottom: 1em;
            font-weight: 600;
        }
        .markdown-body h1 { font-size: 1.8rem; margin-top: 0; }
        .markdown-body h2 { font-size: 1.4rem; border-bottom: 1px solid var(--card-border); padding-bottom: 0.5em; }
        .markdown-body h3 { font-size: 1.1rem; }
        .markdown-body p { margin-bottom: 1.2em; }
        .markdown-body ul, .markdown-body ol { margin-bottom: 1.2em; padding-left: 2em; }
        .markdown-body li { margin-bottom: 0.5em; }
        .markdown-body code {
            background: rgba(255,255,255,0.1);
            padding: 0.2em 0.4em;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9em;
        }
        .markdown-body pre {
            background: #000;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            border: 1px solid var(--card-border);
            margin-bottom: 1.5em;
        }
        .markdown-body pre code {
            background: transparent;
            padding: 0;
        }
        .markdown-body blockquote {
            border-left: 4px solid var(--accent-progress);
            padding-left: 1em;
            color: var(--text-muted);
            margin: 0 0 1.5em 0;
            background: rgba(255,255,255,0.02);
            padding: 1em;
            border-radius: 0 8px 8px 0;
        }
        .loader {
            display: flex;
            justify-content: center;
            padding: 40px;
            color: var(--text-muted);
        }
        
        .clickable-card {
            cursor: pointer;
        }
        /* Header controls */
        .header-controls {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .search-container {
            position: relative;
            display: flex;
            align-items: center;
        }

        .search-icon {
            position: absolute;
            left: 12px;
            color: var(--text-muted);
            pointer-events: none;
        }

        .search-input {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #fff;
            border-radius: 20px;
            padding: 8px 16px 8px 36px;
            font-family: var(--font-body);
            font-size: 0.9rem;
            width: 250px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
        }

        .search-input:focus {
            outline: none;
            border-color: var(--accent);
            background: rgba(255,255,255,0.1);
            width: 300px;
            box-shadow: 0 0 0 3px rgba(0, 240, 255, 0.1);
        }

        .search-input::placeholder {
            color: rgba(255,255,255,0.3);
        }

        .lang-switch {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: var(--text-muted);
            border-radius: 8px;
            padding: 4px;
            display: flex;
            align-items: center;
            cursor: pointer;
            font-family: var(--font-body);
            font-size: 0.85rem;
        }

        .lang-option {
            padding: 4px 12px;
            border-radius: 6px;
            transition: all 0.2s;
        }

        .lang-option.active {
            background: rgba(255,255,255,0.1);
            color: #fff;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 data-i18n="title">Requirement Manager</h1>
        <div class="header-controls">
            <div class="search-container">
                <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" class="search-input" id="search-input" data-i18n-placeholder="searchPlaceholder" placeholder="Search requirements..." oninput="handleSearch(event)">
            </div>
            <div class="lang-switch" onclick="toggleLang()">
                <div class="lang-option" id="lang-en">EN</div>
                <div class="lang-option" id="lang-zh">中</div>
            </div>
            <div class="refresh-status" id="refresh-status"><span data-i18n="liveSync">Live Sync Active</span></div>
        </div>
    </div>
    
    <div class="kanban" id="kanban">
        <!-- Columns injected by JS -->
    </div>

    <!-- Modal -->
    <div class="modal-overlay" id="details-modal" onclick="closeModal(event)">
        <div class="modal-container" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h2 class="modal-title" id="modal-title" data-i18n="details">Requirement Details</h2>
                <button class="close-btn" onclick="closeModal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="modal-tabs">
                <button class="tab-btn active" onclick="switchTab(event, 'proposal')" data-i18n="proposal">Proposal</button>
                <button class="tab-btn" onclick="switchTab(event, 'design')" data-i18n="design">Design</button>
                <button class="tab-btn" onclick="switchTab(event, 'spec')" data-i18n="spec">Spec</button>
                <button class="tab-btn" onclick="switchTab(event, 'tasks')" data-i18n="tasks">Tasks</button>
                <button class="tab-btn" onclick="switchTab(event, 'checklist')" data-i18n="checklist">Checklist</button>
            </div>
            <div class="modal-content-area markdown-body" id="modal-content">
                <div class="loader" data-i18n="loading">Loading details...</div>
            </div>
        </div>
    </div>

    <script>
        const i18n = {
            en: {
                title: 'Requirement Manager',
                liveSync: 'Live Sync Active',
                connected: 'Connected',
                updated: 'Updated',
                reconnecting: 'Connection lost. Reconnecting...',
                pending: 'Pending',
                in_progress: 'In Progress',
                completed: 'Completed',
                archived: 'Archived',
                tasks: 'Tasks',
                checklist: 'Checklist',
                noTasks: 'No tasks here',
                details: 'Requirement Details',
                proposal: 'Proposal',
                design: 'Design',
                spec: 'Spec',
                loading: 'Loading details...',
                optimizations: 'Key Results & Changes',
                emptyTab: 'No {tab} provided for this requirement.',
                searchPlaceholder: 'Search requirements...'
            },
            zh: {
                title: '需求管理看板',
                liveSync: '实时同步',
                connected: '已连接',
                updated: '已更新',
                reconnecting: '连接断开。重新连接中...',
                pending: '待处理',
                in_progress: '进行中',
                completed: '已完成',
                archived: '已归档',
                tasks: '任务',
                checklist: '验收',
                noTasks: '暂无任务',
                details: '需求详情',
                proposal: '提案',
                design: '设计',
                spec: '规格',
                loading: '加载中...',
                optimizations: 'KR 与变更',
                emptyTab: '该需求暂未提供 {tab} 文档。',
                searchPlaceholder: '搜索需求...'
            }
        };

        let currentLang = localStorage.getItem('rm_lang') || 'en';
        let currentSearchQuery = '';
        
        function t(key, params = {}) {
            let text = i18n[currentLang][key] || key;
            for (const [k, v] of Object.entries(params)) {
                text = text.replace(\`{\${k}}\`, v);
            }
            return text;
        }

        function updateStaticI18n() {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                el.textContent = t(key);
            });
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                el.placeholder = t(key);
            });
            document.getElementById('lang-en').className = \`lang-option \${currentLang === 'en' ? 'active' : ''}\`;
            document.getElementById('lang-zh').className = \`lang-option \${currentLang === 'zh' ? 'active' : ''}\`;
        }

        function toggleLang() {
            currentLang = currentLang === 'en' ? 'zh' : 'en';
            localStorage.setItem('rm_lang', currentLang);
            updateStaticI18n();
            if (window.lastData) {
                renderBoard(filterRequirements(window.lastData, currentSearchQuery));
            }
        }

        function handleSearch(event) {
            currentSearchQuery = event.target.value.toLowerCase().trim();
            if (window.lastData) {
                renderBoard(filterRequirements(window.lastData, currentSearchQuery));
            }
        }

        function filterRequirements(data, query) {
            if (!query) return data;
            return data.filter(req => {
                const matchName = req.name.toLowerCase().includes(query);
                const matchDeps = (req.dependencies || []).some(d => d && d.toLowerCase().includes(query));
                const matchSubtasks = (req.subtasks || []).some(sub => sub.name.toLowerCase().includes(query));
                return matchName || matchDeps || matchSubtasks;
            });
        }

        const COLUMNS = [
            { id: 'pending', title: 'Pending' },
            { id: 'in_progress', title: 'In Progress' },
            { id: 'completed', title: 'Completed' },
            { id: 'archived', title: 'Archived' }
        ];

        function initSSE() {
            const eventSource = new EventSource('/api/stream');
            
            eventSource.onopen = () => {
                document.getElementById('refresh-status').innerHTML = \`\${t('liveSync')} &nbsp;<span style="opacity: 0.5">|</span>&nbsp; \${t('connected')}\`;
            };
            
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    window.lastData = data;
                    renderBoard(filterRequirements(data, currentSearchQuery));
                    const time = new Date().toLocaleTimeString();
                    document.getElementById('refresh-status').innerHTML = \`\${t('liveSync')} &nbsp;<span style="opacity: 0.5">|</span>&nbsp; \${t('updated')} \${time}\`;
                } catch (err) {
                    console.error('Failed to parse SSE data', err);
                }
            };
            
            eventSource.onerror = (err) => {
                console.error('SSE connection error', err);
                document.getElementById('refresh-status').innerHTML = \`<span style="color: #ef4444">⚠️ \${t('reconnecting')}</span>\`;
                eventSource.close();
                setTimeout(initSSE, 3000); // Attempt to reconnect after 3 seconds
            };
        }

        function renderBoard(requirements) {
            const kanban = document.getElementById('kanban');
            kanban.innerHTML = '';

            COLUMNS.forEach(col => {
                const reqs = requirements.filter(r => 
                    r.status === col.id || (col.id === 'pending' && r.status === 'draft')
                );
                
                const colEl = document.createElement('div');
                colEl.className = 'column col-' + col.id;
                
                let cardsHtml = reqs.length > 0 
                    ? reqs.map((r, i) => createCard(r, i)).join('') 
                    : \`<div class="empty-state">\${t('noTasks')}</div>\`;

                colEl.innerHTML = \`
                    <div class="column-header">
                        <div class="column-title">
                            <span class="column-dot"></span>
                            \${t(col.id)}
                        </div>
                        <span class="count-badge">\${reqs.length}</span>
                    </div>
                    <div class="column-content">
                        \${cardsHtml}
                    </div>
                \`;
                kanban.appendChild(colEl);
            });
        }

        function createCard(req, index) {
            let deps = (req.dependencies || []).filter(d => d && d.toLowerCase() !== 'none');
            let tagsHtml = deps.map(d => \`<span class="tag" onclick="event.stopPropagation(); setFilter('\${d.replace(/'/g, "\\\\'")}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> \${d}</span>\`).join('');
            
            let tasksHtml = '';
            if (req.progress.items && req.progress.items.length > 0) {
                const listHtml = req.progress.items.map(item => \`
                    <li class="task-item \${item.completed ? 'is-completed' : ''}">
                        <span class="task-checkbox"></span>
                        <span class="task-text">\${item.text}</span>
                    </li>
                \`).join('');
                
                const isOpen = window.openTasks && window.openTasks[req.id];
                
                tasksHtml = \`
                    <button class="task-toggle" onclick="toggleTasks(event, '\${req.id}')" aria-expanded="\${isOpen ? 'true' : 'false'}" id="btn-\${req.id}">
                        <span>\${req.progress.completed} / \${req.progress.total} \${t('tasks')} (\${req.progress.percentage}%)</span>
                        <svg class="toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    <div class="task-list-wrapper \${isOpen ? 'open' : ''}" id="wrapper-\${req.id}">
                        <ul class="task-list">
                            <div class="task-list-inner">
                                \${listHtml}
                            </div>
                        </ul>
                    </div>
                \`;
            } else {
                tasksHtml = \`
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        \${req.progress.completed} / \${req.progress.total} \${t('tasks')} (\${req.progress.percentage}%)
                    </div>
                \`;
            }
            
            const delay = index * 0.1;
            
            let subtasksSection = '';
            if (req.subtasks && req.subtasks.length > 0) {
                const subHtml = req.subtasks.map(sub => \`
                    <div class="subtask-item status-\${sub.status}" onclick="event.stopPropagation(); openModal('\${sub.id}', '\${sub.name.replace(/'/g, "\\\\'")}')">
                        <div class="subtask-name">\${sub.name}</div>
                        <div class="subtask-progress-text">
                            \${sub.progress.completed} / \${sub.progress.total} \${t('tasks')} (\${sub.progress.percentage}%) • \${t(sub.status)}
                        </div>
                        <div class="progress-bar" style="height: 2px; margin-bottom: 0; margin-top: 4px; opacity: 0.5;">
                            <div class="progress-fill" style="width: \${sub.progress.percentage}%"></div>
                        </div>
                    </div>
                \`).join('');
                
                const isSubOpen = window.openSubtasks && window.openSubtasks[req.id];
                
                subtasksSection = \`
                    <div class="subtasks-container">
                        <div class="subtasks-header" onclick="event.stopPropagation(); toggleSubtasks('\${req.id}')">
                            <svg class="subtask-toggle-icon" id="subtasks-icon-\${req.id}" style="transform: \${isSubOpen ? 'rotate(180deg)' : 'rotate(0deg)'}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            \${t('optimizations')} (\${req.subtasks.length})
                        </div>
                        <div class="subtasks-list \${isSubOpen ? 'open' : ''}" id="subtasks-\${req.id}">
                            <div class="subtasks-list-inner">
                                \${subHtml}
                            </div>
                        </div>
                    </div>
                \`;
            }

            return \`
                <div class="card clickable-card" style="animation-delay: \${delay}s" onclick="openModal('\${req.id}', '\${req.name.replace(/'/g, "\\'")}')">
                    <h3>\${req.name}</h3>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: \${req.progress.percentage}%"></div>
                        </div>
                    </div>
                    \${tasksHtml}
                    \${subtasksSection}
                    \${tagsHtml ? \`<div class="tags">\${tagsHtml}</div>\` : ''}
                </div>
            \`;
        }

        window.openTasks = {};
        window.openSubtasks = {};

        function setFilter(query) {
            const input = document.getElementById('search-input');
            input.value = query;
            currentSearchQuery = query.toLowerCase().trim();
            if (window.lastData) {
                renderBoard(filterRequirements(window.lastData, currentSearchQuery));
            }
        }
        
        function toggleSubtasks(reqId) {
            const list = document.getElementById(\`subtasks-\${reqId}\`);
            const icon = document.getElementById(\`subtasks-icon-\${reqId}\`);
            
            if (list.classList.contains('open')) {
                list.classList.remove('open');
                icon.style.transform = 'rotate(0deg)';
                window.openSubtasks[reqId] = false;
            } else {
                list.classList.add('open');
                icon.style.transform = 'rotate(180deg)';
                window.openSubtasks[reqId] = true;
            }
        }
        
        function toggleTasks(event, reqId) {
            if (event) event.stopPropagation();
            const wrapper = document.getElementById(\`wrapper-\${reqId}\`);
            const btn = document.getElementById(\`btn-\${reqId}\`);
            
            if (wrapper.classList.contains('open')) {
                wrapper.classList.remove('open');
                btn.setAttribute('aria-expanded', 'false');
                window.openTasks[reqId] = false;
            } else {
                wrapper.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
                window.openTasks[reqId] = true;
            }
        }

        let currentDetails = null;
        let currentTab = 'proposal';

        async function openModal(id, name) {
            const modal = document.getElementById('details-modal');
            const title = document.getElementById('modal-title');
            const content = document.getElementById('modal-content');
            
            title.textContent = name;
            title.removeAttribute('data-i18n'); // Because title is dynamic now
            content.innerHTML = \`<div class="loader">\${t('loading')}</div>\`;
            modal.classList.add('active');
            
            try {
                const res = await fetch(\`/api/details?id=\${id}\`);
                if (!res.ok) throw new Error('Failed to fetch details');
                currentDetails = await res.json();
                renderTab(currentTab);
            } catch (err) {
                console.error(err);
                content.innerHTML = \`<div style="color: #ef4444; padding: 20px;">Failed to load details.</div>\`;
            }
        }

        function closeModal(event) {
            // If event is provided and it's not from the overlay itself, ignore it
            if (event && event.target.id !== 'details-modal') return;
            const modal = document.getElementById('details-modal');
            modal.classList.remove('active');
            currentDetails = null;
        }

        function switchTab(event, tabId) {
            currentTab = tabId;
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            if (event && event.currentTarget) {
                event.currentTarget.classList.add('active');
            }
            renderTab(tabId);
        }

        function renderTab(tabId) {
            const content = document.getElementById('modal-content');
            if (!currentDetails) return;
            
            const rawMarkdown = currentDetails[tabId];
            if (!rawMarkdown || rawMarkdown.trim() === '') {
                content.innerHTML = \`<div class="empty-state">\${t('emptyTab', { tab: t(tabId) })}</div>\`;
                return;
            }
            
            // Use marked.js if available
            if (window.marked) {
                content.innerHTML = marked.parse(rawMarkdown);
            } else {
                content.innerHTML = \`<pre style="white-space: pre-wrap; font-family: inherit;">\${rawMarkdown}</pre>\`;
            }
        }

        updateStaticI18n();
        initSSE();
    </script>
</body>
</html>
`;

// Create HTTP Server
const server = http.createServer((req, res) => {
  if (req.url === '/api/requirements') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getRequirements()));
  } else if (req.url.startsWith('/api/details')) {
    const urlUrl = new URL(req.url, `http://${req.headers.host}`);
    const id = urlUrl.searchParams.get('id');
    if (!id) {
      res.writeHead(400);
      return res.end('Missing id');
    }

    // Path traversal guard: id may legitimately contain `/krs/` or `/changes/`
    // segments, but never `..` or absolute paths.
    if (id.split('/').some(seg => seg === '..' || seg === '' || seg.startsWith('.'))) {
      res.writeHead(400);
      return res.end('Invalid id');
    }

    const resolveSafe = (base) => {
      const candidate = path.resolve(base, id);
      const baseResolved = path.resolve(base);
      if (!candidate.startsWith(baseResolved + path.sep) && candidate !== baseResolved) {
        return null;
      }
      return fs.existsSync(candidate) ? candidate : null;
    };

    let targetDir = resolveSafe(specsPath) || resolveSafe(archivePath);

    if (!targetDir) {
      res.writeHead(404);
      return res.end('Not found');
    }
    
    const readSafe = (filename) => {
      const filepath = path.join(targetDir, filename);
      return fs.existsSync(filepath) ? fs.readFileSync(filepath, 'utf8') : '';
    };
    
    const details = {
      proposal: readSafe('proposal.md'),
      design: readSafe('design.md'),
      spec: readSafe('spec.md'),
      tasks: readSafe('tasks.md'),
      checklist: readSafe('checklist.md')
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(details));
  } else if (req.url === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    // Send initial data
    res.write(`data: ${JSON.stringify(getRequirements())}\n\n`);
    
    const client = { id: Date.now(), res };
    sseClients.push(client);
    
    req.on('close', () => {
      sseClients = sseClients.filter(c => c.id !== client.id);
    });
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML_TEMPLATE);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

console.log('\n=======================================');
console.log('📋 Requirement Manager Dashboard');
console.log('=======================================\n');

if (!fs.existsSync(sddPath)) {
  console.log('\x1b[33m%s\x1b[0m', '⚠️ Warning: No "sdd" directory found in current path.');
  console.log('Are you running this in your project root?');
  console.log(`Current path: ${currentDir}\n`);
}

server.listen(PORT, () => {
  console.log(`🚀 Server running at: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`📂 Monitoring SDD data from: ${sddPath}`);
  console.log('\nPress Ctrl+C to stop');
});
