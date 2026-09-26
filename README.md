# AIlhongdeploy

AI LHOUNG travel planner — React/Vite frontend, Express/Prisma/PostgreSQL API.

เก็บทั้งระบบใน **GitHub repo เดียว** โดยตั้ง Root Directory ของแต่ละ hosting service แยกกัน:

| Folder | หน้าที่ | Deploy |
| --- | --- | --- |
| `frontend/` | เว็บ React และแผนที่ Leaflet | Vercel / static hosting |
| `backend/` | API, authentication, Gemini, PostgreSQL | Node hosting เช่น Render / Railway |

หนึ่ง repository ใช้ได้ แต่ frontend และ backend ยังเป็นคนละ service ส่วน database อยู่ Supabase/PostgreSQL

## Run locally

ใช้ Node.js 22.12+ และ npm พร้อม PostgreSQL ที่เข้าถึงได้

```sh
npm run setup
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

ใส่ค่าจริงใน `.env` ของแต่ละฝั่ง (ห้าม commit) แล้วเปิดสอง terminal:

```sh
npm run dev:backend
```

```sh
npm run dev:frontend
```

Frontend: http://localhost:5173 — API: http://localhost:8899/api

## Database setup

ฐานข้อมูลเดิมของโปรเจกต์ได้รับ security migration และ runtime role แล้ว ไม่ต้องสร้าง role ซ้ำ ส่วน `.env` จริงยังอยู่ในโฟลเดอร์ต้นฉบับบนเครื่อง ไม่ถูกคัดลอกมาเผยแพร่ ให้ตั้งค่าจากนั้นในเครื่อง/secret manager โดยไม่ใส่ลง GitHub

สำหรับ **ฐานข้อมูลใหม่ที่ว่างเท่านั้น** รันใน `backend/` หลังตั้ง owner `DIRECT_URL` และ `DATABASE_URL`:

```sh
npx prisma db push
npm run migrate:security
npm run migrate:phase0
npx prisma generate
npm run security:runtime-role
```

สำหรับ **ฐานข้อมูลเดิมที่ยังไม่ได้อัปเกรด** สำรองข้อมูลและตรวจ schema ก่อน แล้วรัน `npm run migrate:security`, `npm run migrate:phase0` และ `npx prisma generate` ห้ามใช้ `db push` แทน migration โดยไม่ตรวจผลกระทบ

`security:runtime-role` เป็นงานผู้ดูแลแบบรันครั้งเดียว: สร้าง role `ailhoung_runtime`, ตรวจสิทธิ์, เขียน DATABASE_URL และ JWT_SECRET ใหม่ลง `.env` โดยไม่พิมพ์ secret; เก็บ DIRECT_URL เฉพาะเครื่องผู้ดูแล/migration job ไม่ต้องใส่ใน runtime hosting. สคริปต์จะปฏิเสธถ้า role มีอยู่แล้ว

## Deploy from this single repo

1. **API service:** Root Directory = `backend`; install/build = `npm ci && npx prisma generate`; start = `npm start`. Build ต้องติดตั้ง devDependencies เพื่อใช้ Prisma CLI; ไม่มี migration อัตโนมัติขณะ start
2. ตั้ง `NODE_ENV=production`, `APP_ENV=production` (หรือ `staging`), `DATABASE_URL` ของ runtime role, `JWT_SECRET` สุ่มอย่างน้อย 32 bytes, `GEMINI_API_KEY`, `GEMINI_MODEL` ที่บัญชีรองรับ และ `FRONTEND_URL=https://<your-web-domain>` ตั้ง `TRUST_PROXY_HOPS` ตาม proxy จริง ห้ามเดาจำนวน hop. Hosting กำหนด `PORT` ได้
3. **Frontend:** Root Directory = `frontend`; install = `npm ci`; build = `npm run build`; output = `dist`. ตั้ง `VITE_API_URL=https://<your-api-domain>/api` ก่อน build; ไม่ใส่ JWT/Gemini/database secret ในตัวแปร `VITE_*`
4. ตั้ง `VITE_GEOCODE_URL` หากมี Photon provider ของตัวเอง ค่าเริ่มต้นเป็น public demo ที่ไม่มี SLA. `vercel.json` และ `public/_headers` เตรียม security headers; `_redirects` เตรียม SPA fallback สำหรับโฮสต์ที่รองรับ ต้องตรวจ headers จริงหลัง deploy
5. รัน security migration ด้วย migration credential ก่อนเปิด API เวอร์ชันใหม่ แล้วตรวจ register/login, CRUD, การแชร์, แผนที่, CORS/HTTPS และ backup/restore บน environment เป้าหมาย

