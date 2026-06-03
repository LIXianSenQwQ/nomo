# Trae Skill: 智能需求工作流 (Smart Requirement Workflow)

[English](README.md) | [中文](README_zh.md)

智能需求工作流 (Smart Requirement Workflow) 是一款专为 AI 辅助编程设计的核心技能。它结合了**深度追问（The "Grill"）**与完整的**"规范先行 (SDD)"**工作流——从需求澄清贯穿到验证交付。它会化身为严格的产品经理和架构师，确保在你提出笼统或不完整的需求时，先通过提问理清所有细节，再自动生成标准化、高度结构化的需求文档，并在实现阶段保持方向不偏移，直至验证完成。

## ✨ 核心特性

- **深度追问机制 (The Grill)**（阶段一）：分析你的初始需求，**每次只问一个最关键的问题**，结合实时代码库上下文，深挖缺失细节、边界条件、UI/UX 流程及技术限制。
- **对齐与确认**（阶段二）：根据你的回答总结敲定的需求大纲，在生成任何规范文档前向你进行最终确认。
- **已有 Spec 检查**：新建 spec 前先扫描 `sdd/specs/` 是否存在可复用或可续接的工作，避免重复劳动。
- **规范文档生成**（阶段三）：确认无误后，根据复杂度自动生成文档：
  - **简单需求**（`spec.md` + `tasks.md` + `checklist.md`）：单模块、1-5 个任务、无破坏性变更
  - **复杂需求**（全部 5 个文件）：多模块、新增数据模型、6+ 任务、架构决策
  - **Epic / OKR 需求**（主目录 5 文件 + `krs/` 子目录）：大型重构、迁移，或单个 `spec.md` 无法清晰罗列的多目标项目——拆分为一份"Objective 主 spec" + 每个可独立度量的子目标对应一个 KR 子 spec
- **SHALL/Scenario 需求格式**：采用 `系统应当 … / 当 … 时，则 …` 的结构化场景格式，内建可测试性，需求清晰无歧义。
- **实现引导**（阶段四）：按依赖顺序执行任务，依赖声明的并行任务可并发推进，实现中途发现的新需求会回写到 spec 中。
- **独立验证**（阶段五）：用独立的 `checklist.md` 逐项验证，失败项触发"修复→重验"循环，直至全部通过。
- **异常处理规则**：为所有非 happy-path 场景定义显式的恢复路径——意图变更、确认被否、实施中发现 spec 缺口、反复验证失败、跨会话续接等。
- **护栏规则**：显式护栏防止过早编码、保护无关代码、强制最小实现。
- **机器可读元数据**：自动在 `spec.md` 注入 YAML Frontmatter（状态、影响范围、依赖），让 AI Agent 瞬间理解功能的影响半径和依赖关系。
- **全局项目注册表**：自动维护 `sdd/project.md` 作为总索引，总览所有进行中与已归档的特性。
- **零上下文丢失**：通过详尽、明确的标准化文档，让 AI 在漫长的编码过程中保持专注，有效防止架构偏移和代码"写跑偏"。

## ✅ 前置条件 (Prerequisites)

调用本技能前请确认：

- **项目根目录可写** —— 技能会在 `sdd/` 下创建并维护文件（如 `sdd/specs/<name>/`、`sdd/project.md`）。
- **代码库可被搜索** —— 阶段一强制要求 Context Gathering，需要 search/grep 能力。
- **模板文件齐全** —— `references/` 下的 `proposal.template.md` / `design.template.md` / `spec.template.md` / `tasks.template.md` / `checklist.template.md` 必须与 `SKILL.md` 同目录存在。
- **Node.js 14+**（可选） —— 仅当需要启动看板（`scripts/dashboard.js`）时需要，且 3030 端口空闲。
- **交互式会话** —— 阶段一、二、三的 Step 8 以及 E1–E5 异常路径全部需要用户介入，**不可在 headless / CI 环境无人值守运行**。

