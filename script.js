const API_BASE_URL = 'https://api.aleilsondev.sbs/api/v1';
const SIGNER_NAME = "Usuário de Teste"; 
let globalSignerId = ''; 
// Variáveis de Canvas/Contexto removidas


// FUNÇÕES UTILITÁRIAS (LOGS E MENSAGENS)

function log(message, type = 'info') {
    const logDiv = document.getElementById('log');
    const color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'blue';
    logDiv.innerHTML = `<span style="color: ${color};">[${new Date().toLocaleTimeString()}] ${message}</span><br>` + logDiv.innerHTML;
}

function displayStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.className = `message-box ${type}`;
    element.textContent = message;
    element.style.display = 'block';
}


// FUNÇÕES DE GERENCIAMENTO DE ESTADO DA UI

function toggleAuthForms(showLogin) {
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    if (showLogin) {
        loginSection.classList.remove('hidden');
        registerSection.classList.add('hidden');
    } else {
        loginSection.classList.add('hidden');
        registerSection.classList.remove('hidden');
    }
}

function updateUIBasedOnLoginState() {
    const token = localStorage.getItem('jwtToken'); 
    const authContainer = document.querySelector('.auth-container');
    const signatureContainer = document.getElementById('signatureContainer');
    const userProfileSection = document.getElementById('userProfileSection');
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const evidenceContainer = document.getElementById('evidenceContainer'); 

    if (token) {
        // ESTADO LOGADO
        authContainer.classList.remove('hidden'); 
        loginSection.classList.add('hidden');
        registerSection.classList.add('hidden');
        userProfileSection.classList.remove('hidden'); 
        signatureContainer.classList.remove('hidden'); 
        evidenceContainer.classList.remove('hidden'); 
        
        const userEmail = localStorage.getItem('userEmail') || 'Usuário';
        userNameDisplay.textContent = userEmail.split('@')[0];
    } else {
        // ESTADO DESLOGADO
        authContainer.classList.remove('hidden');
        signatureContainer.classList.add('hidden'); 
        userProfileSection.classList.add('hidden');
        evidenceContainer.classList.add('hidden'); 
        
        loginSection.classList.remove('hidden');
        registerSection.classList.add('hidden');
    }
}

// FUNÇÕES DE AUTENTICAÇÃO

async function registerUser() {
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const statusDiv = 'registerStatus';
    if (!name || !email || !password) {
        displayStatus(statusDiv, 'Preencha todos os campos para se registrar.', 'error');
        return;
    }
    log(`Tentando registrar o usuário: ${email}...`);
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await response.json();
        if (!response.ok) {
            displayStatus(statusDiv, `❌ Erro no Cadastro: ${data.message || data.error}`, 'error');
            return;
        }
        displayStatus(statusDiv, `✅ Cadastro de ${name} realizado com sucesso! Faça login.`, 'success');
        log('Usuário registrado. Alternando para o Login.', 'success');
        document.getElementById('registerName').value = '';
        document.getElementById('registerEmail').value = '';
        document.getElementById('registerPassword').value = '';
        setTimeout(() => toggleAuthForms(true), 1500); 
    } catch (error) {
        displayStatus(statusDiv, 'Erro de conexão com a API. Verifique o servidor.', 'error');
        log(`Erro de rede: ${error.message}`, 'error');
    }
}


async function loginUser() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const statusDiv = 'loginStatus';
    if (!email || !password) {
        displayStatus(statusDiv, 'Preencha e-mail e senha para entrar.', 'error');
        return;
    }
    log(`Tentando login para: ${email}...`);
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok || !data.token) {
            displayStatus(statusDiv, `❌ Falha no Login: ${data.message || 'Credenciais inválidas.'}`, 'error');
            return;
        }
        localStorage.setItem('jwtToken', data.token);
        localStorage.setItem('userEmail', email);
        displayStatus(statusDiv, `✅ Login bem-sucedido! Bem-vindo(a)!`, 'success');
        log('Login realizado. Token salvo e UI atualizada.', 'success');
        document.getElementById('loginPassword').value = ''; 
        updateUIBasedOnLoginState();
    } catch (error) {
        displayStatus(statusDiv, 'Erro de conexão com a API. Verifique o servidor.', 'error');
        log(`Erro de rede: ${error.message}`, 'error');
    }
}


