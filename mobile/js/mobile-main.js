// =====================================================
// MOBILE-MAIN.JS - Lógica principal del Index Móvil
// =====================================================

let protectedPage = null;

// Funciones de utilidad
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 300);
    }
    document.body.classList.add('loaded');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastMessage) return;
    
    toastMessage.textContent = message;
    
    // Reset classes
    toast.className = 'mobile-toast';
    
    if (type === 'error') {
        toast.classList.add('toast-error');
    } else if (type === 'success') {
        toast.classList.add('toast-success');
    }
    
    // Show toast
    toast.classList.add('show');
    
    // Hide after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function handleSessionExpired() {
    showToast('Sesión expirada. Redirigiendo al login...', 'error');
    setTimeout(() => {
        if (typeof TupakAuth !== 'undefined') {
            TupakAuth.logout();
            return;
        }
        window.location.href = 'login.html';
    }, 1500);
}

// Actualizar UI con datos de usuario
function updateUserUI(session) {
    if (!session) return;

    const welcomeName = document.getElementById('welcome-name');
    if (welcomeName && session.name) {
        const firstName = session.name.split(' ')[0];
        welcomeName.textContent = firstName;
    }

    const userAvatar = document.getElementById('user-avatar');
    if (userAvatar && session.name) {
        const initials = session.name.split(' ')
            .slice(0, 2)
            .map(n => n.charAt(0).toUpperCase())
            .join('');
        userAvatar.innerHTML = `<span>${initials || 'U'}</span>`;
    }

    const roleDisplay = document.getElementById('user-role-display');
    if (roleDisplay && session.rol) {
        const roles = session.rol.split(',').map(r => r.trim().toUpperCase());
        const filtered = roles.filter(r => r === 'ASESOR' || r === 'ADMIN').join(', ');
        roleDisplay.textContent = filtered;
    }
}

// Navegación a módulos
function navegarA(modulo) {
    const rutas = {
        'carga_comite': 'view/carga_comite.html'
    };

    if (rutas[modulo]) {
        // Add haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
        window.location.href = rutas[modulo];
    } else {
        showToast('Módulo no disponible', 'error');
    }
}

// Cambiar a versión desktop
function switchToDesktop() {
    localStorage.setItem('preferredVersion', 'desktop');
    window.location.href = '../index.html';
}

// Resetear preferencia de versión
function resetVersionPreference() {
    localStorage.removeItem('preferredVersion');
}

// Animaciones de entrada
function animateToolCards() {
    const cards = document.querySelectorAll('.tool-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
            card.style.transition = 'all 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100 + (index * 80));
    });
}

// Logout
function handleLogout() {
    if (protectedPage) {
        protectedPage.stop();
    }
    if (typeof TupakAuth !== 'undefined') {
        TupakAuth.logout();
        return;
    }
    window.location.href = 'login.html';
}

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof TupakAuth === 'undefined' || typeof TupakAuth.initializeProtectedPage !== 'function') {
        window.location.href = 'login.html';
        return;
    }

    protectedPage = TupakAuth.initializeProtectedPage({
        redirectOnFailure: false,
        onSession: updateUserUI,
        onInvalid: handleSessionExpired
    });

    const isReady = await protectedPage.start();
    if (!isReady) {
        return;
    }

    hideLoadingScreen();
    
    // Marcar preferencia como móvil
    localStorage.setItem('preferredVersion', 'mobile');

    // Animate cards after loading
    setTimeout(animateToolCards, 100);
});