## 🚀 工作流与使用方法

你可以通过以下方式触发智能需求工作流技能：
- "使用 smart-requirement-workflow 添加一个登录功能。"
- "我有一个关于购物车的初步想法，用 smart-requirement-workflow 帮我梳理一下。"
- "把我们上周定的那个功能实现一下。"

### 典型五阶段执行流程

1. **阶段一：深度追问 (The Grill)**
   - AI **绝对不会**立刻开始写文档。
   - **结合代码库**：AI 会首先查阅现有的代码库，了解当前的架构、数据模型和限制条件（入口点、数据模型、现有模式、依赖项、约束条件——语言无关）。
   - **快速路径**：如果你的需求已经定义得很清晰（范围明确、用户流程已知、验收标准清楚、无跨模块影响），AI 可能会提议跳过深入追问。你可以接受这个快捷方式，也可以坚持要求全面探索边界情况。
   - **每次仅问一个问题**：AI 绝对不会向你抛出一长串问题列表。它会每次只问**一个**最犀利、最关键的问题。
   - 你回答问题后，AI 会根据你的回答和代码库现状提出下一个问题，持续迭代，深挖边界条件和错误处理，直到所有决策分支都被彻底理清。
2. **阶段二：对齐与确认**
   - AI 会根据你的回答，总结出一份详尽的、敲定的需求大纲。
   - 在进入生成阶段前，它会向你进行最终确认。
3. **阶段三：规范文档生成**
   - 先检查是否已有匹配的 spec 可复用（避免重复）。
   - 确认后，AI 会在 `sdd/specs/` 下按选定的复杂度生成相应文档（**Simple = 3 文件，Complex = 5 文件，Epic = 主目录 5 文件 + `krs/` 子 spec**），更新全局注册表 `sdd/project.md`，并提交给你审阅。
   - **在你明确批准之前，不写任何代码。**
4. **阶段四：实现**
   - AI 按 `tasks.md` 中的依赖顺序逐一执行任务，勾选完成。
   - 声明为可并行的任务会并发推进。
   - 若实现过程中发现新需求，先回写 spec 再继续。
5. **阶段五：验证**
   - 逐项对照 `checklist.md` 验证实现结果。
   - 若某项未通过，则追加任务到 `tasks.md`，修复后重新验证。
   - 所有任务和清单项全部勾选后，状态更新为 `completed`。

### 异常处理（非 Happy Path）

工作流为偏离主路径的场景定义了显式的恢复规则，避免 AI 自由发挥：

| 编号 | 场景 | 恢复策略 |
|------|------|----------|
| **E1** | 用户在追问中途改变意图 | 立即停止当前问题链，标注哪些已捕获的回答被作废，从新意图重新开始 Grill（不悄悄合并旧答案） |
| **E2** | 用户在阶段二拒绝确认 | **仅针对被否决的点**回到阶段一追问，再重新汇总并请求确认 |
| **E3** | 实施中发现 spec 缺口 | 暂停当前任务，状态回退 `in_progress → draft`，更新 spec，仅就变更点重新确认，再恢复任务 |
| **E4** | 同一 checklist 项反复验证失败 | 第 1 轮：修复重验。第 2 轮：质疑该验收标准本身是否有问题。第 3 轮：**强制停止**，向用户升级——绝不进入第 4 轮 |
| **E5** | 会话中断后续接 | 先读 `spec.md` frontmatter 中的 `status`，按状态机决定从哪一阶段续接，而不是从阶段一重头开始 |

## 📂 目录结构与规范

本技能通过项目根目录下的 `sdd` 文件夹进行工作流管理。

### 1. 按复杂度分类的需求

