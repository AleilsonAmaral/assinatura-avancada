const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const otpService = require('../services/otpService');
const { cpfValidationMiddleware } = require('../middleware/cpfValidationMiddleware');
// ... (Auxiliares mantidos)

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const getExpirationTime = () => {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 6);
        return expiresAt;
};


// ====================================================================
// ROTA: POST /register 
// ====================================================================

router.post('/register', async (req, res) => {
        // 🛑 CORREÇÃO FINAL: Ler 'Email' (Maiúsculo)
        const { name, email, password } = req.body || {};

        if (!name || !email || !password) {
                return res.status(400).json({ message: 'Por favor, forneça nome, e-mail e senha.' });
        }

        let client;
        try {
                const checkUserQuery = 'SELECT * FROM users WHERE email = $1';
                client = await pool.connect();
                // ✅ CORRIGIDO: Usar 'Email'
                const existingUserResult = await client.query(checkUserQuery, [email]);

                if (existingUserResult.rows.length > 0) {
                        client.release();
                        return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
                }

                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);

                const insertUserQuery = 'INSERT INTO users (name, email, password, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id, name, email';
                // ✅ CORRIGIDO: Usar 'Email'
                const savedUserResult = await client.query(insertUserQuery, [name, email, hashedPassword]);
                const savedUser = savedUserResult.rows[0];

                client.release();

                res.status(201).json({
                        message: 'Usuário registrado com sucesso!',
                        user: {
                                id: savedUser.id,
                                name: savedUser.name,
                                email: savedUser.email,
                        }
                });

        } catch (error) {
                if (client) client.release();
                console.error('[ERRO NO REGISTRO - SQL]:', error);
                res.status(500).json({ message: 'Erro interno ao registrar o usuário.', error: error.message });
        }
});


// ====================================================================
// ROTA: POST /login 
// ====================================================================

router.post('/login', async (req, res) => {
        // 🛑 CORREÇÃO APLICADA: Lendo 'Email' (Maiúsculo)
        const { email, password, stayLoggedIn } = req.body || {};

        if (!email || !password) {
                return res.status(400).json({ message: 'Por favor, forneça e-mail e senha.' });
        }

        let client;
        try {
                const checkUserQuery = 'SELECT id, name, password FROM users WHERE email = $1';
                client = await pool.connect();

                // ✅ CORRIGIDO: Usando a variável 'Email' (Maiúsculo)
                const userResult = await client.query(checkUserQuery, [email]);
                const user = userResult.rows[0];

                if (!user) {
                        client.release();
                        return res.status(401).json({ message: 'Credenciais inválidas.' });
                }

                const isMatch = await bcrypt.compare(password, user.password);

                if (!isMatch) {
                        client.release();
                        return res.status(401).json({ message: 'Credenciais inválidas.' });
                }

                const payload = { id: user.id, name: user.name };
                let expiresInTime = '1h';
                if (stayLoggedIn) {
                        expiresInTime = '30d';
                }

                const token = jwt.sign(
                        payload,
                        process.env.JWT_SECRET,
                        { expiresIn: expiresInTime }
                );

                client.release();

                res.status(200).json({
                        message: 'Login bem-sucedido!',
                        token: token
                });

        } catch (error) {
                if (client) client.release();
                console.error('[ERRO NO LOGIN - SQL]:', error);
                res.status(500).json({ message: 'Erro interno ao tentar fazer login.' });
        }
});

// ====================================================================
// ROTA: POST /request-otp 
// ====================================================================

router.post('/request-otp', cpfValidationMiddleware, async (req, res) => {

        // 🛑 CORREÇÃO APLICADA: Lendo 'Email' (Maiúsculo)
        const { signerId, method, email } = req.body || {};

        if (!signerId || !method || !email) {
                return res.status(400).json({ message: 'CPF, método e destinatário são obrigatórios para o OTP.' });
        }

        let client;
        try {
                // 1. GERAÇÃO E PERSISTÊNCIA DO OTP
                const otpCode = generateOTP();
                const expiresAt = getExpirationTime();

                client = await pool.connect();

                const insertOtpQuery = `
            INSERT INTO otps (signer_id, code, expires_at) 
            VALUES ($1, $2, $3)
            ON CONFLICT (signer_id) DO UPDATE 
            SET code = $2, expires_at = $3, used_at = NULL`;

                await client.query(insertOtpQuery, [signerId, otpCode, expiresAt]);

                // 2. ENVIO DO TOKEN (E-MAIL)
                // ✅ CORRIGIDO: Usando a variável 'Email'
                const messageResponse = await otpService.sendToken(method, email, otpCode);

                // 3. GERAÇÃO DO JWT (Payload)
                // ✅ CORRIGIDO: Usando 'Email' no payload
                const payload = { id: signerId, name: email, flow: 'signature' };
                const token = jwt.sign(
                        payload,
                        process.env.JWT_SECRET,
                        { expiresIn: '15m' }
                );

                client.release();

                // 4. RESPOSTA DE SUCESSO (RETORNA O JWT)
                return res.status(200).json({
                        message: messageResponse,
                        token: token,
                        signerCpfFormatted: signerId
                });

        } catch (error) {
                if (client) client.release();
                console.error('[ERRO FATAL NA TRANSAÇÃO OTP]:', error);
                return res.status(500).json({ message: error.message || 'Falha interna ao processar a solicitação de OTP. Verifique o log do backend.' });
        }
});

// ====================================================================
// ROTA: GET /profile
// Segurança: ROTA PROTEGIDA (COM JWT) - Exige o authMiddleware.
// ====================================================================

router.get('/profile', authMiddleware, (req, res) => {
        res.status(200).json({
                message: "Dados do perfil carregados com sucesso.",
                user: req.user
        });
});

module.exports = router;