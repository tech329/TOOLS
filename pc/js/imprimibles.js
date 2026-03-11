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
let modoReimpresionActivo = false;

const CEDULA_LOOKUP_WEBHOOK = 'https://lpn8nwebhook.luispintasolutions.com/webhook/c460611e-8d0c-4a7b-bfcc-50b1e5858048';
const ACTAS_LOOKUP_WEBHOOK = 'https://lpn8nwebhook.luispintasolutions.com/webhook/actasquerycompleto';
const ACTAS_GENERATE_QUERY_WEBHOOK = 'https://lpn8nwebhook.luispintasolutions.com/webhook/actasquery';
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

    // Inicializar búsqueda por cédula
    initCedulaSearch();

    // Inicializar upload de comprobante
    initComprobanteUpload();

    // Cargar datos de prueba (Temporal)
    cargarDatosPrueba();

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

// ===== GESTIÓN DE DATOS (WEBHOOKS) =====
function extractActasResponseRecords(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];

    const candidates = [
        data.data,
        data.records,
        data.rows,
        data.items,
        data.result,
        data.results,
        data.actas,
        data.output
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
        if (candidate && typeof candidate === 'object') {
            if (Array.isArray(candidate.data)) return candidate.data;
            if (Array.isArray(candidate.rows)) return candidate.rows;
            if (Array.isArray(candidate.records)) return candidate.records;
        }
    }

    if (data.cedula_socio || data.acta || data.nombre_socio) {
        return [data];
    }

    return [];
}

function sortActasByNewest(records) {
    return [...records].sort((a, b) => {
        const actaA = parseInt(a?.acta, 10) || 0;
        const actaB = parseInt(b?.acta, 10) || 0;
        if (actaA !== actaB) return actaB - actaA;

        const dateA = new Date(a?.fecha_hora || a?.created_at || 0).getTime() || 0;
        const dateB = new Date(b?.fecha_hora || b?.created_at || 0).getTime() || 0;
        if (dateA !== dateB) return dateB - dateA;

        const idA = parseInt(a?.id, 10) || 0;
        const idB = parseInt(b?.id, 10) || 0;
        return idB - idA;
    });
}

function getCurrentActaFormData() {
    const getValue = (id) => document.getElementById(id)?.value?.trim() || '';

    return {
        nombreCompleto: getValue('nombreCompleto'),
        identificacion: normalizarCedula(getValue('identificacion')),
        telefono: getValue('telefono'),
        montoAprobado: getValue('montoAprobado'),
        tasaInteres: getValue('tasaInteres'),
        plazoPago: getValue('plazoPago'),
        formaPago: getValue('formaPago'),
        destinoCredito: getValue('destinoCredito'),
        observaciones: getValue('observaciones'),
        fechaActa: getValue('fechaActaForm'),
        horaActa: getValue('horaActaForm')
    };
}

function calculateFirstPaymentDate(paymentDay, referenceDate = new Date()) {
    const baseDate = new Date(referenceDate);
    const currentDay = baseDate.getDate();
    const selectedDay = parseInt(paymentDay, 10);

    if (!Number.isFinite(selectedDay) || selectedDay < 1 || selectedDay > 31) {
        return null;
    }

    let targetMonth = baseDate.getMonth();
    let targetYear = baseDate.getFullYear();

    if (selectedDay < currentDay) {
        const daysBack = currentDay - selectedDay;
        if (daysBack > 7) {
            targetMonth += 2;
        } else {
            targetMonth += 1;
        }
    } else {
        targetMonth += 1;
    }

    while (targetMonth > 11) {
        targetMonth -= 12;
        targetYear += 1;
    }

    let firstPaymentDate = new Date(targetYear, targetMonth, selectedDay);

    if (firstPaymentDate.getMonth() !== targetMonth) {
        firstPaymentDate = new Date(targetYear, targetMonth + 1, 0);
    }

    return firstPaymentDate;
}

function getFirstPaymentSchedule(fechaBase) {
    const referenceDate = fechaBase ? new Date(`${fechaBase}T00:00:00`) : new Date();
    if (Number.isNaN(referenceDate.getTime())) {
        return { dia_pago: null, mes_anio_primer_pago: null };
    }

    const paymentDay = referenceDate.getDate();
    const firstPaymentDate = calculateFirstPaymentDate(paymentDay, referenceDate);

    if (!firstPaymentDate) {
        return { dia_pago: null, mes_anio_primer_pago: null };
    }

    const diaPago = String(paymentDay).padStart(2, '0');
    const mesPrimerPago = String(firstPaymentDate.getMonth() + 1).padStart(2, '0');
    const anioPrimerPago = String(firstPaymentDate.getFullYear());

    return {
        dia_pago: diaPago,
        mes_anio_primer_pago: `${mesPrimerPago}/${anioPrimerPago}`
    };
}