#### 简单需求
在 `sdd/specs/<requirement-name>/` 下创建，包含三个核心文件：
- **`spec.md`**：YAML Frontmatter（状态、影响范围、依赖），范围界定，**SHALL/Scenario** 功能需求。
- **`tasks.md`**：按阶段拆分的可执行任务看板，含 `# Task Dependencies` 显式依赖声明和并行标记。
- **`checklist.md`**：独立的验收清单。

#### 复杂需求
在 `sdd/specs/<requirement-name>/` 下创建，包含完整的五段式 SDD 结构：
- **`proposal.md`**：背景上下文、当前痛点、特性价值、备选方案及成功指标。
- **`design.md`**：技术架构、数据模型、接口定义、数据流及错误处理策略。
- **`spec.md`**：YAML Frontmatter（状态、影响范围、依赖），范围界定，**SHALL/Scenario** 功能需求（ADDED/MODIFIED/REMOVED）。
- **`tasks.md`**：按阶段拆分的可执行任务看板，含 `# Task Dependencies` 显式依赖声明和并行标记。
- **`checklist.md`**：独立验收清单——涵盖功能验证、代码质量、测试、非功能性四大类，每项均可客观验证。

#### Epic / OKR 需求
当一个 `spec.md` 已经无法清晰罗列工作内容时使用——典型场景：大型重构、系统迁移、跨团队的多目标计划，或由若干可独立交付的子特性组成的新功能集合。

主 spec 定义 **Objective（目标）**，每个可度量的 **Key Result（关键结果）** 在 `krs/` 下拥有自己独立、自包含的子 spec：

```
sdd/specs/<epic-name>/
├── proposal.md       # 这个 epic 存在的动机；总体 Objective
├── design.md         # 所有 KR 共用的跨切面架构决策
├── spec.md           # kind: epic，记录 Objective 与 key_results 列表
├── tasks.md          # 仅记录 epic 级别的协调任务（跨 KR 排序、集成、上线）
├── checklist.md      # epic 级验证（Objective 是否达成、所有 KR 是否完成、集成是否通过）
└── krs/
    ├── kr-01-<name>/   # kind: kr，parent: <epic-name>
    │   ├── spec.md
    │   ├── tasks.md
    │   └── checklist.md
    └── kr-02-<name>/
        └── ...
```

只有当**全部 KR 都完成**且 epic 级 checklist 全部通过时，epic 才能标记为 `completed`。

### 2. 修改现有需求
当修改现有需求时，**不会**覆盖原始规范。而是在现有需求的 `changes` 目录下创建一个新的变更记录：
`sdd/specs/<existing-requirement-name>/changes/<change-name>/`
该变更目录同样必须包含这五个核心文件，以清晰追踪变更的动机与实现细节。

## 📌 任务状态与生命周期管理

- **任务追踪**：所有任务与验收清单默认使用未完成的 Markdown 任务列表 (`- [ ]`)。
- **状态更新**：当任务完成时，AI 会将其更新为已完成 (`- [x]`)。
- **特性闭环**：当一个需求的所有任务（`tasks.md`）**且**所有验收清单项（`checklist.md`）均勾选 (`- [x]`) 时，`spec.md` 的 YAML Frontmatter 及 `sdd/project.md` 注册表中的状态必须更新为 `completed`。
- **归档规则**：
  - **不要**仅仅因为需求已完成就将其归档 (`archived`)。已完成的需求应保留在活跃的 `sdd/specs/` 目录中，作为当前系统架构的实时文档。
  - **只有**当你明确要求归档，或者该特性已被新系统完全废弃/替换时，才将其移动到 `sdd/archive/` 目录并更新全局注册表。

### 状态流转状态机

```
pending → draft → in_progress → completed → archived
            ↑__________|              |
                                       └─→ in_progress（已验证缺陷 / 计划外增强）
```

