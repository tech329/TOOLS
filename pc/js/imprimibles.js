// =====================================================
// IMPRIMIBLES - PC JavaScript
// Centro de Herramientas - Módulo de Documentos Imprimibles
// MODO SIMULACIÓN - Sin Supabase
// =====================================================

// Configuración de tiempos
const loaderStartTime = Date.now();
const MIN_LOADER_TIME = 1200;

// Variables globales
let datosActaParaGuardar = null;
let contadorActaLocal = 1;
let contadorSesionLocal = 1;
let contadorCreditoLocal = 1;
let nombreAutocompletado = false;
const ACTA_MODULE_LOCKED = true;

const CEDULA_LOOKUP_WEBHOOK = 'https://lpn8nwebhook.luispintasolutions.com/webhook/c460611e-8d0c-4a7b-bfcc-50b1e5858048';
const ACTAS_QUERY_WEBHOOK = 'https://lpn8nwebhook.luispintasolutions.com/webhook/actasquery';
const ACTAS_INSERT_WEBHOOK = 'https://lpn8nwebhook.luispintasolutions.com/webhook/actasinsert';

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    initPage();
});

async function initPage() {
    // Verificar sesión
    const session = localStorage.getItem('appSession');
    if (!session) {
        window.location.href = '../login.html';
        return;
    }

    try {
        const userData = JSON.parse(session);
        setupUserInfo(userData);
        
        // ELIMINADO: No consultar al entrar, se hará al generar el acta
        // fetchActas(userData);
    } catch (e) {
        console.error('Error parsing session:', e);
    }

    // Inicializar tabs
    initTabs();

    // Inicializar formulario del acta
    initActaForm();

    if (ACTA_MODULE_LOCKED) {
        lockActaModule();
    }

    // Inicializar búsqueda por cédula
    initCedulaSearch();

    // Inicializar upload de comprobante
    initComprobanteUpload();

    if (!ACTA_MODULE_LOCKED) {
        // Cargar datos de prueba (Temporal)
        cargarDatosPrueba();
    }

    // Ocultar loading
    hideLoadingScreen();
}

function cargarDatosPrueba() {
    console.log("🧪 Cargando datos de prueba...");
    const campos = {
        'identificacion': '1727652107',
        'nombreCompleto': 'LUIS PINTA TEST',
        'telefono': '0962543428',
        'montoAprobado': '1500',
        'tasaInteres': '26',
        'plazoPago': '12',
        'destinoCredito': 'Capital de trabajo',
        'observaciones': 'Crédito de prueba para integración de webhook'
    };

    for (const [id, valor] of Object.entries(campos)) {
        const el = document.getElementById(id);
        if (el) el.value = valor;
    }
}

function lockActaModule() {
    const actaTab = document.getElementById('tab-acta');
    if (!actaTab) return;

    actaTab.classList.add('acta-module-locked');

    const fields = actaTab.querySelectorAll('input, select, textarea, button');
    fields.forEach((field) => {
        field.disabled = true;
        field.setAttribute('aria-disabled', 'true');
        field.setAttribute('tabindex', '-1');
    });

    datosActaParaGuardar = null;

    const actaPreview = document.getElementById('acta-preview');
    if (actaPreview) {
        actaPreview.style.display = 'none';
    }
}

async function showActaLockedMessage() {
    await showCustomAlert(
        'Modulo bloqueado',
        'DATOS INVALIDOS PARA CREAR NUEVAS ACTAS',
        [{ text: 'Cerrar', type: 'secondary', value: 'close' }],
        'error'
    );
}