function logoutUser() {
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('userEmail');
    log('Usuário desconectado. Limpando a sessão.', 'info');
    updateUIBasedOnLoginState();
}

/**
 * Rota protegida: Carrega os dados do perfil após o login.
 * Garante que o JWT esteja sendo enviado e lido corretamente.
 */
async function getProfile() {
    const token = localStorage.getItem('jwtToken');
    const profileStatus = 'profileStatus';

    if (!token) {
        displayStatus(profileStatus, 'Você não está logado. Faça login para acessar.', 'error');
        return;
    }

    log('Tentando carregar o perfil do usuário (rota protegida)...');

    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            }
        });

        const data = await response.json();
        const userInfoDiv = document.getElementById('userInfo');
        const userNameDisplay = document.getElementById('userNameDisplay');

        if (!response.ok) {
            displayStatus(profileStatus, `❌ Erro ao carregar perfil: ${data.message || 'Token inválido.'}`, 'error');
            if (response.status === 401) logoutUser(); 
            return;
        }

        const user = data.user;
        userNameDisplay.textContent = user.name;

        userInfoDiv.innerHTML = `
            <strong>ID:</strong> ${user._id}<br>
            <strong>Nome:</strong> ${user.name}<br>
            <strong>E-mail:</strong> ${user.email}
        `;
        
        displayStatus(profileStatus, '✅ Perfil carregado com sucesso via JWT!', 'success');

    } catch (error) {
        displayStatus(profileStatus, 'Erro de conexão com a API. Verifique se o servidor Express está rodando.', 'error');
        log(`Erro de rede/conexão: ${error.message}`, 'error');
    }
}


// FUNÇÕES DE CONFIGURAÇÃO DA UI

function setupPasswordToggles() {
    document.querySelectorAll('.toggle-password-btn').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const passwordInput = document.getElementById(targetId);
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                button.textContent = 'visibility'; 
            } else {
                passwordInput.type = 'password';
                button.textContent = 'visibility_off'; 
            }
        });
    });
}

function setupAuthEventListeners() {
    const goToRegisterLink = document.getElementById('goToRegister');
    const goToLoginLink = document.getElementById('goToLogin');
    if (goToRegisterLink) {
        goToRegisterLink.addEventListener('click', (e) => {
            e.preventDefault(); 
            toggleAuthForms(false);
        });
    }
    if (goToLoginLink) {
        goToLoginLink.addEventListener('click', (e) => {
            e.preventDefault(); 
            toggleAuthForms(true);
        });
    }
}

// LÓGICA DE GERENCIAMENTO DE TEMPLATES (FRONTEND)

function handleTemplateSelection() {
    const selector = document.getElementById('templateSelector');
    const fileUploadContainer = document.getElementById('fileUploadContainer');
    const docTitle = document.getElementById('docTitle');
    const docId = document.getElementById('docId');

    // Sempre reseta os campos de Título e ID para evitar confusão
    docTitle.value = "";
    docId.value = "";

    if (selector.value === 'upload') {
        // Estado: Fazer upload de novo arquivo (Mostra o input file)
        fileUploadContainer.classList.remove('hidden');
        docTitle.placeholder = 'Digite o título do documento (Obrigatório)';
        docId.placeholder = 'Digite um ID único (Obrigatório)';
    } else if (selector.value) {
        // Estado: Template selecionado (Esconde o input file)
        fileUploadContainer.classList.add('hidden');
        
        // Simulação: Preenche os metadados do template
        if (selector.value === 'template-servico') {
            docTitle.value = 'Contrato de Serviço Padrão (V1.0)';
            docId.value = 'TPL-SERV-' + Date.now(); // Gera um ID único baseado no tempo
        } else if (selector.value === 'template-nda') {
            docTitle.value = 'Acordo de Não Divulgação';
            docId.value = 'TPL-NDA-' + Date.now();
        }
    } else {
        // Estado: Nenhuma seleção (Esconde o input file)
        fileUploadContainer.classList.add('hidden');
        docTitle.placeholder = 'Título do Contrato';
        docId.placeholder = 'ID Único do Documento';
    }
}


