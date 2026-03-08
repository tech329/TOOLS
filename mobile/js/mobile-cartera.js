// Variables Globales
let CARTERA_DATA = [];
let hasAtrasados = false;
let currentView = 'cobros';

// ===== UTILIDADES DE FECHA (MIGRADAS DE APP MADRE) =====

function getMesAnioPrimerPago(credito) {
    return credito['mes_anio_primer_pago'] || credito['mes / año_primer_pago'] || credito.mes_año_primer_pago || null;
}

function parseEuropeanNumber(value) {
    if (!value) return 0;
    const str = String(value).trim();
    const normalized = str.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
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
    return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                        <p class="font-black text-indigo-700">$${parseFloat(credito.monto_aprobado || 0).toLocaleString('es-ES', {minimumFractionDigits:2})}</p>
                    </div>
                    <div>
                        <p class="text-[10px] text-indigo-500 uppercase font-bold">Capital Vigente</p>
                        <p class="font-black text-indigo-700">$${credito.capital_restante}</p>
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
    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    showConfirmModal({
        title: 'LIQUIDAR CRÉDITO',
        message: `¿Estás seguro de liquidar el crédito de ${credito.nombre_socio}? El saldo actual se marcará como 0,00.`,
        icon: 'fas fa-money-bill-wave',
        onConfirm: () => {
            const payload = {
                id_credito: credito.id,
                cedula_socio: credito.cedula_socio,
                cuota_pagada: credito.plazo, // Se marca como pagado total
                capital_restante: "0,00",
                accion: "LIQUIDAR_CREDITO",
                timestamp: new Date().toISOString()
            };

            console.log('📤 PAYLOAD LIQUIDACIÓN:', payload);
            showCustomToast('Petición de liquidación generada (Simulado)');
            
            // Actualización visual local
            credito.capital_restante = "0,00";
            credito.cuota_pagada = credito.plazo;
            renderCards(currentView, document.getElementById('data-list'));
            updateStats();
        }
    });
}

function prepararPagoCuota(id) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    const cuotaActual = parseInt(credito.cuota_pagada) || 0;
    const plazoTotal = parseInt(credito.plazo) || 0;
    const proximaCuota = cuotaActual + 1;
    const capitalActual = credito.capital_restante || '0,00';

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
    const regexFormato = /^-?\d{1,3}(\.\d{3})*,\d{2}$/;
    if (!regexFormato.test(nuevoCapitalStr)) {
        showCustomToast('Formato inválido. Use 0.000,00', 'error');
        return;
    }

    const nuevoCapital = parseEuropeanNumber(nuevoCapitalStr);
    const capitalAnterior = parseEuropeanNumber(credito.capital_restante);

    if (nuevoCapital > capitalAnterior) {
        showCustomToast('El nuevo capital no puede ser mayor al anterior', 'error');
        return;
    }

    showConfirmModal({
        title: 'CONFIRMAR REGISTRO',
        message: `Socio: ${credito.nombre_socio}\nCuota a registrar: #${numeroCuota}\nNuevo Capital: $${nuevoCapitalStr}\n\n¿Desea proceder?`,
        icon: 'fas fa-shield-alt',
        onConfirm: () => {
            const payload = {
                id_credito: credito.id,
                cedula_socio: credito.cedula_socio,
                cuota_pagada: numeroCuota,
                capital_restante: nuevoCapitalStr,
                accion: "REGISTRAR_PAGO_CUOTA",
                timestamp: new Date().toISOString()
            };

            console.log('📤 PAYLOAD PAGO:', payload);
            showCustomToast(`Pago de cuota #${numeroCuota} registrado (Simulado)`);

            // Simular actualización local
            credito.cuota_pagada = numeroCuota;
            credito.capital_restante = nuevoCapitalStr;
            renderCards(currentView, document.getElementById('data-list'));
            updateStats();
        }
    });
}

function confirmarNotificarWhatsApp(id) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;
    
    const cuotaPagada = parseInt(credito.cuota_pagada) || 0;
    const mesAnioPrimerPago = getMesAnioPrimerPago(credito);
    const fechaPagoTexto = formatearFechaTexto(credito.dia_pago, mesAnioPrimerPago, cuotaPagada);
    const montoDisplay = parseFloat(credito.monto_aprobado || 0).toLocaleString('es-ES', {minimumFractionDigits:2});

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
                Se enviará un mensaje automático mediante la API oficial.
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