// ===== GESTIÓN DE DATOS (WEBHOOKS) =====
async function fetchActas(userData) {
    if (!userData) return null;

    try {
        console.log("🔍 Consultando última acta antes de generar...");
        const response = await fetch(ACTAS_QUERY_WEBHOOK, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': userData.token || ""
            },
            body: JSON.stringify({
                cedula: userData.cedula || "",
                rol: userData.rol || "",
                asesor: userData.name || "",
                correo: userData.email || ""
            })
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        const actas = Array.isArray(data) ? data : [];
        window.ACTAS_RECIBIDAS = actas;

        console.log("📥 RESPUESTA COMPLETA DEL WEBHOOK:", JSON.stringify(data, null, 2));

        if (actas.length > 0) {
            const ultimaActa = actas[0];
            console.log("📄 ÚLTIMA ACTA DETECTADA:", ultimaActa);
            
            const hoy = new Date().toISOString().split('T')[0];
            const fechaUltima = ultimaActa.fecha || '';

            // Logs específicos para investigar 'credito'
            console.log("🔍 VALOR DE 'credito' RECIBIDO:", ultimaActa.credito);
            console.log("🔍 TIPO DE DATO DE 'credito':", typeof ultimaActa.credito);

            // 1. Incrementar Acta + 1
            const proximaActa = (parseInt(ultimaActa.acta) || 0) + 1;
            
            // 2. Incrementar Crédito + 1
            const proximoCredito = (parseInt(ultimaActa.credito) || 0) + 1;

            // 3. Determinar Sesión
            let proximaSesion = 1;
            if (fechaUltima === hoy) {
                proximaSesion = (parseInt(ultimaActa.sesion) || 0) + 1;
            }

            console.log(`✨ CALCULADOS -> Acta: ${proximaActa}, Crédito: ${proximoCredito}, Sesión: ${proximaSesion}`);

            return {
                acta: proximaActa,
                sesion: proximaSesion,
                credito: proximoCredito
            };
        }
        
        console.warn("⚠️ El webhook devolvió un array vacío o sin actas.");
        return null;
    } catch (error) {
        console.error("❌ Error en fetchActas:", error);
        return null;
    }
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

// ===== TABS =====
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            showTab(tabId);
        });
    });
}

function showTab(tabId) {
    // Desactivar todos los tabs
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Activar el tab seleccionado
    const button = document.querySelector(`[data-tab="${tabId}"]`);
    const content = document.getElementById(`tab-${tabId}`);

    if (button) button.classList.add('active');
    if (content) content.classList.add('active');

    // Manejar visibilidad de las previews según la pestaña
    const actaPreview = document.getElementById('acta-preview');
    const comprobantePreview = document.getElementById('comprobante-preview');

    if (actaPreview) {
        actaPreview.style.display = (tabId === 'acta') ? 'block' : 'none';
    }

    // Solo mostrar comprobante preview si está en la pestaña y tiene la clase visible
    if (comprobantePreview) {
        if (tabId !== 'comprobante') {
            comprobantePreview.style.display = 'none';
        } else if (comprobantePreview.classList.contains('visible')) {
            comprobantePreview.style.display = 'block';
        }
    }
}

// ===== ACTA FORM =====
function initActaForm() {
    const form = document.getElementById('acta-form');
    if (!form) return;

    // Establecer fecha y hora actuales
    const fechaInput = document.getElementById('fechaActaForm');
    const horaInput = document.getElementById('horaActaForm');

    if (fechaInput) fechaInput.value = obtenerFechaLocal();
    if (horaInput) horaInput.value = obtenerHoraLocal();

    // Inicializar fecha formateada
    actualizarFechaFormateada();

    // Listeners para actualizar fecha formateada
    if (fechaInput) fechaInput.addEventListener('change', actualizarFechaFormateada);
    if (horaInput) horaInput.addEventListener('change', actualizarFechaFormateada);

    // Reset handler
    form.addEventListener('reset', handleFormReset);
}

// ===== BÚSQUEDA POR CÉDULA =====
function initCedulaSearch() {
    const cedulaInput = document.getElementById('identificacion');
    const nombreInput = document.getElementById('nombreCompleto');
    
    if (!cedulaInput) return;

    // Búsqueda al salir del campo (blur)
    cedulaInput.addEventListener('blur', function() {
        const cedula = this.value.trim();
        if (cedula && cedula.length === 10) {
            buscarPorCedula(cedula);
        }
    });

    // Búsqueda al presionar Enter
    cedulaInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const cedula = this.value.trim();
            if (cedula && cedula.length === 10) {
                buscarPorCedula(cedula);
            } else if (cedula.length > 0 && cedula.length !== 10) {
                showToast('La cédula debe tener 10 dígitos', 'warning');
            }
        }
    });

    // Detectar edición manual del nombre
    if (nombreInput) {
        nombreInput.addEventListener('input', function() {
            if (!nombreAutocompletado) {
                marcarComoManual();
            }
        });
    }
}

