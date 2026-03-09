# UX Visual Review Tool (MVP)

A lightweight internal tool for UX designers to compare design mockups with frontend implementation screenshots.

## What this MVP includes

- Create a review task with metadata (`task name`, `version`, `owner`)
- Upload design image + implementation screenshot
- Auto-generate a visual diff image using `pixelmatch`
- Detect difference regions and overlay them on the diff image
- Click a region and create an issue with:
  - `type`: layout / spacing / typography / color / missing element / overlap / text overflow
  - `severity`: high / medium / low
  - `description`
- Export review report in JSON or CSV

## Core pages

- `/tasks`: Task List (Page 1)
- `/create`: Create Task (Page 2)
- `/tasks/:id`: Review Result (Page 3)

## Tech stack

- Frontend: Next.js (App Router)
- Backend: Next.js Route Handlers (Node.js runtime)
- DB: SQLite (`better-sqlite3`)
- Image diff: `pixelmatch` + `pngjs` + `sharp`
- Automation helper: Playwright script

## Data model (SQLite)

### `tasks`
- `task_id`
- `task_name`
- `version`
- `owner`
- `created_at`

### `images`
- `image_id`
- `task_id`
- `type`
- `url`

### `issues`
- `issue_id`
- `task_id`
- `x`
- `y`
- `width`
- `height`
- `type`
- `severity`
- `description`
- `created_at`

## Local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API endpoints

- `GET /api/tasks`: list tasks
- `POST /api/tasks`: create task + upload images + generate diff
- `GET /api/tasks/:id`: review data
- `POST /api/tasks/:id/issues`: create issue
- `GET /api/tasks/:id/report?format=json|csv`: export report

## Playwright screenshot automation

Capture implementation screenshots from a running frontend URL:

```bash
npm run capture -- --url http://localhost:3000 --output public/uploads/captured-home.png --width 1440 --height 1080 --fullPage true
```

Use the captured image when creating a task.

## Notes for MVP

- Uploaded images are normalized to PNG.
- Implementation screenshot is resized to the design image dimensions for stable diffing.
- Difference regions are stored in `public/uploads/<task_id>/regions.json`.
- SQLite DB is stored at `data/review.db`.