// REMOVIDO: LÓGICA DO CANVAS (RUBRICA)

// ETAPA 1: SOLICITAR OTP (POST /auth/request-otp)

async function solicitarOTP() {
    // 1. Captura os dados da tela
    const signerId = document.getElementById('signerId').value;
    const method = document.getElementById('method').value;
    
    // CORREÇÃO CRÍTICA: Lendo o destinatário do campo correto
    let recipient = ''; 
    if (method === 'Email') {
        recipient = document.getElementById('signerEmail').value;
    } else { // Para SMS ou WhatsApp
        recipient = document.getElementById('signerPhone').value;
    }

    if (!signerId || !method || !recipient) {
        displayStatus('otpStatus', 'Preencha todos os campos: CPF, método e destinatário.', 'error');
        return;
    }
    
    globalSignerId = signerId;

    log(`Solicitando OTP para o signatário ${signerId} via ${method} para ${recipient}...`);

    try {
        const loggedInToken = localStorage.getItem('jwtToken'); 
        if (!loggedInToken) {
            displayStatus('otpStatus', 'Erro: Usuário não autenticado. Faça login novamente.', 'error');
            return;
        }

        // 🚨 CORREÇÃO APLICADA: Rota /auth/request-otp
        const response = await fetch(`${API_BASE_URL}/auth/request-otp`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${loggedInToken}` // Usa o JWT de Login
            },
            // CORREÇÃO APLICADA: Chave 'Email' para o destinatário
            body: JSON.stringify({ 
                signerId: signerId,   
                method: method,       
                Email: recipient     
            })
        });

        const data = await response.json();

        if (!response.ok) {
            displayStatus('otpStatus', `Erro (${response.status}): ${data.error || data.message}`, 'error');
            log(`Falha na solicitação: ${data.error || data.message}`, 'error');
            return;
        }
        
        // ✅ CORREÇÃO APLICADA: Salvar o JWT de Transação (curta duração)
        if (data.token) {
            localStorage.setItem('jwtToken', data.token);
            log('JWT de Transação salvo para o Passo 2.', 'info');
        }


        displayStatus('otpStatus', `✅ ${data.message}. Verifique seu dispositivo e siga para o Passo 2.`, 'success');
        
        document.getElementById('step1').style.border = '1px solid green';
        document.getElementById('step2').classList.remove('hidden');
        log('OTP solicitado com sucesso. Aguardando a entrada do código pelo usuário.', 'success');

    } catch (error) {
        displayStatus('otpStatus', 'Erro de conexão com a API. Verifique se o servidor Express está rodando.', 'error');
        log(`Erro de rede/conexão: ${error.message}`, 'error');
    }
}


// ETAPA 2: ASSINAR DOCUMENTO (POST /document/sign)

async function assinarDocumento() {
    const otpCode = document.getElementById('otpCode').value;
    const templateId = document.getElementById('templateSelector').value; 
    const contractTitle = document.getElementById('docTitle').value;
    const documentId = document.getElementById('docId').value;
    const resultDiv = document.getElementById('signatureResult');
    
    // Base64/Rubrica é um placeholder vazio ou 'N/A' (para o Carimbo Digital)
    const signatureImageBase64 = 'N/A';
    
    const fileInput = document.getElementById('documentFile');
    const file = fileInput.files[0];
    
    const isTemplateFlow = (templateId && templateId !== 'upload');

    // 1. Validação do Fluxo
    if (!isTemplateFlow && (!file || !documentId)) {
        displayStatus('signatureResult', 'Selecione um Arquivo ou um Modelo, e preencha o ID do Documento.', 'error');
        return;
    }
    if (!otpCode) {
        displayStatus('signatureResult', 'O Código OTP é obrigatório.', 'error');
        return;
    }

    log(`Tentando assinar o documento ${documentId} (${isTemplateFlow ? 'Template Fixo' : file.name})...`);

    // 2. Construção do FormData para upload de arquivo e dados
    const formData = new FormData();
    
    // Anexa o arquivo SOMENTE se não for um template
    if (!isTemplateFlow) {
        formData.append('documentFile', file);
    }
    
    // Envia o ID do Template (se aplicável)
    if (isTemplateFlow) {
        formData.append('templateId', templateId);
    }

    formData.append('submittedOTP', otpCode);
    formData.append('signerId', globalSignerId); 
    formData.append('signerName', SIGNER_NAME);
    formData.append('contractTitle', contractTitle);
    formData.append('documentId', documentId);
    // Base64 VAZIO/NULO agora que estamos usando o Carimbo (hash)
    formData.append('signatureImage', signatureImageBase64); 

    try {
        const token = localStorage.getItem('jwtToken'); 
        
        if (!token) {
            displayStatus('signatureResult', 'Erro: Usuário não autenticado. Faça login novamente.', 'error');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/document/sign`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`
            },
            body: formData 
        });

        const data = await response.json();

        if (!response.ok) {
            displayStatus('signatureResult', `Falha na Assinatura (${response.status}): ${data.message || data.error}`, 'error');
            log(`Assinatura Falhou: ${data.message || data.error}`, 'error');
            return;
        }
        
        // 🔑 NOTA: O backend deve retornar 'signatureData.hash'
        const hash = data.signatureRecord.signatureData.hash || 'Hash indisponível';

        // --- SUCESSO NA ASSINATURA ---
        resultDiv.className = 'success';
        // Atualiza a mensagem de sucesso para refletir se foi template ou upload
        const source = isTemplateFlow ? `Template: ${templateId}` : `Arquivo: ${file.name}`;
        resultDiv.innerHTML = `
            <h3>✅ ASSINATURA CONCLUÍDA E SALVA!</h3>
            <p><strong>Status Legal:</strong> Assinatura Eletrônica Avançada</p>
            <p><strong>Fonte do Documento:</strong> ${source}</p>
            <p><strong>Hash do Documento:</strong> ${hash.substring(0, 35)}...</p>
            <p><strong>Evidência Salva:</strong> Sim, na base de dados</p>
        `;
        log(`Assinatura salva. Hash: ${hash}`, 'success');

    } catch (error) {
        displayStatus('signatureResult', 'Erro de rede. Verifique se o servidor Express está rodando e se há conexão.', 'error');
        log(`Erro de rede: ${error.message}`, 'error');
    }
}


// FUNÇÃO: BUSCAR E EXIBIR EVIDÊNCIA LEGAL

async function buscarEvidencia() {
    const searchTerm = document.getElementById('evidenceSearchTerm').value;
    const statusDiv = 'evidenceStatus';
    const displayDiv = document.getElementById('evidenceResultDisplay');
    const dataDiv = document.getElementById('evidenceData');
    

    // Limpa a tela antes de buscar
    displayDiv.classList.add('hidden');
    dataDiv.innerHTML = '';
    
    if (!searchTerm) {
        displayStatus(statusDiv, 'Por favor, insira um termo de busca (ID ou Hash).', 'error');
        return;
    }

    log(`Buscando evidência para: ${searchTerm}...`);

    try {
        // A rota /document/:searchTerm/evidence está protegida no backend.
        const token = localStorage.getItem('jwtToken'); 
        if (!token) {
            displayStatus(statusDiv, 'Acesso negado. Faça login para auditar.', 'error');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/document/${searchTerm}/evidence`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Envia o JWT de Login/Sessão
            } 
        });

        const data = await response.json();

        if (!response.ok) {
            displayStatus(statusDiv, `❌ Erro (${response.status}): ${data.message || 'Evidência não encontrada.'}`, 'error');
            return;
        }

        // SUCESSO: Renderiza os dados
        displayStatus(statusDiv, '✅ Evidência legal encontrada e validada.', 'success');
        displayDiv.classList.remove('hidden');
        renderEvidence(data.evidenceRecord, dataDiv);
        log(`Evidência recuperada com sucesso.`, 'success');

    } catch (error) {
        displayStatus(statusDiv, 'Erro de rede. Não foi possível conectar ao serviço de evidência.', 'error');
        log(`Erro de rede/conexão na busca: ${error.message}`, 'error');
    }
}

