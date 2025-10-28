// digital-signer-api/src/services/dbService.js

const { pool } = require('../db'); 
const EVIDENCE_TABLE = 'signature_records'; 

const dbService = {
    
    /**
     * Salva o registro completo da assinatura (evidência legal) no PostgreSQL.
     * @param {object} record - O objeto de evidência gerado no signRoutes.
     */
    saveSignatureRecord: async (record) => {
        let client;
        try {
            client = await pool.connect();
            
            const query = `
                INSERT INTO ${EVIDENCE_TABLE} (
                    document_id, signer_id, signer_name, contract_title, 
                    file_metadata, signature_data, signed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *;
            `;
            
            const values = [
                record.documentId,
                record.signerId,
                record.signerName,
                record.contractTitle,
                record.fileMetadata, 
                record.signatureData,
                record.signedAt 
            ];

            const result = await client.query(query, values);
            console.log(`[DB LOG] ✅ Evidência Jurídica salva para Doc ID: ${record.documentId}`);
            return result.rows[0];

        } catch (error) {
            console.error('[DB ERROR - saveSignatureRecord]:', error.message);
            throw new Error('Falha ao salvar o registro de evidência no banco de dados.');
        } finally {
            if (client) client.release();
        }
    },

    /**
     * Busca o registro de evidência no PostgreSQL por Document ID, Signer ID, ou Hash.
     * @param {string} searchTerm - O ID do documento, CPF, ou Hash.
     */
    getEvidence: async (searchTerm) => {
        let client;
        try {
            client = await pool.connect();
            
            // O termo é convertido para minúsculo para IDs e CPFs (insensível a case)
            const searchTermLower = searchTerm.toLowerCase(); 

            // 💡 CORREÇÃO FINAL DA QUERY: Simplificamos para usar o termo MINÚSCULO ($1) em todos os campos
            // que queremos case-insensitive, e usamos o termo original ($2) apenas para o hash.
            const query = `
                SELECT 
                    document_id, signer_name, signed_at, signature_data, contract_title
                FROM ${EVIDENCE_TABLE}
                WHERE 
                    LOWER(document_id) = $1 OR 
                    LOWER(signer_id) = $1 OR
                    signature_data->>'hash' = $2; 
            `;

            // O parâmetro 1 ($1) recebe o termo em minúsculo. O parâmetro 2 ($2) recebe o termo original para o hash.
            const result = await client.query(query, [searchTermLower, searchTerm]); 
            
            // 🚨 DEBUG: Log para ver o resultado exato da busca
            console.log(`[DB DEBUG - getEvidence] Buscando: ${searchTerm}. Resultados: ${result.rows.length}`);


            return result.rows[0] || null;

        } catch (error) {
            console.error('[DB ERROR - getEvidence]:', error.message);
            throw new Error('Falha ao consultar a evidência no banco de dados.');
        } finally {
            if (client) client.release();
        }
    }
};

module.exports = dbService;