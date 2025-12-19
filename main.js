// main.js - Sistema Principal de TUPAK RIKUNA
// Gestión de navegación, sesiones y carga de módulos

// ===== CONFIGURACIÓN SUPABASE =====
// Nota: este archivo puede ser evaluado más de una vez (por recargas en vivo o inyección de módulos).
// Para evitar errores de "Identifier ... has already been declared", usamos `var` + `window.*`.
var SUPABASE_URL = window.SUPABASE_URL || 'https://lpsupabase.luispinta.com';
var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.bZRDLg2HoJKCXPp_B6BD5s-qcZM6-NrKO8qtxBtFGTk';
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// NO asignar supabase aquí - se asigna dinámicamente cuando esté listo
var supabase = null;

function waitForSupabaseLibrary(timeoutMs = 30000, intervalMs = 100) {
    console.log('⏱️ Esperando librería Supabase... (timeout:', timeoutMs, 'ms)');
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const timer = setInterval(() => {
            const lib = window.supabase;
            const elapsed = Date.now() - start;

            if (lib && typeof lib.createClient === 'function') {
                console.log('✅ Supabase library encontrada después de', elapsed, 'ms');
                clearInterval(timer);
                resolve(lib);
                return;
            }

            if (elapsed >= timeoutMs) {
                clearInterval(timer);
                console.error('❌ Timeout después de', elapsed, 'ms');
                console.error('❌ window.supabase:', window.supabase);
                console.error('❌ typeof createClient:', typeof window.supabase?.createClient);
                reject(new Error('Timeout: Supabase library no se cargó en ' + (timeoutMs / 1000) + ' segundos'));
            }
        }, intervalMs);
    });
}

async function ensureSupabaseClient() {
    if (supabase && supabase.auth) return supabase;
    if (window.TupakSupabase && window.TupakSupabase.auth) {
        supabase = window.TupakSupabase;
        return supabase;
    }

    const lib = (window.supabase && typeof window.supabase.createClient === 'function')
        ? window.supabase
        : await waitForSupabaseLibrary();

    supabase = window.TupakSupabase;
    if (!supabase) {
        // Usar sessionStorage para que la sesión se pierda al cerrar navegador
        supabase = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                storage: sessionStorage // Sesión solo dura mientras el navegador está abierto
            }
        });
        window.TupakSupabase = supabase;
    }

    return supabase;
}

window.TupakSupabaseReady = window.TupakSupabaseReady || ensureSupabaseClient().catch((err) => {
    console.error(err?.message || err);
    return null;
});

// ===== VARIABLES GLOBALES =====
var currentUser = null;
var isAuthenticated = false;

// ===== UTILIDADES =====
function showToast(message, type = 'info', duration = 3000) {
    // Crear contenedor si no existe
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} p-4 rounded-lg shadow-lg max-w-sm`;

    const icon = type === 'success' ? 'check-circle' :
        type === 'error' ? 'exclamation-circle' :
            type === 'warning' ? 'exclamation-triangle' : 'info-circle';

    toast.innerHTML = `
        <div class="flex items-center space-x-3">
            <i class="fas fa-${icon} text-lg"></i>
            <span class="flex-1">${message}</span>
            <button class="toast-close text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Estilos según tipo
    if (type === 'success') {
        toast.classList.add('bg-green-500', 'text-white');
    } else if (type === 'error') {
        toast.classList.add('bg-red-500', 'text-white');
    } else if (type === 'warning') {
        toast.classList.add('bg-yellow-500', 'text-black');
    } else {
        toast.classList.add('bg-blue-500', 'text-white');
    }

    toastContainer.appendChild(toast);

    // Remover automáticamente
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, duration);

    // Permitir cerrar manualmente
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
}

function showModal(title, message, onConfirm = null, confirmText = 'Confirmar', cancelText = 'Cancelar') {
    // Crear modal si no existe
    let modal = document.getElementById('confirmation-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirmation-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 id="modal-title" class="text-lg font-semibold text-gray-900"></h3>
                    <button id="modal-close" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <p id="modal-message" class="text-gray-600 mb-6"></p>
                <div class="flex justify-end space-x-3">
                    <button id="modal-cancel" class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">${cancelText}</button>
                    <button id="modal-confirm" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">${confirmText}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const titleEl = modal.querySelector('#modal-title');
    const messageEl = modal.querySelector('#modal-message');
    const confirmBtn = modal.querySelector('#modal-confirm');
    const cancelBtn = modal.querySelector('#modal-cancel');
    const closeBtn = modal.querySelector('#modal-close');

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    modal.style.display = 'flex';

    const closeModal = () => {
        modal.style.display = 'none';
    };

    confirmBtn.onclick = () => {
        if (onConfirm) onConfirm();
        closeModal();
    };

    cancelBtn.onclick = closeModal;
    closeBtn.onclick = closeModal;
}

// ===== GESTIÓN DE PANTALLA DE CARGA =====
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const app = document.getElementById('app');

    if (loadingScreen) {
        loadingScreen.classList.remove('fade-out');
        loadingScreen.style.display = 'flex';
    }

    if (app) {
        app.classList.remove('show');
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const app = document.getElementById('app');

    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 300);
    }

    if (app) {
        app.classList.add('show');
    }
}

