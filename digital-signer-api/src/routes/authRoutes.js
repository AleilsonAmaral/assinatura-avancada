const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const authMiddleware = require('../middleware/authMiddleware'); 
const otpService = require('../services/otpService');
const MailgunService = require('../services/MailgunService'); 

// FUNÇÃO AUXILIAR: Gera um código OTP de 6 dígitos
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString(); 

// FUNÇÃO AUXILIAR: Calcula o tempo de expiração (5 minutos)
const getExpirationTime = () => {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); 
    return expiresAt;
};

// ====================================================================
// ROTA: POST /register 
// ====================================================================

router.post('/register', async (req, res) => {
    const { nome, email, senha } = req.body || {}; 
    
    if (!nome || !email || !senha) {
        return res.status(400).json({ message: 'Por favor, forneça nome, e-mail e senha.' });
    }

    let client;
    try {
        // ✅ CORREÇÃO 1: Nome da tabela alterado para 'usuários'
        const checkUserQuery = 'SELECT * FROM usuários WHERE email = $1'; 
        client = await pool.connect();
        const existingUserResult = await client.query(checkUserQuery, [email]);
        
        if (existingUserResult.rows.length > 0) {
            client.release();
            return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(senha, salt);

        // ✅ CORREÇÃO 2: INSERT na tabela 'usuários'
        const insertUserQuery = 'INSERT INTO usuários (nome, email, senha, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id, nome, email';
        const savedUserResult = await client.query(insertUserQuery, [nome, email, hashedPassword]);
        const savedUser = savedUserResult.rows[0]; 

        client.release();
        
        res.status(201).json({
            message: 'Usuário registrado com sucesso!',
            user: {
                id: savedUser.id,
                nome: savedUser.nome,
                email: savedUser.email,
            }
        });

    } catch (error) {
        if (client) client.release();
        console.error('[ERRO NO REGISTRO - SQL]:', error);
        res.status(500).json({ message: 'Erro interno ao registrar o usuário.', error: error.message });
    }
});


router.post('/login', async (req, res) => {
    const { email, senha, stayLoggedIn } = req.body || {}; 

    if (!email || !senha) {
        return res.status(400).json({ message: 'Por favor, forneça e-mail e senha.' });
    }

    let client;
    try {
        // ✅ CORREÇÃO 3: SELECT na tabela 'usuários'
        const checkUserQuery = 'SELECT id, nome, senha FROM usuários WHERE email = $1'; 
        client = await pool.connect();
        const userResult = await client.query(checkUserQuery, [email]);
        const user = userResult.rows[0];

        if (!user) {
            client.release();
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const isMatch = await bcrypt.compare(senha, user.senha); 

        if (!isMatch) {
            client.release();
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const payload = { id: user.id, nome: user.nome };
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

// ... (Restante do código: request-otp, get /profile, module.exports) ...