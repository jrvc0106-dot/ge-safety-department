# G&E Safety Department — first working web version

Bilingual web application for construction safety observations. It uses Supabase Authentication, Postgres row level security, private photo storage, project membership, view receipts, corrective actions, Safety verification, and a print-ready daily report with photos.

## Setup

1. Create a Supabase project. In SQL Editor, run `supabase/schema.sql` once.
2. Create the first account from the app using a `@geflcontractors.com` company email and confirm it by email. The database trigger creates its worker profile. In Supabase Authentication, copy that user UUID and run `update public.profiles set role = 'admin' where id = 'USER_UUID';` in SQL Editor. This is the one-time admin bootstrap step.
3. Sign in as admin. Create projects and assign members on **Projects & team**. Additional team members with `@geflcontractors.com` addresses can create accounts; they see no project data until the admin assigns them. If self-registration is not desired, disable public signups and invite users from Supabase Authentication.
4. Copy `.env.example` to `.env` and fill in the project URL and **publishable/anon** key. Never put a service-role key in this app.
5. Run `npm install`, then `npm run dev`. Build with `npm run build`.

This release focuses on observations and basic project/member administration. The PDF button opens the browser's Save as PDF dialog, and photos use signed URLs. Role enforcement is in SQL, not only in the interface. Admin team management, JHA, incidents, and mobile packaging are subsequent modules. Do not enter real jobsite data until authentication, membership, and storage policies have been validated in the configured Supabase project.
