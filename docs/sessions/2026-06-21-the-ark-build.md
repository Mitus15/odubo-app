# The Ark — Project Management System Build Log

**Sessions:** June 14–21, 2026
**Status:** Phase 1 Complete + Editing/Usability Enhancements
**Deployed:** Pushed to main, Vercel auto-deploying

---

## What Is The Ark

A fully general, versatile project management hub inside the odubo.studio admin dashboard. Manages any type of project — music, tech, career, immigration, events, scripts, personal — with no hardcoded types. Everything (categories, statuses, integrations, custom fields) is user-defined and grows organically.

**Inspired by:** Asana, Monday.com, ClickUp, Trello, Jira — takes the best ideas and makes them personal.

---

## Architecture

### Database (Cloudflare D1 — Migrations 134–141)

| Migration | Tables | Purpose |
|-----------|--------|---------|
| 134 | `ark_categories`, `ark_statuses`, `ark_projects` | Core entities + seeded default statuses |
| 135 | `ark_milestones`, `ark_tasks` | Project phases + work items |
| 136 | `ark_notes`, `ark_assets`, `ark_timeline` | Notes, files/links, activity log |
| 137 | `ark_integrations`, `ark_project_integrations` | Platform/service connections |
| 138 | `ark_templates` | Reusable project structures |
| 139 | `ark_custom_fields`, `ark_custom_field_values` | Extensible per-category fields |
| 140 | `ALTER ark_tasks ADD scheduled_date` | Calendar scheduling (separate from due_date) |
| 141 | `ark_reviews` | Weekly review records |

All migrations run on both local and remote D1.

### Types

`src/types/ark.ts` — All entity types + input types:
- ArkCategory, ArkStatus, ArkProject, ArkTask, ArkMilestone
- ArkNote, ArkAsset, ArkIntegration, ArkProjectIntegration
- ArkTimelineEntry, ArkTemplate, ArkCustomField, ArkCustomFieldValue
- ArkReview (implied by table, not explicitly typed yet)

### API Routes (all under `/api/admin/ark/`)

**Core:**
- `GET/POST /api/admin/ark` — List/create projects
- `GET /api/admin/ark/stats` — Dashboard aggregates
- `GET /api/admin/ark/briefing` — Morning Briefing data
- `GET/PUT /api/admin/ark/calendar` — Calendar planner data + batch scheduling

**Per-project (`/api/admin/ark/[projectId]/`):**
- `GET/PUT/DELETE` — Single project CRUD
- `tasks/` — GET, POST tasks; `tasks/[taskId]/` — PUT, DELETE
- `tasks/reorder/` — PUT batch reorder
- `milestones/` — GET, POST; `milestones/[milestoneId]/` — PUT, DELETE
- `notes/` — GET, POST; `notes/[noteId]/` — PUT, DELETE
- `assets/` — GET, POST; `assets/[assetId]/` — PUT, DELETE
- `integrations/` — GET, POST, DELETE project integration links
- `timeline/` — GET, POST entries
- `coach/` — POST AI coaching actions

**Settings:**
- `categories/` — GET, POST; `categories/[id]/` — PUT, DELETE
- `statuses/` — GET, POST; `statuses/[id]/` — PUT, DELETE
- `integrations/` — GET, POST; `integrations/[id]/` — PUT, DELETE
- `templates/` — GET, POST; `templates/[templateId]/` — PUT, DELETE
- `custom-fields/` — GET, POST; `custom-fields/[id]/` — PUT, DELETE
- `review/` — GET (week data), POST (save review)

---

## Pages & Components

### Admin Integration
- `src/app/admin/page.tsx` — "The Ark" added to sidebar navItems with `href: '/admin/ark'`
- `src/app/admin/TabContent.tsx` — ArkTab registered as dynamic import
- `src/app/admin/layout.tsx` — QuickCapture FAB added globally
- `src/app/admin/tabs/ArkTab.tsx` — Morning Briefing (greeting, today, overdue, upcoming, project pulse)
- `src/app/admin/components/QuickCapture.tsx` — Floating + button, Cmd+K shortcut, task/note capture

### Ark Pages
| Route | File | Description |
|-------|------|-------------|
| `/admin/ark` | `ark/page.tsx` + `ArkDashboardClient.tsx` | Projects dashboard (Grid/List/Board views) |
| `/admin/ark/create` | `ark/create/` | 3-step project creation wizard |
| `/admin/ark/[projectId]` | `ark/[projectId]/` | Project detail with 7 sub-tabs |
| `/admin/ark/calendar` | `ark/calendar/` | Cross-project planner (Day/Week/Month + backlog) |
| `/admin/ark/review` | `ark/review/` | Weekly review ritual (4-step guided flow) |
| `/admin/ark/settings` | `ark/settings/` | Manage integrations, categories, statuses |

### Project Detail Sub-tabs
| Tab | Component | Features |
|-----|-----------|----------|
| Overview | `OverviewSection.tsx` | Charter, objectives, success criteria, tags — fully editable |
| Tasks | `TasksSection.tsx` | Task list with edit modal, milestone picker, inline dates |
| Milestones | `MilestonesSection.tsx` | Inline title edit, description, expand with child tasks |
| Notes | `NotesSection.tsx` | Grid of cards, categories, pinning, modal editor |
| Assets & Integrations | `AssetsIntegrationsSection.tsx` | Category grouping, edit modal, platform linking |
| Timeline | `TimelineSection.tsx` | Auto + manual activity log |
| Coach | `CoachSection.tsx` | AI coaching via DeepSeek (5 actions) |

