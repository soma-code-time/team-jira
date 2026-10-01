# Team Jira — Angular + Supabase

A lightweight Jira-style board for a small team.

## Stack
- Angular 18
- Supabase Database
- Supabase Realtime
- Vercel or Netlify for hosting

## 1. Create Supabase project
Create a free Supabase project, then open SQL Editor and run `supabase.sql`.

## 2. Configure the app
Copy `.env.example` to `.env` and set:
- SUPABASE_URL
- SUPABASE_ANON_KEY

For Vercel, add these as Environment Variables.

## 3. Local run
```bash
npm install
npm start
```

## 4. Deploy
Push this folder to GitHub, import the repo into Vercel, add the two environment variables, and deploy.

The app uses Supabase Realtime, so task changes are shared with all open browsers without redeploying the UI.
