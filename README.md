# G&E Safety Department — first working web version

Bilingual web application for construction safety observations. It uses Supabase Authentication, Postgres row level security, private photo storage, project membership, view receipts, corrective actions, Safety verification, and a print-ready daily report with photos.

## Setup

1. Create a Supabase project. In SQL Editor, run `supabase/schema.sql` once.
2. In Authentication, create the first user with a company email. Copy its user UUID. In SQL Editor insert `profiles` with the same UUID, email, name and role `admin`.
3. Insert a project into `projects`, then assign the admin's UUID in `project_members`. Add other users through Supabase Authentication, insert their profiles, and assign them to projects.
4. Copy `.env.example` to `.env` and fill in the project URL and **publishable/anon** key. Never put a service-role key in this app.
5. Run `npm install`, then `npm run dev`. Build with `npm run build`.

This release focuses on observations. The PDF button opens the browser's Save as PDF dialog, and photos use signed URLs. Role enforcement is in SQL, not only in the interface. Admin team management, JHA, incidents, and mobile packaging are subsequent modules. Do not enter real jobsite data until authentication, membership, and storage policies have been validated in the configured Supabase project.
