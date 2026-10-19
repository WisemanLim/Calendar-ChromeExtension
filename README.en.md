# Wise Calendar — Chrome Extension

[한국어](README.md) · PRD: [.docs/PRD.md](.docs/PRD.md)

A Manifest V3 port of the **Wise Calendar** iOS/Android planner for desktop Chrome.
It keeps the big-date hero screen and the planner-mode **template entry (medication · appointment · fixed/repeat) with repeat cycles (daily · weekly · yearly)**.
Ported from the iOS sources (`Calendar-iOS/Calendar/*.swift`). The UI text is Korean, as in the app.

## Features

| Area | Details |
|------|---------|
| Main | `⚙ ⇥ / [Today] ‹ year › / ⌕ ＋` · `‹ MONTH YEAR ›` · week strip (weather or emoji) · big-date hero (rainbow colour by event count) · lunar date and daily high · schedule list · two mini months |
| Gestures | Drag the hero left/right = next/previous day · double-click = add · long-press 0.6 s = one-time input mode · drag the week strip = ±7 days · drag the mini months = change month · pull down = refresh |
| Planner modes | Diary (full screen, elapsed timer, start/end recorded automatically) · Work events (to-do checklist with due date; meeting, seminar, team dinner) · Personal events (medication, appointment, fixed/repeat) |
| Templates | The 15 iOS `templates.v3` seeds · title patterns `yyyy-mm-dd` `yyyy/mm/dd` `yy-mm-dd` `yyyy.mm.dd` `dd-mm-yyyy` `d###` are substituted on save |
| Repeat | Daily / weekly (weekdays) / yearly with start and end dates · **individual registration** (default ON: one event per day) · medication/fixed titles without a date pattern repeat yearly automatically |
| Event actions | Click = edit (changing the start keeps the original duration) · right-click or long-press = copy / repeat-copy (with or without notes) / delete · search (−1 to +2 years) |
| Storage | **Local** by default (`chrome.storage.local`) · optional **Google Calendar** sync in Settings |
| Other | Reminders (09:00 on the event day, `chrome.alarms`) · weather (Open-Meteo + location) · medication photo · dark/light · 4-step onboarding · support pages · side panel |

## Install (developer mode)

1. Open `chrome://extensions` and turn on **Developer mode**
2. **Load unpacked** → select this folder (`Calendar-ChromeExtension`)
3. Pin Wise Calendar from the puzzle icon. Clicking it opens the popup; the **⇥** button opens the side panel.

Store package: `make package` → `dist/wise-calendar-<version>.zip`

## Google Calendar sync (optional)

Settings (⚙) → 캘린더 연동 → **Google Calendar** opens the sync screen. It shows the account signed in to Chrome, the permissions requested (`calendar.events`, `calendar.readonly`) and a `[request permission as <account>]` button that opens Google's consent screen for that account.

Google requires an OAuth client per app (one-time setup). Either:

- **B) Paste a client ID in the sync screen (no manifest edit, recommended)** — enable the Google Calendar API, configure the consent screen (add your account as a test user while in testing), create an OAuth client of type **Web application** with the redirect URI shown on the screen (`https://<extension-id>.chromiumapp.org/`), then paste the client ID and request permission. The signed-in account is pre-selected (`login_hint`).
- **A) Chrome-extension client in the manifest** — pin the extension ID with `"key"`, create a client of type **Chrome extension**, and replace `oauth2.client_id`. Permission is then requested with `getAuthToken` for the Chrome account.

Without a client ID the screen shows these steps with copy buttons for the extension ID and redirect URI instead of an error. New events go to the primary calendar; local events are not migrated.

## Permissions

| Permission | Why |
|------------|-----|
| `storage`, `unlimitedStorage` | Settings, templates, local events, photos |
| `alarms`, `notifications` | 09:00 reminders |
| `sidePanel` | Side panel |
| `identity`, `identity.email` | Google permission request, show the signed-in account (sync only) |
| `geolocation` | Location for weather |
| hosts `api.open-meteo.com`, `www.googleapis.com` | Weather, Google Calendar API |