/**
 * Renderiza os dados da evidência de forma visualmente agradável.
 * @param {object} record - O registro de assinatura retornado pela API.
 * @param {HTMLElement} targetDiv - A div onde o resultado será inserido.
 */
function renderEvidence(record, targetDiv) {
    const signedAt = new Date(record.signed_at || record.signedAt).toLocaleString('pt-BR'); 
    const hashShort = record.signatureData.hash.substring(0, 35) + '...';
    
    // --- Estrutura as Provas Legais ---
    targetDiv.innerHTML = `
        <p class="helper-text" style="color:#2ecc71;">Este registro é a prova legal e inviolável da assinatura.</p>
        
        <hr style="border-top: 1px solid #ddd; margin: 15px 0;">

        <h3>Informações do Documento</h3>
        <p><strong>Título:</strong> ${record.contractTitle}</p>
        <p><strong>ID Único:</strong> <span style="font-family: monospace; color:#3498db;">${record.documentId}</span></p>
        <p><strong>Fonte:</strong> ${record.fileMetadata.source}</p>
        
        <h3>Prova Criptográfica (Selo/Carimbo Digital)</h3>
        <p><strong>Hash SHA-256 (Conteúdo):</strong> 
            <span style="font-family: monospace; font-size: 0.8em; color: #e74c3c; word-break: break-all;">
                ${hashShort}
            </span>
        </p>
        <p><strong>Assinado em:</strong> ${signedAt}</p>
        <p><strong>Método de Autenticação:</strong> ${record.signatureData.authMethod}</p>

        <h3>Dados do Signatário</h3>
        <p><strong>Nome:</strong> ${record.signerName}</p>
        <p><strong>CPF (ID do Signatário):</strong> ${record.signerId}</p>

        <h3>Carimbo Digital (Visual)</h3>
        <p style="font-size: 14px; color:#2c3e50;">
            A assinatura foi verificada pelo Carimbo Digital. 
            A evidência visual do carimbo está no documento PDF final.
        </p>
        <p style="font-size: 12px; color: #6c757d;">
            (A rubrica manuscrita não é mais exigida para este nível de segurança.)
        </p>
    `;
}

