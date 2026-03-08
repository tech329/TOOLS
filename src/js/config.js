// =====================================================
// CONFIGURACIÓN GLOBAL DE LA APLICACIÓN
// =====================================================

const CONFIG = {
    // Webhooks
    WEBHOOKS: {
        // Webhook real de consulta de cédula
        CEDULA_LOOKUP: 'https://lpn8nwebhook.luispintasolutions.com/webhook/c460611e-8d0c-4a7b-bfcc-50b1e5858048',
        
        // Webhook real de subida de archivos (multiplatform)
        FILE_UPLOAD: 'https://lpn8nwebhook.luispintasolutions.com/webhook/cfec9893-74d7-4eb3-aa7d-d9f09a7441',
        
        // Webhook real de datos del comite
        COMITE_DATA: 'https://lpn8nwebhook.luispintasolutions.com/webhook/comites_insert',
        ORIGINAL_UPLOAD: 'https://lpwebhook.luispinta.com/webhook/6162a481-26e7-4c66-ba24-e58b1b1dc27e'
    },

    // URLs de la aplicación
    URLS: {
        INDEX: 'index.html',
        CARGA_COMITE: 'src/view/carga_comite.html'
    },

    // Configuración de archivos
    FILES: {
        MAX_SIZE_MB: 15,
        ALLOWED_TYPES: ['application/pdf'],
        ALLOWED_EXTENSIONS: ['.pdf']
    },

    // Configuración de la empresa
    EMPRESA: {
        NOMBRE: 'Caja de Ahorro Tupak Rantina',
        LOGO_URL: '../../shared/img/logo.webp'
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
    }
};

// Exportar configuración globalmente
window.APP_CONFIG = CONFIG;