| 从 | 到 | 条件 |
|---|-----|------|
| `pending` | `draft` | 用户确认需求意向 |
| `draft` | `draft` | 用户拒绝阶段二确认；仅就被否决点重新追问（见 E2） |
| `draft` | `in_progress` | 用户批准规范生成 |
| `in_progress` | `draft` | 实现过程中发现规范缺口 |
| `in_progress` | `completed` | 所有任务和验收清单项均已验证通过 |
| `completed` | `in_progress` | 仅限已验证的缺陷或计划外的增强需求 |
| `completed` | `archived` | 用户明确要求归档 |

**禁止跳状态**：需求必须经历 `pending → draft → in_progress → completed` 的完整流程。禁止直接跳转。

## 🛡️ 护栏规则

- **批准前不写代码**：阶段一至三只产出文档，不碰代码。
- **不动无关代码**：工作区可能包含其他人的工作，只改 spec 范围内的内容。
- **最小实现优先**：只在 spec 要求时才增加复杂度。
- **语言一致性**：文档语言跟随用户沟通语言。
- **先看代码再写 Spec**：不了解现有系统的 spec 比没有 spec 更糟。
- **保留 spec 文档**：完成后不要删除 spec 文档——它们是系统当前的活文档和历史记录。

## 📊 实时看板面板 (Live Kanban Dashboard)

本技能内置了一个零依赖的 Node.js 脚本，可将你的需求可视化为一个实时的看板。

### ✨ 面板特性
- **实时同步 (SSE)**：自动且即时地将 Markdown 文件的任何修改同步到面板，无需手动刷新。
- **富文本详情弹窗**：点击任何需求卡片，即可直接在浏览器中阅读渲染精美的 `proposal`、`design`、`spec`、`tasks` 和 `checklist`。
- **子任务嵌套**：`changes/`（变更记录）与 `krs/`（Epic 关键结果）会被可视化嵌套到所属父需求卡片下。
- **即时搜索**：支持按需求名称、依赖项或子任务进行实时过滤。
- **国际化 (i18n)**：无缝切换中英文界面。

你无需手动执行任何命令！只需对 AI 说：
> "打开需求面板" 或 "看一看看板"

AI 就会自动在后台启动服务器，并为你提供预览链接（通常是 **http://localhost:3030** ）。

## 📤 产出物清单 (Output)

本技能在你的项目中实际生成的文件：

| 文件 | 创建时机 |
|------|----------|
| `sdd/specs/<name>/spec.md` | 始终创建 |
| `sdd/specs/<name>/tasks.md` | 始终创建 |
| `sdd/specs/<name>/checklist.md` | 始终创建（Simple / Complex / Epic） |
| `sdd/specs/<name>/proposal.md` | 仅 Complex 与 Epic |
| `sdd/specs/<name>/design.md` | 仅 Complex 与 Epic |
| `sdd/specs/<name>/krs/kr-NN-<name>/...` | 仅 Epic —— 每个 Key Result 一个子目录 |
| `sdd/specs/<name>/changes/<change-name>/...` | 修改已完成需求时创建 |
| `sdd/project.md` | 首次运行时创建，每次状态变更时更新 |

阶段一与阶段二是纯对话式的——在你批准进入阶段三前，**不会写任何文件**。

## 📚 资源索引 (Resources)

| 路径 | 用途 |
|------|------|
| `references/proposal.template.md` | 背景、痛点、价值主张、备选方案、成功指标 |
| `references/design.template.md` | 技术架构、数据模型、接口、数据流、错误处理 |
| `references/spec.template.md` | YAML frontmatter（`status` / `impact_radius` / `dependencies` / `kind` / `parent` / `key_results`）+ 范围 + SHALL/Scenario |
| `references/tasks.template.md` | 含 `# Task Dependencies` 与并行标记的有序任务看板 |
| `references/checklist.template.md` | 独立、可客观验证的验收清单 |
| `scripts/dashboard.js` | 零依赖 Node 看板（SSE 实时刷新 + 中英文 i18n + 子任务嵌套） |
| `SKILL.md` | AI Agent 实际加载执行的完整技能规约 |