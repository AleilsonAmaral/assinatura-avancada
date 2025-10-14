// SIMULAÇÃO DE BANCO DE DADOS EM MEMÓRIA
const SIGNATURE_DATABASE = []; 

function saveSignatureRecord(record) {
    SIGNATURE_DATABASE.push(record);
    console.log(`[DB LOG] ✅ Evidência Jurídica salva para Doc ID: ${record.documentId}`);
    return true;
}

function getEvidence(searchTerm) {
    const searchTermLower = searchTerm.toLowerCase();

    // Busca o registro por ID, CPF/ID, Nome ou Título (essencial para auditoria)
    const result = SIGNATURE_DATABASE.find(r => 
        r.documentId.toLowerCase() === searchTermLower || 
        r.signerId.toLowerCase() === searchTermLower ||
        (r.signerName && r.signerName.toLowerCase().includes(searchTermLower)) ||
        (r.contractTitle && r.contractTitle.toLowerCase().includes(searchTermLower))
    );
    
    return result || null;
}

module.exports = {
    saveSignatureRecord,
    getEvidence
};