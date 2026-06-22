"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOTP = exports.sendOTP = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../config/database"));
const auditService_1 = __importDefault(require("../services/auditService"));
// Generate random OTP
const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};
// Helper to get client IP
const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
};
const normalizePhone = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length >= 10) {
        return digits.slice(-10);
    }
    return digits;
};
const sendOtpViaFast2SMS = async (phone, otp) => {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
        throw new Error('FAST2SMS_API_KEY is not configured');
    }
    const route = process.env.FAST2SMS_ROUTE || 'dlt';
    const senderId = process.env.FAST2SMS_SENDER_ID || 'KRYCRT';
    const messageId = Number(process.env.FAST2SMS_MESSAGE_ID || 180882);
    const endpoint = process.env.FAST2SMS_URL || 'https://www.fast2sms.com/dev/bulkV2';
    const payload = {
        variables_values: otp,
        route,
        message: messageId,
        sender_id: senderId,
        numbers: phone,
    };
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            accept: 'application/json',
            authorization: apiKey,
            'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    const rawBody = await response.text();
    let parsed = null;
    try {
        parsed = rawBody ? JSON.parse(rawBody) : null;
    }
    catch {
        parsed = null;
    }
    if (!response.ok) {
        const providerMessage = (Array.isArray(parsed?.message) ? parsed?.message.join(', ') : parsed?.message) ||
            rawBody ||
            `HTTP ${response.status}`;
        throw new Error(`Fast2SMS request failed: ${providerMessage}`);
    }
    if (parsed?.return === false) {
        const providerMessage = Array.isArray(parsed.message)
            ? parsed.message.join(', ')
            : parsed?.message || 'Provider rejected OTP request';
        throw new Error(`Fast2SMS rejected OTP: ${providerMessage}`);
    }
    return parsed || {};
};
// Send OTP to phone number
const sendOTP = async (req, res) => {
    try {
        const { phone } = req.body;
        const normalizedPhone = normalizePhone(phone);
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';
        if (!normalizedPhone || !/^\d{10}$/.test(normalizedPhone)) {
            // Log failed attempt
            await auditService_1.default.log({
                phone_number: normalizedPhone || String(phone || ''),
                action: 'send-otp',
                status: 'failed',
                ip_address: clientIp,
                user_agent: userAgent,
                error_message: 'Invalid phone number format',
                action_details: 'Invalid phone format provided',
            });
            return res.status(400).json({ error: 'Invalid phone number. Please provide a 10-digit number.' });
        }
        // Validate user exists before sending OTP
        const userExistsResult = await database_1.default.query(`SELECT id
       FROM users
       WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE '%' || $1
         AND is_active = true
       LIMIT 1`, [normalizedPhone]);
        if (userExistsResult.rows.length === 0) {
            await auditService_1.default.log({
                phone_number: normalizedPhone,
                action: 'send-otp',
                status: 'failed',
                ip_address: clientIp,
                user_agent: userAgent,
                error_message: 'User not found for phone number',
                action_details: 'OTP request blocked for unknown phone number',
            });
            return res.status(404).json({ error: 'User is not available. Please contact admin.' });
        }
        // Generate OTP
        const otp = generateOTP();
        const isProduction = process.env.NODE_ENV === 'production';
        const allowDevFallback = process.env.OTP_DEV_FALLBACK === 'true';
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
        // Upsert OTP record (delete old and create new)
        await database_1.default.query(`DELETE FROM otp_verification WHERE phone_number = $1`, [normalizedPhone]);
        await database_1.default.query(`INSERT INTO otp_verification (phone_number, otp_code, expires_at, attempts, is_verified)
       VALUES ($1, $2, $3, 0, false)`, [normalizedPhone, otp, expiresAt]);
        let smsResponse = null;
        try {
            smsResponse = await sendOtpViaFast2SMS(normalizedPhone, otp);
        }
        catch (smsError) {
            const smsErrorMessage = smsError instanceof Error ? smsError.message : 'SMS provider error';
            // Block login when SMS is not delivered, unless development fallback is explicitly enabled.
            if (isProduction || !allowDevFallback) {
                // Keep OTP table clean if SMS could not be delivered.
                await database_1.default.query(`DELETE FROM otp_verification WHERE phone_number = $1`, [normalizedPhone]);
                await auditService_1.default.log({
                    phone_number: normalizedPhone,
                    action: 'send-otp',
                    status: 'failed',
                    ip_address: clientIp,
                    user_agent: userAgent,
                    error_message: smsErrorMessage,
                    action_details: 'OTP generation succeeded but SMS sending failed',
                });
                return res.status(502).json({
                    error: 'Failed to send OTP SMS. Please try again.',
                    ...(isProduction ? {} : { details: smsErrorMessage }),
                });
            }
            // In development, allow OTP flow for testing even if SMS provider is unavailable.
            console.warn(`[sendOTP] SMS provider failed in development, using fallback response: ${smsErrorMessage}`);
            await auditService_1.default.log({
                phone_number: normalizedPhone,
                action: 'send-otp',
                status: 'success',
                ip_address: clientIp,
                user_agent: userAgent,
                action_details: 'OTP generated in development fallback (SMS not sent)',
                metadata: {
                    provider: 'fast2sms',
                    fallback: true,
                    sms_error: smsErrorMessage,
                },
            });
            return res.json({
                message: 'OTP generated (development fallback, SMS not sent)',
                phone: normalizedPhone,
                otp,
            });
        }
        // Log successful OTP send
        await auditService_1.default.log({
            phone_number: normalizedPhone,
            action: 'send-otp',
            status: 'success',
            ip_address: clientIp,
            user_agent: userAgent,
            action_details: 'OTP sent successfully',
            metadata: {
                otp_expiry_minutes: 10,
                provider: 'fast2sms',
                provider_request_id: smsResponse?.request_id,
            },
        });
        if (!isProduction) {
            console.log(`OTP for ${normalizedPhone}: ${otp}`);
        }
        res.json({
            message: 'OTP sent successfully',
            phone: normalizedPhone,
            // In production, remove this
            ...(process.env.NODE_ENV === 'development' && { otp }),
        });
    }
    catch (error) {
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';
        const phone = req.body?.phone;
        console.error('Send OTP error:', error);
        // Log error
        await auditService_1.default.log({
            phone_number: phone,
            action: 'send-otp',
            status: 'failed',
            ip_address: clientIp,
            user_agent: userAgent,
            error_message: error instanceof Error ? error.message : 'Unknown error',
            action_details: 'Server error while sending OTP',
        });
        res.status(500).json({ error: 'Failed to send OTP' });
    }
};
exports.sendOTP = sendOTP;
// Verify OTP and return JWT token
const verifyOTP = async (req, res) => {
    try {
        const { phone, otp } = req.body;
        const normalizedPhone = normalizePhone(phone);
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';
        if (!normalizedPhone || !otp) {
            // Log failed attempt
            await auditService_1.default.log({
                phone_number: normalizedPhone || String(phone || ''),
                action: 'verify-otp',
                status: 'failed',
                ip_address: clientIp,
                user_agent: userAgent,
                error_message: 'Missing phone or OTP',
                action_details: 'Incomplete request parameters',
            });
            return res.status(400).json({ error: 'Phone number and OTP are required' });
        }
        // Get OTP record
        const otpResult = await database_1.default.query(`SELECT * FROM otp_verification 
       WHERE phone_number = $1 
       ORDER BY created_at DESC 
       LIMIT 1`, [normalizedPhone]);
        if (otpResult.rows.length === 0) {
            // Log failed attempt
            await auditService_1.default.log({
                phone_number: normalizedPhone,
                action: 'verify-otp',
                status: 'failed',
                ip_address: clientIp,
                user_agent: userAgent,
                error_message: 'OTP not found',
                action_details: 'No OTP record found for phone number',
            });
            return res.status(401).json({ error: 'OTP not found. Please request a new OTP.' });
        }
        const otpRecord = otpResult.rows[0];
        // Check expiry
        if (new Date() > new Date(otpRecord.expires_at)) {
            await database_1.default.query(`DELETE FROM otp_verification WHERE id = $1`, [otpRecord.id]);
            // Log failed attempt
            await auditService_1.default.log({
                phone_number: normalizedPhone,
                action: 'verify-otp',
                status: 'failed',
                ip_address: clientIp,
                user_agent: userAgent,
                error_message: 'OTP expired',
                action_details: 'OTP verification attempted after expiry',
            });
            return res.status(401).json({ error: 'OTP has expired. Please request a new OTP.' });
        }
        // Check max attempts
        if (otpRecord.attempts >= otpRecord.max_attempts) {
            await database_1.default.query(`DELETE FROM otp_verification WHERE id = $1`, [otpRecord.id]);
            // Log failed attempt
            await auditService_1.default.log({
                phone_number: normalizedPhone,
                action: 'verify-otp',
                status: 'failed',
                ip_address: clientIp,
                user_agent: userAgent,
                error_message: 'Too many failed attempts',
                action_details: `Maximum attempts (${otpRecord.max_attempts}) exceeded`,
            });
            return res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
        }
        // Verify OTP
        if (otpRecord.otp_code !== otp) {
            // Increment attempts
            await database_1.default.query(`UPDATE otp_verification SET attempts = attempts + 1 WHERE id = $1`, [otpRecord.id]);
            // Log failed attempt
            await auditService_1.default.log({
                phone_number: normalizedPhone,
                action: 'verify-otp',
                status: 'attempted',
                ip_address: clientIp,
                user_agent: userAgent,
                error_message: 'Invalid OTP',
                action_details: `Wrong OTP provided (attempt ${otpRecord.attempts + 1}/${otpRecord.max_attempts})`,
                metadata: { attempt_number: otpRecord.attempts + 1, max_attempts: otpRecord.max_attempts },
            });
            return res.status(401).json({ error: 'Invalid OTP. Please try again.' });
        }
        // OTP is valid - login only existing active user
        const userResult = await database_1.default.query(`SELECT u.*, r.name as role_name 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') LIKE '%' || $1
         AND u.is_active = true`, [normalizedPhone]);
        if (userResult.rows.length === 0) {
            await auditService_1.default.log({
                phone_number: normalizedPhone,
                action: 'verify-otp',
                status: 'failed',
                ip_address: clientIp,
                user_agent: userAgent,
                error_message: 'User not found for verified OTP',
                action_details: 'OTP verified but login blocked for unknown phone number',
            });
            await database_1.default.query(`DELETE FROM otp_verification WHERE id = $1`, [otpRecord.id]);
            return res.status(404).json({ error: 'User is not available. Please contact admin.' });
        }
        const user = {
            id: userResult.rows[0].id,
            name: userResult.rows[0].name,
            email: userResult.rows[0].email,
            phone: userResult.rows[0].phone,
            role: userResult.rows[0].role_name || 'Sales Agent',
        };
        // Mark OTP as verified and delete
        await database_1.default.query(`DELETE FROM otp_verification WHERE id = $1`, [otpRecord.id]);
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        // Update last login date
        await database_1.default.query(`UPDATE users SET last_login_date = NOW() WHERE id = $1`, [user.id]);
        // Log successful verification
        await auditService_1.default.log({
            user_id: user.id,
            phone_number: normalizedPhone,
            action: 'verify-otp',
            status: 'success',
            ip_address: clientIp,
            user_agent: userAgent,
            action_details: 'User logged in successfully via OTP',
            metadata: { user_id: user.id, is_new_user: false, role: user.role },
        });
        res.json({
            message: 'OTP verified successfully',
            token,
            user,
        });
    }
    catch (error) {
        const clientIp = getClientIp(req);
        const userAgent = req.headers['user-agent'] || '';
        const phone = req.body?.phone;
        console.error('Verify OTP error:', error);
        // Log error
        await auditService_1.default.log({
            phone_number: phone,
            action: 'verify-otp',
            status: 'failed',
            ip_address: clientIp,
            user_agent: userAgent,
            error_message: error instanceof Error ? error.message : 'Unknown error',
            action_details: 'Server error during OTP verification',
        });
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
};
exports.verifyOTP = verifyOTP;
