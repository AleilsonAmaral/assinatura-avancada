const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs/promises');

// Caminho do arquivo Excel de registro (sera criado na raiz do projeto)
const EXPORT_FILE = path.join(__dirname, '..', '..', 'registros_assinaturas.xlsx');

const ExportService = {
    // Função para salvar a nova assinatura no arquivo Excel
    saveSignatureToExcel: async (recordData) => {
        const workbook = new ExcelJS.Workbook();
        let worksheet;

        // Verifica se o arquivo existe e o carrega, caso contrário, cria
        try {
            await fs.access(EXPORT_FILE);
            await workbook.xlsx.readFile(EXPORT_FILE);
            worksheet = workbook.getWorksheet('Registros') || workbook.addWorksheet('Registros');
        } catch (error) {
            // O arquivo não existe, cria um novo
            worksheet = workbook.addWorksheet('Registros');
            worksheet.columns = [
                { header: 'ID Documento', key: 'document_id', width: 25 },
                { header: 'ID Signatário', key: 'signer_id', width: 25 },
                { header: 'Nome Signatário', key: 'signer_name', width: 30 },
                { header: 'Título Contrato', key: 'contract_title', width: 40 },
                { header: 'Metadados (JSON)', key: 'file_metadata_json', width: 50 },
                { header: 'Dados Assinatura (JSON)', key: 'signature_data_json', width: 50 },
                { header: 'Assinado em (UTC)', key: 'signed_at', width: 25 },
                { header: 'Criado em (UTC)', key: 'created_at', width: 25 },
            ];
        }

        // Prepara a nova linha
        const newRow = {
            ...recordData,
            file_metadata_json: JSON.stringify(recordData.file_metadata),
            signature_data_json: JSON.stringify(recordData.signature_data),
            signed_at: new Date(recordData.signed_at).toISOString(),
            created_at: new Date().toISOString(),
        };

        worksheet.addRow(newRow);

        // Salva o workbook no arquivo
        await workbook.xlsx.writeFile(EXPORT_FILE);
        console.log(`[Excel Audit]: Novo registro salvo em: ${EXPORT_FILE}`);
    }
};

module.exports = ExportService;