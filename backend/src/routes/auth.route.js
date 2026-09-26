import express from 'express'
import { login, register } from '../controllers/auth.controller.js';

import { refresh } from '../controllers/refresh.controller.js';
import { requireRefreshOrigin } from '../security/refresh-session.js';

const authRoute = express.Router()

// สมัครสมาชิก
authRoute.post('/refresh', requireRefreshOrigin, refresh);
authRoute.post('/login', login);

// เข้าสู่ระบบ (คืนค่า JWT Token)
authRoute.post('/register', register);
;

export default authRoute
