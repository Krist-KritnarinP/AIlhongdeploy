# Deploy frontend to Vercel from GitHub Actions

`.github/workflows/deploy.yml` builds and deploys **the frontend only** to Vercel Production on every push to `main`. It uses Vercel CLI's pull → build → prebuilt deploy flow. The API and database are not deployed by this workflow.

## Connect the Vercel project

1. Create a Vercel project connected to `Krist-KritnarinP/AIlhongdeploy`. Set **Root Directory** to `frontend` and use the production domain assigned by Vercel.
2. In Vercel Project Settings → Environment Variables, set `VITE_API_URL` to the reachable API base URL including `/api` (for example `https://api.example.com/api`) for Production, then redeploy. This value is bundled into browser JavaScript and is public; never put credentials or private keys in any `VITE_*` variable.
3. If GitHub Actions is the deployment owner, disable Vercel's automatic Git deployments for this project to avoid duplicate deployments.
4. In the Vercel project settings/token page, create a token with the narrowest access that can deploy this project. Obtain the Vercel Team/Account ID and Project ID from the linked project (or from `.vercel/project.json` after `vercel link`).
5. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and add these three secrets:

   - `VERCEL_TOKEN`: the Vercel access token.
   - `VERCEL_ORG_ID`: the Vercel team ID or personal account ID.
   - `VERCEL_PROJECT_ID`: this frontend project's ID.

   Do not commit the token or `.vercel` credentials. The workflow reads them from GitHub Secrets and does not print them.
6. Push a commit to `main`, then open the repository's **Actions → Deploy frontend to Vercel** run. A successful run prints the Vercel deployment URL.

## API and authentication note

The Vercel deployment publishes only `frontend/`; it does not make the app fully usable until `VITE_API_URL` points to a deployed API. The existing refresh-session cookie is configured for same-site use (`SameSite=Lax`), so a frontend and API on different site domains may not support refresh/login correctly. For user testing, use a same-site API/domain arrangement and configure the API's `FRONTEND_URL`/CORS to the actual Vercel domain. Do not point this workflow at the production database for testing.
