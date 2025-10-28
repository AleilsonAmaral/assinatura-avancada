// digital-signer-api/src/services/UserService.js

const { pool } = require('../db'); 

const UserService = {
    getSignerDataByCpf: async (signerCpf) => {
        // ... (lógica SQL)
        const query = `
            SELECT signer_name 
            FROM signature_records 
            WHERE signer_id = $1
            ORDER BY created_at DESC
            LIMIT 1; 
        `;
        // ...
        
        let client;
        try {
            client = await pool.connect();
            const result = await client.query(query, [signerCpf]);
            const record = result.rows[0];

            if (!record) {
                console.error(`[ERROR - USER SERVICE] E-mail do signatário não encontrado para CPF: ${signerCpf}.`);
                throw new Error("Dados do signatário (email/nome) não encontrados no banco de dados.");
            }
            
            const email = record.signer_name; 
            const nameForDisplay = email; // Usa o email completo como nome
            
            return {
                email: email,
                name: nameForDisplay,
                cpfCnpj: signerCpf, 
            };

        } catch (error) {
            console.error("[ERRO DB - USER SERVICE]: Falha na consulta de dados do signatário.", error.message);
            throw new Error("Falha grave ao recuperar dados do signatário.");
        } finally {
             if (client) {
                client.release();
            }
        }
    },

    getUserDataById: async (signerId) => {
        console.error(`[FATAL] Função getUserDataById chamada. Use getSignerDataByCpf para o fluxo de notificação.`);
        throw new Error("Função de busca obsoleta chamada.");
    }
};

module.exports = UserService;