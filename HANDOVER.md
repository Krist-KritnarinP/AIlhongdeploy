# Handover — 2026-09-26

## Phase 0 — implementation update (2026-09-26)

ทำงานใน worktree/branch `codex/phase0-production` เพื่อไม่ทับงาน agent อื่น ผู้ใช้ยืนยันภายหลังว่ายังไม่มี agent อื่นรับส่วนงาน รายละเอียดการเปิดใช้งานอยู่ใน [docs/PHASE0_OPERATIONS.md](docs/PHASE0_OPERATIONS.md) และสถานะรายข้ออยู่ใน [frontend/ROADMAP.md](frontend/ROADMAP.md)

งานโค้ดที่เพิ่ม:
- GitHub Actions: frontend/backend tests, build, Prisma validate/generate, PostgreSQL HTTP integration และรัน migration ซ้ำ
- Access JWT 15 นาที + refresh token แบบ HttpOnly อายุ 7 วัน, เก็บ hash ใน DB, หมุน token/ตรวจ reuse, Origin validation และ frontend single-flight/Web Locks
- เปลี่ยนรหัสผ่าน/logout เพิกถอน refresh ด้วย tokenVersion; หน้าโปรไฟล์เพิ่ม export JSON และยืนยันรหัสผ่านก่อนลบบัญชีพร้อม cascade
- Gemini ใช้ model config ชัดเจน มี optional fallback เฉพาะ 404/503 ไม่เกินสอง provider attempts โดยคิด quota ทุกครั้ง; เพิ่ม AI_ENABLED สำหรับหยุดใช้งาน
- Liveness/readiness, optional Sentry แบบ allowlist ไม่ส่งข้อมูลส่วนตัว, config validation และงาน cleanup refresh sessions

ผลตรวจรอบนี้:
- Unit tests **19 ผ่าน** (frontend 6 + backend 13), production build และ Prisma validate/generate ผ่าน
- HTTP security integration เดิมและ Phase 0 integration ผ่านบน PostgreSQL 17 ชั่วคราว ไม่เรียก AI provider
- ทดสอบอัปเกรดจาก Prisma schema ของ commit ebd9f60 และ migration ซ้ำผ่าน; ทดสอบ refresh/export/delete/password/logout ด้วย runtime role ที่ไม่ใช่เจ้าของ DB และเปิด RLS ผ่าน
- Chromium mobile smoke ผ่าน: 401 ต่ออายุ token อัตโนมัติหนึ่งครั้ง, ดาวน์โหลด JSON, ต้องกดยืนยันก่อนลบบัญชี, ไม่มี horizontal overflow/page errors (API จำลอง; HTTP/DB จริงตรวจแยก)
- Frontend lint exit 0 มี warnings เดิม 8 รายการ ไม่ใช่ lint-clean ทั้งหมด
- npm install รายงาน dependency audit 0 vulnerabilities หลังเพิ่ม Sentry; ไม่ใช่การรับรอง penetration test

**ก่อน deploy:** ต้องรัน `npm run migrate:phase0 --prefix backend` ด้วย migration credential หลังยืนยัน backup แล้ว ตั้ง APP_ENV และ REFRESH_COOKIE_SAME_SITE ให้ถูกกับ domain และตั้ง scheduled cleanup. รอบนี้ **ไม่ได้เปลี่ยนฐานข้อมูล Supabase จริงและไม่ได้ deploy/push**

**งานค้างตามคำขอผู้ใช้:** ชื่อ/อีเมลผู้ให้บริการ, Privacy/Terms/consent ที่ตรวจแล้ว, staging/production domains/resources, Sentry/uptime ปลายทางจริง, Supabase backup/PITR + restore drill, Google budget alerts และตรวจ availability ของ Gemini models จริง จึงยังไม่ติ๊ก Phase 0 ว่าพร้อมเปิด public ทั้งหมด

ข้อจำกัด: access token ยังอยู่ใน localStorage; refresh แบบ cross-site อาจถูก browser บล็อก; retry refresh token ที่ใช้ไปแล้วจะเพิกถอนทุก session ของบัญชี; export/delete ครอบคลุมฐานข้อมูล live ไม่ได้ลบสำเนา backups/provider logs โดยอัตโนมัติ


## อัปเดตเอกสาร: แผน Admin — 2026-09-26

- เพิ่ม [ADMIN_PLAN.md](ADMIN_PLAN.md) บันทึกความจำเป็น หน้าที่ ขอบเขตสิทธิ์ และแผนพัฒนา Admin รุ่นแรก
- เน้นการระงับบัญชี ดูการใช้/จัดการโควตา AI ปิด AI ชั่วคราว และ audit log
- ยังไม่ได้เพิ่ม role, schema, API หรือหน้าจอ Admin; เป็นงานเอกสารเท่านั้น
- ตรวจความสอดคล้องกับ schema/auth/AI quota ปัจจุบัน ลิงก์เอกสาร และ `git diff --check`; ไม่รัน application tests ซ้ำสำหรับการเพิ่มเอกสาร

## สถานะการส่งมอบโค้ดก่อนหน้า

