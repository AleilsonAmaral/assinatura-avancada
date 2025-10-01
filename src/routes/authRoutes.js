// src/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware'); // <-- 1. IMPORTAÇÃO DO MIDDLEWARE

// =========================================================
// ROTA: POST /api/v1/auth/register (Sem Alterações)
// =========================================================
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Por favor, forneça nome, e-mail e senha.' });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Este e-mail já está cadastrado.' });
        }

        const newUser = new User({ name, email, password });
        const savedUser = await newUser.save();

        res.status(201).json({
            message: 'Usuário registrado com sucesso!',
            user: {
                id: savedUser._id,
                name: savedUser.name,
                email: savedUser.email,
            }
        });

    } catch (error) {
        console.error('[ERRO NO REGISTRO]:', error);
        res.status(500).json({ message: 'Erro interno ao registrar o usuário.', error: error.message });
    }
});

/// src/routes/authRoutes.js

router.post('/login', async (req, res) => {
    // 1. Desestruturar o novo parâmetro 'stayLoggedIn'
    const { email, password, stayLoggedIn } = req.body;

    try {
        // ... (Verificação de usuário e senha) ...

        const payload = { userId: user.id };

        // 2. DEFINIÇÃO DA EXPIRAÇÃO BASEADA NA OPÇÃO DO USUÁRIO
        let expiresInTime = '1h'; // Padrão: Se não marcou, expira em 1 hora
        if (stayLoggedIn) {
            expiresInTime = '30d'; // Se marcou, expira em 30 dias (ou o tempo que você preferir)
        }

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: expiresInTime } // 3. Usar a variável definida
        );

        res.status(200).json({
            message: 'Login bem-sucedido!',
            token: token
        });

    } catch (error) {
        // ... (Tratamento de erros) ...
    }
});

// =========================================================
// ROTA: GET /api/v1/auth/profile (A NOVA ROTA PROTEGIDA!)
// DESCRIÇÃO: Retorna os dados do usuário logado (requer token)
// =========================================================
router.get('/profile', authMiddleware, (req, res) => {
    // 2. O middleware 'authMiddleware' é executado primeiro.
    // Se o token for válido, a função continua e o 'req.user' estará disponível.
    // Se o token for inválido, o middleware já terá retornado um erro 401.

    res.status(200).json({
        message: "Dados do perfil carregados com sucesso.",
        user: req.user // 'req.user' foi adicionado à requisição pelo nosso middleware!
    });
});


module.exports = router;