async function enviarWhatsApp(id) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    // Obtener config (si no existe, usamos simulado para el log)
    const config = JSON.parse(localStorage.getItem('userNotificationConfig')) || { user: 'Simulación', instance: 'SIM-XXXX', apikey: 'NO-KEY' };

    let telefono = (credito.telefono_socio || '').replace(/\D/g, '');
    const ultimosNueve = telefono.slice(-9);
    telefono = `+593${ultimosNueve}`;

    const cuotaPagada = parseInt(credito.cuota_pagada) || 0;
    const mesAnioPrimerPago = getMesAnioPrimerPago(credito);
    const fechaPagoTexto = formatearFechaTexto(credito.dia_pago, mesAnioPrimerPago, cuotaPagada);

    const nombreSocio = credito.nombre_socio || 'Estimado socio';
    const userName = config.user || 'La Caja';

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

    const payload = {
        number: telefono,
        mediatype: "image",
        mimetype: "image/png",
        caption: mensaje,
        media: "https://lh3.googleusercontent.com/d/1oMybBIAVHNJaxK-xwDVt379sl_eW0Qhi=w2048",
        fileName: "recordatorio_pago.png",
        delay: 0,
        linkPreview: false,
        mentionsEveryOne: false
    };

    console.log("📤 JSON NOTIFICACIÓN WHATSAPP:", payload);

    if (!credito.telefono_socio) {
        showCustomToast('Socio no tiene teléfono registrado', 'error');
        return;
    }

    if (!canSendNotifications()) {
        showCustomToast('Configuración de WhatsApp no activa', 'error');
        console.warn("⚠️ Notificación no enviada: Configuración incompleta.");
        return;
    }

    try {
        const url = `https://api.luispinta.com/message/sendMedia/${config.instance}`;

        showCustomToast('Enviando notificación...', 'info');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': config.apikey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showCustomToast(`🌿 Notificación enviada a ${nombreSocio}`, 'success');
        } else {
            showCustomToast('Error al enviar. Verifique config.', 'error');
        }
    } catch (error) {
        console.error('Error WhatsApp:', error);
        showCustomToast('Error al procesar la notificación', 'error');
    }
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
    const session = typeof TupakAuth !== 'undefined' ? TupakAuth.getSession() : JSON.parse(localStorage.getItem('appSession'));
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
        
        const data = await response.json();
        CARTERA_DATA = Array.isArray(data) ? data : [];
        updateStats();
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
        filtered = dataToFilter.filter(c => {
            const dias = diasHastaFecha(c.dia_pago, getMesAnioPrimerPago(c), parseInt(c.cuota_pagada) || 0);
            const capitalRestante = parseEuropeanNumber(c.capital_restante);
            return capitalRestante > 0 && (parseInt(c.plazo) || 0) > (parseInt(c.cuota_pagada) || 0) && dias < 0;
        });
    } else if (view === 'cobros') {
        filtered = dataToFilter.filter(c => {
            const dias = diasHastaFecha(c.dia_pago, getMesAnioPrimerPago(c), parseInt(c.cuota_pagada) || 0);
            const capitalRestante = parseEuropeanNumber(c.capital_restante);
            return capitalRestante > 0 && (parseInt(c.plazo) || 0) > (parseInt(c.cuota_pagada) || 0) && dias >= 0 && dias <= 5;
        });
    } else {
        filtered = dataToFilter;
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center p-8 text-gray-400"><i class="fas fa-folder-open text-4xl mb-2"></i><p>${searchTerm ? 'Sin resultados para la búsqueda' : 'No hay registros'}</p></div>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const dias = diasHastaFecha(item.dia_pago, getMesAnioPrimerPago(item), parseInt(item.cuota_pagada) || 0);
        const fecha = formatDateDisplay(item.dia_pago, getMesAnioPrimerPago(item), parseInt(item.cuota_pagada) || 0);
        
        // Botón dinámico según vista
        const actionBtn = view === 'general' 
            ? `<button onclick="${item.acta ? `window.open('https://cajatupakrantina.webcoopec.com/view/${item.acta}', '_blank')` : "showCustomToast('Sin acta asignada', 'info')"}" class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-blue-50 text-blue-600 transition-colors">
                    <i class="fas fa-table text-lg"></i>
                    <span class="text-[10px] font-bold uppercase">Tabla</span>
               </button>`
            : `<button onclick="prepararLiquidacion('${item.id}')" class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-amber-50 text-amber-600 transition-colors">
                    <i class="fas fa-money-bill-wave text-lg"></i>
                    <span class="text-[10px] font-bold uppercase">Liquidar</span>
               </button>`;

        return `
        <div class="data-item ${view}">
            <div class="item-head">
                <div style="flex: 1; min-width: 0;">
                    <div class="item-socio truncate">${item.nombre_socio}</div>
                    <div class="item-cedula">ID: ${item.cedula_socio}</div>
                </div>
                ${getBadge(dias, view)}
            </div>
            
            <div class="item-details">
                <div class="detail-box">
                    <span class="detail-label">VALOR CUOTA</span>
                    <span class="detail-val text-blue-900 font-bold">$${parseFloat(item.monto_aprobado).toFixed(2)}</span>
                </div>
                <div class="detail-box">
                    <span class="detail-label">CAPITAL VIGENTE</span>
                    <span class="detail-val text-indigo-600 font-bold">$${item.capital_restante}</span>
                </div>
                <div class="detail-box">
                    <span class="detail-label">VENCIMIENTO</span>
                    <span class="detail-val">${fecha}</span>
                </div>
                <div class="detail-box">
                    <span class="detail-label">CUOTA #</span>
                    <span class="detail-val font-medium text-slate-700">${item.cuota_pagada || 0}/${item.plazo}</span>
                </div>
            </div>

            <div class="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-100">
                <button onclick="confirmarNotificarWhatsApp('${item.id}')" class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-green-50 text-green-600 transition-colors">
                    <i class="fab fa-whatsapp text-lg"></i>
                    <span class="text-[10px] font-bold uppercase">WhatsApp</span>
                </button>
                <button onclick="prepararPagoCuota('${item.id}')" class="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-indigo-50 text-indigo-600 transition-colors">
                    <i class="fas fa-hand-holding-usd text-lg"></i>
                    <span class="text-[10px] font-bold uppercase">Cobrar</span>
                </button>
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

