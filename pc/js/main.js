// =====================================================
// MAIN.JS - Lógica principal del Index
// =====================================================

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

    if (type === 'error') {
        toast.className = 'fixed top-5 right-5 bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg transform transition-all duration-300 z-50';
    } else if (type === 'success') {
        toast.className = 'fixed top-5 right-5 bg-green-600 text-white px-6 py-4 rounded-lg shadow-lg transform transition-all duration-300 z-50';
    } else {
        toast.className = 'fixed top-5 right-5 bg-gray-800 text-white px-6 py-4 rounded-lg shadow-lg transform transition-all duration-300 z-50';
    }

    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);

    setTimeout(() => {
        toast.style.transform = 'translateX(200%)';
    }, 4000);
}

// Navegación a módulos
function navegarA(modulo) {
    const rutas = {
        'carga_comite': window.APP_CONFIG?.URLS?.CARGA_COMITE || 'src/view/carga_comite.html'
    };

    if (rutas[modulo]) {
        window.location.href = rutas[modulo];
    } else {
        showToast('Módulo no disponible', 'error');
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    hideLoadingScreen();
});
