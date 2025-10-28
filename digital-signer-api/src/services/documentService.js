// digital-signer-api/src/services/DocumentService.js

const { pool } = require('../db'); 

const documentService = {
    getSenderEmailByDocumentId: async (documentId) => {
        
        // 🚨 CORREÇÃO CRÍTICA: Busca o 'signer_name' (onde o e-mail está)
        const query = `
            SELECT signer_name 
            FROM signature_records 
            WHERE document_id = $1
            LIMIT 1;
        `;
        
        let client;
        try {
            client = await pool.connect();
            const result = await client.query(query, [documentId]);
            const sender = result.rows[0];

            if (!sender || !sender.signer_name) { // Verifica o nome da coluna correto
                console.warn(`[WARN - DOC SERVICE] Remetente não encontrado na DB ou campo vazio para Document ID: ${documentId}.`);
                return null; 
            }
            
            // 🚨 Retorna o valor da coluna 'signer_name'
            return sender.signer_name; 

        } catch (error) {
            console.error("[ERRO DB - DOC SERVICE]: Falha na consulta de remetente no DB.", error.message);
            return null; 
        } finally {
            if (client) {
                client.release();
            }
        }
    }
};

module.exports = documentService; // Exportado corretamente como DocumentService