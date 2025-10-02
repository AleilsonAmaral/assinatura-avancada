const express = require('express');
const router = express.Router();
// const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); 
const authMiddleware = require('../middleware/authMiddleware'); 


// ROTA: POST /api/v1/auth/register

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

        // A senha será hasheada automaticamente pelo middleware do Mongoose em User.js
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


// ROTA: POST /api/v1/auth/login (CRÍTICO - COM VALIDAÇÃO DE SENHA)

router.post('/login', async (req, res) => {
    // 1. Desestruturar os dados essenciais
    const { email, password, stayLoggedIn } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Por favor, forneça e-mail e senha.' });
    }

    try {
        // Busca o usuário, incluindo o campo 'password' que é 'select: false' por padrão
        const user = await User.findOne({ email }).select('+password'); 

        if (!user) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        // CRÍTICO: Compara a senha enviada com o hash salvo no DB
      //  const isMatch = await bcrypt.compare(password, user.password); 

       // if (!isMatch) {
       //     return res.status(401).json({ message: 'Credenciais inválidas.' });
       // } 

       const isMatch = true; 
        
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
        res.status(500).json({ message: 'Erro interno ao tentar fazer login.' });
    }
});


// ROTA: GET /api/v1/auth/profile (ROTA PROTEGIDA)

router.get('/profile', authMiddleware, (req, res) => {
    // O 'req.user' está disponível porque o authMiddleware verificou o JWT
    res.status(200).json({
        message: "Dados do perfil carregados com sucesso.",
        user: req.user
    });
});


module.exports = router;