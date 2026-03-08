// =====================================================
// TICKETS.JS - Lógica del módulo de Tickets (PC)
// =====================================================

let currentStep = 1;
let initialProblem = '';
let questionsData = [];
let sessionCheckInterval = null;
const SESSION_CHECK_INTERVAL = 60000;
const MIN_LOADER_TIME = 1200;

// ===== VERIFICACIÓN DE SESIÓN =====
function setupUserInfo(userData) {
    const nameEl = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    const roleEl = document.getElementById('user-role');
    
    if (nameEl && userData.name) {
        nameEl.textContent = userData.name;
    }
    if (avatarEl && userData.name) {
        avatarEl.textContent = userData.name.charAt(0).toUpperCase();
    }
    if (roleEl && userData.rol) {
        const roles = (userData.rol || "").split(',').map(r => r.trim().toUpperCase());
        const filtered = roles.filter(r => r === 'ASESOR' || r === 'ADMIN').join(', ');
        roleEl.textContent = filtered;
    }
}

async function verifySession() {
    const sessionData = localStorage.getItem('appSession');
    if (!sessionData) {
        window.location.href = '../login.html';
        return;
    }
    
    try {
        const session = JSON.parse(sessionData);
        setupUserInfo(session);
    } catch (error) {
        console.error('Error verificando sesión:', error);
        window.location.href = '../login.html';
    }
}

// ===== LOADER =====
function hideLoadingScreen() {
    const loader = document.getElementById('loading-screen');
    const now = Date.now();
    const elapsed = now - loaderStartTime;
    const remaining = Math.max(0, MIN_LOADER_TIME - elapsed);

    setTimeout(() => {
        if (loader) {
            loader.style.opacity = '0';
            loader.style.visibility = 'hidden';
            setTimeout(() => {
                loader.style.display = 'none';
                document.body.classList.add('loaded');
            }, 300);
        }
    }, remaining);
}

// ===== TOAST =====
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastMessage) return;
    
    toastMessage.textContent = message;

    if (type === 'error') {
        toast.className = 'fixed top-5 right-5 bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg transform transition-all duration-300 z-50';
    } else if (type === 'success') {
        toast.className = 'fixed top-5 right-5 bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg transform transition-all duration-300 z-50';
    } else {
        toast.className = 'fixed top-5 right-5 bg-gray-800 text-white px-6 py-4 rounded-lg shadow-lg transform transition-all duration-300 z-50';
    }

    toast.style.display = 'block';
    toast.style.transform = 'translateX(0)';

    setTimeout(() => {
        toast.style.transform = 'translateX(200%)';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 4000);
}

// ===== LÓGICA DE TICKETS =====

function parseMarkdownWithInputs(markdownText) {
    questionsData = [];
    
    // Simplificación de marked si no está disponible, pero asumimos que se carga vía CDN
    let html = typeof marked !== 'undefined' ? marked.parse(markdownText) : markdownText;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const listItems = tempDiv.querySelectorAll('li');
    
    listItems.forEach((li, index) => {
        const text = li.textContent || li.innerText;
        const cleanText = text.replace(/\[input:[^\]]+\]/g, '').trim();
        questionsData.push(cleanText);
    });
    
    const inputRegex = /\[input:([^\]]+)\]/g;
    let inputCounter = 0;
    html = html.replace(inputRegex, (match, inputId) => {
        const dataIndex = inputCounter++;
        return `<input type="text" id="${inputId}" class="dynamic-input" data-question-index="${dataIndex}" required placeholder="Escriba su respuesta aquí..." />`;
    });
    
    return html;
}

// Simulación de Webhook 1
async function simulateWebhook1(problema) {
    showToast('[Simulación] Webhook ejecutado: Enviar problema inicial', 'info');
    
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([{
                output: "### Preguntas de Soporte Adicionales\n\nPara brindarle una mejor solución, por favor proporcione los siguientes detalles:\n\n1. ¿En qué módulo específico ocurrió el problema? [input:modulo]\n2. ¿Qué navegador o dispositivo estaba utilizando? [input:dispositivo]\n3. ¿Es la primera vez que ocurre este error? [input:frecuencia]\n4. ¿Apareció algún código de mensaje de error? [input:codigo_error]"
            }]);
        }, 1500);
    });
}