function buildActasQueryPayload(userData, filters = {}) {
    const formData = getCurrentActaFormData();
    const firstPaymentSchedule = getFirstPaymentSchedule(formData.fechaActa);
    const cedulaBusqueda = normalizarCedula(
        filters.cedula_socio ||
        filters.cedulaSocio ||
        filters.cedula_busqueda ||
        filters.cedula ||
        filters.identificacion ||
        formData.identificacion
    );

    const sanitizedUserData = userData && typeof userData === 'object'
        ? Object.fromEntries(Object.entries(userData).filter(([key, value]) => key !== 'token' && value != null))
        : {};

    return {
        ...sanitizedUserData,
        ...formData,
        ...filters,
        cedula: userData?.cedula || '',
        rol: userData?.rol || '',
        asesor: userData?.name || userData?.nombre || '',
        correo: userData?.email || userData?.correo || '',
        nombre_socio: formData.nombreCompleto,
        cedula_socio: cedulaBusqueda,
        cedulaSocio: cedulaBusqueda,
        cedula_busqueda: cedulaBusqueda,
        numero_cedula: cedulaBusqueda,
        identificacion: cedulaBusqueda || formData.identificacion,
        telefono_socio: formData.telefono,
        monto_aprobado: formData.montoAprobado,
        interes: formData.tasaInteres,
        plazo: formData.plazoPago,
        frecuencia_pago: formData.formaPago,
        destino_credito: formData.destinoCredito,
        fecha_hora: formData.fechaActa && formData.horaActa ? `${formData.fechaActa}T${formData.horaActa}:00` : '',
        dia_pago: firstPaymentSchedule.dia_pago,
        mes_anio_primer_pago: firstPaymentSchedule.mes_anio_primer_pago,
        buscar_por_cedula: cedulaBusqueda,
        buscarPorCedula: cedulaBusqueda,
        tipo_busqueda: cedulaBusqueda ? 'cedula_socio' : 'general',
        origen_consulta: 'pc-imprimibles',
        usuario: sanitizedUserData,
        formulario_acta: formData,
        filtros_busqueda: filters
    };
}

