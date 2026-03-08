// =====================================================
// HERRAMIENTAS DE CONSULTA - PC JavaScript
// =====================================================

let protectedPage = null;

const loaderStartTime = Date.now();
const MIN_LOADER_TIME = 1200;

document.addEventListener('DOMContentLoaded', async () => {
    await initPage();
});

// Configuración de herramientas
const TOOLS = [
    {
        id: 'verificar-cedula',
        title: 'Verificar Nombres con Cédula',
        description: 'Consulta y verifica nombres asociados a números de cédula en Ecuador.',
        image: 'https://lh3.googleusercontent.com/d/1pFyHvGxdIi_zqXpuwtK8WBrKQdUSFkpE',
        action: 'Acceder al sistema',
        url: 'https://srienlinea.sri.gob.ec/sri-en-linea/SriPagosWeb/ConsultaDeudasFirmesImpugnadas/Consultas/consultaDeudasFirmesImpugnadas',
        external: true
    },
    {
        id: 'autorizacion-buro',
        title: 'Autorización de revisión del buró crediticio',
        description: 'Genera una autorización formal para la consulta de tu historial crediticio.',
        image: 'https://lh3.googleusercontent.com/d/1Ad540QfeZwub_InNyxbb0v3m0lrWfcAy',
        action: 'Generar documento',
        url: 'autorizacion_buro.html',
        external: false,
        internal: true
    },
    {
        id: 'equifax',
        title: 'Equifax Buró de Crédito',
        description: 'Consulta tu historial crediticio y reportes de crédito con Equifax Ecuador.',
        image: 'https://lh3.googleusercontent.com/d/1fVSs_tfen9B9XtDa1NzZErbUfNkgRXlw',
        action: 'Acceder al sistema',
        url: 'https://interactivereports.equifax.com/ir/report',
        external: true
    },
    {
        id: 'procesos-judiciales',
        title: 'Consulta de Procesos Judiciales',
        description: 'Accede al sistema de consulta de procesos judiciales de la Función Judicial del Ecuador.',
        image: 'https://lh3.googleusercontent.com/d/1DlLnxlxRWev6PnrTABPpUgZKa1u-Jq-h',
        action: 'Acceder al sistema',
        url: 'https://procesosjudiciales.funcionjudicial.gob.ec/busqueda-filtros',
        external: true
    },
    {
        id: 'supa',
        title: 'SUPA',
        description: 'Sistema Único de Pensiones Alimenticias - Consulta de pensiones alimenticias.',
        image: 'https://lh3.googleusercontent.com/d/18KYmHmmyL3jC86EdCVOcIersc0WuQqhO',
        action: 'Acceder al sistema',
        url: 'https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf',
        external: true
    },
    {
        id: 'consulta-ruc',
        title: 'Consulta RUC - SRI',
        description: 'Consulta información de RUC y datos tributarios con el Servicio de Rentas Internas.',
        image: 'https://lh3.googleusercontent.com/d/1QMiZTDTbqoJZT-IjXWDELXGojLWBlotl',
        action: 'Acceder al sistema',
        url: 'https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc',
        external: true
    },
    {
        id: 'catastros-mejia',
        title: 'Consulta de Catastros en el Cantón Mejía',
        description: 'Consulta información catastral y verifica propiedades en el Cantón Mejía.',
        image: 'https://lh3.googleusercontent.com/d/1F_ZL-uUIuHITdumFJoK8Ex3wIGXcCndE',
        action: 'Acceder al sistema',
        url: 'catastros_mejia.html',
        external: false,
        internal: true
    },
    {
        id: 'catastros-latacunga',
        title: 'Consulta de Catastros de Latacunga',
        description: 'Consulta información catastral y verifica propiedades en el Cantón Latacunga.',
        image: 'https://lh3.googleusercontent.com/d/14LMKezmM_4oNT2-xJqHH4BMGjSMAg_Vb',
        action: 'Acceder al sistema',
        url: 'https://servltga.latacunga.gob.ec/portal_ec/latacunga.php',
        external: true
    },
    {
        id: 'multas-transito',
        title: 'Multas de Tránsito',
        description: 'Consulta y verifica multas de tránsito con la Agencia Nacional de Tránsito (ANT).',
        image: 'https://lh3.googleusercontent.com/d/165EU5e_h4u_FaZ1DNQb3r4X5_pqfZnyi',
        action: 'Acceder al sistema',
        url: 'https://ant.com.ec/multas-transito',
        external: true
    },
    {
        id: 'proximamente',
        title: 'Nueva Herramienta',
        description: 'Espacio reservado para futuras herramientas de consulta.',
        image: null,
        action: 'Próximamente',
        url: null,
        disabled: true
    }
];