async function buscarPorCedula(cedula) {
    const nombreInput = document.getElementById('nombreCompleto');
    const searchIcon = document.getElementById('cedula-search-icon');
    const statusBadge = document.getElementById('nombre-status');

    // Validar formato de cédula
    if (!/^\d{10}$/.test(cedula)) {
        showToast('La cédula debe contener solo 10 dígitos numéricos', 'warning');
        return;
    }

    // Mostrar icono de carga
    if (searchIcon) searchIcon.classList.remove('hidden');
    
    showToast('Buscando información de la cédula...', 'info');

    try {
        const data = window.APP_CONFIG?.fetchCedulaLookup
            ? await window.APP_CONFIG.fetchCedulaLookup(cedula)
            : await fetchCedulaLookupFallback(cedula);

        const result = Array.isArray(data) ? data[0] : null;

        if (result && result.encontrado && result.nombre) {
            // Nombre encontrado
            nombreInput.value = result.nombre.toUpperCase();
            nombreAutocompletado = true;
            marcarComoEncontrado();
            showToast('✅ Nombre encontrado: ' + result.nombre, 'success');
            
            // Mover el foco al siguiente campo
            document.getElementById('telefono')?.focus();
        } else {
            // No encontrado - habilitar entrada manual
            habilitarEntradaManual(result?.mensaje || 'Revise la cédula. Si no existe, ingrese manualmente');
        }
    } catch (error) {
        console.error('Error buscando cédula:', error);
        habilitarEntradaManual('El servidor no responde. Ingrese manualmente');
    } finally {
        // Ocultar icono de carga
        if (searchIcon) searchIcon.classList.add('hidden');
    }
}

async function fetchCedulaLookupFallback(cedula) {
    const requests = [
        {
            url: CEDULA_LOOKUP_WEBHOOK,
            init: {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ cedula })
            }
        }
    ];
    let lastError = null;

    for (const request of requests) {
        try {
            const response = await fetch(request.url, request.init);
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            return await response.json();
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('No se pudo consultar la cédula');
}

function marcarComoEncontrado() {
    const nombreInput = document.getElementById('nombreCompleto');
    const statusBadge = document.getElementById('nombre-status');
    
    if (nombreInput) {
        nombreInput.classList.remove('manual-input');
        nombreInput.classList.add('auto-filled');
    }
    
    if (statusBadge) {
        statusBadge.textContent = '✓ Autocompletado';
        statusBadge.className = 'status-badge found';
    }
}

function marcarComoManual() {
    const nombreInput = document.getElementById('nombreCompleto');
    const statusBadge = document.getElementById('nombre-status');
    
    if (nombreInput) {
        nombreInput.classList.remove('auto-filled');
        nombreInput.classList.add('manual-input');
    }
    
    if (statusBadge) {
        statusBadge.textContent = '✎ Manual';
        statusBadge.className = 'status-badge manual';
    }
}

function habilitarEntradaManual(mensaje) {
    const nombreInput = document.getElementById('nombreCompleto');
    
    nombreAutocompletado = false;
    
    if (nombreInput) {
        nombreInput.value = '';
        nombreInput.placeholder = 'Ingresa el nombre completo manualmente';
        nombreInput.focus();
    }
    
    marcarComoManual();
    showToast(mensaje, 'warning');
}

function obtenerFechaLocal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function obtenerHoraLocal() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function formatearFechaEspanol(fecha, hora) {
    const meses = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];

    const fechaObj = new Date(fecha + 'T' + hora);
    const dia = fechaObj.getDate();
    const mes = meses[fechaObj.getMonth()];
    const año = fechaObj.getFullYear();

    let horas = fechaObj.getHours();
    const minutos = fechaObj.getMinutes();

    let periodo, horaFormateada;
    if (horas === 0) {
        periodo = 'de la medianoche';
        horaFormateada = '12';
    } else if (horas === 12) {
        periodo = 'del mediodía';
        horaFormateada = '12';
    } else if (horas >= 1 && horas <= 11) {
        periodo = 'de la mañana';
        horaFormateada = horas.toString();
    } else if (horas >= 13 && horas <= 17) {
        periodo = 'de la tarde';
        horaFormateada = (horas - 12).toString();
    } else if (horas >= 18 && horas <= 23) {
        periodo = 'de la noche';
        horaFormateada = (horas - 12).toString();
    }

    let minutosTexto = '';
    if (minutos === 0) {
        minutosTexto = ' en punto';
    } else if (minutos === 1) {
        minutosTexto = ' con 1 minuto';
    } else {
        minutosTexto = ` con ${minutos} minutos`;
    }

    return `${dia} de ${mes} del ${año} a las ${horaFormateada} ${periodo}${minutosTexto}`;
}

