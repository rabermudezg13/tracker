# Daily Talent Tracker

A responsive, installable recruiter productivity tracker designed around current Apple Human Interface Guidelines principles: clear hierarchy, familiar controls, generous touch targets, restrained color, system typography, adaptive light/dark appearance, reduced-motion support, and modal sheets for focused tasks.

## Included

- Persistent daily checklist saved in `localStorage`
- Built-in actions:
  - Badges
  - Upload Drug Test
  - Activate Talents
  - Call Talents
  - Text Talents
  - Check Email
  - Send Welcome Email
- Count goals for measurable actions
- Monthly calendar with complete/in-progress indicators
- Monthly KPI dashboard
- Achievement badges
- Add custom actions for today or every workday
- Export/import JSON backups
- Responsive iPad, desktop, and mobile layouts
- Light/dark mode via system appearance
- Reduced-motion accessibility support
- Installable PWA support

## Run locally

From this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Persistence

Version 1 stores data on the current device using `localStorage`. Export backups from the app to protect your history. A later Firebase layer can sync the same data model across devices.
