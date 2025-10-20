const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // ✅ Agora importado para ser usado
const jwt = require('jsonwebtoken');
const User = require('../models/User'); 
const authMiddleware = require('../middleware/authMiddleware'); 

// ⭐️ DESCOMENTE SE FOR USAR ESSES SERVIÇOS
// const otpService = require('../services/otpService');
// const EmailService = require('../services/EmailService');


// ROTA: POST /api/v1/auth/register
// Nota: O hash da senha deve ser feito aqui ou em um pré-save hook no seu User model.
// Assumimos que o hashing da senha já está ocorrendo no model.
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body || {};
    
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


// ROTA: POST /api/v1/auth/login

router.post('/login', async (req, res) => {
    const { email, password, stayLoggedIn } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ message: 'Por favor, forneça e-mail e senha.' });
    }

    try {
        // Busca o usuário, incluindo o campo 'password' que é 'select: false' por padrão
        const user = await User.findOne({ email }).select('+password'); 

        if (!user) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        // 🎯 CORREÇÃO DE SEGURANÇA: Verifica se a senha fornecida bate com o hash armazenado
        const isMatch = await bcrypt.compare(password, user.password); 

        if (!isMatch) {
            // Se não bater, impede o login e retorna erro 401
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }
        
        // Se isMatch for true, o código prossegue daqui

        // 2. DEFINIÇÃO DA EXPIRAÇÃO (JWT)
        const payload = { id: user._id, name: user.name };
        let expiresInTime = '1h'; 
        if (stayLoggedIn) {
            expiresInTime = '30d'; 
        }

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: expiresInTime } 
        );

        res.status(200).json({
            message: 'Login bem-sucedido!',
            token: token
        });

    } catch (error) {
        console.error('[ERRO NO LOGIN]:', error);
        // Em um ambiente real, você logaria erros de servidor, mas retornaria 401 para evitar vazamento de informação.
        res.status(500).json({ message: 'Erro interno ao tentar fazer login.' });
    }
});


// ROTA: POST /api/v1/auth/request-otp 

router.post('/request-otp', async (req, res) => {
    const { email } = req.body || {};

    if (!email) {
        return res.status(400).json({ message: 'E-mail é obrigatório para solicitar OTP.' });
    }

    try {
        // A lógica de envio continua aqui, assumindo que os requires de serviço estão descomentados/implementados
        // ... (Seu código de serviço de OTP/E-mail)

        res.status(200).json({ message: 'Código OTP enviado para o seu e-mail.' });

    } catch (error) {
        console.error('[ERRO NO ENVIO DE OTP]:', error);
        res.status(500).json({ message: 'Erro interno ao enviar o código OTP.', error: error.message });
    }
});


// ROTA: GET /api/v1/auth/profile (ROTA PROTEGIDA)

router.get('/profile', authMiddleware, (req, res) => {
    res.status(200).json({
        message: "Dados do perfil carregados com sucesso.",
        user: req.user
    });
});


module.exports = router;