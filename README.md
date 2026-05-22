# RELAY — Real-time Chat

A real-time multi-room chat app built with React + Supabase.

## Features
- Multiple rooms (#general, #random, #dev, #design, #announcements)
- Live messages via Supabase Realtime (Postgres Changes)
- Typing indicators via Supabase Broadcast
- Online presence via Supabase Presence
- Message persistence in Postgres

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase-setup.sql`
3. Go to **Database → Replication** and ensure `messages` table is added to `supabase_realtime` publication

### 2. Environment
```bash
cp .env.example .env
```
Fill in your Supabase project URL and anon key from **Project Settings → API**.

### 3. Run
```bash
npm install
npm run dev
```

### 4. Deploy
```bash
npm run build
# Deploy the dist/ folder to Netlify / Vercel / Cloudflare Pages
```
Set the two env vars in your hosting platform's dashboard.

## Stack
- React 18 + Vite
- Supabase (Realtime, Presence, Postgres)
- No other dependencies
