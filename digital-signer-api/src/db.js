// digital-signer-api/src/db.js

const { Pool } = require('pg');

// 1. Definição do Pool de Conexão
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    family: 4, // Força o uso de IPv4
});

// 2. Exportação PURA e imediata
module.exports = { pool };