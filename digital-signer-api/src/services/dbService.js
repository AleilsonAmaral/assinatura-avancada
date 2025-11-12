// digital-signer-api/src/services/dbService.js

const { pool } = require('../db'); 
const EVIDENCE_TABLE = 'signature_records'; 
// 🚨 NOVO: Importa o serviço de exportação para a estratégia paliativa
const exportService = require('./exportService'); 

const dbService = {
    
    /**
     * Salva o registro completo da assinatura (evidência legal) no PostgreSQL.
     * Tenta salvar no DB e, em caso de falha de persistência, salva no Excel.
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
                RETURNING id;
            `;
            
            // O objeto 'record' já possui as chaves corretas (documentId, signerId, etc.)
            const values = [
                record.documentId,
                record.signerId,
                record.signerName,
                record.contractTitle,
                record.fileMetadata, // Deve ser JSONB
                record.signatureData, // Deve ser JSONB
                record.signedAt 
            ];

            const result = await client.query(query, values);
            
            console.log(`[DB LOG] ✅ Evidência Jurídica salva para Doc ID: ${record.documentId} no PostgreSQL.`);
            return result.rows[0];

        } catch (error) {
            // 🛑 ESTRATÉGIA PALIATIVA: Tenta salvar no Excel se o DB falhar
            
            console.error('[DB ERROR - saveSignatureRecord]: FALHA CRÍTICA NO POSTGRESQL! Tentando salvar no Excel...');
            console.error('Erro de SQL original:', error.message);

            // Tenta salvar o registro completo no arquivo Excel
            try {
                // Passamos o objeto 'record' completo para o ExcelService
                await exportService.saveSignatureToExcel(record); 
                console.log('[PALIATIVO SUCESSO]: Dados de evidência salvos no arquivo Excel.');
            } catch (excelError) {
                console.error('[PALIATIVO FALHA]: Falha ao salvar no Excel.', excelError.message);
            }
            
            // Lançamos o erro para a rota upstream, informando que a persistência falhou.
            throw new Error('Falha ao salvar o registro de evidência no banco de dados. (Verifique o arquivo Excel de Auditoria)');

        } finally {
            if (client) client.release();
        }
    },

    // A função getEvidence não precisa de fallback para Excel, pois ela só deve buscar dados auditáveis no DB.
    getEvidence: async (searchTerm) => {
        // ... (Lógica de busca mantida inalterada)
        // ...
    }
};

module.exports = dbService;