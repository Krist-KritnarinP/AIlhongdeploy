# ตั้งลิงก์ทดสอบจาก GitHub ด้วย Render

Blueprint นี้สร้าง **staging** แยกเป็น static frontend และ API ที่ Singapore ใช้แผน Free ไม่มีการต่อกับฐานข้อมูลจริงใน repo และปิด Gemini ไว้เป็นค่าเริ่มต้น ลิงก์ frontend ที่กำหนดไว้คือ:

`https://ailhongdeploy-kritnarinp-test-web.onrender.com`

API ใช้ route `/api/*` ที่ frontend proxy ไป backend ทำให้ browser ใช้ same-origin และ refresh cookie เป็น `SameSite=Lax` ได้ ไม่ต้องส่ง database/Gemini secret ไปฝั่ง browser

> URL ด้านบนเป็น URL ของเว็บหลัง deploy สำเร็จ ยังไม่ใช่เว็บที่เปิดใช้ได้ตอนนี้ หากเปิดก่อนสร้างบริการบน Render จะขึ้น Not Found

## สิ่งที่ต้องมี

- บัญชี GitHub ที่เข้าถึง repo `Krist-KritnarinP/AIlhongdeploy`
- บัญชี Render ที่เชื่อมสิทธิ์อ่าน repo นี้
- **staging database แยกจาก production** พร้อม role `ailhoung_runtime` ที่จำกัดสิทธิ์ตามคู่มือ root README; ห้ามนำ owner URL หรือ production `DATABASE_URL` มาใส่ช่องนี้
- Database ต้องผ่าน `npm run migrate:security` และ `npm run migrate:phase0` ด้วย migration credential ก่อนเริ่ม deploy; รัน `npx prisma generate` ด้วย

ไม่ต้องใส่ Gemini key; API เริ่มด้วย `AI_ENABLED=false` ปลอดภัยต่อค่าใช้จ่าย เปลี่ยนเป็น true ภายหลังได้เมื่อใส่ key ที่ผู้ดูแลควบคุมและตรวจรุ่นโมเดล/ค่าใช้จ่ายแล้ว

## ทำครั้งแรก

1. Push branch `main` ไป GitHub และตรวจว่า Actions workflow `Phase 0 checks` ผ่านก่อน Render deploy
2. กดปุ่ม [Deploy to Render](https://render.com/deploy?repo=https://github.com/Krist-KritnarinP/AIlhongdeploy) ใน README, เชื่อม GitHub หากระบบขอ และเลือก workspace ของคุณ ตรวจ service และแผนก่อนอนุมัติ Blueprint
3. กรอกเฉพาะ **runtime URL ของ staging role** ในช่อง `DATABASE_URL` ของ API service เป็น secret ใน Render Dashboard ไม่ต้องส่งค่าให้ Codex และห้ามวางใน GitHub variables, Blueprint หรือ browser `VITE_*`
4. ตรวจ Render environment ว่าค่าที่ระบบสร้าง/ตั้งไว้มี `JWT_SECRET` ที่ Render generate ให้, `APP_ENV=staging`, `FRONTEND_URL` ตรงกับ web service จริง, `TRUST_PROXY_HOPS=1`, `AI_ENABLED=false` และ `REFRESH_COOKIE_SAME_SITE=lax`
5. ถ้าใช้ staging DB ใหม่ ให้สร้าง schema และ security objects ด้วย migration credential **ก่อน** เปิด API; อย่ารัน migration ด้วย runtime role. หลัง migration ตรวจ role ต่อ `refresh_sessions` ได้โดยไม่มี schema CREATE
6. รอ deploy ทั้งสอง service เสร็จ ตรวจ API `/health/live`, `/health/ready`, ทดสอบสมัคร/login/refresh/logout, ทริป, share/revoke, geocoding และ browser cookie ที่ `onrender.com` ก่อนส่ง frontend URL ให้คนทดสอบ
7. ใส่ข้อมูลทดสอบเท่านั้น ลบ staging data เมื่อจบการทดสอบ

## ข้อจำกัดแผน Free

- Backend อาจพักเมื่อไม่มี traffic และตอบช้าตอนเริ่มใหม่; ไม่เหมาะกับ SLA หรือ production
- Render Free Postgres (ถ้าเลือกใช้แทน staging DB ภายนอก) มีอายุจำกัดตามนโยบาย Render; ตรวจวันหมดอายุ/backup ก่อนเก็บข้อมูลทดสอบ ห้ามใช้เป็นที่เก็บถาวร
- โค้ด/URL ของบริการยังไม่พิสูจน์จนกว่าจะผ่าน Blueprint sync, environment setup, migration และ deployment status; ติดตาม build/deploy ใน Render Dashboard
- ก่อนเปิด AI ต้องเลือก model IDs ที่บัญชี Gemini ใช้งานได้จริง ตั้ง API key เฉพาะ API service และคง quota; `GEMINI_API_KEY` ไม่ควรอยู่ใน repo หรือ frontend

Render Deploy Button services have auto-deploy disabled so pushes to this public repo do not deploy into every user's Render account. Redeploy from that account's Render Dashboard after reviewing updates. See [Render Deploy Button guidance](https://render.com/docs/deploy-to-render), [Blueprint](https://render.com/docs/blueprint-spec), [monorepo roots](https://render.com/docs/monorepo-support), [external rewrite behavior](https://render.com/docs/redirects-rewrites) and [Singapore region](https://render.com/docs/regions).
