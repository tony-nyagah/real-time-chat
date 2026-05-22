# RELAY — Real-time Chat

A real-time multi-room chat app built with React 19 and Supabase, styled with a Neubrutalist design system.

![Login screen — bold yellow wordmark stamp on a graph-paper background]

## Features

- **Multi-room chat** — #general, #random, #dev, #design, #announcements
- **Live messages** — Supabase Postgres Changes listener fires on every INSERT with no custom DB trigger required
- **Optimistic updates** — your own messages appear instantly; the DB record swaps in silently on confirm, or rolls back on failure
- **Typing indicators** — broadcast over the room channel; auto-clear after 2.5 s of inactivity
- **Online presence** — per-room presence tracking shows who is currently connected
- **Message persistence** — last 100 messages per room fetched on join; stale fetches cancelled on room switch
- **Neubrutalist UI** — hard black borders, offset box-shadows, yellow accent, dot-grid texture, Space Grotesk font

## Stack

| Layer | Technology |
|---|---|
| UI | React 19 + Vite 8 |
| Realtime | Supabase Realtime (Postgres Changes + Broadcast + Presence) |
| Database | Supabase Postgres (with RLS) |
| Styling | Plain CSS — custom properties, no CSS framework |
| Font | [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) via Google Fonts |
| Runtime | Bun (or Node) |

## Project Structure

```
real-time-chat/
├── index.html          # Vite HTML entry point
├── main.jsx            # React DOM mount
├── App.jsx             # All app logic and UI
├── App.css             # Component styles (Neubrutalist)
├── index.css           # Design tokens, reset, base font
├── supabase.js         # Supabase client (reads from .env)
├── supabase-setup.sql  # One-time DB setup script
├── vite.config.js      # Vite + React plugin config
└── .env                # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
```

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run `supabase-setup.sql` — this creates the `messages` table, enables RLS, adds the necessary policies, and adds the table to the `supabase_realtime` publication

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in both values from **Project Settings → API**:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install and run

```bash
bun install
bun run dev
```

Or with npm: `npm install && npm run dev`

### 4. Deploy

```bash
bun run build
# deploy the dist/ folder to Netlify / Vercel / Cloudflare Pages
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in your hosting platform's dashboard.

## How Realtime Works

```
User types  →  broadcast "typing" event  →  other clients show indicator
User sends  →  optimistic local update
            →  INSERT into messages table
            →  postgres_changes fires for all room subscribers
            →  duplicate check by ID prevents double-render
```

The channel for each room carries all three Supabase realtime primitives on a single subscription:

- **Postgres Changes** (`INSERT` on `messages` filtered by `room`) — delivers new messages
- **Broadcast** (`typing` event) — delivers ephemeral typing signals
- **Presence** (`sync` event) — tracks who is online in the room

## Design

The UI uses a **Neubrutalist** design language:

- 3 px solid black borders on every interactive surface
- Hard offset box-shadows (no blur) — `4px 4px 0 #000`
- Buttons physically "stamp" down on `:active` via `translate` + shadow reduction
- Primary accent: `#FFE500` (yellow) — used for the sidebar header, your own message bubbles, active states, and the logo wordmark stamp
- Secondary accent: `#FF4D00` (orange-red) — used for your username and the `$` prompt
- Black (`#111`) sidebar with yellow header bar
- Dot-grid texture in the messages area
- Square dots for presence and typing indicators (no `border-radius`)
- All labels and buttons uppercase with tracked letter-spacing