โปรเจกต์รวมเป็น monorepo พร้อม frontend/backend แยกโฟลเดอร์ ดู [README.md](README.md) สำหรับ setup และ deploy

เอกสารงานฉบับเต็มอยู่ที่ [frontend/HANDOVER.md](frontend/HANDOVER.md) และ [frontend/SECURITY_REVIEW.md](frontend/SECURITY_REVIEW.md) โดยหัวข้อท้ายสุดคือผลตรวจรอบล่าสุด ข้อความรุ่นเก่าถูกเก็บไว้เป็นประวัติ

การอ้างอิงโฟลเดอร์เดิมในเอกสารให้เทียบดังนี้:
- `PersonalProject_Front` → `frontend`
- `PersonalProject_API` → `backend`

แก้การรอ geocoder ทั้งชุดเป็น progressive pins พร้อม cache/dedup/cancellation; lazy-load routes; ลด blur และ animation; แก้ security ด้าน validation, ownership, password/session revocation, AI quota, error redaction และ runtime DB role

ฐานข้อมูลเดิมถูกอัปเกรดแล้วและ JWT secret ถูกหมุนเวียน ผู้ใช้เดิมต้อง login ใหม่. Secret จริงยังอยู่ใน `.env` ของต้นฉบับ ไม่รวมใน repo นี้

ตรวจแล้ว: frontend 4 tests, backend 7 tests, real database integration, production build และ Chromium desktop/mobile smoke. ยังไม่ได้ deploy hosting หรือทดสอบ live geocoder/tile latency, backup restore และ production proxy

ต้นฉบับทั้งสอง repository ยังอยู่ครบพร้อมประวัติ Git. Repo นี้เริ่มประวัติใหม่จาก snapshot ของโค้ดที่แก้แล้ว

ตรวจ fresh install จาก lockfile ใน monorepo แล้ว: unit tests ทั้ง 11 ผ่านโดยไม่ต้องใช้ secret จริง, build และ Prisma schema validate ผ่าน. Dependency installation ในเครื่องตรวจใช้ npm ci --offline --ignore-scripts จาก cache; hosting ควรใช้ npm ci ตาม README


## Render staging setup prepared (2026-09-26)

- Added root `render.yaml`: free Singapore API/static services, API readiness, deploy only after GitHub checks pass, API reverse proxy under frontend `/api` (same-origin refresh cookies), SPA fallback, CSP/security headers, random JWT secret, Gemini disabled by default.
- Added [docs/DEPLOY_TEST_LINK.md](docs/DEPLOY_TEST_LINK.md) with secure setup order and Render Blueprint link; proposed frontend URL `https://ailhongdeploy-kritnarinp-test-web.onrender.com` is **not live/verified** until Blueprint creation, staging runtime DB config, migrations and healthy deployments complete.
- Push `main` สำเร็จแล้ว; ตรวจ SHA ของ remote ตรงกับ commit `f3fc8b548ba0d83359b52f99d28b8cb7c34baf11`. GitHub Actions run #2 ของ SHA นี้สำเร็จ (`https://github.com/Krist-KritnarinP/AIlhongdeploy/actions/runs/36225372453`). หลัง commit handover นี้จะมี workflow ใหม่สำหรับเอกสาร ให้ตรวจ run ล่าสุดก่อน Render deploy. `render.yaml` พร้อมให้ Blueprint อ่าน
- No database or Gemini secrets were found in Render/GitHub; staging requires a separate limited-role database URL entered directly in Render Dashboard, not sent in chat. Gemini begins disabled.
- Existing production/Supabase database was not touched. Render services not created; waiting for GitHub push/Blueprint sync and user-owned Render environment inputs is still required.

## Render Not Found clarification and deploy link (2026-09-26)

- Confirmed proposed app URL currently responds HTTP 404 because the Render services do not exist yet; it is not a live test site. Added the official Deploy to Render button to README to start the Blueprint in the user's Render account.
- Changed both Blueprint services to `autoDeployTrigger: off` following Render's Deploy Button guidance, so future pushes do not silently deploy into every tester's Render instance. Each owner redeploys from their own Render Dashboard.
- No Render service or database was created/modified. Still requires user's Render authorization and a separate migrated staging DB runtime URL; never use the production/Supabase credential.

## Vercel GitHub Actions deployment (2026-09-26)

- Added `.github/workflows/deploy.yml`: on every push to `main`, installs frontend dependencies, pulls Vercel production settings, builds with Vercel CLI and deploys the prebuilt frontend to Production. Job permissions are read-only for repo contents and deploys are serialized/cancelled per branch.
- Added [docs/VERCEL_DEPLOY.md](docs/VERCEL_DEPLOY.md) with instructions to create/link the Vercel frontend project, set `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` in GitHub Actions Secrets, configure `VITE_API_URL`, and inspect the Action's deployment URL. Updated root README.
- The workflow publishes frontend only; it does not provision API/database. A same-site API arrangement and actual staging environment remain prerequisites for working refresh-session authentication. No Vercel credentials were supplied or added to the repo.