// Simulación de Webhook 2
async function simulateWebhook2(payload) {
    showToast('[Simulación] Webhook ejecutado: Enviar respuestas', 'info');
    
    return new Promise((resolve) => {
        setTimeout(() => {
            const finalTicket = `TICKET DE SOPORTE - WEPCOOPEC\n\nDESCRIPCIÓN DEL PROBLEMA:\n${payload.descripcion_del_problema}\n\nDETALLES ADICIONALES:\n${payload.respuesta_a_preguntas_relacionadas}\n\nESTADO: Pendiente de revisión\nFECHA GENERACIÓN: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
            
            resolve([{
                output: `${finalTicket}\n\n[Sugerencia: Por favor, tenga a mano su número de socio para agilizar su atención.]`
            }]);
        }, 1500);
    });
}

// Event Listeners y Inicialización
document.addEventListener('DOMContentLoaded', () => {
    verifySession();
    hideLoadingScreen();

    const sendTicketBtn = document.getElementById('send-ticket-btn');
    const clearTicketBtn = document.getElementById('clear-ticket-btn');
    const sendAnswersBtn = document.getElementById('send-answers-btn');
    const backBtn = document.getElementById('back-btn');
    const ticketProblemInput = document.getElementById('ticket-problem');
    const responseSection = document.getElementById('ticket-response-section');

    if (sendTicketBtn) {
        sendTicketBtn.addEventListener('click', async () => {
            const problema = ticketProblemInput.value.trim();

            if (!problema) {
                showToast('Por favor, describa el problema antes de continuar.', 'error');
                ticketProblemInput.focus();
                return;
            }

            initialProblem = problema;
            sendTicketBtn.disabled = true;
            sendTicketBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Simulando envío...';

            try {
                const data = await simulateWebhook1(problema);
                
                if (Array.isArray(data) && data.length > 0 && data[0].output) {
                    const markdownOutput = data[0].output;
                    const htmlContent = parseMarkdownWithInputs(markdownOutput);
                    
                    document.getElementById('questions-container').innerHTML = htmlContent;
                    document.getElementById('step1-card').classList.add('hidden');
                    document.getElementById('step2-card').classList.remove('hidden');
                    
                    // Actualizar indicadores
                    document.getElementById('step1-item').classList.remove('active');
                    document.getElementById('step2-item').classList.add('active');
                    document.getElementById('step-line').classList.add('active');
                    
                    currentStep = 2;
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Error en la simulación.', 'error');
            } finally {
                sendTicketBtn.disabled = false;
                sendTicketBtn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Enviar a Soporte';
            }
        });
    }

    if (sendAnswersBtn) {
        sendAnswersBtn.addEventListener('click', async () => {
            const inputs = document.querySelectorAll('.dynamic-input');
            let allFilled = true;
            let formattedQA = '';

            inputs.forEach(input => {
                if (!input.value.trim()) {
                    allFilled = false;
                    input.style.borderColor = 'var(--red-500)';
                } else {
                    input.style.borderColor = 'var(--slate-200)';
                    const questionIndex = parseInt(input.getAttribute('data-question-index'));
                    const question = questionsData[questionIndex] || 'Pregunta';
                    const answer = input.value.trim();
                    formattedQA += `${question}\n${answer}\n\n`;
                }
            });

            if (!allFilled) {
                showToast('Por favor, complete todas las preguntas.', 'error');
                return;
            }

            formattedQA = formattedQA.trim();
            sendAnswersBtn.disabled = true;
            sendAnswersBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Procesando...';

            try {
                const payload = {
                    descripcion_del_problema: initialProblem,
                    respuesta_a_preguntas_relacionadas: formattedQA
                };

                const data = await simulateWebhook2(payload);
                
                if (Array.isArray(data) && data.length > 0 && data[0].output) {
                    const fullMessage = data[0].output;
                    const suggestionMatch = fullMessage.match(/\[([^\]]+)\]/);
                    let mainMessage = fullMessage;
                    let suggestions = '';
                    
                    if (suggestionMatch) {
                        suggestions = suggestionMatch[1];
                        mainMessage = fullMessage.replace(/\[[^\]]+\]/g, '').trim();
                    }
                    
                    window.ticketMessage = mainMessage;
                    document.getElementById('ticket-message').textContent = mainMessage;
                    
                    if (suggestions) {
                        document.getElementById('suggestions-text').textContent = suggestions;
                        document.getElementById('suggestions-section').classList.remove('hidden');
                    }
                    
                    responseSection.classList.remove('hidden');
                    responseSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } catch (error) {
                console.error('Error:', error);
                showToast('Error en la simulación del paso 2.', 'error');
            } finally {
                sendAnswersBtn.disabled = false;
                sendAnswersBtn.innerHTML = '<i class="fas fa-check-circle mr-2"></i>Generar Ticket';
            }
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('step2-card').classList.add('hidden');
            document.getElementById('step1-card').classList.remove('hidden');
            document.getElementById('step1-item').classList.add('active');
            document.getElementById('step2-item').classList.remove('active');
            document.getElementById('step-line').classList.remove('active');
            currentStep = 1;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if (clearTicketBtn) {
        clearTicketBtn.addEventListener('click', () => {
            ticketProblemInput.value = '';
            responseSection.classList.add('hidden');
            document.getElementById('ticket-message').textContent = '';
            document.getElementById('suggestions-section').classList.add('hidden');
            if (currentStep === 2) backBtn.click();
        });
    }
});

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Error al copiar:', err);
        return false;
    }
}

window.handleUploadTicket = async function() {
    const message = window.ticketMessage;
    if (!message) return;
    
    const copied = await copyToClipboard(message);
    if (copied) {
        showToast('Ticket copiado al portapapeles. Abriendo WEBCOOPEC...', 'success');
        setTimeout(() => {
            window.open('https://www.webcoopec.com/soporte/upload/open.php', '_blank');
        }, 1000);
    }
};

window.handleCopyTicket = async function() {
    const message = window.ticketMessage;
    if (!message) return;
    
    const copied = await copyToClipboard(message);
    if (copied) {
        showToast('Ticket copiado con éxito', 'success');
    }
};
