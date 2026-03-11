// Variables Globales
let CARTERA_DATA = [];
let hasAtrasados = false;
let currentView = 'cobros';
const ACTUALIZAR_CREDITO_WEBHOOK = 'https://lpn8nwebhook.luispintasolutions.com/webhook/actualizar_credito';
const REGISTRAR_PAGO_WEBHOOK = 'https://lpn8nwebhook.luispintasolutions.com/webhook/registrar_pago';
const LIQUIDAR_CREDITO_WEBHOOK = 'https://lpn8nwebhook.luispintasolutions.com/webhook/liquidar_credito';

function isAdminUser() {
    const session = typeof TupakAuth !== 'undefined'
        ? TupakAuth.getSession()
        : JSON.parse(localStorage.getItem('appSession') || 'null');
    const roles = String(session?.rol || '').split(',').map(role => role.trim().toUpperCase());
    return roles.includes('ADMIN') || session?.email === 'contacto@tupakrantina.com' || session?.name === 'Luis Pinta';
}

function canEditCartera() {
    return !isAdminUser();
}

function showAdminReadOnlyToast() {
    showCustomToast('Los administradores tienen acceso de solo lectura en cartera.', 'info');
}

function getCurrentSessionData() {
    return typeof TupakAuth !== 'undefined'
        ? TupakAuth.getSession()
        : JSON.parse(localStorage.getItem('appSession') || 'null');
}

// ===== UTILIDADES DE FECHA (MIGRADAS DE APP MADRE) =====

function getMesAnioPrimerPago(credito) {
    return credito['mes_anio_primer_pago'] || credito['mes / año_primer_pago'] || credito.mes_año_primer_pago || null;
}

function hasMissingPaymentSchedule(credito) {
    return !credito?.dia_pago || !getMesAnioPrimerPago(credito);
}

function isActiveCredit(credito) {
    const plazo = parseInt(credito?.plazo, 10) || 0;
    const cuotaPagada = parseInt(credito?.cuota_pagada, 10) || 0;
    const capitalRestante = parseEuropeanNumber(credito?.capital_restante);
    return plazo > 0 && cuotaPagada < plazo && capitalRestante > 0;
}

function getMissingPaymentScheduleCredits() {
    return CARTERA_DATA.filter(credito => isActiveCredit(credito) && hasMissingPaymentSchedule(credito));
}

function getCreditoDias(credito) {
    return diasHastaFecha(credito.dia_pago, getMesAnioPrimerPago(credito), parseInt(credito.cuota_pagada, 10) || 0);
}

function sortCreditosByDias(creditos, direction = 'asc') {
    return [...creditos].sort((a, b) => {
        const diasA = getCreditoDias(a);
        const diasB = getCreditoDias(b);

        const safeDiasA = diasA === null ? Number.POSITIVE_INFINITY : diasA;
        const safeDiasB = diasB === null ? Number.POSITIVE_INFINITY : diasB;

        if (safeDiasA !== safeDiasB) {
            return direction === 'desc' ? safeDiasB - safeDiasA : safeDiasA - safeDiasB;
        }

        const fechaA = new Date(a.fecha_hora || a.created_at || 0).getTime() || 0;
        const fechaB = new Date(b.fecha_hora || b.created_at || 0).getTime() || 0;
        if (fechaA !== fechaB) return fechaA - fechaB;

        return String(a.nombre_socio || '').localeCompare(String(b.nombre_socio || ''), 'es', { sensitivity: 'base' });
    });
}

function getAssignPaymentDateDefaults() {
    const hoy = new Date();
    const nextMonth = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    return {
        mes: String(nextMonth.getMonth() + 1).padStart(2, '0'),
        anio: String(nextMonth.getFullYear())
    };
}

function renderMissingPaymentScheduleSection() {
    const section = document.getElementById('missing-payment-schedule-section');
    const countEl = document.getElementById('missing-payment-schedule-count');
    const listEl = document.getElementById('missing-payment-schedule-list');
    if (!section || !countEl || !listEl) return;

    const missingCredits = getMissingPaymentScheduleCredits();
    countEl.textContent = String(missingCredits.length);

    if (missingCredits.length === 0) {
        section.classList.add('hidden');
        listEl.innerHTML = '';
        return;
    }

    section.classList.remove('hidden');
    listEl.innerHTML = missingCredits.map(credito => `
        <article class="bg-white border border-amber-200 rounded-2xl p-3 shadow-sm">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <p class="text-xs font-black text-slate-800 uppercase">${credito.nombre_socio || 'N/A'}</p>
                    <p class="text-[11px] text-slate-500 mt-1">${credito.cedula_socio || 'N/A'}</p>
                    <p class="text-[11px] text-slate-500">$${formatStoredAmount(credito.monto_aprobado)}</p>
                </div>
                <span class="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase">Pendiente</span>
            </div>
            <div class="flex gap-2 mt-3">
                ${canEditCartera() ? `<button onclick="openAsignarFechaModal('${credito.id}')" class="flex-1 px-3 py-2 rounded-xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider"><i class="fas fa-calendar-plus mr-1"></i>Asignar</button>` : `<span class="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider text-center">Solo ver</span>`}
                ${credito.acta ? `<button onclick="window.open('https://cajatupakrantina.webcoopec.com/view/${credito.acta}', '_blank')" class="flex-1 px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider"><i class="fas fa-table mr-1"></i>Tabla</button>` : ''}
            </div>
        </article>
    `).join('');
}

