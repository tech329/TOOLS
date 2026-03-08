// =====================================================
// CONFIG.JS - Configuración Global de la Aplicación
// Compartido entre versiones PC y Mobile
// =====================================================

window.APP_CONFIG = {
    // Información de la App
    APP_NAME: 'Centro de Herramientas',
    APP_SUBTITLE: 'Caja de Ahorro y Crédito Tupak Rantina',
    APP_VERSION: '2.0.1',
    
    // URLs de recursos
    LOGO_URL: './img/logo.webp',
    LOGO_LP_WHITE: './img/lpsolutionswithe.webp',
    LOGO_LP_BLACK: './img/lpsolutionsblack.webp',
    
    // Colores de marca
    COLORS: {
        PRIMARY: '#001749',
        SECONDARY: '#e48410',
        ACCENT: '#3787c6',
        BLUE: '#015cd0',
        TEAL: '#14b8a6'
    },
    
    // Webhooks de operaciones
    WEBHOOKS: {
        CEDULA_LOOKUP: 'https://lpn8nwebhook.luispintasolutions.com/webhook/c460611e-8d0c-4a7b-bfcc-50b1e5858048',
        COMITE_UPLOAD: 'https://lpwebhook.luispinta.com/webhook/your-comite-webhook'
    },
    
    // Módulos de la aplicación
    MODULES: {
        HERRAMIENTAS_CONSULTA: {
            id: 'herramientas-consulta',
            name: 'Herramientas de Consulta',
            description: 'Consultas en sistemas externos',
            icon: 'fa-search',
            color: 'from-green-500 to-emerald-500',
            enabled: true,
            pcPath: 'view/herramientas_consulta.html',
            mobilePath: 'view/herramientas_consulta.html'
        },
        CALCULADORA: {
            id: 'calculadora',
            name: 'Calculadora',
            description: 'Calcular cuotas y tablas de amortización',
            icon: 'fa-calculator',
            color: 'from-blue-500 to-indigo-500',
            enabled: true,
            pcPath: 'view/calculadora.html',
            mobilePath: 'view/calculadora.html'
        },
        DOCUMENTACION: {
            id: 'documentacion',
            name: 'Documentación',
            description: 'Guía para carpeta de créditos',
            icon: 'fa-file-alt',
            color: 'from-purple-500 to-violet-500',
            enabled: true,
            pcPath: 'view/documentacion.html',
            mobilePath: 'view/documentacion.html'
        },
        IMPRIMIBLES: {
            id: 'imprimibles',
            name: 'Imprimibles',
            description: 'Actas, comprobantes, carátulas y solicitudes',
            icon: 'fa-print',
            color: 'from-rose-500 to-red-500',
            enabled: true,
            mobileEnabled: false,
            pcPath: 'view/imprimibles.html',
            mobilePath: '#'
        },
        TICKETS: {
            id: 'tickets',
            name: 'Tickets',
            description: 'Generador de tickets de soporte',
            icon: 'fa-ticket-alt',
            color: 'from-orange-500 to-red-500',
            enabled: true,
            pcPath: 'view/tickets.html',
            mobilePath: 'view/tickets.html'
        },
        CARTERA: {
            id: 'cartera',
            name: 'Cartera',
            description: 'Gestión de cartera',
            icon: 'fa-briefcase',
            color: 'from-slate-500 to-gray-600',
            enabled: true,
            pcPath: 'view/cartera.html',
            mobilePath: 'view/cartera.html'
        },
        CARGA_COMITE: {
            id: 'carga-comite',
            name: 'Cargar Comité',
            description: 'Subir documentación para comité de crédito',
            icon: 'fa-file-upload',
            color: 'from-teal-500 to-cyan-500',
            enabled: true,
            pcPath: 'view/carga_comite.html',
            mobilePath: 'view/carga_comite.html'
        }
    },
    
    getDeviceProfile: function() {
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
    },

    // Función para detectar dispositivo
    isMobile: function() {
        return this.getDeviceProfile().isMobile;
    },

    isPhone: function() {
        return this.getDeviceProfile().isPhone;
    },
    
    // Función para obtener módulos activos
    getEnabledModules: function() {
        return Object.values(this.MODULES).filter(m => m.enabled);
    },

    getCedulaLookupRequests: function(cedula) {
        const numero = String(cedula || '').trim();
        return [
            this.WEBHOOKS.CEDULA_LOOKUP ? {
                url: this.WEBHOOKS.CEDULA_LOOKUP,
                init: {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ cedula: numero })
                }
            } : null
        ].filter(Boolean);
    },

    fetchCedulaLookup: async function(cedula) {
        const requests = this.getCedulaLookupRequests(cedula);
        let lastError = null;

        for (const request of requests) {
            try {
                const response = await fetch(request.url, request.init);

                if (!response.ok) {
                    throw new Error(`Cedula lookup failed with status ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('No se pudo consultar la cédula');
    },
    
    // Función para obtener todos los módulos
    getAllModules: function() {
        return Object.values(this.MODULES);
    },
    
    // Función para obtener ruta del módulo según dispositivo
    getModulePath: function(moduleId) {
        const module = this.MODULES[moduleId];
        if (!module) return '#';
        return this.isMobile() ? module.mobilePath : module.pcPath;
    }
};
