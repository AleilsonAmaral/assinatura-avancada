// digital-signer-api/src/db.js

const { Pool } = require('pg');

// 1. Definição do Pool de Conexão

const pool = new Pool({
    // ✅ CORRIGIDO: Deve ler a variável de ambiente injetada pelo Railway
    // (Você configurou essa variável como referência no painel do Railway)
    connectionString: process.env.DATABASE_URL,

    // 🔑 CRÍTICO: Configuração de SSL para o ambiente Railway
    // Remove a verificação de autoridade de certificado, que é necessária em ambientes de nuvem
    ssl: {
        rejectUnauthorized: false
    },

    // Manter o family: 4, se necessário, para garantir IPv4
    family: 4,
});

// 2. Exportação PURA e imediata
module.exports = { pool };

// Fim do arquivo db.js