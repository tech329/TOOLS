// =====================================================
// DOCUMENTACIÓN - PC JavaScript
// =====================================================

// Configuración de tiempos
const loaderStartTime = Date.now();
const MIN_LOADER_TIME = 1200;

// Configuración del checklist
const STORAGE_KEY = 'documentChecklist';
const TIMESTAMP_KEY = 'documentChecklistTimestamp';
const RESET_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos

let protectedPage = null;

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
    await initPage();
});

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

    // Inicializar checklist
    initChecklist();

    // Ocultar loading con tiempo mínimo de 1200ms
    hideLoadingScreen();

}

// ===== GESTIÓN DE USUARIO =====
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

// ===== LOADING SCREEN =====
function hideLoadingScreen() {
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
    showToast('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'error');
    setTimeout(() => {
        if (typeof TupakAuth !== 'undefined') {
            TupakAuth.logout();
            return;
        }
        window.location.href = '../login.html';
    }, 2000);
}

// ===== CHECKLIST MANAGEMENT =====
function initChecklist() {
    // Verificar expiración
    checkExpiration();

    // Cargar estado guardado
    loadChecklistState();

    // Agregar event listeners
    attachChecklistListeners();

    // Actualizar contadores
    updateCounters();

    // Actualizar display de estado
    updateLastResetDisplay();
}

function checkExpiration() {
    const timestamp = localStorage.getItem(TIMESTAMP_KEY);
    if (timestamp) {
        const lastReset = new Date(parseInt(timestamp));
        const now = new Date();
        const timeDiff = now.getTime() - lastReset.getTime();

        if (timeDiff > RESET_PERIOD) {
            resetChecklist(false); // Reset sin notificación
            return;
        }
    }

    // Si no existe timestamp, crear uno
    if (!timestamp) {
        localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());
    }
}

function loadChecklistState() {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
        try {
            const checkedItems = JSON.parse(savedState);
            checkedItems.forEach(docId => {
                const checkbox = document.getElementById(`doc${docId}`);
                if (checkbox) {
                    checkbox.checked = true;
                    updateRowStyle(checkbox, true);
                }
            });
        } catch (e) {
            console.error('Error loading checklist state:', e);
        }
    }
}

function saveChecklistState() {
    const checkboxes = document.querySelectorAll('.document-checkbox');
    const checkedItems = [];

    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const docId = checkbox.getAttribute('data-doc');
            checkedItems.push(docId);
        }
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedItems));
}

function resetChecklist(showNotification = true) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(TIMESTAMP_KEY, Date.now().toString());

    const checkboxes = document.querySelectorAll('.document-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        updateRowStyle(checkbox, false);
    });

    updateCounters();
    updateLastResetDisplay();

    if (showNotification) {
        showToast('Checklist reiniciado correctamente', 'success');
    }
}

function updateRowStyle(checkbox, isChecked) {
    const row = checkbox.closest('.document-item');
    if (!row) return;

    if (isChecked) {
        row.classList.add('completed');
    } else {
        row.classList.remove('completed');
    }
}

function updateCounters() {
    const checkboxes = document.querySelectorAll('.document-checkbox');
    const totalCount = checkboxes.length;
    const completedCount = Array.from(checkboxes).filter(cb => cb.checked).length;

    const completedEl = document.getElementById('completedCount');
    const totalEl = document.getElementById('totalCount');

    if (completedEl) completedEl.textContent = completedCount;
    if (totalEl) totalEl.textContent = totalCount;
}

function updateLastResetDisplay() {
    const timestamp = localStorage.getItem(TIMESTAMP_KEY);
    const statusElement = document.getElementById('checklistStatus');

    if (!statusElement) return;

    if (timestamp) {
        const lastReset = new Date(parseInt(timestamp));
        const now = new Date();
        const daysAgo = Math.floor((now.getTime() - lastReset.getTime()) / (24 * 60 * 60 * 1000));
        const daysRemaining = Math.max(0, 7 - daysAgo);

        if (daysRemaining > 0) {
            statusElement.textContent = `Checklist se reinicia en ${daysRemaining} día${daysRemaining !== 1 ? 's' : ''}`;
        } else {
            statusElement.innerHTML = `<span style="color: #d97706;">Checklist listo para reiniciar</span>`;
        }
    } else {
        statusElement.textContent = `Checklist se reinicia automáticamente cada 7 días`;
    }
}

function attachChecklistListeners() {
    // Checkbox change listeners
    const checkboxes = document.querySelectorAll('.document-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            updateRowStyle(e.target, e.target.checked);
            saveChecklistState();
            updateCounters();
        });
    });

    // Reset button listener
    const resetButton = document.getElementById('resetChecklistBtn');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            showConfirmModal(
                'Reiniciar Checklist',
                '¿Estás seguro que deseas reiniciar el checklist? Se perderá todo el progreso actual.',
                () => resetChecklist(true)
            );
        });
    }
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'check-circle' :
        type === 'error' ? 'exclamation-circle' : 'info-circle';

    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Remover automáticamente
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, duration);
}

// ===== CONFIRM MODAL =====
function showConfirmModal(title, message, onConfirm) {
    // Remover modal existente si hay uno
    const existingModal = document.querySelector('.confirm-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.innerHTML = `
        <div class="confirm-modal-content">
            <div class="confirm-modal-icon">
                <i class="fas fa-refresh"></i>
            </div>
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="confirm-modal-buttons">
                <button class="btn-cancel">Cancelar</button>
                <button class="btn-confirm">Sí, Reiniciar</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('overflow-hidden');

    // Mostrar con animación
    requestAnimationFrame(() => {
        modal.classList.add('show');
    });

    // Event listeners
    const cancelBtn = modal.querySelector('.btn-cancel');
    const confirmBtn = modal.querySelector('.btn-confirm');

    const closeModal = () => {
        modal.classList.remove('show');
        document.body.classList.remove('overflow-hidden');
        setTimeout(() => modal.remove(), 300);
    };

    cancelBtn.addEventListener('click', closeModal);
    confirmBtn.addEventListener('click', () => {
        onConfirm();
        closeModal();
    });

    // Cerrar al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

// ===== CLEANUP =====
window.addEventListener('beforeunload', () => {
    if (protectedPage) {
        protectedPage.stop();
    }
});
