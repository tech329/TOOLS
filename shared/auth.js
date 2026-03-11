// =====================================================
// AUTH.JS - Sistema de Autenticación con Webhooks
// Compartido entre versiones PC y Mobile
// =====================================================

const SESSION_KEY = 'appSession';

// Webhooks de autenticación
const AUTH_WEBHOOKS = {
    LOGIN: 'https://lpn8nwebhook.luispintasolutions.com/webhook/fe0874fe-7554-4f7e-8744-9865bd673a1e',
    VERIFY: 'https://lpn8nwebhook.luispintasolutions.com/webhook/c672670b-5db3-4af5-bd91-bf594a1b915c',
    USER: 'https://lpn8nwebhook.luispintasolutions.com/webhook/user7441558qwqqwqqssa'
};

const PHONE_LANDSCAPE_BLOCK_CLASS = 'tupak-phone-landscape-blocked';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SESSION_GUARD_INTERVAL_MS = 60 * 1000;
const RESPONSIVE_BREAKPOINTS = {
    mobileMaxWidth: 960,
    desktopMinWidth: 1180,
    debounceMs: 220
};
const MOBILE_VIEW_FILES = new Set([
    'autorizacion_buro.html',
    'calculadora.html',
    'carga_comite.html',
    'cartera.html',
    'catastros_mejia.html',
    'croquis.html',
    'documentacion.html',
    'herramientas_consulta.html',
    'tickets.html'
]);

let responsiveRedirectTimer = null;
let responsiveRedirectInProgress = false;
let sessionGuardIntervalId = null;
let sessionValidationInFlight = null;