// ===== GESTIÓN DE AUTENTICACIÓN =====
async function checkAuth() {
    try {
        showLoadingScreen();

        let client;

        // SOLUCIÓN 1: Si TupakSupabase ya existe, usar directamente
        if (window.TupakSupabase && window.TupakSupabase.auth) {
            client = window.TupakSupabase;
        }
        // SOLUCIÓN 2: Si la librería existe pero el cliente no, CREAR EL CLIENTE AHORA
        else if (window.supabase && typeof window.supabase.createClient === 'function') {
            try {
                client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        storage: sessionStorage
                    }
                });
                window.TupakSupabase = client;
            } catch (createError) {
                console.error('Error creando cliente Supabase:', createError);
                client = null;
            }
        }
        // SOLUCIÓN 3: Si ninguna de las anteriores, esperar Promise con timeout
        else {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout esperando cliente Supabase')), 3000);
            });

            try {
                client = await Promise.race([window.TupakSupabaseReady, timeoutPromise]);
            } catch (timeoutError) {
                console.error('Timeout esperando Supabase:', timeoutError.message);
                client = window.TupakSupabase || null;
            }
        }

        if (!client) {
            console.error('No se pudo obtener cliente Supabase');
            hideUserInterface();
            alert('Error: No se pudo cargar Supabase. Por favor:\n1. Verifica tu conexión a internet\n2. Recarga la página (Ctrl+F5)\n3. Si el problema persiste, contacta soporte');
            return false;
        }

        supabase = client;

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
            hideUserInterface();
            window.location.href = 'login.html';
            return false;
        }

        currentUser = session.user;
        isAuthenticated = true;
        updateUserInterface();

        return true;
    } catch (error) {
        console.error('Error en checkAuth():', error);
        hideUserInterface();
        window.location.href = 'login.html';
        return false;
    } finally {
        hideLoadingScreen();
    }
}

function updateUserInterface() {
    if (!currentUser) return;

    // Actualizar información del usuario en el header
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        // Intentar obtener el nombre de varias fuentes
        let displayName = sessionStorage.getItem('nombreUsuarioActual') ||
            currentUser.user_metadata?.full_name ||
            currentUser.user_metadata?.nombre ||
            currentUser.user_metadata?.name ||
            currentUser.email?.split('@')[0] ||
            'Usuario';
        userInfo.textContent = displayName;
    }

    // Mostrar y configurar el botón de logout
    const logoutContainer = document.getElementById('logout-btn');
    if (logoutContainer) {
        logoutContainer.classList.remove('hidden');
        logoutContainer.innerHTML = `
            <button onclick="window.TupakAuth.logout()"
                    class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center">
                <i class="fas fa-sign-out-alt mr-2"></i>
                <span class="hidden sm:inline">Cerrar Sesión</span>
                <span class="sm:hidden">Salir</span>
            </button>
        `;
    }
}

function hideUserInterface() {
    // Ocultar el botón de logout
    const logoutContainer = document.getElementById('logout-btn');
    if (logoutContainer) {
        logoutContainer.classList.add('hidden');
        logoutContainer.innerHTML = '';
    }

    // Resetear información del usuario
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        userInfo.textContent = 'Usuario';
    }
}

async function logout() {
    showModal(
        'Cerrar Sesión',
        '¿Está seguro que desea cerrar sesión?',
        async () => {
            try {
                const client = await window.TupakSupabaseReady;
                if (!client) {
                    currentUser = null;
                    isAuthenticated = false;
                    hideUserInterface();
                    window.location.href = 'login.html';
                    return;
                }
                supabase = client;

                // Limpiar datos de sesión
                sessionStorage.clear(); // Limpiar toda la sessionStorage

                // También limpiar localStorage de cualquier token antiguo de Supabase
                try {
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && (key.includes('supabase') || key.includes('sb-') || key.includes('auth-token') || key.includes('tupak'))) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(key => localStorage.removeItem(key));
                } catch (e) { console.warn('Error limpiando localStorage:', e); }

                // Limpiar caché de cartera
                if (typeof clearCarteraAccessCache === 'function') {
                    clearCarteraAccessCache();
                }

                // Cerrar sesión en Supabase
                const { error } = await supabase.auth.signOut();
                if (error) {
                    console.warn('Error al cerrar sesión en Supabase:', error);
                }

                // Limpiar variables globales
                currentUser = null;
                isAuthenticated = false;

                // Ocultar elementos de UI de usuario
                hideUserInterface();

                // Mostrar formulario de login
                window.location.href = 'login.html';

                showToast('Sesión cerrada correctamente', 'info');

            } catch (error) {
                console.error('Error en logout:', error);
                // Aún así limpiar y mostrar login
                currentUser = null;
                isAuthenticated = false;
                hideUserInterface();
                window.location.href = 'login.html';
            }
        }
    );
}

// ===== ESCUCHAR CAMBIOS DE AUTENTICACIÓN =====
(async () => {
    const client = await window.TupakSupabaseReady;
    if (!client) return;
    supabase = client;

    supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth State Change:', event);
        if (event === 'SIGNED_OUT') {
            // Limpiar caché de cartera al cerrar sesión
            if (typeof clearCarteraAccessCache === 'function') {
                clearCarteraAccessCache();
            }

            currentUser = null;
            isAuthenticated = false;
            hideUserInterface();
            // Solo redirigir si estamos seguros de que fue una acción explícita
            // window.location.href = 'login.html'; 
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            currentUser = session?.user || null;
            isAuthenticated = true;
            if (document.getElementById('login-container')) {
                document.getElementById('login-container').remove();
                document.getElementById('app').style.display = 'block';
            }
            updateUserInterface();

            // Verificar acceso a cartera cuando el usuario inicia sesión
            if (typeof toggleCarteraTab === 'function') {
                setTimeout(() => toggleCarteraTab(), 100);
            }
        }
    });
})();

// ===== EXPORTAR FUNCIONES GLOBALES =====
window.TupakAuth = {
    checkAuth,
    logout,
    showToast,
    showModal,
    supabase: () => window.TupakSupabase || supabase,
    supabaseReady: () => window.TupakSupabaseReady,
    getCurrentUser: () => currentUser,
    isAuthenticated: () => isAuthenticated,
    hideUserInterface,
    updateUserInterface
};