async function initPage() {
    if (typeof TupakAuth === 'undefined' || typeof TupakAuth.initializeProtectedPage !== 'function') {
        window.location.href = '../login.html';
        return;
    }

    protectedPage = TupakAuth.initializeProtectedPage({
        redirectOnFailure: false,
        onSession: setupUserInfo,
        onInvalid: handleSessionExpired
    });

    const isReady = await protectedPage.start();
    if (!isReady) {
        return;
    }

    // Renderizar tarjetas
    renderToolCards();

    // Ocultar loading con tiempo mínimo de 1200ms
    const elapsed = Date.now() - loaderStartTime;
    const remainingTime = Math.max(0, MIN_LOADER_TIME - elapsed);
    
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
            document.body.classList.add('loaded');
        }
    }, remainingTime);

}

function handleSessionExpired() {
    showToast('error', 'Sesión expirada. Redirigiendo al login...');
    setTimeout(() => {
        if (typeof TupakAuth !== 'undefined') {
            TupakAuth.logout();
            return;
        }
        window.location.href = '../login.html';
    }, 1500);
}

function setupUserInfo(userData) {
    const nameEl = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    const roleEl = document.getElementById('user-role');
    
    // La sesión guarda 'name' no 'nombre'
    const userName = userData.name || userData.nombre || 'Usuario';
    
    if (nameEl) {
        nameEl.textContent = userName;
    }
    
    if (avatarEl && userName) {
        avatarEl.textContent = userName.charAt(0).toUpperCase();
    }

    if (roleEl && userData.rol) {
        const roles = (userData.rol || "").split(',').map(r => r.trim().toUpperCase());
        const filtered = roles.filter(r => r === 'ASESOR' || r === 'ADMIN').join(', ');
        roleEl.textContent = filtered;
    }
}

function renderToolCards() {
    const grid = document.getElementById('tools-grid');
    if (!grid) return;

    grid.innerHTML = TOOLS.map(tool => createToolCard(tool)).join('');
}

function createToolCard(tool) {
    const disabledClass = tool.disabled ? 'disabled' : '';
    const onClick = tool.disabled ? '' : `onclick="openTool('${tool.id}')"`;
    
    const imageContent = tool.image 
        ? `<img src="${tool.image}" alt="${tool.title}" loading="lazy">`
        : `<div class="card-image-placeholder">
               <i class="fas fa-plus-circle"></i>
               <span>Próximamente</span>
           </div>`;
    
    const internalBadge = tool.internal 
        ? `<span class="internal-badge">Interno</span>` 
        : '';
    
    const actionIcon = tool.external 
        ? '<i class="fas fa-external-link-alt"></i>' 
        : tool.disabled 
            ? '<i class="fas fa-clock"></i>'
            : '<i class="fas fa-arrow-right"></i>';

    return `
        <div class="tool-card ${disabledClass}" ${onClick}>
            <div class="card-image">
                ${imageContent}
                ${internalBadge}
            </div>
            <div class="card-body">
                <h3 class="card-title">${tool.title}</h3>
                <p class="card-description">${tool.description}</p>
                <div class="card-action">
                    <span>${tool.action}</span>
                    ${actionIcon}
                </div>
            </div>
        </div>
    `;
}

function openTool(toolId) {
    const tool = TOOLS.find(t => t.id === toolId);
    if (!tool || tool.disabled) return;

    if (tool.external) {
        window.open(tool.url, '_blank');
    } else {
        window.open(tool.url, '_blank');
    }
}

// Toast notification
function showToast(type, message) {
    const container = document.querySelector('.toast-container') || createToastContainer();
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}
