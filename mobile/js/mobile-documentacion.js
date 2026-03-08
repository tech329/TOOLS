/**
 * MOBILE DOCUMENTACIÓN - JavaScript
 * Gestión de checklist de documentos para móvil
 * Con persistencia en localStorage y reinicio automático cada 7 días
 */

// Configuración
const STORAGE_KEY = 'documentacion_checklist';
const EXPIRATION_DAYS = 7;
const TOTAL_DOCS = 15;

// Estado
let checklistData = {
    items: {},
    createdAt: null,
    lastUpdated: null
};

/**
 * Inicialización cuando el DOM está listo
 */
document.addEventListener('DOMContentLoaded', function() {
    initPage();
});

/**
 * Inicializar página
 */
function initPage() {
    // Verificar sesión
    const sessionData = localStorage.getItem('appSession');
    if (!sessionData) {
        window.location.href = '../login.html';
        return;
    }

    // Parsear sesión y mostrar nombre de usuario
    try {
        const session = JSON.parse(sessionData);
        updateUserDisplay(session);
    } catch (e) {
        console.error('Error parsing session:', e);
    }

    // Inicializar checklist
    initChecklist();
    setupEventListeners();

    // Mostrar body
    document.body.classList.add('loaded');

    // Ocultar loading después de un breve delay
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
        }
    }, 400);
}

/**
 * Actualizar información del usuario en el header
 */
function updateUserDisplay(session) {
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    
    // Usar session.name (como otros módulos móviles)
    if (nameEl && session.name) {
        const firstName = session.name.split(' ')[0];
        nameEl.textContent = firstName;
    }
    
    if (roleEl && session.rol) {
        const roles = (session.rol || "").split(',').map(r => r.trim().toUpperCase());
        const filtered = roles.filter(r => r === 'ASESOR' || r === 'ADMIN').join(', ');
        roleEl.textContent = filtered;
    }
}

/**
 * Inicializar checklist
 */
function initChecklist() {
    loadChecklistData();
    updateUI();
}

/**
 * Cargar datos del checklist desde localStorage
 */
function loadChecklistData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        
        if (stored) {
            const data = JSON.parse(stored);
            
            // Verificar si ha expirado (7 días)
            if (data.createdAt) {
                const ageInDays = (Date.now() - data.createdAt) / (1000 * 60 * 60 * 24);
                
                if (ageInDays >= EXPIRATION_DAYS) {
                    // Resetear automáticamente
                    resetChecklistData();
                    showToast('Checklist reiniciado (7 días)', 'info');
                    return;
                }
            }
            
            checklistData = data;
        } else {
            // Inicializar nuevo checklist
            resetChecklistData();
        }
    } catch (error) {
        console.error('Error cargando checklist:', error);
        resetChecklistData();
    }
}

/**
 * Resetear datos del checklist
 */
function resetChecklistData() {
    checklistData = {
        items: {},
        createdAt: Date.now(),
        lastUpdated: Date.now()
    };
    
    // Inicializar todos los items como false
    for (let i = 1; i <= TOTAL_DOCS; i++) {
        checklistData.items[i] = false;
    }
    
    saveChecklistData();
}

/**
 * Guardar datos del checklist en localStorage
 */
function saveChecklistData() {
    try {
        checklistData.lastUpdated = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(checklistData));
    } catch (error) {
        console.error('Error guardando checklist:', error);
    }
}

/**
 * Actualizar la interfaz de usuario
 */
function updateUI() {
    // Actualizar checkboxes
    for (let i = 1; i <= TOTAL_DOCS; i++) {
        const checkbox = document.getElementById(`doc${i}`);
        if (checkbox) {
            checkbox.checked = checklistData.items[i] || false;
        }
    }
    
    // Actualizar contador y progreso
    updateProgress();
    
    // Actualizar estado de reinicio
    updateResetStatus();
}

/**
 * Actualizar progreso del checklist
 */
function updateProgress() {
    const completed = Object.values(checklistData.items).filter(v => v === true).length;
    const percentage = Math.round((completed / TOTAL_DOCS) * 100);
    
    const completedEl = document.getElementById('completedCount');
    const totalEl = document.getElementById('totalCount');
    const progressFill = document.getElementById('progressFill');
    
    if (completedEl) completedEl.textContent = completed;
    if (totalEl) totalEl.textContent = TOTAL_DOCS;
    if (progressFill) progressFill.style.width = `${percentage}%`;
}

/**
 * Actualizar estado de reinicio automático
 */
function updateResetStatus() {
    const statusEl = document.getElementById('checklistStatus');
    
    if (statusEl && checklistData.createdAt) {
        const ageInDays = (Date.now() - checklistData.createdAt) / (1000 * 60 * 60 * 24);
        const remaining = Math.max(0, Math.ceil(EXPIRATION_DAYS - ageInDays));
        
        if (remaining <= 1) {
            statusEl.textContent = 'Se reiniciará pronto';
            statusEl.style.color = '#ef4444';
        } else {
            statusEl.textContent = `Reinicio en ${remaining} días`;
            statusEl.style.color = '';
        }
    }
}

/**
 * Configurar event listeners
 */
function setupEventListeners() {
    // Listeners para cada checkbox
    for (let i = 1; i <= TOTAL_DOCS; i++) {
        const checkbox = document.getElementById(`doc${i}`);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                const docNum = this.getAttribute('data-doc');
                checklistData.items[docNum] = this.checked;
                saveChecklistData();
                updateProgress();
                
                // Feedback haptico simulado
                if (this.checked && 'vibrate' in navigator) {
                    navigator.vibrate(50);
                }
            });
        }
    }
    
    // Botón de reinicio
    const resetBtn = document.getElementById('resetChecklistBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', showConfirmModal);
    }
}

/**
 * Navegar hacia atrás
 */
function goBack() {
    window.location.href = '../index.html';
}

/**
 * Mostrar modal de confirmación
 */
function showConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('overflow-hidden');
    }
}

/**
 * Cerrar modal de confirmación
 */
function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('overflow-hidden');
    }
}

/**
 * Confirmar reinicio
 */
function confirmReset() {
    closeConfirmModal();
    resetChecklistData();
    updateUI();
    showToast('Checklist reiniciado correctamente', 'success');
    
    // Vibración de confirmación
    if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
    }
}

/**
 * Mostrar notificación toast
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icon}"></i>
        </div>
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Auto-remover después de 3 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Hacer funciones disponibles globalmente para onclick
window.goBack = goBack;
window.closeConfirmModal = closeConfirmModal;
window.confirmReset = confirmReset;
