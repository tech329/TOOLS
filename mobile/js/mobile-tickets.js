// =====================================================
// MOBILE-TICKETS.JS - Lógica Tickets Versión Móvil
// =====================================================

let currentStep = 1;
let initialProblem = '';
let questionsData = [];
const MIN_LOADER_TIME = 1200;

// ===== VERIFICACIÓN DE SESIÓN =====
function verifySession() {
    const sessionData = localStorage.getItem('appSession');
    if (!sessionData) {
        window.location.href = '../login.html';
        return;
    }
    
    try {
        const session = JSON.parse(sessionData);
        // Mostrar solo el primer nombre
        const firstName = session.name ? session.name.split(' ')[0] : 'Usuario';
        document.getElementById('user-name').textContent = firstName;
        
        const roleEl = document.getElementById('user-role');
        if (roleEl && session.rol) {
            const roles = (session.rol || "").split(',').map(r => r.trim().toUpperCase());
            const filtered = roles.filter(r => r === 'ASESOR' || r === 'ADMIN').join(', ');
            roleEl.textContent = filtered;
        }
    } catch (e) {
        window.location.href = '../login.html';
    }
}

// ===== LOADER =====
function hideLoadingScreen() {
    const loader = document.getElementById('loading-screen');
    const now = Date.now();
    const elapsed = now - (window.loaderStartTime || now);
    const remaining = Math.max(0, MIN_LOADER_TIME - elapsed);

    setTimeout(() => {
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
                document.body.classList.add('loaded');
            }, 300);
        }
    }, remaining);
}

// ===== TOAST MÓVIL =====
function showToast(message) {
    const toast = document.getElementById('toast-mobile');
    if (!toast) return;
    
    toast.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 4000);
}

// ===== LÓGICA DE TICKETS =====

function parseMarkdownWithInputs(markdownText) {
    questionsData = [];
    let html = typeof marked !== 'undefined' ? marked.parse(markdownText) : markdownText;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const listItems = tempDiv.querySelectorAll('li');
    
    listItems.forEach(li => {
        const text = li.textContent || li.innerText;
        questionsData.push(text.replace(/\[input:[^\]]+\]/g, '').trim());
    });
    
    return html.replace(/\[input:([^\]]+)\]/g, (match, inputId) => {
        return `<input type="text" id="${inputId}" class="m-dynamic-input" data-q-index="${questionsData.length - 1}" placeholder="Tu respuesta..." />`;
    });
}

async function simulateWebhook1(problema) {
    showToast('[Simulación] Webhook ejecutado: Enviar problema inicial');
    return new Promise(r => setTimeout(() => r([{
        output: "### Por favor responda:\n\n1. ¿Cuándo ocurrió? [input:cuando]\n2. ¿Qué hacía antes? [input:antes]\n3. ¿Módulo afectado? [input:modulo]"
    }]), 1500));
}

async function simulateWebhook2(payload) {
    showToast('[Simulación] Webhook ejecutado: Enviar respuestas');
    return new Promise(r => setTimeout(() => r([{
        output: `TICKET GENERADO (MÓVIL)\n\nProblema: ${payload.descripcion_del_problema}\n\nRespuestas:\n${payload.respuesta_a_preguntas_relacionadas}\n\n[Sugerencia: Intente borrar caché del navegador.]`
    }]), 1500));
}

document.addEventListener('DOMContentLoaded', () => {
    verifySession();
    hideLoadingScreen();

    const btnNext = document.getElementById('m-btn-next');
    const btnGenerate = document.getElementById('m-btn-generate');
    const inputProblem = document.getElementById('m-input-problem');

    btnNext.addEventListener('click', async () => {
        const p = inputProblem.value.trim();
        if (!p) { showToast('Describe el problema'); return; }

        initialProblem = p;
        btnNext.disabled = true;
        btnNext.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const data = await simulateWebhook1(p);
        const html = parseMarkdownWithInputs(data[0].output);

        document.getElementById('m-questions-container').innerHTML = html;
        document.getElementById('m-step1').style.display = 'none';
        document.getElementById('m-step2').classList.remove('hidden');
        
        document.getElementById('indicator-step1').classList.remove('active');
        document.getElementById('indicator-step2').classList.add('active');
        document.getElementById('indicator-line').classList.add('active');
        
        window.scrollTo(0,0);
        btnNext.disabled = false;
        btnNext.innerHTML = 'Continuar <i class="fas fa-arrow-right ml-2"></i>';
    });

    btnGenerate.addEventListener('click', async () => {
        const inputs = document.querySelectorAll('.m-dynamic-input');
        let qa = '';
        inputs.forEach((inp, idx) => {
            qa += `P: ${questionsData[idx]}\nR: ${inp.value}\n\n`;
        });

        btnGenerate.disabled = true;
        const data = await simulateWebhook2({
            descripcion_del_problema: initialProblem,
            respuesta_a_preguntas_relacionadas: qa
        });

        const full = data[0].output;
        const main = full.replace(/\[[^\]]+\]/g, '').trim();
        const sug = (full.match(/\[([^\]]+)\]/) || [])[1];

        document.getElementById('m-result-text').textContent = main;
        window.mTicket = main;

        if (sug) {
            document.getElementById('m-sug-text').textContent = sug;
            document.getElementById('m-sug-box').classList.remove('hidden');
        }

        document.getElementById('m-step2').style.display = 'none';
        document.getElementById('m-result-step').classList.remove('hidden');
        window.scrollTo(0,0);
    });
});

window.mBackTo1 = () => location.reload();

window.mCopy = () => {
    navigator.clipboard.writeText(window.mTicket);
    showToast('Copiado al portapapeles');
};

window.mUpload = () => {
    navigator.clipboard.writeText(window.mTicket);
    showToast('Copiado. Abriendo soporte...');
    setTimeout(() => window.open('https://www.webcoopec.com/soporte/upload/open.php', '_blank'), 1000);
};