## Layout

```
manifest.json  app.html (popup + ?view=panel)  background.js (alarms → notifications)
css/app.css    icons/
js/main.js            bootstrap: load → onboarding → main view
js/core/              pure logic ported from iOS (calendar grid, title patterns, todo encoding,
                      templates, recurrence + RRULE, editor save plan, colours/lunar/weather codes)
js/platform/          storage, settings, templates, event store (month cache), local & Google
                      calendar adapters, images, weather, notifications
js/ui/                calendar view, editor, edit/copy/search sheets, settings, support, onboarding
test/unit/            node --test (49)
test/e2e/run.mjs      Playwright with the real unpacked extension (35)
test/impl/<N>/        per-epic scenario, result and logs
```

## Storage keys (same names as the iOS UserDefaults keys)

`settings.plannerMode` (default `todo`) · `settings.notificationsEnabled` · `settings.onboardingCompleted` · `settings.lastSeenVersion` ·
`settings.appColorScheme` · `settings.storageMode` · `settings.enabledCalendarIDs` · `templates.v3` · `events.local.v1` ·
`eventImage.<id>` · `wc.eventCountCache` · `wc.dailyWeather` · `wc.dailyTemperature` · `wc.lastFetchDate` · `wc-remind:<uuid>`

## Development and tests

```bash
make test      # unit tests (Node 20+, no dependencies)
make lint      # manifest JSON + JS syntax
make package   # dist/*.zip
```

E2E (optional). Playwright is not a project dependency; install it elsewhere and pass its path:

```bash
mkdir -p /tmp/pw && cd /tmp/pw && npm i playwright && npx playwright install chromium
cd <this folder>
PLAYWRIGHT=/tmp/pw/node_modules/playwright node test/e2e/run.mjs test/e2e/out
# add CHROMIUM_PATH=<binary> to use an existing Chromium
```

### Results (2026-10-19)

| Run | Epic | Tests | Verdict |
|-----|------|-------|---------|
| impl/1 | Pure logic port | unit 25 (KST and EST) | PASS |
| impl/2 | Storage layer and editor save plan | unit 16 | PASS |
| impl/3 | Main calendar UI | E2E 12 | PASS* |
| impl/4 | Event editors | E2E 8 | PASS* |
| impl/5 | Edit, copy, delete, search | E2E 5 | PASS* |
| impl/6 | Settings, onboarding, support, side panel | E2E 7 | PASS* |
| impl/7 | Reminders and weather | unit 3 + E2E 2 | PASS* |
| impl/8 | Google Calendar sync | unit 5 + E2E 1 | PASS* (mocked; a real account needs a client ID and was not tested) |

\* The full 35/35 E2E pass ran **before** the last changes (month-load generation check, immediate theme apply, test sync waits).
After those changes the unit tests pass 49/49; the E2E rerun was slowed by system load and stopped at 11/35 (all passing). Rerun `make e2e` to confirm.

## Troubleshooting (problems hit during implementation)

- **Sheets and onboarding vanished on re-render** — the main view redrew all of `#app`, including overlays → the main view now renders into its own `.main-host`.
- **Photos missing on recurring events** — occurrence ids (`master@date`) were looked up → fall back to the master id, matching the iOS shared identifier.
- **Google sync error / hang** — `getAuthToken` with the placeholder client ID → client ID check, a consent screen for the signed-in account, and a client ID field in Settings (`launchWebAuthFlow`).
- **Month-load race** — a load started before a refresh could write stale data → loads from an older invalidation generation are discarded.
- **E2E browser "crash"** — an outer `timeout` sent SIGTERM and Playwright closed the browser → no wrapper, and a Chromium build matching Playwright.

## Differences from iOS

- Open-Meteo only (no WeatherKit). Weather refreshes once a day; pull down to refresh now.
- File picker or drag-and-drop instead of the camera.
- Reminders show only while Chrome runs and the OS allows Chrome notifications.
- Local data lives in one browser profile with no sync; use Google sync to share across devices.
