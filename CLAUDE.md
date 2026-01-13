# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Signal Manager is a DHIS2 application for managing SMS-based health signals. It uses React with TanStack Router/Query for routing and data management, Ant Design for UI, and Dexie for local IndexedDB storage.

## Development Commands

### Start Development Server
```bash
yarn start
# or
npm start
```
Runs the app in development mode with a proxy to `https://tests.dhis2.hispuganda.org/eidsr`. The app will be available at http://localhost:3000.

### Build for Production
```bash
yarn build
# or
npm build
```
Creates optimized production build in `build/` folder with deployable `.zip` in `build/bundle`.

### Run Tests
```bash
yarn test
# or
npm test
```
Runs all tests in `/src` directory.

### Deploy to DHIS2
```bash
yarn deploy
# or
npm deploy
```
Deploys built app to DHIS2 instance (requires prior build). Prompts for server URL and credentials.

## Architecture

### Core Technology Stack
- **DHIS2 Platform**: Built with `@dhis2/app-runtime` and `@dhis2/cli-app-scripts`
- **Routing**: TanStack Router with hash-based history
- **State Management**: TanStack Query for server state
- **Local Storage**: Dexie (IndexedDB) for offline data persistence
- **UI Framework**: Ant Design components
- **Validation**: Zod schemas for runtime type validation
- **TypeScript**: Strict mode enabled

### Data Flow Architecture

The app implements a **local-first data synchronization pattern**:

1. **DHIS2 API → TanStack Query → Dexie → UI**
   - Data fetched from DHIS2 via `useDataEngine`
   - Cached in TanStack Query
   - Persisted to Dexie IndexedDB for offline access
   - UI consumes local data via `useLiveQuery`

2. **Key Collections** (`src/collections.ts`):
   - `smsCollection`: Inbound SMS messages with auto-refresh (3s interval)
   - `signalsQueryOptions`: Event-based signals with pagination and filtering
   - `initialQueryOptions`: Program metadata and user organization units

3. **Local Database** (`src/db.ts`):
   - `events` table: Stores `EventWithValues` keyed by `event` ID
   - Indexed by `lastUpdated` for efficient sorting

### Router Architecture

Uses TanStack Router with **context-aware routing**:

```
RootRoute (layout + initial data loader)
├── IndexRoute (/)
├── SignalsRoute (/signals)
│   └── SignalsIndexRoute (index)
└── SMSRoute (/sms)
    └── SMSIndexRoute (index)
```

**Router Context** (`src/router.tsx`):
- `engine`: DHIS2 data engine injected from App.tsx
- `queryClient`: TanStack Query client
- Hash history for DHIS2 app compatibility

**Root Loader** (`src/routes/__root.tsx`):
- Fetches program stage metadata (Nnnqw1XKpZL)
- Resolves user's assigned districts based on org unit hierarchy
- Transforms program stage sections and data elements into Maps for efficient lookup

### Signal Workflow System

Signals follow a **progressive triage workflow** (`src/utils.ts:nextAction`):

```
Step 0 (Create) → Step 1 (Triage) → Step 2 (Verify) → Step 3 (Risk Assessment) → Archived
                       ↓                    ↓
                   Discard              Discard
```

**Workflow Logic**:
- Data element `RZMTtSyhdHY`: Triage decision (Relevant/Discard)
- Data element `FidiishnZJZ`: Verification decision (Alert/Discard)
- Data element `VaO1WnueBpu`: Risk assessment completion marker
- Data element `x84ZTtD0Z8u`: Risk level (Very High/High/Moderate/Low)

**Risk Level Colors** (`src/utils.ts:signalLevel`):
- Very High → crimson
- High → red
- Moderate → orange
- Low → yellow

### SMS-to-Event Integration

The app links SMS messages to DHIS2 events:

1. SMS messages fetched from `sms/inbound` API
2. Matched against tracker events using event ID = SMS ID
3. `forwarded` flag indicates if SMS has been processed into an event
4. Program stage `Nnnqw1XKpZL` represents signal events

### Data Transformation Patterns

**Event Data Values** (`src/collections.ts:signalsQueryOptions`):
- DHIS2 returns `dataValues` as array of `{dataElement, value}` objects
- Transformed to key-value pairs using `fromPairs`: `{[dataElement]: value}`
- Enables efficient lookup: `event.dataValues[dataElementId]`

**Organization Unit Resolution**:
- Fetches user's assigned org units from `/me` endpoint
- Traverses hierarchy to find all district-level (level 3) units
- For regional/national users, queries child units to build district list
- Results sorted alphabetically for UI display

### Type System

All data structures validated with Zod schemas (`src/types.ts`):
- `SMSSchema`: Inbound SMS structure
- `EventSchema`: DHIS2 event with array-based dataValues
- `EventWithValuesSchema`: Event with transformed key-value dataValues
- `ProgramStageSchema`: Metadata structure
- Runtime validation ensures type safety from API responses

### Infinite Scroll Pattern

Custom hook `useDexieInfiniteTableQuery` (`src/utils.ts`):
- Fetches paginated data from API via TanStack Query
- Stores results in Dexie table using `bulkPut`
- Returns live-updating local data via `useLiveQuery`
- Supports optional client-side filtering
- Handles next page logic and loading states

## Key Files

- `src/App.tsx`: Root component with providers (DHIS2, TanStack Query, Ant Design)
- `src/router.tsx`: Router configuration with hash history and context
- `src/collections.ts`: TanStack Query data fetching and caching logic
- `src/db.ts`: Dexie database schema
- `src/types.ts`: Zod schemas and TypeScript types
- `src/utils.ts`: Workflow logic, data hooks, helper functions
- `src/routes/__root.tsx`: Layout and initial data loading
- `src/routes/signals.tsx`: Signal management interface
- `src/routes/sms.tsx`: SMS message interface
- `src/components/signal-modal.tsx`: Signal creation/editing modal
- `d2.config.js`: DHIS2 app configuration

## Important Constants

- **Program Stage ID**: `Nnnqw1XKpZL` (hardcoded signal program stage)
- **District Level**: 3 (organization unit level for districts)
- **SMS Refetch Interval**: 3000ms (3 seconds)
- **Default Page Size**: 10 items

## Development Notes

- The app uses **hash-based routing** (`createHashHistory`) for DHIS2 compatibility
- TypeScript strict mode is enabled - all types must be explicit
- DHIS2 data engine is accessed via `useDataEngine` hook from `@dhis2/app-runtime`
- Local data persistence enables offline-first UX
- All date filtering uses `occurredAfter`/`occurredBefore` parameters on DHIS2 API
