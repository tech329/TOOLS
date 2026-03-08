// =====================================================
// HERRAMIENTAS DE CONSULTA - MOBILE JavaScript
// =====================================================

let protectedPage = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initPage();
});

// Configuración de herramientas
const TOOLS = [
    {
        id: 'verificar-cedula',
        title: 'Verificar Nombres con Cédula',
        description: 'Consulta nombres asociados a cédulas en Ecuador.',
        image: 'https://lh3.googleusercontent.com/d/1pFyHvGxdIi_zqXpuwtK8WBrKQdUSFkpE',
        action: 'Acceder',
        url: 'https://srienlinea.sri.gob.ec/sri-en-linea/SriPagosWeb/ConsultaDeudasFirmesImpugnadas/Consultas/consultaDeudasFirmesImpugnadas',
        external: true
    },
    {
        id: 'autorizacion-buro',
        title: 'Autorización Buró Crediticio',
        description: 'Genera autorización para consulta de buró de crédito.',
        image: 'https://lh3.googleusercontent.com/d/1Ad540QfeZwub_InNyxbb0v3m0lrWfcAy',
        action: 'Generar',
        url: 'autorizacion_buro.html',
        external: false,
        internal: true
    },
    {
        id: 'equifax',
        title: 'Equifax Buró de Crédito',
        description: 'Consulta historial crediticio con Equifax.',
        image: 'https://lh3.googleusercontent.com/d/1fVSs_tfen9B9XtDa1NzZErbUfNkgRXlw',
        action: 'Acceder',
        url: 'https://interactivereports.equifax.com/ir/report',
        external: true
    },
    {
        id: 'procesos-judiciales',
        title: 'Procesos Judiciales',
        description: 'Consulta procesos en la Función Judicial.',
        image: 'https://lh3.googleusercontent.com/d/1DlLnxlxRWev6PnrTABPpUgZKa1u-Jq-h',
        action: 'Acceder',
        url: 'https://procesosjudiciales.funcionjudicial.gob.ec/busqueda-filtros',
        external: true
    },
    {
        id: 'supa',
        title: 'SUPA - Pensiones Alimenticias',
        description: 'Sistema Único de Pensiones Alimenticias.',
        image: 'https://lh3.googleusercontent.com/d/18KYmHmmyL3jC86EdCVOcIersc0WuQqhO',
        action: 'Acceder',
        url: 'https://supa.funcionjudicial.gob.ec/pensiones/publico/consulta.jsf',
        external: true
    },
    {
        id: 'consulta-ruc',
        title: 'Consulta RUC - SRI',
        description: 'Consulta información de RUC y datos tributarios.',
        image: 'https://lh3.googleusercontent.com/d/1QMiZTDTbqoJZT-IjXWDELXGojLWBlotl',
        action: 'Acceder',
        url: 'https://srienlinea.sri.gob.ec/sri-en-linea/SriRucWeb/ConsultaRuc/Consultas/consultaRuc',
        external: true
    },
    {
        id: 'catastros-mejia',
        title: 'Catastros Cantón Mejía',
        description: 'Consulta información catastral del Cantón Mejía.',
        image: 'https://lh3.googleusercontent.com/d/1F_ZL-uUIuHITdumFJoK8Ex3wIGXcCndE',
        action: 'Consultar',
        url: 'catastros_mejia.html',
        external: false,
        internal: true
    },
    {
        id: 'catastros-latacunga',
        title: 'Catastros Latacunga',
        description: 'Consulta catastral del Cantón Latacunga.',
        image: 'https://lh3.googleusercontent.com/d/14LMKezmM_4oNT2-xJqHH4BMGjSMAg_Vb',
        action: 'Acceder',
        url: 'https://servltga.latacunga.gob.ec/portal_ec/latacunga.php',
        external: true
    },
    {
        id: 'multas-transito',
        title: 'Multas de Tránsito',
        description: 'Consulta multas con la ANT.',
        image: 'https://lh3.googleusercontent.com/d/165EU5e_h4u_FaZ1DNQb3r4X5_pqfZnyi',
        action: 'Acceder',
        url: 'https://ant.com.ec/multas-transito',
        external: true
    },
    {
        id: 'proximamente',
        title: 'Nueva Herramienta',
        description: 'Próximamente disponible.',
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
        onSession: updateUserDisplay,
        onInvalid: handleSessionExpired
    });

    const isReady = await protectedPage.start();
    if (!isReady) {
        return;
    }

    // Renderizar tarjetas
    renderToolCards();

    // Mostrar body
    document.body.classList.add('loaded');

    // Ocultar loading
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
        }
    }, 400);

}

function updateUserDisplay(session) {
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    
    if (nameEl && session.name) {
        // Mostrar solo el primer nombre en el header
        const firstName = session.name.split(' ')[0];
        nameEl.textContent = firstName;
    }

    if (roleEl && session.rol) {
        const roles = (session.rol || "").split(',').map(r => r.trim().toUpperCase());
        const filtered = roles.filter(r => r === 'ASESOR' || r === 'ADMIN').join(', ');
        roleEl.textContent = filtered;
    }
}

function handleSessionExpired() {
    showSessionExpiredScreen();
}

function showSessionExpiredScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div class="text-center">
                <i class="fas fa-user-lock" style="font-size: 3rem; color: var(--secondary); margin-bottom: 1rem;"></i>
                <div class="loading-text" style="font-size: 1.2rem; font-weight: 600;">Sesión Expirada</div>
                <div class="loading-brand" style="margin-bottom: 1.5rem;">Su token de seguridad ha sido invalidado.</div>
                <button onclick="if (window.TupakAuth) { window.TupakAuth.logout(); } else { window.location.href='../login.html'; }" style="background: var(--secondary); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 0.95rem;">
                    <i class="fas fa-sign-in-alt" style="margin-right: 8px;"></i>VOLVER AL INICIO
                </button>
            </div>
            <div class="loading-footer">
                <span>POWERED BY</span>
                <img src="../../shared/img/lpsolutionswithe.webp" alt="LP Solutions">
            </div>
        `;
        loadingScreen.style.display = 'flex';
        loadingScreen.classList.remove('fade-out');
    } else {
        window.location.href = '../login.html';
    }
}

function renderToolCards() {
    const list = document.getElementById('tools-list');
    if (!list) return;

    list.innerHTML = TOOLS.map(tool => createToolCard(tool)).join('');
}

function createToolCard(tool) {
    const disabledClass = tool.disabled ? 'disabled' : '';
    const onClick = tool.disabled ? '' : `onclick="openTool('${tool.id}')"`;
    
    const imageContent = tool.image 
        ? `<img src="${tool.image}" alt="${tool.title}" loading="lazy">`
        : `<div class="card-image-placeholder">
               <i class="fas fa-plus-circle"></i>
               <span>Próx.</span>
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

    // Feedback táctil
    if (navigator.vibrate) {
        navigator.vibrate(10);
    }

    // Si es herramienta interna, navegar directamente (mejor compatibilidad)
    if (tool.internal) {
        // Navegar directamente a la página interna
        window.location.href = tool.url;
    } else {
        // Herramientas externas se abren en nueva pestaña
        window.open(tool.url, '_blank');
    }
}

function goBack() {
    window.location.href = '../index.html';
}

// Toast notification
function showToast(type, message) {
    const container = document.querySelector('.toast-container') || createToastContainer();
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
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
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}