function actualizarFechaFormateada() {
    const fecha = document.getElementById('fechaActaForm')?.value;
    const hora = document.getElementById('horaActaForm')?.value;

    if (fecha && hora) {
        const fechaFormateada = formatearFechaEspanol(fecha, hora);
        const fechaActaEl = document.getElementById('fechaActa');
        if (fechaActaEl) fechaActaEl.textContent = fechaFormateada;
    }
}

function handleFormReset() {
    datosActaParaGuardar = null;
    nombreAutocompletado = false;

    setTimeout(() => {
        const fechaInput = document.getElementById('fechaActaForm');
        const horaInput = document.getElementById('horaActaForm');
        const nombreInput = document.getElementById('nombreCompleto');
        const statusBadge = document.getElementById('nombre-status');
        
        if (fechaInput) fechaInput.value = obtenerFechaLocal();
        if (horaInput) horaInput.value = obtenerHoraLocal();
        
        // Reset estado del nombre
        if (nombreInput) {
            nombreInput.classList.remove('auto-filled', 'manual-input');
            nombreInput.placeholder = 'Se autocompletará al buscar cédula...';
        }
        if (statusBadge) {
            statusBadge.className = 'status-badge hidden';
        }

        // Reset preview values
        const previewIds = ['preview-nombre', 'preview-identificacion', 'preview-telefono', 
                           'preview-monto', 'preview-tasa', 'preview-plazo', 
                           'preview-forma', 'preview-destino', 'preview-observaciones'];
        previewIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '---';
        });

        actualizarFechaFormateada();
    }, 100);
}

// ===== FUNCIONES SIMULADAS (SIN SUPABASE) =====
function obtenerProximoNumeroActa() {
    const numero = contadorActaLocal.toString().padStart(6, '0');
    contadorActaLocal++;
    return numero;
}

function obtenerProximoNumeroSesion() {
    const numero = contadorSesionLocal.toString().padStart(3, '0');
    contadorSesionLocal++;
    return numero;
}

function obtenerUltimoNumeroCredito() {
    const numero = contadorCreditoLocal;
    contadorCreditoLocal++;
    return numero;
}

function obtenerDatosUsuario() {
    const session = localStorage.getItem('appSession');
    if (session) {
        try {
            const data = JSON.parse(session);
            return { nombre: data.name || 'ASESOR', correo: data.email || '' };
        } catch (e) {}
    }
    return { nombre: 'ASESOR', correo: '' };
}