### Shared Components
| Component | File | Purpose |
|-----------|------|---------|
| `ProjectHeader.tsx` | Header with inline title edit, status dropdown, progress ring |
| `ArkDensityContext.tsx` | UI density provider (S/M/L toggle) + CSS custom properties |
| `QuickCapture.tsx` | Global floating + button with task/note modal |

---

## Features

### Core CRUD
- Create/edit/delete projects, tasks, milestones, notes, assets
- User-defined categories, statuses, and integrations (nothing hardcoded)
- Sub-projects via `parent_project_id`

### Task Management
- **Edit modal** — click any task → full editing (title, description, status, priority, milestone, dates, tags)
- **Inline dates** — due_date (D) and scheduled_date (S) pickers on every row
- **Milestone picker** — assign tasks to milestones on create or edit
- **Overdue indicators** — red border + "Xd overdue" on past-due items
- **Status checkbox** — one-click mark done/reopen

### Milestone Management
- **Inline title editing** — click title to edit
- **Expand/collapse** — click arrow to see child tasks
- **Add task from milestone** — creates task with milestone_id pre-set
- **Description** — add/edit description in expanded view
- **Progress bar** — based on child task completion

### Project Overview (Fully Editable)
- **Edit mode toggle** — switch between view and edit
- **Editable fields:** title (inline in header), category, priority, dates, icon, color, charter, objectives, success criteria, tags

### Asset Management
- **Type suggestions:** working file, final, repurposable, source, reference
- **Category suggestions:** marketing, social, print, web, design
- **Grouped by category** with section headers
- **Edit modal** — click to edit any field
- **Integration tagging** — link assets to platforms
- **Inline integration creation** — create new platforms without leaving the page

### Calendar Planner (`/admin/ark/calendar`)
- **Three views:** Day, Week, Month
- **Backlog sidebar** — unscheduled tasks, drag onto calendar to schedule
- **Drag & drop** — between days to reschedule
- **`scheduled_date` vs `due_date`** — independent concepts (plan vs deadline)
- **Mark done from calendar** — checkbox on each task
- **Color-coded** by project category

### Morning Briefing (ArkTab)
- Time-aware greeting
- Today's scheduled tasks with checkboxes
- Overdue tasks (red section)
- Coming up (3-day lookahead + milestone deadlines)
- Active projects pulse (progress bars, next due task)
- Weekly stats (completed count)
- Friday prompt for weekly review

### Quick Capture
- **Floating + button** on ALL admin pages
- **Cmd+K** keyboard shortcut
- Task mode: title, project selector, due date, priority
- Note mode: title, content, project, category
- Stays open after submit for rapid entry

### AI Project Coach
- **5 actions:** Next Steps, Break Down, Summarize, Plan Week, Think Through
- Full project context sent to DeepSeek (charter, tasks, milestones, notes, timeline)
- Responses saveable to project timeline
- Free-form input for "Think through" and "Break down"

### Weekly Review (`/admin/ark/review`)
- **Step 1:** What Got Done (auto-populated + manual adds)
- **Step 2:** What's Stuck (overdue, blocked, stale projects)
- **Step 3:** Reflect (mood selector + free-form)
- **Step 4:** Plan Next Week (focus areas)
- Saved to `ark_reviews` table

### UI Density Toggle
- **S | M | L** buttons in top bar of every Ark page
- CSS custom properties cascade to ALL children
- Affects: text sizes, padding, gaps, card sizes, checkboxes, icons
- Persists in localStorage

### Settings (`/admin/ark/settings`)
- **Platforms tab:** Create/edit/delete integrations (name, icon, type, URL, color)
- **Categories tab:** Create/edit/delete project categories with color + icon
- **Statuses tab:** Create/edit/delete workflow statuses (color, scope, closed flag)

---

## Key Design Decisions

1. **Nothing hardcoded** — project types, statuses, note categories, asset types are all user-defined strings
2. **`due_date` vs `scheduled_date`** — separate concepts: deadline vs when you plan to work on it
3. **CSS-variable density** — one context sets `--ark-*` custom properties, all children respond automatically
4. **Integrations as a two-tier system** — define platforms globally once, link to projects with specific URLs/notes
5. **Timeline auto-logging** — status changes and task completions automatically create timeline entries
6. **AI via DeepSeek** — uses existing `src/lib/deepseek.ts` OpenAI SDK wrapper, project context built from all related data

---

## Git Commits

```
2feca8e feat(ark): add editing, settings page, and asset management
7f88e23 feat: add The Ark — project management system
```

---

## What's NOT Built Yet

- Template system UI (save project as template, create from template)
- Custom fields UI (define per-category, render in overview)
- Archive/completion ritual flow
- Drag-to-reorder tasks and milestones
- R2 file upload for assets (currently URL/link only)
- URL auto-detection (paste URL → suggest integration)
- Cross-project search
- Bulk actions (multi-select, batch update)
- AI weekly progress summaries
- AI archive retrospective
- Task dependencies visualization
- Gantt/timeline view
