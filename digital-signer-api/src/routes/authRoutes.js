const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const authMiddleware = require('../middleware/authMiddleware'); 
const otpService = require('../services/otpService');
const { cpfValidationMiddleware } = require('../middleware/cpfValidationMiddleware'); 
// As funções auxiliares foram movidas para um arquivo de utilidade (utilityService.js)
// Mas, para manter a funcionalidade como está, as mantemos aqui:

// 🎯 FUNÇÃO AUXILIAR: Gera um código OTP de 6 dígitos
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString(); 

// 🎯 FUNÇÃO AUXILIAR: Calcula o tempo de expiração (6 minutos)
const getExpirationTime = () => {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 6); 
    return expiresAt;
};


// ====================================================================
// ROTA: POST /register 
// ====================================================================

router.post('/register', async (req, res) => {
    const { name, email, password } = req.body || {}; 
    
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Por favor, forneça nome, e-mail e senha.' });
    }

    let client;
    try {
        const checkUserQuery = 'SELECT * FROM users WHERE email = $1'; 
        client = await pool.connect();
        const existingUserResult = await client.query(checkUserQuery, [email]);
        
        if (existingUserResult.rows.length > 0) {
            client.release();
            return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const insertUserQuery = 'INSERT INTO users (name, email, password, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id, name, email';
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
    const { email, password, stayLoggedIn } = req.body || {}; 

    if (!email || !password) {
        return res.status(400).json({ message: 'Por favor, forneça e-mail e senha.' });
    }

    let client;
    try {
        const checkUserQuery = 'SELECT id, name, password FROM users WHERE email = $1'; 
        client = await pool.connect();
        const userResult = await client.query(checkUserQuery, [Email]);
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
// Segurança: ROTA PÚBLICA (SEM JWT) - A autenticação é feita pelo CPF/E-mail.
// Esta é a rota que seu frontend deve chamar para enviar o código.
// ====================================================================

router.post('/request-otp', cpfValidationMiddleware, async (req, res) => {
    // 🚨 A rota estava configurada para retornar apenas a mensagem, mas o fluxo exige o JWT aqui.
    // O JWT DEVE ser gerado AQUI e retornado para o Frontend.
    
    const { signerId, method, Email } = req.body || {};

    if (!signerId || !method || !Email) {
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
        const messageResponse = await otpService.sendToken(method, Email, otpCode);
        
        // 3. GERAÇÃO DO JWT (CONFORME SUA ARQUITETURA)
        const payload = { id: signerId, name: email, flow: 'signature' }; 
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '15m' } // Token de curta duração para finalizar a assinatura
        );
        
        client.release();
        
        // 4. RESPOSTA DE SUCESSO (RETORNA O JWT)
        return res.status(200).json({
            message: messageResponse,
            token: token, // <<-- O JWT AGORA É ENVIADO AO FRONTEND AQUI
            signerCpfFormatted: signerId // Melhor usar o CPF limpo (do backend)
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