function parseEuropeanNumber(value) {
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

function isValidCapitalInputFormat(value) {
    const normalized = String(value || '').trim();
    return /^(?:\d{1,3}|\d{1,3}(?:\.\d{3})+),\d{2}$/.test(normalized);
}

function diasHastaFecha(diaPago, mesAnioPrimerPago, cuotaPagada = 0) {
    if (!diaPago || !mesAnioPrimerPago) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    try {
        const partes = mesAnioPrimerPago.split('/');
        if (partes.length !== 2) return null;
        const mesPrimerPago = parseInt(partes[0]);
        const anioPrimerPago = parseInt(partes[1]);
        if (isNaN(mesPrimerPago) || isNaN(anioPrimerPago)) return null;
        const primerPago = new Date(anioPrimerPago, mesPrimerPago - 1, parseInt(diaPago));
        primerPago.setHours(0, 0, 0, 0);
        const proximoPago = new Date(primerPago);
        proximoPago.setMonth(primerPago.getMonth() + cuotaPagada);
        const diferencia = Math.ceil((proximoPago - hoy) / (1000 * 60 * 60 * 24));
        return diferencia;
    } catch (error) {
        return null;
    }
}

function formatDateDisplay(diaPago, mesAnioPrimerPago, cuotaPagada = 0) {
    if (!diaPago || !mesAnioPrimerPago) return 'N/A';
    try {
        const partes = mesAnioPrimerPago.split('/');
        const mesPrimerPago = parseInt(partes[0]);
        const anioPrimerPago = parseInt(partes[1]);
        const primerPago = new Date(anioPrimerPago, mesPrimerPago - 1, parseInt(diaPago));
        const fecha = new Date(primerPago);
        fecha.setMonth(primerPago.getMonth() + cuotaPagada);
        const options = { day: 'numeric', month: 'short' };
        return fecha.toLocaleDateString('es-ES', options).toUpperCase();
    } catch (error) { return 'N/A'; }
}

function formatEuropeanNumber(value) {
    if (!Number.isFinite(value)) return '0,00';
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatStoredAmount(value) {
    return formatEuropeanNumber(parseEuropeanNumber(value));
}

// ===== SISTEMA DE NOTIFICACIONES Y MODALES (TIPO APP MADRE) =====

function showCustomToast(message, type = 'success') {
    const container = document.getElementById('custom-toast-container');
    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl transition-all duration-300 transform translate-x-full opacity-0 pointer-events-auto`;
    
    const bgColors = {
        success: 'bg-emerald-500 text-white',
        error: 'bg-red-500 text-white',
        info: 'bg-indigo-500 text-white'
    };
    
    toast.className += ` ${bgColors[type] || bgColors.info}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
    
    toast.innerHTML = `
        <i class="fas ${icon} text-lg"></i>
        <span class="font-medium">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    }, 100);
    
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showConfirmModal({ title, message, icon = 'fas fa-question-circle', onConfirm, showInput = false, inputPlaceholder = '', inputType = 'text', extraHTML = '', inputLabel = '', inputSubtitle = '', hideCancel = false, confirmText = 'Confirmar' }) {
    const modal = document.getElementById('confirm-modal');
    const content = modal.querySelector('.modal-content');
    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const iconContainer = document.getElementById('confirm-modal-icon');
    const confirmBtn = document.getElementById('confirm-modal-confirm');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    const extraEl = document.getElementById('confirm-modal-extra');
    const inputContainer = document.getElementById('confirm-modal-input-container');
    const inputLabelEl = document.getElementById('confirm-modal-input-label');
    const inputSubtitleEl = document.getElementById('confirm-modal-input-subtitle');
    const inputField = document.getElementById('confirm-modal-input');

    titleEl.textContent = title;
    msgEl.textContent = message;
    confirmBtn.textContent = confirmText;
    
    if (hideCancel) {
        cancelBtn.classList.add('hidden');
    } else {
        cancelBtn.classList.remove('hidden');
    }
    
    // Inyectar HTML extra si existe
    if (extraHTML && extraEl) {
        extraEl.innerHTML = extraHTML;
        extraEl.classList.remove('hidden');
    } else if (extraEl) {
        extraEl.innerHTML = '';
        extraEl.classList.add('hidden');
    }

    // Configurar Input
    if (showInput && inputContainer) {
        inputContainer.classList.remove('hidden');
        inputLabelEl.textContent = inputLabel;
        inputSubtitleEl.textContent = inputSubtitle;
        inputField.placeholder = inputPlaceholder;
        inputField.type = inputType;
        inputField.value = '';
    } else if (inputContainer) {
        inputContainer.classList.add('hidden');
    }

    iconContainer.innerHTML = `<i class="${icon}"></i>`;
    
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden'); // Bloquear scroll
    
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        if (showInput && inputField) {
            inputField.focus();
        }
    }, 10);

    // Clonar para limpiar eventos
    const newConfirm = confirmBtn.cloneNode(true);
    confirmBtn.replaceWith(newConfirm);
    const newCancel = cancelBtn.cloneNode(true);
    cancelBtn.replaceWith(newCancel);

    newConfirm.addEventListener('click', () => {
        const inputVal = showInput ? inputField.value : null;
        closeModal();
        if (onConfirm) onConfirm(inputVal);
    });

    newCancel.addEventListener('click', closeModal);
    
    function closeModal() {
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        }, 200);
    }
}

function formatearPrimerPago(mesAnio, dia) {
    if (!mesAnio || !dia) return 'N/A';
    try {
        const [mes, anio] = mesAnio.split('/');
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return `${dia} de ${meses[parseInt(mes) - 1]} del ${anio}`;
    } catch (e) { return 'N/A'; }
}

function viewCreditoDetails(id) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    const missingSchedule = hasMissingPaymentSchedule(credito);

    const extraHTML = `
        <div class="text-left space-y-4">
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Información del Socio</p>
                <div class="grid grid-cols-1 gap-3">
                    <div>
                        <p class="text-[10px] text-slate-500 uppercase font-bold">Nombre</p>
                        <p class="font-bold text-slate-800 text-sm uppercase">${credito.nombre_socio}</p>
                    </div>
                    <div class="flex justify-between">
                        <div>
                            <p class="text-[10px] text-slate-500 uppercase font-bold">Cédula</p>
                            <p class="font-bold text-slate-800 text-sm">${credito.cedula_socio}</p>
                        </div>
                        <div>
                            <p class="text-[10px] text-slate-500 uppercase font-bold">Teléfono</p>
                            <p class="font-bold text-slate-800 text-sm">${credito.telefono_socio || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <p class="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Detalles Financieros</p>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-[10px] text-indigo-500 uppercase font-bold">Monto</p>
                        <p class="font-black text-indigo-700">$${formatStoredAmount(credito.monto_aprobado)}</p>
                    </div>
                    <div>
                        <p class="text-[10px] text-indigo-500 uppercase font-bold">Capital Vigente</p>
                        <p class="font-black text-indigo-700">$${formatStoredAmount(credito.capital_restante)}</p>
                    </div>
                    <div>
                        <p class="text-[10px] text-indigo-500 uppercase font-bold">Plazo</p>
                        <p class="font-bold text-slate-800">${credito.plazo} meses</p>
                    </div>
                    <div>
                        <p class="text-[10px] text-indigo-500 uppercase font-bold">Interés</p>
                        <p class="font-bold text-slate-800">${credito.interes || 0}%</p>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p class="text-[9px] text-slate-500 uppercase font-bold">Frecuencia</p>
                    <p class="text-xs font-bold text-slate-700">${credito.frecuencia_pago || 'MENSUAL'}</p>
                </div>
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p class="text-[9px] text-slate-500 uppercase font-bold">Día de Pago</p>
                    <p class="text-xs font-bold text-emerald-600">Día ${credito.dia_pago}</p>
                </div>
            </div>

            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p class="text-[9px] text-slate-500 uppercase font-bold">Primer Pago</p>
                <p class="text-xs font-bold text-slate-700">${formatearPrimerPago(getMesAnioPrimerPago(credito), credito.dia_pago)}</p>
            </div>

            ${missingSchedule ? `
            <div class="bg-amber-50 p-3 rounded-xl border border-amber-200">
                <p class="text-[9px] text-amber-600 uppercase font-black">Fecha de Pago Pendiente</p>
                <p class="text-xs font-semibold text-amber-800 mt-1">Este crédito no tiene día de pago ni mes y año asignados.</p>
                ${canEditCartera() ? `<button onclick="openAsignarFechaModal('${credito.id}')" class="mt-3 w-full px-3 py-3 rounded-xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider"><i class="fas fa-calendar-plus mr-1"></i>Asignar Fecha</button>` : `<div class="mt-3 w-full px-3 py-3 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider text-center">Solo visualización para admin</div>`}
            </div>` : ''}
            
            ${credito.acta ? `
            <div class="bg-blue-50 p-3 rounded-xl border border-blue-100 flex justify-between items-center">
                <div>
                    <p class="text-[9px] text-blue-500 uppercase font-bold">Número de Acta</p>
                    <p class="text-xs font-black text-blue-800">${credito.acta}</p>
                </div>
                <button onclick="window.open('https://cajatupakrantina.webcoopec.com/view/${credito.acta}', '_blank')" class="bg-blue-600 text-white p-2 px-3 rounded-lg text-[10px] font-bold">
                    VER TABLA
                </button>
            </div>` : ''}
        </div>
    `;

    showConfirmModal({
        title: 'DETALLES DEL CRÉDITO',
        icon: 'fas fa-info-circle',
        extraHTML: extraHTML,
        hideCancel: true,
        confirmText: 'CERRAR'
    });
}

function formatearFechaTexto(diaPago, mesAnioPrimerPago, cuotaPagada) {
    try {
        const mesesTexto = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];

        const [mes, anio] = mesAnioPrimerPago.split('/');
        const mesPrimerPago = parseInt(mes);
        const anioPrimerPago = parseInt(anio);

        const primerPago = new Date(anioPrimerPago, mesPrimerPago - 1, parseInt(diaPago));
        const proximoPago = new Date(primerPago);
        proximoPago.setMonth(primerPago.getMonth() + parseInt(cuotaPagada));

        const dia = proximoPago.getDate();
        const mesTexto = mesesTexto[proximoPago.getMonth()];
        const anioProximo = proximoPago.getFullYear();

        return `${dia} de ${mesTexto} del ${anioProximo}`;
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return 'N/A';
    }
}

function canSendNotifications() {
    const config = JSON.parse(localStorage.getItem('userNotificationConfig'));
    if (!config) return false;
    
    const hasApiKey = config.apikey && config.apikey.toLowerCase() !== 'no' && config.apikey.trim() !== '';
    const hasInstance = config.instance && config.instance.toLowerCase() !== 'no' && config.instance.trim() !== '';

    return config.active && hasApiKey && hasInstance;
}

function abrirAutorizacion(cedula, nombre) {
    const url = `autorizacion_buro.html?cedula=${cedula}&nombre=${encodeURIComponent(nombre)}`;
    window.location.href = url;
}

// ===== ACCIONES FINANCIERAS (RÉPLICA APP MADRE) =====

function prepararLiquidacion(id) {
    if (!canEditCartera()) {
        showAdminReadOnlyToast();
        return;
    }

    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    showConfirmModal({
        title: 'LIQUIDAR CRÉDITO',
        message: `¿Estás seguro de liquidar el crédito de ${credito.nombre_socio}? El saldo actual se marcará como 0,00.`,
        icon: 'fas fa-money-bill-wave',
        onConfirm: async () => {
            const session = getCurrentSessionData();
            const payload = {
                id_credito: credito.id,
                cedula: session?.cedula || '',
                rol: session?.rol || '',
                asesor: session?.name || '',
                correo: session?.email || '',
                accion: "LIQUIDAR_CREDITO",
                timestamp: new Date().toISOString()
            };

            console.log('📤 PAYLOAD LIQUIDACIÓN:', payload);

            try {
                const response = await fetch(LIQUIDAR_CREDITO_WEBHOOK, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': session?.token || ''
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                credito.capital_restante = "0,00";
                credito.cuota_pagada = credito.plazo;
                renderCards(currentView, document.getElementById('data-list'));
                updateStats();
                renderMissingPaymentScheduleSection();
                showCustomToast('Crédito liquidado correctamente.', 'success');
            } catch (error) {
                console.error('❌ Error al liquidar crédito:', error);
                showCustomToast('No se pudo liquidar el crédito. Intenta nuevamente.', 'error');
            }
        }
    });
}

function openAsignarFechaModal(id) {
    if (!canEditCartera()) {
        showAdminReadOnlyToast();
        return;
    }

    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) {
        showCustomToast('No se encontró el crédito', 'error');
        return;
    }

    const defaults = getAssignPaymentDateDefaults();
    const currentMonth = getMesAnioPrimerPago(credito)?.split('/')?.[0] || defaults.mes;
    const currentYear = getMesAnioPrimerPago(credito)?.split('/')?.[1] || defaults.anio;
    const currentDay = String(credito.dia_pago || '').replace(/\D/g, '');
    const currentYearNumber = parseInt(currentYear, 10) || new Date().getFullYear();

    const monthOptions = [
        ['01', 'Enero'], ['02', 'Febrero'], ['03', 'Marzo'], ['04', 'Abril'],
        ['05', 'Mayo'], ['06', 'Junio'], ['07', 'Julio'], ['08', 'Agosto'],
        ['09', 'Septiembre'], ['10', 'Octubre'], ['11', 'Noviembre'], ['12', 'Diciembre']
    ].map(([value, label]) => `<option value="${value}" ${value === currentMonth ? 'selected' : ''}>${label}</option>`).join('');

    let yearOptions = '';
    for (let year = currentYearNumber; year <= currentYearNumber + 2; year++) {
        yearOptions += `<option value="${year}" ${String(year) === String(currentYear) ? 'selected' : ''}>${year}</option>`;
    }

    const extraHTML = `
        <div class="text-left space-y-4">
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm space-y-1">
                <p><strong>Socio:</strong> ${credito.nombre_socio || 'N/A'}</p>
                <p><strong>Cédula:</strong> ${credito.cedula_socio || 'N/A'}</p>
                <p><strong>Monto:</strong> $${formatStoredAmount(credito.monto_aprobado)}</p>
            </div>
            <div>
                <label class="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Día de Pago</label>
                <input id="assign-dia-pago" type="number" min="1" max="31" value="${currentDay}" placeholder="15" class="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg font-black text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-100 outline-none transition-all">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Mes Primer Pago</label>
                    <select id="assign-mes-primer-pago" class="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-100 outline-none transition-all">${monthOptions}</select>
                </div>
                <div>
                    <label class="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Año Primer Pago</label>
                    <select id="assign-anio-primer-pago" class="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-100 outline-none transition-all">${yearOptions}</select>
                </div>
            </div>
            <p class="text-[10px] text-slate-400 italic">Se guardará como dia_pago = DD y mes_anio_primer_pago = MM/YYYY.</p>
        </div>`;

    showConfirmModal({
        title: 'ASIGNAR FECHA',
        message: 'Complete los datos del primer pago para este crédito.',
        icon: 'fas fa-calendar-plus',
        extraHTML,
        confirmText: 'GUARDAR',
        onConfirm: () => guardarFechaPago(id)
    });
}

async function guardarFechaPago(id) {
    if (!canEditCartera()) {
        showAdminReadOnlyToast();
        return;
    }

    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    const day = parseInt(document.getElementById('assign-dia-pago')?.value, 10);
    const month = document.getElementById('assign-mes-primer-pago')?.value || '';
    const year = document.getElementById('assign-anio-primer-pago')?.value || '';

    if (!Number.isInteger(day) || day < 1 || day > 31) {
        showCustomToast('El día debe estar entre 1 y 31', 'error');
        return;
    }

    const diaFormateado = String(day).padStart(2, '0');
    const mesAnioPrimerPago = `${month}/${year}`;
    const session = getCurrentSessionData();
    const payload = {
        id_credito: credito.id,
        cedula_socio: credito.cedula_socio,
        dia_pago: diaFormateado,
        mes_anio_primer_pago: mesAnioPrimerPago,
        cedula: session?.cedula || '',
        rol: session?.rol || '',
        asesor: session?.name || '',
        correo: session?.email || '',
        accion: 'ASIGNAR_FECHA_PAGO',
        timestamp: new Date().toISOString()
    };

    console.log('📤 PAYLOAD FECHA PAGO:', payload);

    try {
        const response = await fetch(ACTUALIZAR_CREDITO_WEBHOOK, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': session?.token || ''
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        credito.dia_pago = diaFormateado;
        credito.mes_anio_primer_pago = mesAnioPrimerPago;
        renderCards(currentView, document.getElementById('data-list'));
        updateStats();
        renderMissingPaymentScheduleSection();
        showCustomToast('Fecha de pago asignada correctamente', 'success');
    } catch (error) {
        console.error('❌ Error al asignar fecha de pago:', error);
        showCustomToast('No se pudo actualizar la fecha de pago', 'error');
    }
}

function prepararPagoCuota(id) {
    if (!canEditCartera()) {
        showAdminReadOnlyToast();
        return;
    }

    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    const cuotaActual = parseInt(credito.cuota_pagada) || 0;
    const plazoTotal = parseInt(credito.plazo) || 0;
    const proximaCuota = cuotaActual + 1;
    const capitalActual = formatStoredAmount(credito.capital_restante || '0,00');

    // HTML Extra con acciones (Réplica exacta de la imagen)
    const extraHTML = `
        <div class="flex flex-col gap-5 text-left mb-4">
            <!-- Caja Azul de Info -->
            <div class="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-sm space-y-2">
                <p class="text-slate-700"><strong>Socio:</strong> <span class="uppercase font-black text-slate-900 ml-1">${credito.nombre_socio}</span></p>
                <p class="text-slate-700"><strong>Cédula:</strong> <span class="text-slate-900 ml-1">${credito.cedula_socio}</span></p>
                <p class="text-slate-700"><strong>Acta:</strong> <span class="text-slate-900 ml-1">${credito.acta || 'N/A'}</span></p>
                <p class="text-slate-700"><strong>Cuota actual:</strong> <span class="text-slate-900 ml-1">${cuotaActual} de ${plazoTotal}</span></p>
                <p class="text-slate-700"><strong>Nueva cuota:</strong> <span class="text-emerald-600 font-black ml-1">${proximaCuota} de ${plazoTotal}</span></p>
            </div>

            <!-- Caja Capital Actual (Amarillo) -->
            <div class="bg-[#fffbeb] p-6 rounded-2xl border-2 border-[#fef3c7] text-center shadow-sm">
                <p class="text-xs font-bold text-[#b45309] uppercase tracking-widest mb-1">Capital Actual:</p>
                <p class="text-4xl font-black text-[#1e293b]">$${capitalActual}</p>
            </div>
            
            <!-- Botón Ver Tabla -->
            ${credito.acta ? `
            <div class="flex justify-center -mt-2">
                <button onclick="window.open('https://cajatupakrantina.webcoopec.com/view/${credito.acta}', '_blank')" class="flex items-center gap-2 px-6 py-3.5 bg-[#5c56e0] hover:bg-[#4a44cc] text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95 shadow-indigo-100">
                    <i class="fas fa-table"></i> Ver Tabla de Amortización
                </button>
            </div>` : ''}
        </div>
    `;

    showConfirmModal({
        title: `REGISTRAR PAGO`,
        message: ``,
        icon: 'fas fa-cash-register',
        showInput: true,
        extraHTML: extraHTML,
        inputLabel: 'Nuevo Capital Vigente *',
        inputSubtitle: 'Usa . para miles y , para decimales (Ejemplo: 8.500,50)',
        inputPlaceholder: 'Ejemplo: ' + capitalActual,
        onConfirm: (valor) => {
            validarYConfirmarPago(credito, valor, proximaCuota);
        }
    });
}

function validarYConfirmarPago(credito, nuevoCapitalStr, numeroCuota) {
    if (!nuevoCapitalStr) {
        showCustomToast('Debe ingresar el nuevo capital', 'error');
        return;
    }

    // Validar formato (ej: 1.500,00 o 500,00)
    if (!isValidCapitalInputFormat(nuevoCapitalStr)) {
        showCustomToast('Corrija el valor. Use . para miles y , para decimales. Ejemplo: 8.500,50', 'error');
        return;
    }

    const nuevoCapital = parseEuropeanNumber(nuevoCapitalStr);
    const capitalAnterior = parseEuropeanNumber(credito.capital_restante);

    if (nuevoCapital >= capitalAnterior) {
        showCustomToast('El capital debe disminuir', 'error');
        return;
    }

    showConfirmModal({
        title: 'CONFIRMAR REGISTRO',
        message: `Socio: ${credito.nombre_socio}\nCuota a registrar: #${numeroCuota}\nNuevo Capital: $${nuevoCapitalStr}\n\n¿Desea proceder?`,
        icon: 'fas fa-shield-alt',
        onConfirm: async () => {
            const session = getCurrentSessionData();
            const capitalAnterior = parseEuropeanNumber(credito.capital_restante);
            const capitalNuevo = parseEuropeanNumber(nuevoCapitalStr);
            const payload = {
                id_credito: credito.id,
                cedula_socio: credito.cedula_socio,
                cuota_pagada: String(numeroCuota),
                capital_restante: nuevoCapitalStr,
                valor_registrado: formatEuropeanNumber(Math.max(0, capitalAnterior - capitalNuevo)),
                cedula: session?.cedula || '',
                rol: session?.rol || '',
                asesor: session?.name || '',
                correo: session?.email || '',
                accion: "REGISTRAR_PAGO_CUOTA",
                timestamp: new Date().toISOString()
            };

            console.log('📤 PAYLOAD PAGO:', payload);

            try {
                const response = await fetch(REGISTRAR_PAGO_WEBHOOK, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': session?.token || ''
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                credito.cuota_pagada = numeroCuota;
                credito.capital_restante = nuevoCapitalStr;
                renderCards(currentView, document.getElementById('data-list'));
                updateStats();
                renderMissingPaymentScheduleSection();
                showCustomToast(`Pago de cuota #${numeroCuota} registrado correctamente.`, 'success');
            } catch (error) {
                console.error('❌ Error al registrar pago:', error);
                showCustomToast('No se pudo registrar el pago. Intenta nuevamente.', 'error');
            }
        }
    });
}

function confirmarNotificarWhatsApp(id) {
    if (!canEditCartera()) {
        showAdminReadOnlyToast();
        return;
    }

    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;
    
    const cuotaPagada = parseInt(credito.cuota_pagada) || 0;
    const mesAnioPrimerPago = getMesAnioPrimerPago(credito);
    const fechaPagoTexto = formatearFechaTexto(credito.dia_pago, mesAnioPrimerPago, cuotaPagada);
    const montoDisplay = formatStoredAmount(credito.monto_aprobado);

    const extraHTML = `
        <div class="text-left space-y-3 mt-4">
            <div class="bg-green-50 p-4 rounded-xl border border-green-100">
                <p class="text-[10px] font-black text-green-600 uppercase mb-2">Resumen de Notificación</p>
                <p class="text-sm"><strong>Socio:</strong> ${credito.nombre_socio}</p>
                <p class="text-sm"><strong>Celular:</strong> ${credito.telefono_socio || 'N/A'}</p>
                <p class="text-sm"><strong>Fecha Pago:</strong> ${fechaPagoTexto}</p>
                <p class="text-sm"><strong>Monto Total:</strong> $${montoDisplay}</p>
            </div>
            <p class="text-[10px] text-slate-500 italic flex items-center gap-2">
                <i class="fab fa-whatsapp text-green-500 text-sm"></i>
                Se abrirá WhatsApp con el número del socio y el mensaje listo para enviar.
            </p>
        </div>
    `;

    showConfirmModal({
        title: 'NOTIFICAR PAGO',
        message: `¿Deseas enviar un recordatorio de pago a ${credito.nombre_socio} vía WhatsApp?`,
        icon: 'fab fa-whatsapp',
        extraHTML: extraHTML,
        confirmText: 'SÍ, ENVIAR',
        onConfirm: () => {
            enviarWhatsApp(id);
        }
    });
}

function enviarWhatsApp(id) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    const session = typeof TupakAuth !== 'undefined'
        ? TupakAuth.getSession()
        : JSON.parse(localStorage.getItem('appSession') || 'null');
    const config = JSON.parse(localStorage.getItem('userNotificationConfig') || 'null');
    const userName = session?.name || config?.user || 'La Caja';

    let telefono = (credito.telefono_socio || '').replace(/\D/g, '');
    if (!telefono) {
        showCustomToast('Socio no tiene teléfono registrado', 'error');
        return;
    }

    const ultimosNueve = telefono.slice(-9);
    if (ultimosNueve.length !== 9) {
        showCustomToast('El teléfono del socio no es válido', 'error');
        return;
    }

    telefono = `+593${ultimosNueve}`;

    const cuotaPagada = parseInt(credito.cuota_pagada) || 0;
    const mesAnioPrimerPago = getMesAnioPrimerPago(credito);
    const fechaPagoTexto = formatearFechaTexto(credito.dia_pago, mesAnioPrimerPago, cuotaPagada);
    const nombreSocio = credito.nombre_socio || 'Estimado socio';

    const dias = diasHastaFecha(credito.dia_pago, mesAnioPrimerPago, cuotaPagada);
    let mensaje = "";

    if (dias < 0) {
        // ATRASADOS (Desde ayer en adelante)
        const fechaReferencia = dias === -1 ? "ayer" : `el pasado *${fechaPagoTexto}*`;
        mensaje = `Hola *${nombreSocio}*, le saluda *${userName}* de la *CAJA DE AHORRO Y CRÉDITO TUPAK RANTINA*.

Le recordamos que su cuota registra un retraso desde ${fechaReferencia}. Agradecemos de antemano su pronto compromiso de pago para regularizar su crédito, recordando que el incumplimiento genera recargos por mora y el reporte negativo en el buró crediticio.

Ante cualquier pregunta, estoy para servirle. ¡Que tenga un excelente día! 🌿✨`;
    } else {
        // PRÓXIMOS COBROS (Hoy, Mañana, Futuro)
        let cuando = "";
        if (dias === 0) cuando = "*hoy mismo*";
        else if (dias === 1) cuando = "*mañana*";
        else cuando = `el día *${fechaPagoTexto}*`;

        mensaje = `Hola *${nombreSocio}*, le saluda *${userName}* de la *CAJA DE AHORRO Y CRÉDITO TUPAK RANTINA*.

El motivo de mi mensaje es solo para recordarle que ${cuando} le toca el pago de su crédito.

Ante cualquier pregunta, estoy para servirle. Este mensaje es solo un recordatorio y no pretende causar molestia o inconvenientes.

¡Que tenga un excelente día! 🌿✨`;
    }

    const url = `https://api.whatsapp.com/send?phone=${encodeURIComponent(telefono)}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    showCustomToast(`WhatsApp abierto para ${nombreSocio}`, 'success');
}

// ===== INICIALIZACIÓN =====

document.addEventListener('DOMContentLoaded', async () => {
    // Configurar info de usuario inmediatamente si hay sesión
    const session = typeof TupakAuth !== 'undefined' ? TupakAuth.getSession() : JSON.parse(localStorage.getItem('appSession'));
    if (session) {
        const name = session.name || 'Usuario';
        document.getElementById('user-name').textContent = name.toUpperCase();
        
        const roleBadge = document.getElementById('user-role-badge');
        if (roleBadge && session.rol) {
            const roles = (session.rol || "").split(',').map(r => r.trim().toUpperCase());
            const primaryRole = roles.includes('ADMIN') ? 'ADMIN EN JEFE' : (roles.includes('ASESOR') ? 'ASESOR' : roles[0]);
            roleBadge.textContent = primaryRole;
        }
    }

    // Configurar buscador
    setupSearch();

    // Cargar datos reales
    await fetchCartera();
    
    // Ocultar loader
    hideLoadingScreen();

    // Vista inicial inteligente
    if (hasAtrasados) {
        switchView('atrasados');
    } else {
        switchView('cobros');
    }
});

function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            renderCards(currentView, document.getElementById('data-list'), term);
        });
    }
}

async function fetchCartera() {
    const session = getCurrentSessionData();
    if (!session) return;

    try {
        const response = await fetch('https://lpn8nwebhook.luispintasolutions.com/webhook/carteraquery', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': session.token || ""
            },
            body: JSON.stringify({
                cedula: session.cedula || "",
                rol: session.rol || "",
                asesor: session.name || "",
                correo: session.email || ""
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        CARTERA_DATA = Array.isArray(data) ? data : [];
        updateStats();
        renderMissingPaymentScheduleSection();
    } catch (err) {
        console.error('Error fetching cartera:', err);
    }
}

function updateStats() {
    const stats = { vigentes: 0, cobros: 0, atrasados: 0 };
    
    CARTERA_DATA.forEach(c => {
        const dias = diasHastaFecha(c.dia_pago, getMesAnioPrimerPago(c), parseInt(c.cuota_pagada) || 0);
        const plazo = parseInt(c.plazo) || 0;
        const cuota = parseInt(c.cuota_pagada) || 0;
        const capitalRestante = parseEuropeanNumber(c.capital_restante);

        // Solo créditos activos
        if (plazo > 0 && cuota < plazo && capitalRestante > 0) {
            stats.vigentes++;
            if (dias < 0) stats.atrasados++;
            else if (dias <= 5) stats.cobros++;
        }
    });

    if (document.getElementById('count-vigentes')) document.getElementById('count-vigentes').textContent = stats.vigentes;
    if (document.getElementById('count-prox-cobro')) document.getElementById('count-prox-cobro').textContent = stats.cobros;
    if (document.getElementById('count-atrasados')) document.getElementById('count-atrasados').textContent = stats.atrasados;
    
    hasAtrasados = stats.atrasados > 0;
}

function switchView(view) {
    currentView = view;
    const listContainer = document.getElementById('data-list');
    const title = document.getElementById('card-title');
    const buttons = document.querySelectorAll('.tab-btn');
    
    // Actualizar botones de tabs
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.id === `btn-${view}`);
    });

    // Actualizar estados visuales de las tarjetas del dashboard
    const statCards = document.querySelectorAll('.stat-card-m');
    statCards.forEach(card => {
        card.classList.remove('active-stat');
    });

    if (view === 'atrasados') statCards[0].classList.add('active-stat');
    if (view === 'cobros') statCards[1].classList.add('active-stat');
    if (view === 'general') statCards[2].classList.add('active-stat');

    // Actualizar título
    const titles = {
        atrasados: 'Cartera Vencida (Mora)',
        cobros: 'Cobros Próximos (5 Días)',
        general: 'Cartera Vigente Total'
    };
    title.textContent = titles[view];

    // Limpiar búsqueda
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    renderCards(view, listContainer);
}

function renderCards(view, container, searchTerm = '') {
    // Filtrar por término de búsqueda primero
    let dataToFilter = CARTERA_DATA;
    if (searchTerm) {
        dataToFilter = CARTERA_DATA.filter(c => 
            (c.nombre_socio && c.nombre_socio.toLowerCase().includes(searchTerm)) ||
            (c.cedula_socio && c.cedula_socio.includes(searchTerm))
        );
    }

    let filtered = [];
    
    if (view === 'atrasados') {
        filtered = sortCreditosByDias(dataToFilter.filter(c => {
            const dias = diasHastaFecha(c.dia_pago, getMesAnioPrimerPago(c), parseInt(c.cuota_pagada) || 0);
            const capitalRestante = parseEuropeanNumber(c.capital_restante);
            return capitalRestante > 0 && (parseInt(c.plazo) || 0) > (parseInt(c.cuota_pagada) || 0) && dias < 0;
        }), 'asc');
    } else if (view === 'cobros') {
        filtered = sortCreditosByDias(dataToFilter.filter(c => {
            const dias = diasHastaFecha(c.dia_pago, getMesAnioPrimerPago(c), parseInt(c.cuota_pagada) || 0);
            const capitalRestante = parseEuropeanNumber(c.capital_restante);
            return capitalRestante > 0 && (parseInt(c.plazo) || 0) > (parseInt(c.cuota_pagada) || 0) && dias >= 0 && dias <= 5;
        }), 'asc');
    } else {
        filtered = dataToFilter;
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center p-8 text-gray-400"><i class="fas fa-folder-open text-4xl mb-2"></i><p>${searchTerm ? 'Sin resultados para la búsqueda' : 'No hay registros'}</p></div>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const missingSchedule = hasMissingPaymentSchedule(item);
        const dias = diasHastaFecha(item.dia_pago, getMesAnioPrimerPago(item), parseInt(item.cuota_pagada) || 0);
        const fecha = formatDateDisplay(item.dia_pago, getMesAnioPrimerPago(item), parseInt(item.cuota_pagada) || 0);
        
        // Botón dinámico según vista
        const actionBtn = view === 'general' 
            ? `${missingSchedule
                ? canEditCartera()
                    ? `<button onclick="openAsignarFechaModal('${item.id}')" class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-amber-50 text-amber-600 transition-colors"><i class="fas fa-calendar-plus text-lg"></i><span class="text-[10px] font-bold uppercase">Asignar</span></button>`
                    : `<button disabled class="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed"><i class="fas fa-lock text-lg"></i><span class="text-[10px] font-bold uppercase">Solo ver</span></button>`
                : `<button onclick="${item.acta ? `window.open('https://cajatupakrantina.webcoopec.com/view/${item.acta}', '_blank')` : "showCustomToast('Sin acta asignada', 'info')"}" class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-blue-50 text-blue-600 transition-colors">
                    <i class="fas fa-table text-lg"></i>
                    <span class="text-[10px] font-bold uppercase">Tabla</span>
               </button>`}`
            : `${canEditCartera()
                ? `<button onclick="prepararLiquidacion('${item.id}')" class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-amber-50 text-amber-600 transition-colors"><i class="fas fa-money-bill-wave text-lg"></i><span class="text-[10px] font-bold uppercase">Liquidar</span></button>`
                : `<button onclick="${item.acta ? `window.open('https://cajatupakrantina.webcoopec.com/view/${item.acta}', '_blank')` : "showCustomToast('Sin acta asignada', 'info')"}" class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-blue-50 text-blue-600 transition-colors"><i class="fas fa-table text-lg"></i><span class="text-[10px] font-bold uppercase">Tabla</span></button>`}`;

        return `
        <div class="data-item ${view} ${missingSchedule ? 'ring-2 ring-amber-200 bg-amber-50/70' : ''}">
            <div class="item-head">
                <div style="flex: 1; min-width: 0;">
                    <div class="item-socio truncate">${item.nombre_socio}</div>
                    <div class="item-cedula">ID: ${item.cedula_socio}</div>
                </div>
                ${missingSchedule ? '<span class="badge-m bg-amber-100 text-amber-700 border border-amber-200">FALTA FECHA</span>' : getBadge(dias, view)}
            </div>
            
            <div class="item-details">
                <div class="detail-box">
                    <span class="detail-label">VALOR CUOTA</span>
                    <span class="detail-val text-blue-900 font-bold">$${formatStoredAmount(item.monto_aprobado)}</span>
                </div>
                <div class="detail-box">
                    <span class="detail-label">CAPITAL VIGENTE</span>
                    <span class="detail-val text-indigo-600 font-bold">$${formatStoredAmount(item.capital_restante)}</span>
                </div>
                <div class="detail-box">
                    <span class="detail-label">VENCIMIENTO</span>
                    <span class="detail-val">${missingSchedule ? 'PENDIENTE' : fecha}</span>
                </div>
                <div class="detail-box">
                    <span class="detail-label">CUOTA #</span>
                    <span class="detail-val font-medium text-slate-700">${missingSchedule ? 'Sin fecha' : `${item.cuota_pagada || 0}/${item.plazo}`}</span>
                </div>
            </div>

            <div class="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-100">
                ${canEditCartera() ? `<button onclick="confirmarNotificarWhatsApp('${item.id}')" class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-green-50 text-green-600 transition-colors"><i class="fab fa-whatsapp text-lg"></i><span class="text-[10px] font-bold uppercase">WhatsApp</span></button>` : `<button onclick="${item.acta ? `window.open('https://cajatupakrantina.webcoopec.com/view/${item.acta}', '_blank')` : "showCustomToast('Sin acta asignada', 'info')"}" class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-blue-50 text-blue-600 transition-colors"><i class="fas fa-table text-lg"></i><span class="text-[10px] font-bold uppercase">Tabla</span></button>`}
                ${canEditCartera() ? `<button onclick="prepararPagoCuota('${item.id}')" class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-indigo-50 text-indigo-600 transition-colors"><i class="fas fa-hand-holding-usd text-lg"></i><span class="text-[10px] font-bold uppercase">Cobrar</span></button>` : `<button disabled class="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed"><i class="fas fa-lock text-lg"></i><span class="text-[10px] font-bold uppercase">Lectura</span></button>`}
                ${actionBtn}
                <button onclick="viewCreditoDetails('${item.id}')" class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors">
                    <i class="fas fa-eye text-lg"></i>
                    <span class="text-[10px] font-bold uppercase">Ver</span>
                </button>
            </div>
        </div>
    `;
    }).join('');
}

function getBadge(dias, view) {
    if (dias < 0) {
        return `<span class="badge-m bg-red-100 text-red-600 border border-red-200">${Math.abs(dias)} DÍAS MORA</span>`;
    } else if (dias <= 5) {
        return `<span class="badge-m bg-orange-100 text-orange-600 border border-orange-200">EN ${dias} DÍAS</span>`;
    }
    return `<span class="badge-m bg-emerald-100 text-emerald-600 border border-emerald-200">AL DÍA</span>`;
}

function hideLoadingScreen() {
    const loader = document.getElementById('loading-screen');
    const elapsed = Date.now() - (window.loaderStartTime || Date.now());
    const remaining = Math.max(0, (window.MIN_LOADER_TIME || 1000) - elapsed);

    setTimeout(() => {
        if (loader) {
            loader.style.opacity = '0';
            loader.style.visibility = 'hidden';
            setTimeout(() => {
                loader.style.display = 'none';
                document.body.classList.add('loaded');
            }, 300);
        }
    }, remaining);
}
// Old functions removed via end of file truncation or replacement logic below

