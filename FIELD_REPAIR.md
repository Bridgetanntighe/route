# Field repair notes

## Asset versioning
- Live HTML loads `assets/styles.v2.css` + `outreach-core.js` + `assets/app.v2.js`
- Previous bundle retained as `assets/app.v1.js` and `assets/styles.v1.css`
- Root `app.js` / `styles.css` also retained as the v1 cache targets for any old HTML still requesting unversioned paths

## Legacy venue split
- Combined id `me-and-you-curious` was split into:
  - `me-and-you-productions`
  - `curious-pr`
- On load, any saved visit under `me-and-you-curious` is copied to `me-and-you-productions` (legacy key kept)

## Supabase
- Do **not** run anonymous open policies again
- Apply `migrations/001_secure_auth_and_places.sql` after review
- Enable Auth email magic link / OTP
- Insert team members into `outreach_members` via SQL (not from the app)
- Until members sign in, the app stays local-only