function formatearCapitalRestante(monto) {
    try {
        const numero = parseFloat(monto);
        if (isNaN(numero)) return '0,00';

        const partes = numero.toFixed(2).split('.');
        const entero = partes[0];
        const decimales = partes[1];

        const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${enteroFormateado},${decimales}`;
    } catch (error) {
        console.error('Error formateando capital restante:', error);
        return '0,00';
    }
}

// ===== GENERACIÓN DE ACTA =====
async function generarActa() {
    if (ACTA_MODULE_LOCKED) {
        await showActaLockedMessage();
        return;
    }

    const form = document.getElementById('acta-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const btnGenerar = document.querySelector('[onclick="generarActa()"]');
    const textoOriginal = btnGenerar.innerHTML;
    btnGenerar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
    btnGenerar.disabled = true;

    try {
        const sessionData = localStorage.getItem('appSession');
        const userData = sessionData ? JSON.parse(sessionData) : null;
        
        // 1. Consultar el webhook JUSTO ANTES de generar para evitar duplicados
        const nuevosNumeros = await fetchActas(userData);
        
        let numeroActa, numeroSesion, numeroCredito;
        
        if (nuevosNumeros) {
            numeroActa = nuevosNumeros.acta.toString().padStart(6, '0');
            numeroSesion = nuevosNumeros.sesion.toString().padStart(3, '0');
            numeroCredito = nuevosNumeros.credito;
        } else {
            // Fallback a contadores locales si el webhook falla o no hay datos
            numeroActa = contadorActaLocal.toString().padStart(6, '0');
            numeroSesion = contadorSesionLocal.toString().padStart(3, '0');
            numeroCredito = contadorCreditoLocal;
        }

        const fecha = document.getElementById('fechaActaForm').value;
        const hora = document.getElementById('horaActaForm').value;

        // Actualizar números en el documento
        document.getElementById('numeroActa').textContent = numeroActa;
        document.getElementById('numeroSesion').textContent = numeroSesion;
        
        // El número de crédito se guardará en el JSON final
        const datos = {
            nombreCompleto: document.getElementById('nombreCompleto').value,
            identificacion: document.getElementById('identificacion').value,
            telefono: document.getElementById('telefono').value,
            montoAprobado: document.getElementById('montoAprobado').value,
            tasaInteres: document.getElementById('tasaInteres').value,
            plazoPago: document.getElementById('plazoPago').value,
            formaPago: document.getElementById('formaPago').value,
            destinoCredito: document.getElementById('destinoCredito').value,
            observaciones: document.getElementById('observaciones').value || 'Sin observaciones adicionales'
        };

        // Llenar el preview
        document.getElementById('preview-nombre').textContent = datos.nombreCompleto;
        document.getElementById('preview-identificacion').textContent = datos.identificacion;
        document.getElementById('preview-telefono').textContent = datos.telefono;
        document.getElementById('preview-monto').textContent = '$' + parseFloat(datos.montoAprobado).toLocaleString('es-EC', {minimumFractionDigits: 2});
        document.getElementById('preview-tasa').textContent = datos.tasaInteres + '%';
        document.getElementById('preview-plazo').textContent = datos.plazoPago;
        document.getElementById('preview-forma').textContent = datos.formaPago;
        document.getElementById('preview-destino').textContent = datos.destinoCredito;
        document.getElementById('preview-observaciones').textContent = datos.observaciones;

        actualizarFechaFormateada();

        // Obtener datos del usuario
        const datosUsuario = userData; // Usar el objeto ya parseado arriba
        const capitalRestanteFormateado = formatearCapitalRestante(datos.montoAprobado);

        // Preparar JSON para guardar (simulación)
        datosActaParaGuardar = {
            acta: numeroActa,
            sesion: numeroSesion,
            nombre_socio: datos.nombreCompleto,
            cedula_socio: datos.identificacion,
            monto_aprobado: datos.montoAprobado,
            interes: datos.tasaInteres,
            plazo: datos.plazoPago,
            observaciones: datos.observaciones,
            telefono_socio: datos.telefono,
            frecuencia_pago: datos.formaPago,
            destino_credito: datos.destinoCredito,
            fecha_hora: fecha + 'T' + hora + ':00',
            asesor_credito: datosUsuario.name || datosUsuario.nombre,
            correo_asesor: datosUsuario.email || datosUsuario.correo,
            cuota_pagada: '0',
            credito: numeroCredito.toString(),
            capital_restante: capitalRestanteFormateado,
            dia_pago: null,
            mes_anio_primer_pago: null,
            regularizado: false,
            regularizado_cred: false
        };

        // Scroll al preview
        document.getElementById('acta-preview').scrollIntoView({ behavior: 'smooth' });

        // Mostrar alerta
        await showCustomAlert(
            'Documento Generado',
            'Por favor asegúrate de revisar muy bien antes de imprimir.',
            [{ text: 'Entendido', type: 'primary', value: 'ok' }],
            'success'
        );

    } catch (error) {
        console.error('Error generando acta:', error);
        await showCustomAlert(
            'Error',
            'Error generando el acta.',
            [{ text: 'Cerrar', type: 'secondary', value: 'close' }],
            'error'
        );
    } finally {
        btnGenerar.innerHTML = textoOriginal;
        btnGenerar.disabled = false;
    }
}

async function imprimirActa() {
    if (ACTA_MODULE_LOCKED) {
        await showActaLockedMessage();
        return;
    }

    if (!datosActaParaGuardar) {
        await showCustomAlert(
            'Error',
            'No hay datos para imprimir. Primero debe generar el acta.',
            [{ text: 'Cerrar', type: 'secondary', value: 'close' }],
            'error'
        );
        return;
    }

    const confirmacion = await showCustomAlert(
        'Confirmación',
        '¿Estás 100% seguro(a) de que la información del acta es correcta?',
        [
            { text: 'Deseo revisar nuevamente', type: 'warning', value: 'revisar' },
            { text: 'Es correcto, imprimir', type: 'success', value: 'imprimir' }
        ],
        'info'
    );

    if (confirmacion === 'revisar') {
        document.getElementById('acta-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }

    if (confirmacion === 'imprimir') {
        const btnImprimir = document.getElementById('btn-imprimir');
        const originalHtml = btnImprimir.innerHTML;
        
        // Obtener sesión para credenciales
        const sessionData = localStorage.getItem('appSession');
        const session = sessionData ? JSON.parse(sessionData) : {};
        
        try {
            // Deshabilitar botón y mostrar estado
            btnImprimir.disabled = true;
            btnImprimir.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            console.log("📤 Enviando datos a base de datos:", datosActaParaGuardar);

            // Enviar datos al Webhook de Inserción
            const response = await fetch(ACTAS_INSERT_WEBHOOK, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': session.token || ""
                },
                body: JSON.stringify({
                    ...datosActaParaGuardar,
                    cedula: session.cedula || "",  // Cédula del asesor para el webhook
                    correo: session.email || ""    // Correo del asesor para el webhook
                })
            });

            if (!response.ok) {
                throw new Error(`Error en el servidor: ${response.status}`);
            }

            console.log("✅ Datos guardados exitosamente");
            showToast('Acta guardada en base de datos correctamente', 'success');

            // Proceder con la impresión física
            window.print();
            
            // Limpiar datos después de éxito
            datosActaParaGuardar = null;

        } catch (error) {
            console.error("❌ Error al guardar el acta:", error);
            showToast('Error al conectar con la base de datos, el acta no se guardó.', 'error');
            
            // Preguntar si desea imprimir de todas formas aunque falló el guardado
            const reintentar = await showCustomAlert(
                'Error de conexión',
                'No se pudo guardar el acta en la base de datos. ¿Deseas imprimirla de todas formas?',
                [
                    { text: 'No, intentar de nuevo', type: 'secondary', value: 'cancel' },
                    { text: 'Sí, imprimir de todas formas', type: 'warning', value: 'print_anyway' }
                ],
                'error'
            );
            
            if (reintentar === 'print_anyway') {
                window.print();
                datosActaParaGuardar = null;
            }
        } finally {
            // Restaurar botón
            btnImprimir.disabled = false;
            btnImprimir.innerHTML = originalHtml;
        }
    }
}

// ===== COMPROBANTE UPLOAD =====
function initComprobanteUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    if (!uploadArea || !fileInput) return;

    uploadArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) procesarImagenComprobante(file);
    });

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            procesarImagenComprobante(file);
        }
    });
}

function procesarImagenComprobante(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Por favor selecciona una imagen válida', 'error');
        return;
    }

    const imageUrl = URL.createObjectURL(file);
    const comprobanteImage = document.getElementById('comprobante-image');
    const comprobantePreview = document.getElementById('comprobante-preview');
    const actaPreview = document.getElementById('acta-preview');

    // Ocultar el acta para que no se imprima
    if (actaPreview) actaPreview.style.display = 'none';

    if (comprobanteImage) comprobanteImage.src = imageUrl;
    if (comprobantePreview) {
        comprobantePreview.classList.add('visible');
        comprobantePreview.style.display = 'block';
    }

    setTimeout(() => {
        if (comprobantePreview) {
            comprobantePreview.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);

    setTimeout(() => window.print(), 500);
}

// ===== DESCARGAS DE CARÁTULAS =====
async function downloadCaratula(fileId, filename, buttonEl) {
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const button = buttonEl instanceof HTMLElement ? buttonEl : null;

    if (button) {
        button.dataset.originalLabel = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Descargando...';
    }

    try {
        const response = await fetch(downloadUrl, { mode: 'cors' });

        if (!response.ok || response.type === 'opaqueredirect') {
            throw new Error('Respuesta no válida');
        }

        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('text/html')) {
            throw new Error('Respuesta HTML recibida');
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
        showToast('Descarga iniciada', 'success');
    } catch (error) {
        console.warn('Descarga directa fallida, usando método alternativo:', error.message);
        const fallbackLink = document.createElement('a');
        fallbackLink.href = downloadUrl;
        fallbackLink.download = filename;
        fallbackLink.rel = 'noopener';
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        document.body.removeChild(fallbackLink);
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = button.dataset.originalLabel || '<i class="fas fa-download"></i> Descargar';
            delete button.dataset.originalLabel;
        }
    }
}

// ===== SOLICITUD DE CRÉDITO =====
function abrirSolicitudCredito() {
    // Crear un iframe oculto para imprimir
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    iframe.onload = function() {
        try {
            setTimeout(() => {
                iframe.contentWindow.print();
                setTimeout(() => document.body.removeChild(iframe), 1000);
            }, 500);
        } catch (e) {
            console.error('Error al imprimir:', e);
            document.body.removeChild(iframe);
        }
    };

    // Usar nuestra propia solicitud local
    iframe.src = 'solicitudcredito.html';
}

// ===== CUSTOM ALERT MODAL =====
function showCustomAlert(title, message, buttons, type = 'info') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customAlertOverlay');
        const modalIcon = document.getElementById('modalIcon');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalButtons = document.getElementById('modalButtons');

        if (!overlay) {
            console.warn('Modal overlay not found');
            resolve(buttons[0]?.value || 'ok');
            return;
        }

        // Set icon based on type
        const iconConfig = {
            info: { icon: 'fa-info-circle', class: 'info' },
            success: { icon: 'fa-check-circle', class: 'success' },
            error: { icon: 'fa-exclamation-circle', class: 'error' },
            warning: { icon: 'fa-exclamation-triangle', class: 'warning' }
        };

        const config = iconConfig[type] || iconConfig.info;
        modalIcon.className = 'modal-icon ' + config.class;
        modalIcon.innerHTML = `<i class="fas ${config.icon}"></i>`;

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        // Clear and create buttons
        modalButtons.innerHTML = '';
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `modal-btn modal-btn-${btn.type || 'primary'}`;
            button.textContent = btn.text;
            button.onclick = () => {
                overlay.classList.remove('active');
                document.body.classList.remove('overflow-hidden');
                resolve(btn.value);
            };
            modalButtons.appendChild(button);
        });

        overlay.classList.add('active');
        document.body.classList.add('overflow-hidden');
    });
}

// ===== TOAST =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        info: 'fa-info-circle',
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle'
    };

    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Toast especial que muestra el JSON
function showToastWithJSON(message, jsonData) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast success toast-json';
    toast.style.cssText = 'max-width: 500px; cursor: pointer;';

    const jsonPreview = JSON.stringify(jsonData, null, 2);
    
    toast.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-check-circle"></i>
                <span><strong>${message}</strong></span>
            </div>
            <pre style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; font-size: 10px; max-height: 200px; overflow-y: auto; margin: 0; white-space: pre-wrap; word-break: break-all;">${jsonPreview}</pre>
            <small style="opacity: 0.8;">Click para copiar JSON</small>
        </div>
    `;

    toast.onclick = () => {
        navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2)).then(() => {
            showToast('JSON copiado al portapapeles', 'success');
        });
    };

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 10000); // 10 segundos para dar tiempo a leer
}

// ===== NAVEGACIÓN =====
function goBack() {
    window.location.href = '../index.html';
}

function handleLogout() {
    localStorage.removeItem('appSession');
    window.location.href = '../login.html';
}