async function fetchActasRecords(userData, filters = {}) {
    if (!userData) return null;

    try {
        console.log("🔍 Consultando actas disponibles...");
        const body = buildActasQueryPayload(userData, filters);
        const cedulaFiltro = body.cedula_socio;

        const response = await fetch(ACTAS_LOOKUP_WEBHOOK, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': userData.token || ""
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        const actas = sortActasByNewest(extractActasResponseRecords(data));
        window.ACTAS_RECIBIDAS = actas;

        console.log('📥 Actas recibidas:', actas.length, cedulaFiltro ? `| filtro cédula: ${cedulaFiltro}` : '');

        return actas;
    } catch (error) {
        console.error("❌ Error consultando actas:", error);
        return [];
    }
}

async function fetchActas(userData) {
    if (!userData) return null;

    try {
        console.log("🔍 Consultando última acta antes de generar...");
        const body = buildActasQueryPayload(userData, { tipo_busqueda: 'generacion' });

        const response = await fetch(ACTAS_GENERATE_QUERY_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': userData.token || ""
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const actas = sortActasByNewest(extractActasResponseRecords(data));

        console.log("📥 RESPUESTA COMPLETA DEL WEBHOOK:", JSON.stringify(actas, null, 2));

        if (actas.length > 0) {
            const ultimaActa = actas[0];
            console.log("📄 ÚLTIMA ACTA DETECTADA:", ultimaActa);
            
            const hoy = new Date().toISOString().split('T')[0];
            const fechaUltimaRegistro = obtenerValorRegistro(ultimaActa, [
                'fecha_hora', 'fechaHora', 'created_at', 'fecha'
            ], '');
            const { fecha: fechaUltima } = obtenerFechaYHoraDesdeRegistro(fechaUltimaRegistro);

            // Logs específicos para investigar 'credito'
            console.log("🔍 VALOR DE 'credito' RECIBIDO:", ultimaActa.credito);
            console.log("🔍 TIPO DE DATO DE 'credito':", typeof ultimaActa.credito);
            console.log("🔍 FECHA ÚLTIMA ACTA:", fechaUltima, '| HOY:', hoy);

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

function normalizarCedula(value) {
    return String(value || '').replace(/\D/g, '');
}

function normalizeRecordKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
}

function obtenerValorRegistro(registro, aliases = [], fallback = '') {
    if (!registro || typeof registro !== 'object') return fallback;

    for (const alias of aliases) {
        if (registro[alias] !== undefined && registro[alias] !== null && registro[alias] !== '') {
            return registro[alias];
        }
    }

    const normalizedAliases = aliases.map(normalizeRecordKey);
    for (const [key, value] of Object.entries(registro)) {
        if (value === undefined || value === null || value === '') continue;
        if (normalizedAliases.includes(normalizeRecordKey(key))) {
            return value;
        }
    }

    return fallback;
}

function obtenerCedulaRegistro(registro) {
    if (!registro || typeof registro !== 'object') return '';

    const posiblesClaves = [
        'cedula_socio',
        'cedulaSocio',
        'identificacion',
        'identificación',
        'cedula',
        'cédula',
        'numero_cedula',
        'numeroCedula',
        'cedula socio',
        'CEDULA_SOCIO',
        'CEDULA',
        'IDENTIFICACION'
    ];

    for (const clave of posiblesClaves) {
        const valor = registro[clave];
        const cedula = normalizarCedula(valor);
        if (cedula) return cedula;
    }

    return '';
}

function obtenerFechaYHoraDesdeRegistro(fechaHora) {
    if (!fechaHora) {
        return {
            fecha: obtenerFechaLocal(),
            hora: obtenerHoraLocal()
        };
    }

    const [fechaPart, horaPart = ''] = String(fechaHora).split('T');
    return {
        fecha: fechaPart || obtenerFechaLocal(),
        hora: horaPart.slice(0, 5) || obtenerHoraLocal()
    };
}

function aplicarDatosActaEnFormulario(registro) {
    const fechaHora = obtenerFechaYHoraDesdeRegistro(obtenerValorRegistro(registro, [
        'fecha_hora', 'fechaHora', 'created_at', 'fecha'
    ]));

    const montoRegistro = obtenerValorRegistro(registro, [
        'monto_aprobado', 'montoAprobado', 'monto aprobado', 'monto', 'valor_credito'
    ]);

    const campos = {
        identificacion: obtenerCedulaRegistro(registro),
        nombreCompleto: obtenerValorRegistro(registro, [
            'nombre_socio', 'nombreCompleto', 'nombre completo', 'nombre', 'socio'
        ], ''),
        telefono: obtenerValorRegistro(registro, [
            'telefono_socio', 'telefono', 'celular', 'numero_telefono', 'telefono socio'
        ], ''),
        montoAprobado: parseAmountValue(montoRegistro).toFixed(2),
        tasaInteres: obtenerValorRegistro(registro, [
            'interes', 'tasaInteres', 'tasa_interes', 'tasa de interes'
        ], ''),
        plazoPago: obtenerValorRegistro(registro, [
            'plazo', 'plazoPago', 'plazo pago', 'meses'
        ], ''),
        formaPago: obtenerValorRegistro(registro, [
            'frecuencia_pago', 'formaPago', 'forma de pago'
        ], 'Mensual'),
        destinoCredito: obtenerValorRegistro(registro, [
            'destino_credito', 'destinoCredito', 'destino del credito', 'destino'
        ], 'Otros'),
        observaciones: obtenerValorRegistro(registro, [
            'observaciones', 'condiciones_especificas', 'condiciones especificas', 'condiciones'
        ], ''),
        fechaActaForm: fechaHora.fecha,
        horaActaForm: fechaHora.hora
    };

    Object.entries(campos).forEach(([id, valor]) => {
        const el = document.getElementById(id);
        if (el) el.value = valor;
    });
}

function cargarPreviewActa(registro) {
    const fechaHora = obtenerFechaYHoraDesdeRegistro(obtenerValorRegistro(registro, [
        'fecha_hora', 'fechaHora', 'created_at', 'fecha'
    ]));
    const montoAprobadoFormateado = formatAmountValue(obtenerValorRegistro(registro, [
        'monto_aprobado', 'montoAprobado', 'monto aprobado', 'monto', 'valor_credito'
    ]));

    document.getElementById('numeroActa').textContent = String(obtenerValorRegistro(registro, ['acta'], '000001')).padStart(6, '0');
    document.getElementById('numeroSesion').textContent = String(obtenerValorRegistro(registro, ['sesion', 'sesión'], '001')).padStart(3, '0');
    document.getElementById('preview-nombre').textContent = obtenerValorRegistro(registro, [
        'nombre_socio', 'nombreCompleto', 'nombre completo', 'nombre', 'socio'
    ], '---');
    document.getElementById('preview-identificacion').textContent = obtenerCedulaRegistro(registro) || '---';
    document.getElementById('preview-telefono').textContent = obtenerValorRegistro(registro, [
        'telefono_socio', 'telefono', 'celular', 'numero_telefono', 'telefono socio'
    ], '---');
    document.getElementById('preview-monto').textContent = '$' + montoAprobadoFormateado;
    document.getElementById('preview-tasa').textContent = `${obtenerValorRegistro(registro, ['interes', 'tasaInteres', 'tasa_interes', 'tasa de interes'], '---')}%`;
    document.getElementById('preview-plazo').textContent = obtenerValorRegistro(registro, ['plazo', 'plazoPago', 'plazo pago', 'meses'], '---');
    document.getElementById('preview-forma').textContent = obtenerValorRegistro(registro, ['frecuencia_pago', 'formaPago', 'forma de pago'], '---');
    document.getElementById('preview-destino').textContent = obtenerValorRegistro(registro, ['destino_credito', 'destinoCredito', 'destino del credito', 'destino'], '---');
    document.getElementById('preview-observaciones').textContent = obtenerValorRegistro(registro, ['observaciones', 'condiciones_especificas', 'condiciones especificas', 'condiciones'], 'Sin observaciones adicionales');

    const fechaInput = document.getElementById('fechaActaForm');
    const horaInput = document.getElementById('horaActaForm');
    if (fechaInput) fechaInput.value = fechaHora.fecha;
    if (horaInput) horaInput.value = fechaHora.hora;
    actualizarFechaFormateada();
}

async function reimprimirActaPorCedula() {
    const cedula = await showCedulaPromptModal({
        defaultCedula: '',
        placeholder: 'Ingresa la cédula a buscar',
        title: 'Reimprimir Acta',
        description: 'Ingresa la cédula del socio para buscar la última acta registrada y cargarla para reimpresión.',
        confirmText: 'Buscar acta'
    });
    if (!cedula) return;

    const cedulaInput = document.getElementById('identificacion');
    if (cedulaInput) cedulaInput.value = cedula;

    const btnReimprimir = document.getElementById('btn-reimprimir-acta');
    const textoOriginal = btnReimprimir ? btnReimprimir.innerHTML : '';

    try {
        if (btnReimprimir) {
            btnReimprimir.disabled = true;
            btnReimprimir.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
        }

        const sessionData = localStorage.getItem('appSession');
        const userData = sessionData ? JSON.parse(sessionData) : null;
        const actas = await fetchActasRecords(userData, { cedula_socio: cedula });

        const coincidencias = actas
            .filter(acta => obtenerCedulaRegistro(acta) === cedula)
            .sort((a, b) => (parseInt(b.acta, 10) || 0) - (parseInt(a.acta, 10) || 0));

        const actaSeleccionada = coincidencias[0] || (actas.length === 1 ? actas[0] : null);

        if (!actaSeleccionada) {
            await showCustomAlert(
                'Acta no encontrada',
                'No se encontró una acta registrada para esa cédula.',
                [{ text: 'Cerrar', type: 'secondary', value: 'close' }],
                'error'
            );
            return;
        }

        console.log('📄 Acta seleccionada para reimpresión:', actaSeleccionada);
        aplicarDatosActaEnFormulario(actaSeleccionada);
        cargarPreviewActa(actaSeleccionada);

        const fechaReimpresion = obtenerFechaYHoraDesdeRegistro(obtenerValorRegistro(actaSeleccionada, [
            'fecha_hora', 'fechaHora', 'created_at', 'fecha'
        ], '')).fecha;
        const firstPaymentSchedule = getFirstPaymentSchedule(fechaReimpresion);

        datosActaParaGuardar = {
            ...actaSeleccionada,
            monto_aprobado: formatAmountValue(obtenerValorRegistro(actaSeleccionada, ['monto_aprobado', 'montoAprobado', 'monto aprobado', 'monto', 'valor_credito'])),
            capital_restante: obtenerValorRegistro(actaSeleccionada, ['capital_restante', 'capitalRestante', 'capital restante'], '') || formatearCapitalRestante(obtenerValorRegistro(actaSeleccionada, ['monto_aprobado', 'montoAprobado', 'monto aprobado', 'monto', 'valor_credito'])),
            dia_pago: obtenerValorRegistro(actaSeleccionada, ['dia_pago', 'diaPago'], firstPaymentSchedule.dia_pago),
            mes_anio_primer_pago: obtenerValorRegistro(actaSeleccionada, ['mes_anio_primer_pago', 'mes / año_primer_pago', 'mes_año_primer_pago', 'mesAnioPrimerPago'], firstPaymentSchedule.mes_anio_primer_pago)
        };
        modoReimpresionActivo = true;

        document.getElementById('acta-preview').scrollIntoView({ behavior: 'smooth' });

        await showCustomAlert(
            'Acta cargada',
            'Se cargó la última acta encontrada para esa cédula. Al imprimir se hará una reimpresión, sin volver a guardar en la base.',
            [{ text: 'Entendido', type: 'primary', value: 'ok' }],
            'success'
        );
    } catch (error) {
        console.error('Error reimprimiendo acta:', error);
        await showCustomAlert(
            'Error',
            'No se pudo recuperar el acta para reimpresión.',
            [{ text: 'Cerrar', type: 'secondary', value: 'close' }],
            'error'
        );
    } finally {
        if (btnReimprimir) {
            btnReimprimir.disabled = false;
            btnReimprimir.innerHTML = textoOriginal;
        }
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
        return null;
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
            return result;
        } else {
            // No encontrado - habilitar entrada manual
            habilitarEntradaManual(result?.mensaje || 'Revise la cédula. Si no existe, ingrese manualmente');
            return result;
        }
    } catch (error) {
        console.error('Error buscando cédula:', error);
        habilitarEntradaManual('El servidor no responde. Ingrese manualmente');
        return null;
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
    modoReimpresionActivo = false;

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

function parseAmountValue(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

    const str = String(value).trim().replace(/\s+/g, '');
    if (!str) return 0;

    let normalized = str;

    if (str.includes(',') && str.includes('.')) {
        normalized = str.lastIndexOf(',') > str.lastIndexOf('.')
            ? str.replace(/\./g, '').replace(',', '.')
            : str.replace(/,/g, '');
    } else if (str.includes(',')) {
        normalized = str.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
        normalized = str.replace(/\./g, '');
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmountValue(value) {
    const amount = parseAmountValue(value);
    return amount.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatearCapitalRestante(monto) {
    try {
        return formatAmountValue(monto);
    } catch (error) {
        console.error('Error formateando capital restante:', error);
        return '0,00';
    }
}

function showCedulaPromptModal(options = {}) {
    const {
        defaultCedula = '',
        placeholder = '1727652107',
        title = 'Buscar Acta',
        description = 'Ingresa la cédula del socio para buscar un acta existente.',
        confirmText = 'Buscar acta'
    } = options;

    return new Promise((resolve) => {
        const existing = document.getElementById('customCedulaPromptOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'customCedulaPromptOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;z-index:12000;padding:24px;backdrop-filter:blur(6px);';
        overlay.innerHTML = `
            <div style="width:min(100%,460px);background:#fff;border-radius:24px;box-shadow:0 25px 60px rgba(15,23,42,.25);overflow:hidden;">
                <div style="padding:24px 24px 18px;background:linear-gradient(135deg,#1d4ed8,#4338ca);color:#fff;">
                    <div style="font-size:22px;font-weight:800;display:flex;align-items:center;gap:12px;">
                        <i class="fas fa-id-card"></i>
                        ${title}
                    </div>
                    <p style="margin:10px 0 0;font-size:13px;line-height:1.5;opacity:.92;">${description}</p>
                </div>
                <div style="padding:24px;display:flex;flex-direction:column;gap:14px;">
                    <label for="customCedulaPromptInput" style="font-size:13px;font-weight:700;color:#334155;">Cédula del socio</label>
                    <input id="customCedulaPromptInput" type="text" maxlength="10" value="${defaultCedula}" placeholder="${placeholder}" style="width:100%;padding:16px 18px;border:2px solid #cbd5e1;border-radius:16px;font-size:18px;font-weight:700;color:#0f172a;outline:none;">
                    <p id="customCedulaPromptError" style="margin:0;font-size:12px;color:#dc2626;display:none;"></p>
                    <div style="display:flex;gap:12px;justify-content:flex-end;padding-top:8px;">
                        <button type="button" id="customCedulaPromptCancel" style="padding:12px 18px;border-radius:14px;border:1px solid #cbd5e1;background:#fff;color:#475569;font-weight:700;">Cancelar</button>
                        <button type="button" id="customCedulaPromptAccept" style="padding:12px 18px;border-radius:14px;border:none;background:#1d4ed8;color:#fff;font-weight:800;box-shadow:0 12px 24px rgba(29,78,216,.24);">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;

        const cleanup = (value = null) => {
            overlay.remove();
            document.body.classList.remove('overflow-hidden');
            resolve(value);
        };

        document.body.appendChild(overlay);
        document.body.classList.add('overflow-hidden');

        const input = document.getElementById('customCedulaPromptInput');
        const error = document.getElementById('customCedulaPromptError');
        const cancelBtn = document.getElementById('customCedulaPromptCancel');
        const acceptBtn = document.getElementById('customCedulaPromptAccept');

        const submit = () => {
            const cedula = normalizarCedula(input?.value);
            if (!/^\d{10}$/.test(cedula)) {
                error.textContent = 'Ingresa una cédula válida de 10 dígitos.';
                error.style.display = 'block';
                input?.focus();
                return;
            }
            cleanup(cedula);
        };

        cancelBtn?.addEventListener('click', () => cleanup(null));
        acceptBtn?.addEventListener('click', submit);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) cleanup(null);
        });
        input?.addEventListener('input', () => {
            if (error.style.display !== 'none') error.style.display = 'none';
        });
        input?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                submit();
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                cleanup(null);
            }
        });

        setTimeout(() => input?.focus(), 30);
    });
}

// ===== GENERACIÓN DE ACTA =====
async function generarActa() {
    await generarActaDesdeFormulario();
}

async function generarActaDesdeFormulario() {
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
        modoReimpresionActivo = false;
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
        const firstPaymentSchedule = getFirstPaymentSchedule(fecha);

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

        const montoAprobadoNumerico = parseAmountValue(datos.montoAprobado);
        if (montoAprobadoNumerico <= 0) {
            throw new Error('Monto aprobado inválido');
        }

        const montoAprobadoFormateado = formatAmountValue(montoAprobadoNumerico);

        // Llenar el preview
        document.getElementById('preview-nombre').textContent = datos.nombreCompleto;
        document.getElementById('preview-identificacion').textContent = datos.identificacion;
        document.getElementById('preview-telefono').textContent = datos.telefono;
        document.getElementById('preview-monto').textContent = '$' + montoAprobadoFormateado;
        document.getElementById('preview-tasa').textContent = datos.tasaInteres + '%';
        document.getElementById('preview-plazo').textContent = datos.plazoPago;
        document.getElementById('preview-forma').textContent = datos.formaPago;
        document.getElementById('preview-destino').textContent = datos.destinoCredito;
        document.getElementById('preview-observaciones').textContent = datos.observaciones;

        actualizarFechaFormateada();

        // Obtener datos del usuario
        const datosUsuario = userData; // Usar el objeto ya parseado arriba
        const capitalRestanteFormateado = formatearCapitalRestante(montoAprobadoNumerico);

        // Preparar JSON para guardar (simulación)
        datosActaParaGuardar = {
            acta: numeroActa,
            sesion: numeroSesion,
            nombre_socio: datos.nombreCompleto,
            cedula_socio: datos.identificacion,
            monto_aprobado: montoAprobadoFormateado,
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
            dia_pago: firstPaymentSchedule.dia_pago,
            mes_anio_primer_pago: firstPaymentSchedule.mes_anio_primer_pago,
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

        if (modoReimpresionActivo) {
            btnImprimir.disabled = true;
            btnImprimir.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando...';
            try {
                window.print();
            } finally {
                btnImprimir.disabled = false;
                btnImprimir.innerHTML = originalHtml;
            }
            return;
        }
        
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
