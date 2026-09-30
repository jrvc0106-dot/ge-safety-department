# Writing proposals

Set OPENAI_API_KEY in Supabase Edge Function secrets before enabling generation. Never place the key in Vite environment variables or client code. Optional OPENAI_WRITING_MODEL overrides the default pinned gpt-4.1-mini-2025-04-14 model.

Apply ../../ai-writing-limit.sql and deploy improve-writing with gateway JWT verification disabled: the handler explicitly verifies the bearer token through auth.getUser, checks project access, and reserves one of 30 daily requests per user before contacting OpenAI. GET returns only configuration readiness. POST action=status requires authentication.

The interface preserves original notes in operational drafts, offers an editable proposal, requires explicit acceptance, and supports restoring the original. The Settings switch controls visibility per browser. OpenAI requests use store:false; this does not override provider retention policies. No note text or credentials are logged by this function.