function showSharedAuthAlert(message) {
    return new Promise((resolve) => {
        if (typeof document === 'undefined' || !document.body) {
            resolve();
            return;
        }

        const existing = document.getElementById('tupak-shared-auth-alert');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'tupak-shared-auth-alert';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:24px;z-index:20000;backdrop-filter:blur(4px);';
        overlay.innerHTML = `
            <div style="width:min(100%,420px);background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 25px 60px rgba(15,23,42,.22);">
                <div style="padding:20px 24px;background:linear-gradient(135deg,#b91c1c,#dc2626);color:#fff;display:flex;align-items:center;gap:12px;font-size:20px;font-weight:800;">
                    <i class="fas fa-ban"></i>
                    Acceso denegado
                </div>
                <div style="padding:24px;display:flex;flex-direction:column;gap:18px;">
                    <p style="margin:0;color:#334155;font-size:14px;line-height:1.6;">${message}</p>
                    <div style="display:flex;justify-content:flex-end;">
                        <button type="button" id="tupak-shared-auth-alert-btn" style="padding:12px 18px;border:none;border-radius:14px;background:#0f172a;color:#fff;font-weight:700;cursor:pointer;">Entendido</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.querySelector('#tupak-shared-auth-alert-btn')?.addEventListener('click', () => {
            overlay.remove();
            resolve();
        });
    });
}

function getDeviceProfile() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';
    const dimensions = [window.innerWidth, window.innerHeight, window.screen && window.screen.width, window.screen && window.screen.height]
        .filter(value => Number.isFinite(value) && value > 0);
    const shortSide = dimensions.length ? Math.min(...dimensions) : 0;
    const longSide = dimensions.length ? Math.max(...dimensions) : 0;
    const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    const coarsePointer = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
    const touchDevice = hasTouch || coarsePointer;
    const androidPhone = /Android.+Mobile/i.test(userAgent);
    const phoneUserAgent = /iPhone|iPod|Windows Phone|BlackBerry|Opera Mini|IEMobile|Mobile/i.test(userAgent) || androidPhone;
    const tabletUserAgent = /iPad|Tablet|PlayBook|Silk/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent));
    const isPhone = phoneUserAgent || (!tabletUserAgent && touchDevice && shortSide <= 915 && longSide <= 1600);
    const isTablet = tabletUserAgent || (!isPhone && touchDevice && shortSide > 915 && shortSide <= 1280 && longSide <= 1800);

    return {
        shortSide,
        longSide,
        isPhone,
        isTablet,
        isMobile: isPhone || isTablet || (touchDevice && shortSide <= 1280)
    };
}

function isMobileDevice() {
    return getDeviceProfile().isMobile;
}

function getSharedAssetHref(fileName) {
    return getAppRootRelativePath() + 'shared/img/' + fileName;
}

function ensureLinkTag(rel, href, extraAttributes) {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
    }

    link.href = href;

    if (extraAttributes) {
        Object.entries(extraAttributes).forEach(([name, value]) => {
            link.setAttribute(name, value);
        });
    }

    return link;
}

function ensureAppIcons() {
    const logoHref = getSharedAssetHref('logo.webp');

    ensureLinkTag('icon', logoHref, {
        type: 'image/webp',
        sizes: '512x512'
    });

    if (getCurrentSection() === 'mobile') {
        ensureLinkTag('apple-touch-icon', logoHref, {
            sizes: '180x180'
        });
    }
}

function ensureMobileOrientationStyles() {
    if (document.getElementById('tupak-mobile-orientation-style')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'tupak-mobile-orientation-style';
    style.textContent = `
        #tupak-mobile-orientation-guard {
            position: fixed;
            inset: 0;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: linear-gradient(135deg, rgba(0, 23, 73, 0.97), rgba(1, 92, 208, 0.94));
            color: #ffffff;
            text-align: center;
            z-index: 999999;
        }

        #tupak-mobile-orientation-guard .tupak-orientation-card {
            width: min(100%, 360px);
            padding: 24px;
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.18);
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
            backdrop-filter: blur(12px);
        }

        #tupak-mobile-orientation-guard h2 {
            margin: 0 0 12px;
            font-size: 1.35rem;
        }

        #tupak-mobile-orientation-guard p {
            margin: 0;
            line-height: 1.55;
            color: rgba(255, 255, 255, 0.86);
        }

        html.${PHONE_LANDSCAPE_BLOCK_CLASS},
        html.${PHONE_LANDSCAPE_BLOCK_CLASS} body {
            overflow: hidden;
        }

        html.${PHONE_LANDSCAPE_BLOCK_CLASS} #tupak-mobile-orientation-guard {
            display: flex;
        }
    `;

    document.head.appendChild(style);
}

function ensureMobileOrientationGuard() {
    if (document.getElementById('tupak-mobile-orientation-guard')) {
        return;
    }

    const guard = document.createElement('div');
    guard.id = 'tupak-mobile-orientation-guard';
    guard.setAttribute('aria-hidden', 'true');
    guard.innerHTML = `
        <div class="tupak-orientation-card">
            <h2>Usa el teléfono en vertical</h2>
            <p>Esta versión móvil está bloqueada en orientación vertical para evitar cambios de vista al girar el dispositivo.</p>
        </div>
    `;
    document.body.appendChild(guard);
}

function isLandscapeOrientation() {
    if (window.matchMedia) {
        return window.matchMedia('(orientation: landscape)').matches;
    }
    return window.innerWidth > window.innerHeight;
}

async function lockPhoneToPortrait() {
    if (!window.screen || !window.screen.orientation || typeof window.screen.orientation.lock !== 'function') {
        return;
    }

    try {
        await window.screen.orientation.lock('portrait');
    } catch (error) {
        // Algunos navegadores solo permiten lock en PWA instalada o fullscreen.
    }
}

function updateMobileOrientationGuard() {
    const shouldBlockLandscape = getCurrentSection() === 'mobile' && getDeviceProfile().isPhone && isLandscapeOrientation();
    document.documentElement.classList.toggle(PHONE_LANDSCAPE_BLOCK_CLASS, shouldBlockLandscape);

    const guard = document.getElementById('tupak-mobile-orientation-guard');
    if (guard) {
        guard.setAttribute('aria-hidden', shouldBlockLandscape ? 'false' : 'true');
    }
}

function initMobileOrientationGuard() {
    if (getCurrentSection() !== 'mobile' || !getDeviceProfile().isPhone) {
        return;
    }

    ensureMobileOrientationStyles();
    ensureMobileOrientationGuard();
    updateMobileOrientationGuard();
    lockPhoneToPortrait();

    window.addEventListener('resize', updateMobileOrientationGuard, { passive: true });
    window.addEventListener('orientationchange', () => {
        updateMobileOrientationGuard();
        lockPhoneToPortrait();
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            updateMobileOrientationGuard();
            lockPhoneToPortrait();
        }
    });
}

function normalizeAllowedRole(rawRole) {
    if (!rawRole) return '';

    const roles = String(rawRole)
        .split(',')
        .map(role => role.trim().toLowerCase())
        .filter(Boolean);

    if (roles.includes('admin')) return 'admin';
    if (roles.includes('asesor')) return 'asesor';
    return '';
}

function isAllowedRole(rawRole) {
    return Boolean(normalizeAllowedRole(rawRole));
}

function normalizeUserResponse(rawData) {
    const data = Array.isArray(rawData) ? (rawData[0] || {}) : (rawData || {});
    return {
        ...data,
        rol: normalizeAllowedRole(data.rol || data.roles || '')
    };
}

function isLoginRoute() {
    const path = window.location.pathname.replace(/\\/g, '/');
    return path.endsWith('/login.html') || path === 'login.html';
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function dispatchSessionEvent(eventName, session) {
    window.dispatchEvent(new CustomEvent(eventName, {
        detail: {
            session: session || null
        }
    }));
}

// ===== GESTIÓN DE SESIÓN =====

function getSession() {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;
    try {
        const parsed = JSON.parse(sessionData);
        if (!parsed || typeof parsed !== 'object') {
            clearSession();
            return null;
        }

        const normalized = {
            ...parsed,
            ts: Number(parsed.ts)
        };

        if (!normalized.cedula || !normalized.token || !Number.isFinite(normalized.ts)) {
            clearSession();
            return null;
        }

        if (Date.now() - normalized.ts > SESSION_MAX_AGE_MS) {
            clearSession();
            return null;
        }

        return normalized;
    } catch (e) {
        clearSession();
        return null;
    }
}

function saveSession(data) {
    const session = {
        cedula: data.cedula,
        name: data.nombre || data.name || 'Usuario',
        email: data.correo || data.email || '',
        whatsapp: data.whatsapp || '',
        rol: normalizeAllowedRole(data.rol || data.roles || ''),
        token: data.token || '',
        ts: Date.now()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    dispatchSessionEvent('tupak:session-updated', session);
    return session;
}

function getCurrentUser() {
    return getSession();
}

function getUserDisplayName() {
    const session = getSession();
    return (session && session.name) ? session.name : 'Usuario';
}

function getUserEmail() {
    const session = getSession();
    return (session && session.email) ? session.email : '';
}

function getUserRole() {
    const session = getSession();
    return (session && session.rol) ? session.rol : '';
}

// ===== VALIDACIÓN DE ROLES =====

function validateRoles(rolesInput) {
    return isAllowedRole(rolesInput);
}

function getUserCedula() {
    const session = getSession();
    return session ? session.cedula : null;
}

function getUserId() {
    return getUserCedula();
}

function getCurrentSection() {
    const path = window.location.pathname.replace(/\\/g, '/');
    if (path.includes('/pc/')) return 'pc';
    if (path.includes('/mobile/')) return 'mobile';
    return '';
}

function getAppRootRelativePath() {
    const path = window.location.pathname.replace(/\\/g, '/');
    const segments = path.split('/').filter(Boolean);
    const sectionIndex = segments.findIndex(segment => segment === 'pc' || segment === 'mobile');

    if (sectionIndex === -1) {
        return './';
    }

    const currentDirectoryDepth = Math.max(segments.length - 1, 0);
    const appRootDepth = sectionIndex;
    const levelsUp = Math.max(currentDirectoryDepth - appRootDepth, 0);

    return levelsUp === 0 ? './' : '../'.repeat(levelsUp);
}

function getRelativePathWithinSection() {
    const path = window.location.pathname.replace(/\\/g, '/');
    const segments = path.split('/').filter(Boolean);
    const sectionIndex = segments.findIndex(segment => segment === 'pc' || segment === 'mobile');

    if (sectionIndex === -1) {
        return '';
    }

    return segments.slice(sectionIndex + 1).join('/');
}

function redirectToLogin() {
    const section = getCurrentSection() || (isMobileDevice() ? 'mobile' : 'pc');
    window.location.href = getAppRootRelativePath() + section + '/login.html';
}

function invalidateSession(options) {
    const settings = {
        notifyParent: true,
        redirect: !isLoginRoute(),
        ...options
    };

    clearSession();
    dispatchSessionEvent('tupak:session-invalidated', null);

    if (settings.notifyParent && window.parent && window.parent !== window) {
        window.parent.postMessage('LOGGED_OUT', '*');
    }

    if (settings.redirect) {
        redirectToLogin();
    }
}

function initializeProtectedPage(options) {
    const settings = {
        verifyOnStart: true,
        redirectOnFailure: true,
        onSession: null,
        onInvalid: null,
        ...options
    };

    let disposed = false;

    const emitSession = () => {
        if (disposed) {
            return null;
        }

        const session = getSession();
        if (session && typeof settings.onSession === 'function') {
            settings.onSession(session);
        }
        return session;
    };

    const handleInvalid = () => {
        if (disposed) {
            return;
        }

        if (typeof settings.onInvalid === 'function') {
            settings.onInvalid();
            return;
        }

        if (settings.redirectOnFailure) {
            invalidateSession({ redirect: true, notifyParent: false });
        }
    };

    const updatedListener = event => {
        if (disposed) {
            return;
        }

        const session = event.detail && event.detail.session ? event.detail.session : getSession();
        if (session && typeof settings.onSession === 'function') {
            settings.onSession(session);
        }
    };

    const invalidatedListener = () => {
        handleInvalid();
    };

    window.addEventListener('tupak:session-updated', updatedListener);
    window.addEventListener('tupak:session-invalidated', invalidatedListener);

    return {
        async start() {
            const currentSession = emitSession();
            if (!currentSession) {
                handleInvalid();
                return false;
            }

            if (!settings.verifyOnStart) {
                return true;
            }

            const isValid = await checkTokenValidity({ redirectOnFailure: settings.redirectOnFailure });
            if (!isValid) {
                handleInvalid();
                return false;
            }

            emitSession();
            return true;
        },
        stop() {
            if (disposed) {
                return;
            }

            disposed = true;
            window.removeEventListener('tupak:session-updated', updatedListener);
            window.removeEventListener('tupak:session-invalidated', invalidatedListener);
        }
    };
}

function hasMobileEquivalent(relativePath) {
    if (!relativePath) {
        return true;
    }

    if (relativePath === 'index.html' || relativePath === 'login.html') {
        return true;
    }

    if (!relativePath.startsWith('view/')) {
        return false;
    }

    return MOBILE_VIEW_FILES.has(relativePath.slice('view/'.length));
}

function buildSectionUrl(section, relativePath) {
    const normalizedPath = relativePath || 'index.html';
    return getAppRootRelativePath() + section + '/' + normalizedPath;
}

function getResponsiveTargetSection() {
    const profile = getDeviceProfile();
    const currentSection = getCurrentSection();
    const width = window.innerWidth || profile.shortSide || 0;

    if (!currentSection || profile.isPhone) {
        return '';
    }

    if (currentSection === 'pc' && width <= RESPONSIVE_BREAKPOINTS.mobileMaxWidth) {
        const relativePath = getRelativePathWithinSection();
        return hasMobileEquivalent(relativePath) ? 'mobile' : '';
    }

    if (currentSection === 'mobile' && !profile.isPhone && width >= RESPONSIVE_BREAKPOINTS.desktopMinWidth) {
        return 'pc';
    }

    return '';
}

function syncResponsiveExperience() {
    if (responsiveRedirectInProgress) {
        return;
    }

    const targetSection = getResponsiveTargetSection();
    if (!targetSection) {
        return;
    }

    const currentSection = getCurrentSection();
    if (targetSection === currentSection) {
        return;
    }

    const relativePath = getRelativePathWithinSection();
    responsiveRedirectInProgress = true;
    window.location.replace(buildSectionUrl(targetSection, relativePath));
}

function queueResponsiveExperienceSync() {
    if (responsiveRedirectTimer) {
        window.clearTimeout(responsiveRedirectTimer);
    }

    responsiveRedirectTimer = window.setTimeout(() => {
        responsiveRedirectTimer = null;
        syncResponsiveExperience();
    }, RESPONSIVE_BREAKPOINTS.debounceMs);
}

function initResponsiveSectionSync() {
    if (!getCurrentSection()) {
        return;
    }

    syncResponsiveExperience();
    window.addEventListener('resize', queueResponsiveExperienceSync, { passive: true });
    window.addEventListener('orientationchange', queueResponsiveExperienceSync, { passive: true });
}

// ===== VERIFICACIÓN DE AUTENTICACIÓN =====

function checkAuth() {
    const session = getSession();
    if (!session) return false;

    if (!isAllowedRole(session.rol)) {
        clearSession();
        return false;
    }
    return true;
}

async function requireAuth() {
    if (!checkAuth()) {
        invalidateSession();
        return false;
    }
    return true;
}

async function checkTokenValidity(options) {
    const settings = {
        redirectOnFailure: !isLoginRoute(),
        ...options
    };
    const session = getSession();
    if (!session || !session.token) {
        if (settings.redirectOnFailure) {
            invalidateSession({ redirect: true });
        }
        return false;
    }

    if (sessionValidationInFlight) {
        return sessionValidationInFlight;
    }

    sessionValidationInFlight = (async () => {
    try {
        const response = await fetch(AUTH_WEBHOOKS.USER, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': session.token 
            },
            body: JSON.stringify({ 
                cedula: session.cedula,
                token: session.token
            })
        });

        if (response.status === 401 || response.status === 403) {
            invalidateSession({ redirect: settings.redirectOnFailure });
            return false;
        }

        const rawData = await response.json();
        const data = normalizeUserResponse(rawData);
        
        const errorMessages = [
            "Token Incorrecto",
            "Sesión expirada",
            "vuelva a iniciar sesión",
            "Token expirado",
            "No autorizado"
        ];

        if (data.message && errorMessages.some(msg => data.message.toLowerCase().includes(msg.toLowerCase()))) {
            invalidateSession({ redirect: settings.redirectOnFailure });
            return false;
        }

        // Validar Roles
        if (!isAllowedRole(data.rol)) {
            await showSharedAuthAlert('Consulta con el administrador para habilitar tu acceso.');
            invalidateSession({ redirect: settings.redirectOnFailure });
            return false;
        }

        saveSession({
            cedula: data.cedula || session.cedula,
            nombre: data.nombre || session.name,
            correo: data.correo || session.email,
            whatsapp: data.whatsapp || session.whatsapp,
            rol: data.rol,
            token: session.token
        });
        
        if (data.nombre || data.cedula || data.activo === "true" || data.activo === true) {
            return true;
        }

        if (data.error || data.status === "error") {
            invalidateSession({ redirect: settings.redirectOnFailure });
            return false;
        }

        return true;
    } catch (error) {
        return checkAuth();
    }
    })();

    try {
        return await sessionValidationInFlight;
    } finally {
        sessionValidationInFlight = null;
    }
}

// ===== FUNCIONES DE LOGIN =====

async function loginWithCedula(cedula) {
    try {
        const response = await fetch(AUTH_WEBHOOKS.LOGIN, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula })
        });
        
        const data = await response.json();
        
        const normalizedRole = normalizeAllowedRole(data.rol || data.roles || '');

        if (data.nombre && (!data.rol && !data.roles || normalizedRole)) {
            return {
                success: true,
                nombre: data.nombre,
                numero: data.numero || '0000',
                rol: normalizedRole
            };
        } else {
            return {
                success: false,
                error: normalizedRole === '' && (data.rol || data.roles)
                    ? 'Usuario sin rol autorizado para ingresar'
                    : 'Cédula no autorizada para el acceso'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: 'Error de conexión. Intente más tarde.'
        };
    }
}

async function verifyOTP(cedula, otp) {
    try {
        const response = await fetch(AUTH_WEBHOOKS.VERIFY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula, otp: otp.toUpperCase() })
        });
        
        const data = await response.json();
        
        if (data.token || data.success || response.ok) {
            // Obtener datos del usuario
            try {
                const userResponse = await fetch(AUTH_WEBHOOKS.USER, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': data.token || ''
                    },
                    body: JSON.stringify({ 
                        rol: "",
                        correo: "",
                        token: data.token || ""
                    })
                });
                
                const userData = await userResponse.json();
                const user = normalizeUserResponse(userData);
                
                if (!isAllowedRole(user.rol)) {
                    return {
                        success: false,
                        error: 'Acceso denegado: consulta con el administrador'
                    };
                }

                // Guardar sesión
                const session = saveSession({
                    cedula: user.cedula || cedula,
                    nombre: user.nombre || data.nombre || 'Usuario',
                    correo: user.correo || '',
                    rol: user.rol,
                    token: data.token || ''
                });
                
                return {
                    success: true,
                    session: session
                };
            } catch (userError) {
                const verifyRole = normalizeAllowedRole(data.rol || data.roles || '');
                if (!verifyRole) {
                    return {
                        success: false,
                        error: 'Acceso denegado: consulta con el administrador'
                    };
                }

                // Si falla obtener usuario, guardar con datos básicos
                const session = saveSession({
                    cedula: cedula,
                    nombre: data.nombre || 'Usuario',
                    rol: verifyRole,
                    token: data.token || ''
                });
                
                return {
                    success: true,
                    session: session
                };
            }
        } else {
            return {
                success: false,
                error: 'Código incorrecto o expirado'
            };
        }
    } catch (error) {
        return {
            success: false,
            error: 'Error de conexión. Intente más tarde.'
        };
    }
}

// ===== LOGOUT =====

function logout() {
    invalidateSession({ redirect: true, notifyParent: true });
}

function initSessionGuard() {
    if (!getCurrentSection()) {
        return;
    }

    if (!isLoginRoute() && !checkAuth()) {
        invalidateSession({ redirect: true, notifyParent: false });
        return;
    }

    if (checkAuth()) {
        checkTokenValidity({ redirectOnFailure: !isLoginRoute() });
    }

    if (sessionGuardIntervalId) {
        return;
    }

    sessionGuardIntervalId = window.setInterval(() => {
        if (document.hidden) {
            return;
        }

        if (!checkAuth()) {
            invalidateSession({ redirect: !isLoginRoute(), notifyParent: false });
            return;
        }

        checkTokenValidity({ redirectOnFailure: !isLoginRoute() });
    }, SESSION_GUARD_INTERVAL_MS);

    window.addEventListener('focus', () => {
        if (checkAuth()) {
            checkTokenValidity({ redirectOnFailure: !isLoginRoute() });
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && checkAuth()) {
            checkTokenValidity({ redirectOnFailure: !isLoginRoute() });
        }
    });

    window.addEventListener('storage', event => {
        if (event.key !== SESSION_KEY) {
            return;
        }

        if (!event.newValue) {
            invalidateSession({ redirect: !isLoginRoute(), notifyParent: false });
            return;
        }

        if (!checkAuth()) {
            invalidateSession({ redirect: !isLoginRoute(), notifyParent: false });
        }
    });
}

// ===== LOG DE ACCIONES =====

async function logUserAction(action, detail) {
    const session = getSession();
    if (!session || !session.token) return;

    try {
        await fetch(AUTH_WEBHOOKS.USER, {
            method: 'POST',
            keepalive: true,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': session.token 
            },
            body: JSON.stringify({ 
                cedula: session.cedula,
                token: session.token,
                accion: action,
                detalle: detail,
                ts: new Date().toISOString()
            })
        });
    } catch (error) {
        // Silencioso
    }
}

// ===== EXPORTAR API =====

window.TupakAuth = {
    // Sesión
    getSession,
    saveSession,
    getCurrentUser,
    getUserDisplayName,
    getUserEmail,
    getUserRole,
    getUserCedula,
    getUserId,
    getDeviceProfile,
    isMobileDevice,
    
    // Autenticación
    checkAuth,
    requireAuth,
    checkTokenValidity,
    validateRoles,
    normalizeAllowedRole,
    isAllowedRole,
    
    // Login
    loginWithCedula,
    verifyOTP,
    logout,
    clearSession,
    initializeProtectedPage,
    
    // Logging
    logUserAction,
    
    // Webhooks (para acceso directo si es necesario)
    AUTH_WEBHOOKS
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ensureAppIcons();
        initMobileOrientationGuard();
        initResponsiveSectionSync();
        initSessionGuard();
    }, { once: true });
} else {
    ensureAppIcons();
    initMobileOrientationGuard();
    initResponsiveSectionSync();
    initSessionGuard();
}

// ===== PROTECCIÓN BÁSICA (DESACTIVADA PARA DESARROLLO) =====
// Descomentar estas líneas para producción

// document.addEventListener('contextmenu', e => e.preventDefault());
// document.addEventListener('keydown', e => {
//     if (e.key === 'F12' || 
//         (e.ctrlKey && (e.key === 'u' || e.key === 's' || e.key === 'p' || e.key === 'i'))) {
//         e.preventDefault();
//     }
// });
