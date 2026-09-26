# Google sign-in and password reset

These features are implemented but stay unavailable until their credentials and database migration are configured. Never commit real OAuth or SMTP secrets.

## Checklist to enable Google login

- [ ] In Google Cloud Console, create/select a project and configure the OAuth consent screen for **External** access. While the app is in Testing, add each tester's Google account under Test users; publish the consent screen when ready for broader use.
- [ ] Create an OAuth Client ID of type **Web application**. Add the exact frontend origins under Authorized JavaScript origins (for example, the Vercel production URL and `http://localhost:5173` for local testing). No wildcard and no URL path.
- [ ] Copy the Web Client ID (ends with `.apps.googleusercontent.com`) into Vercel's `VITE_GOOGLE_CLIENT_ID` environment variable for the environments you deploy, then redeploy/rebuild the frontend.
- [ ] Set the same value as `GOOGLE_CLIENT_ID` in the Render API service environment and redeploy the backend.
- [ ] Verify backend `FRONTEND_URL` is the exact deployed frontend origin, with no trailing slash; it must match the origin allowed by CORS/session checks.
- [ ] Back up the target database, then run the auth migration once with the migration/owner database credential: `npm run migrate:auth --prefix backend`. Never use the runtime URL if it lacks DDL privileges.
- [ ] Test a new Google account, an existing account with the same verified email, logout, then login again. Confirm a Google login failure is not leaving a partial session.
- [ ] If the Google consent screen remains in Testing, make sure every friend/customer tester is listed as a test user. Do not share client secrets or database credentials.

The Google Client ID is a public identifier used in browser code; the OAuth **Client Secret** is not needed for this GIS ID-token flow and must not be put in frontend settings or chat.

## Apply the database migration

Back up the target database first. With the migration/owner database URL configured as `DIRECT_URL` (or `DATABASE_URL`), run from the repository root:

```sh
npm run migrate:auth --prefix backend
```

This additive, repeatable migration adds `users.google_sub` and `password_reset_tokens`; it does not delete existing users or trips. The application runtime role needs the migration's grants/policy. Run it separately for each environment before deploying the matching backend.

## Google sign-in

1. In Google Cloud Console, create a Web OAuth client ID and add the deployed frontend origin to **Authorized JavaScript origins** (for local development, `http://localhost:5173`). Do not add a wildcard or URL path.
2. Set the same client ID in both places:
   - Frontend build environment: `VITE_GOOGLE_CLIENT_ID`
   - Backend runtime environment: `GOOGLE_CLIENT_ID`
3. For Vercel, set `VITE_GOOGLE_CLIENT_ID` in Project Settings → Environment Variables, then rebuild. For Render static sites, set it in the site's environment variables and redeploy. Set backend `GOOGLE_CLIENT_ID` on the API service.

The browser uses Google's Identity Services button and sends its ID credential to the backend. The backend verifies the signature, issuer and audience against Google's keys and the configured client ID. Only Google-verified email addresses are accepted. A verified Google email matching an existing account links to that account. Users created with Google can use **Forgot password** to set a local password later.

## Password reset email

Configure all of these backend runtime variables together:

```text
SMTP_HOST=<provider SMTP host>
SMTP_PORT=587
SMTP_USER=<SMTP username>
SMTP_PASS=<SMTP password or provider token>
SMTP_FROM=<verified sender address>
```

Use the SMTP credentials from a transactional email provider with a verified sender/domain. Keep `SMTP_PASS` only in the hosting provider's secret/environment-variable UI. Port 587 uses STARTTLS; port 465 uses implicit TLS. When SMTP is unset the reset endpoint remains disabled and does not reveal whether an email belongs to an account.

Reset links are single-use, expire after 30 minutes, and the database stores only a SHA-256 hash of the random token. Completing a reset changes the password, invalidates existing refresh sessions, and requires signing in again.

## Local development

Copy the relevant `.env.example` values into ignored local env files. Add `http://localhost:5173` as an authorized Google JavaScript origin. For password-reset testing, use a real SMTP sandbox/test account; do not use production credentials or a production database.