Frontend CSP `connect-src https:` ยังเปิดกว้างเพื่อรองรับ API domain ที่ยังไม่ระบุ ควรจำกัดเป็น API/geocoder ที่ใช้งานจริงหลังทราบ domain. Header configuration ต้องทดสอบกับ hosting ที่เลือก

## Verification

```sh
npm test
npm run build
# Runs against the configured real database, creates/removes temporary test users:
npm run test:security:integration --prefix backend
```

ผลล่าสุด: unit tests 11 ผ่าน, real database security integration ผ่าน, production build ผ่าน และ Chromium desktop/mobile smoke ผ่าน. รายละเอียดและข้อจำกัดอยู่ใน [HANDOVER.md](HANDOVER.md)

Token ยังเก็บใน localStorage; ยังไม่มี email verification/password recovery/breached-password blocklist. IP limiter ใช้ memory ต่อ process; multi-instance ควรใช้ shared store. AI quota เก็บใน database แล้ว. งานนี้ไม่ได้เปิด hosting จริงหรือรับรอง production infrastructure

อ่านต่อ: [Security review](frontend/SECURITY_REVIEW.md) · [Detailed handover](frontend/HANDOVER.md) · [แผนบทบาท Admin](ADMIN_PLAN.md)


## Phase 0 update

เพิ่ม CI, health checks, optional Sentry reporting, controlled Gemini fallback, rotating HttpOnly refresh sessions และ self-service export/delete account แล้ว ต้องรัน `npm run migrate:phase0 --prefix backend` ด้วย migration credential **ก่อน** deploy API รุ่นนี้

Access token อายุ 15 นาที; refresh สูงสุด 7 วันและถูกเพิกถอนเมื่อเปลี่ยนรหัสผ่าน/logout. ตรวจ SameSite/Origin กับโดเมนจริงตาม [Phase 0 operations](docs/PHASE0_OPERATIONS.md)

ผู้ใช้ขอพักส่วนข้อมูลผู้ให้บริการ/กฎหมาย/โดเมน/monitoring จริงไว้ก่อน รายการเหล่านี้และ backup restore/budget alerts ยังไม่เสร็จ ดู [ROADMAP](frontend/ROADMAP.md) สำหรับสถานะล่าสุด ไม่ถือว่า Phase 0 ผ่านเกณฑ์เปิด public ทั้งหมด


## Share a staging test link

Use the button to create the Render services in your own Render account. Review the two services and configure the separate staging database before approving deployment:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Krist-KritnarinP/AIlhongdeploy)

The frontend URL will be `https://ailhongdeploy-kritnarinp-test-web.onrender.com` once Render successfully creates and deploys it. It currently returns Not Found because the services have not been created yet. Follow [the staging setup steps](docs/DEPLOY_TEST_LINK.md); do not put production database credentials or secrets in GitHub.

## Automatic Vercel deployment

The GitHub Actions workflow in `.github/workflows/deploy.yml` builds and deploys the **frontend** to Vercel Production on each push to `main`. Configure the required GitHub Secrets and Vercel project using [the Vercel deployment guide](docs/VERCEL_DEPLOY.md). The API/database are separate; the frontend needs a public `VITE_API_URL` pointing to the deployed API.
