const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    // 1. Pega o token do cabeçalho da requisição
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Acesso negado. Nenhum token fornecido.' });
    }

    const token = authHeader.split(' ')[1]; // Pega apenas o token, sem a palavra "Bearer"

    try {
        // 2. Verifica se o token é válido usando nosso segredo
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Adiciona as informações do usuário (do token) ao objeto 'req'
        // para que as rotas protegidas possam saber quem é o usuário
        req.user = decoded;

        // 4. Se tudo estiver ok, avança para a próxima função (a lógica da rota)
        next();
    } catch (error) {
        // Se o token for inválido (assinatura errada, expirado, etc.)
        res.status(401).json({ message: 'Token inválido ou expirado.' });
    }
}

module.exports = authMiddleware;