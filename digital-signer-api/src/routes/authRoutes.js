const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const authMiddleware = require('../middleware/authMiddleware'); 
const otpService = require('../services/otpService');
const MailgunService = require('../services/MailgunService'); 

// ... (Funções auxiliares) ...

// ====================================================================
// ROTA: POST /register 
// ====================================================================

router.post('/register', async (req, res) => {
    // ✅ LEITURA DO FRONT-END EM PORTUGUÊS
    const { name, email, password } = req.body || {}; 
    
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Por favor, forneça nome, e-mail e senha.' });
    }

    let client;
    try {
        // 🎯 CORREÇÃO 1: Nome da tabela de volta para 'users'
        const checkUserQuery = 'SELECT * FROM users WHERE email = $1'; 
        client = await pool.connect();
        const existingUserResult = await client.query(checkUserQuery, [email]);
        
        if (existingUserResult.rows.length > 0) {
            client.release();
            return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(senha, salt);

        // 🎯 CORREÇÃO 2: Colunas de INSERT ajustadas para 'name' e 'password'
        const insertUserQuery = 'INSERT INTO users (name, email, password, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id, name, email';
        // VALORES PASSADOS: [nome, email, hashedPassword]
        const savedUserResult = await client.query(insertUserQuery, [nome, email, hashedPassword]);
        const savedUser = savedUserResult.rows[0]; 

        client.release();
        
        res.status(201).json({
            message: 'Usuário registrado com sucesso!',
            user: {
                id: savedUser.id,
                // ✅ RETORNO ALINHADO AO BD: Retorna 'name' (do BD)
                nome: savedUser.name, 
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
    // ✅ LEITURA DO FRONT-END EM PORTUGUÊS
    const { email, senha, stayLoggedIn } = req.body || {}; 

    if (!email || !senha) {
        return res.status(400).json({ message: 'Por favor, forneça e-mail e senha.' });
    }

    let client;
    try {
        // 🎯 CORREÇÃO 3: SELECT nas colunas 'name' e 'password'
        const checkUserQuery = 'SELECT id, name, password FROM users WHERE email = $1'; 
        client = await pool.connect();
        const userResult = await client.query(checkUserQuery, [email]);
        const user = userResult.rows[0];

        if (!user) {
            client.release();
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        // ✅ CORREÇÃO 4: Compara senha do body (senha) com senha do BD (user.password)
        const isMatch = await bcrypt.compare(senha, user.password); 

        if (!isMatch) {
            client.release();
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        // ✅ CORREÇÃO 5: Payload usa 'name' do BD
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

// ... (Restante do código: /request-otp, /profile, etc.) ...


router.post('/login', async (req, res) => {
    // CORREÇÃO: Desestruturação alinhada ao Português
    const { email, senha, stayLoggedIn } = req.body || {}; 

    if (!email || !senha) {
        return res.status(400).json({ message: 'Por favor, forneça e-mail e senha.' });
    }

    let client;
    try {
        // CORREÇÃO: SELECT na tabela 'usuários' e colunas 'nome', 'senha'
        const checkUserQuery = 'SELECT id, nome, senha FROM users WHERE email = $1'; 
        client = await pool.connect();
        const userResult = await client.query(checkUserQuery, [email]);
        const user = userResult.rows[0];

        if (!user) {
            client.release();
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        // CORREÇÃO: Compara senha do body (senha) com hash do BD (user.senha)
        const isMatch = await bcrypt.compare(senha, user.senha); 

        if (!isMatch) {
            client.release();
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        // CORREÇÃO: Payload do JWT usa 'nome'
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

// ====================================================================
// ROTA: POST /request-otp 
// ====================================================================

router.post('/request-otp', async (req, res) => {
    const { signerId, method, email } = req.body || {};

    if (!signerId || !method || !email) {
        return res.status(400).json({ message: 'CPF, método e destinatário são obrigatórios para o OTP.' });
    }

    let client;
    try {
        // 1. GERAÇÃO E PERSISTÊNCIA
        const otpCode = generateOTP(); 
        const expiresAt = getExpirationTime();

        client = await pool.connect();
        
        const insertOtpQuery = `
            INSERT INTO otps (signer_id, code, expires_at) 
            VALUES ($1, $2, $3)
            ON CONFLICT (signer_id) DO UPDATE 
            SET code = $2, expires_at = $3, created_at = NOW();
        `;
        await client.query(insertOtpQuery, [signerId, otpCode, expiresAt]);
        
        // 2. ENVIO (Chamada Única ao Orquestrador)
        const messageResponse = await otpService.sendToken(method, email, otpCode);
        
        // 3. RESPOSTA DE SUCESSO 
        return res.status(200).json({
            message: messageResponse,
        });

    } catch (error) {
        // 🚨 CAPTURA O ERRO LANÇADO PELO Serviço de Envio (Mailgun ou Sinch)
        console.error('[ERRO FATAL NA TRANSAÇÃO OTP]:', error);
        
        // Retorna a mensagem de erro detalhada do Serviço (error.message)
        return res.status(500).json({ message: error.message || 'Falha interna ao processar a solicitação de OTP. Verifique o log do backend.' });
        
    } finally {
        // ✅ Libera a conexão UMA ÚNICA VEZ
        if (client) {
            client.release();
        }
    }
});

// ====================================================================
// ROTA: GET /profile
// ====================================================================

router.get('/profile', authMiddleware, (req, res) => {
    res.status(200).json({
        message: "Dados do perfil carregados com sucesso.",
        user: req.user
    });
});

// 🎯 SOLUÇÃO DO TypeError: argument handler must be a function
// A linha de exportação final deve sempre estar presente!
module.exports = router;
// ... (Restante do código: request-otp, get /profile, module.exports) ...