// INICIALIZAÇÃO DA PÁGINA (SETUP)

document.addEventListener('DOMContentLoaded', () => {
    // 1. GERENCIAMENTO DE ESTADO: Verifica e atualiza a UI com base no token
    updateUIBasedOnLoginState();

    // 2. CONFIGURAÇÃO UX: LIGA os toggles de senha
    setupPasswordToggles();

    // 3. CONFIGURAÇÃO AUTH: LIGA os eventos de troca de formulário
    setupAuthEventListeners();

    // 4. Lógica para alternar os campos de E-mail/Celular (Seção OTP) e Templates
    const methodSelector = document.getElementById('method');
    const emailContainer = document.getElementById('emailInputContainer');
    const phoneContainer = document.getElementById('phoneInputContainer');
    const templateSelector = document.getElementById('templateSelector'); 

    function handleMethodChange() {
        if (methodSelector.value === 'Email') {
            emailContainer.classList.remove('hidden');
            phoneContainer.classList.add('hidden');
        } else { // Para SMS e WhatsApp
            emailContainer.classList.add('hidden');
            phoneContainer.classList.remove('hidden');
        }
    }

    if (methodSelector) {
        methodSelector.addEventListener('change', handleMethodChange);
        handleMethodChange(); 
    }
    
    // LIGA o handler para a seleção de templates
    if (templateSelector) {
        templateSelector.addEventListener('change', handleTemplateSelection);
        // 🚨 CORREÇÃO: Chama a função no carregamento para garantir que a UI comece corretamente
        handleTemplateSelection(); 
    }


    // 5. Lógica de inicialização de Canvas removida.
});