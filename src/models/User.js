// src/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 1. A "Planta Baixa" (Schema) do nosso Usuário
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'O nome é obrigatório.'],
    },
    email: {
        type: String,
        required: [true, 'O e-mail é obrigatório.'],
        unique: true, // Garante que não haverá dois usuários com o mesmo e-mail
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'Por favor, insira um e-mail válido.'],
    },
    password: {
        type: String,
        required: [true, 'A senha é obrigatória.'],
        select: false, // Faz com que a senha não seja retornada em buscas por padrão
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// 2. "Middleware" do Mongoose para Criptografar a Senha ANTES de Salvar
// Esta função será executada automaticamente toda vez que um novo usuário for salvo
userSchema.pre('save', async function(next) {
    // Só criptografa a senha se ela foi modificada (ou é nova)
    if (!this.isModified('password')) return next();

    // Gera o "sal" e criptografa a senha com um custo de 12 (padrão de segurança)
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// 3. Cria e Exporta o Modelo
// O Mongoose pegará o nome 'User', colocará em minúsculo e no plural ('users')
// para nomear a coleção no MongoDB.
const User = mongoose.model('User', userSchema);

module.exports = User;