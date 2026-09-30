# Gemini writing proposals

Create a Gemini API key for a Google AI Studio project whose Billing Tier is Free Tier. Do not enable billing if you want to stay on the free tier: a key connected to a paid project can generate charges. The application cannot determine the key's billing tier. Google controls model availability and quotas and may use free-tier input/output to improve its products; avoid confidential text.

Set GEMINI_API_KEY in Supabase Edge Function secrets. Never put it in Vite variables or browser code. This function uses gemini-3.5-flash-lite through generateContent, with no OpenAI fallback, no automatic retries and no paid upgrade. Quota errors leave the original note unchanged.

Apply ../../ai-writing-limit.sql and deploy improve-writing with gateway JWT verification disabled: the handler verifies the bearer token through auth.getUser, checks project access for project notes (the authenticated user's profile biography is supported without a project, with a 500-character proposal limit), and reserves one of 30 requests per user per UTC day. This app limit does not guarantee availability within Google's project-wide quota. GET returns only readiness; POST action=status requires authentication. Readiness indicates a configured key, not a validated key or billing tier.

The interface preserves original notes in operational drafts, requires review and explicit acceptance, supports restoration, and has a browser-local Settings switch. No note content or credentials are logged. Setting a secret does not require redeployment. Provider requests remain untested until the owner supplies a valid key.

Writing controls cover editable note/comment textareas throughout the application, plus marked short finding and description inputs. Rebuilt checklists receive the controls automatically. Original metadata for note inputs is included in operational drafts and cleared when the form resets.
