// =====================================================
// CARTERA.JS - Lógica del módulo de Cartera (PC)
// =====================================================

const MIN_LOADER_TIME = 1200;
let currentView = 'atrasados';
let CARTERA_DATA = [];
let filteredData = [];
let isAdmin = false;

// ===== UTILIDADES DE NÚMEROS (MIGRADAS DE APP MADRE) =====

function parseEuropeanNumber(value) {
    if (!value) return 0;
    const str = String(value).trim();
    const normalized = str.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized) || 0;
}

function formatEuropeanNumber(value) {
    if (!value || isNaN(value)) return '0,00';
    return value.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ===== UTILIDADES DE FECHA =====

function getMesAnioPrimerPago(credito) {
    return credito['mes_anio_primer_pago'] || credito['mes / año_primer_pago'] || credito.mes_año_primer_pago || null;
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
    } catch (error) { return null; }
}

function calcularFechaVencida(diaPago, mesAnioPrimerPago, cuotaPagada = 0) {
    if (!diaPago || !mesAnioPrimerPago) return 'N/A';
    try {
        const partes = mesAnioPrimerPago.split('/');
        const mesPrimerPago = parseInt(partes[0]);
        const anioPrimerPago = parseInt(partes[1]);
        const primerPago = new Date(anioPrimerPago, mesPrimerPago - 1, parseInt(diaPago));
        const fechaVencida = new Date(primerPago);
        fechaVencida.setMonth(primerPago.getMonth() + cuotaPagada);
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${fechaVencida.getDate()}/${meses[fechaVencida.getMonth()]}/${fechaVencida.getFullYear()}`;
    } catch (error) { return 'N/A'; }
}

function getUrgenciaBadge(diasRestantes) {
    if (diasRestantes === 0) return '<span class="px-2 py-1 bg-red-600 text-white rounded text-xs animate-pulse">¡HOY!</span>';
    if (diasRestantes === 1) return '<span class="px-2 py-1 bg-red-500 text-white rounded text-xs">Mañana</span>';
    if (diasRestantes <= 2) return '<span class="px-2 py-1 bg-orange-500 text-white rounded text-xs">' + diasRestantes + ' días</span>';
    return '<span class="px-2 py-1 bg-emerald-500 text-white rounded text-xs">' + diasRestantes + ' días</span>';
}

function formatearPrimerPago(mesAnio, dia) {
    if (!mesAnio || !dia) return 'N/A';
    try {
        const [mes, anio] = mesAnio.split('/');
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return `${dia} de ${meses[parseInt(mes) - 1]} del ${anio}`;
    } catch (e) { return 'N/A'; }
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
    const userNotificationConfig = JSON.parse(localStorage.getItem('userNotificationConfig'));
    if (!userNotificationConfig) return false;
    
    const hasApiKey = userNotificationConfig.apikey &&
        userNotificationConfig.apikey.toLowerCase() !== 'no' &&
        userNotificationConfig.apikey.trim() !== '';

    const hasInstance = userNotificationConfig.instance &&
        userNotificationConfig.instance.toLowerCase() !== 'no' &&
        userNotificationConfig.instance.trim() !== '';

    return userNotificationConfig.active && hasApiKey && hasInstance;
}

// ===== TUPAK SCORE (ICE) =====

function calcularTupakScore(creditos) {
    if (creditos.length === 0) return creditos;

    const montos = creditos.map(c => parseFloat(c.monto_aprobado) || 0);
    const plazos = creditos.map(c => parseInt(c.plazo) || 1);
    const retornos = creditos.map((c, i) => plazos[i] > 0 ? montos[i] / plazos[i] : 0);
    const tasas = creditos.map(c => parseFloat(c.interes) || 0);

    const montoMin = Math.min(...montos);
    const montoMax = Math.max(...montos);
    const plazoMin = Math.min(...plazos);
    const plazoMax = Math.max(...plazos);
    const retornoMin = Math.min(...retornos);
    const retornoMax = Math.max(...retornos);
    const tasaMin = Math.min(...tasas);
    const tasaMax = Math.max(...tasas);

    return creditos.map((c, i) => {
        const montoNorm = montoMax > montoMin ? (montos[i] - montoMin) / (montoMax - montoMin) : 0.5;
        const plazoNorm = plazoMax > plazoMin ? 1 - ((plazos[i] - plazoMin) / (plazoMax - plazoMin)) : 0.5;
        const retornoNorm = retornoMax > retornoMin ? (retornos[i] - retornoMin) / (retornoMax - retornoMin) : 0.5;
        const tasaNorm = tasaMax > tasaMin ? (tasas[i] - tasaMin) / (tasaMax - tasaMin) : 0.5;

        const ice = 0.25 * montoNorm + 0.20 * plazoNorm + 0.40 * retornoNorm + 0.15 * tasaNorm;
        let score = 1;
        if (ice >= 0.80) score = 5;
        else if (ice >= 0.60) score = 4;
        else if (ice >= 0.40) score = 3;
        else if (ice >= 0.20) score = 2;

        return { ...c, tupak_score: score };
    });
}

// ===== SESIÓN Y UI =====

function setupUserInfo() {
    const session = TupakAuth.getSession();
    if (!session) {
        console.warn("⚠️ No hay sesión, redirigiendo a login...");
        window.location.href = '../login.html';
        return;
    }
    
    console.log("👤 Usuario cargado:", session.name, "Rol:", session.rol);

    document.getElementById('user-name').textContent = session.name || 'Usuario';
    document.getElementById('user-avatar').textContent = (session.name || 'U').charAt(0).toUpperCase();

    // Renderizar Rol Filtrado (Solo ADMIN o ASESOR)
    const roleEl = document.getElementById('user-role');
    if (roleEl && session.rol) {
        const roles = session.rol.split(',').map(r => r.trim().toUpperCase());
        const filtered = roles.filter(r => r === 'ASESOR' || r === 'ADMIN').join(', ');
        roleEl.textContent = filtered;
    }

    // Determinar si es Admin
    isAdmin = (session.rol && session.rol.toLowerCase().includes('admin')) || 
              session.email === 'contacto@tupakrantina.com' || 
              session.name === 'Luis Pinta';
    
    const adminDashboard = document.getElementById('admin-dashboard');
    const btnReporteTabla = document.getElementById('btn-generar-reporte-tabla');
    
    if (isAdmin) {
        console.log("🔓 Modo Administrador habilitado");
        // El dashboard se mostrará/ocultará dinámicamente en switchView
        if (btnReporteTabla) btnReporteTabla.classList.remove('hidden');
    } else {
        if (adminDashboard) adminDashboard.classList.add('hidden');
        if (btnReporteTabla) btnReporteTabla.classList.add('hidden');
    }
}

function hideLoadingScreen() {
    const loader = document.getElementById('loading-screen');
    if (!loader) return;
    const elapsed = Date.now() - loaderStartTime;
    const remaining = Math.max(0, MIN_LOADER_TIME - elapsed);

    setTimeout(() => {
        loader.style.opacity = '0';
        loader.style.visibility = 'hidden';
        setTimeout(() => {
            loader.style.display = 'none';
            document.body.classList.add('loaded');
        }, 300);
    }, remaining);
}

function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`btn-${view}`);
    if (btn) btn.classList.add('active');
    
    const titles = {
        atrasados: 'Pagos Atrasados / Mora',
        cobros: 'Cobros Próximos (Próximos 5 días)',
        general: 'Base de Datos de Cartera'
    };
    document.getElementById('card-main-title').textContent = titles[view];

    // Controlar visibilidad del Dashboard Admin (Solo en Vista General para Admins)
    const adminDashboard = document.getElementById('admin-dashboard');
    if (adminDashboard) {
        if (isAdmin && view === 'general') {
            adminDashboard.classList.remove('hidden');
        } else {
            adminDashboard.classList.add('hidden');
        }
    }

    renderData(view);
}

// ===== LÓGICA DE DATOS =====

async function fetchCartera() {
    const session = TupakAuth.getSession();
    if (!session) return;

    try {
        console.log("🔍 Cargando datos de cartera para:", session.name);
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
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        console.log("📥 Datos recibidos:", Array.isArray(data) ? data.length : "error");
        
        CARTERA_DATA = Array.isArray(data) ? data : [];
        CARTERA_DATA = calcularTupakScore(CARTERA_DATA);
        updateStats();
        if (isAdmin) updateAdminDashboard();
        
        // Determinar vista inicial dinámica
        const tieneAtrasados = CARTERA_DATA.some(c => {
            const dias = diasHastaFecha(c.dia_pago, getMesAnioPrimerPago(c), parseInt(c.cuota_pagada) || 0);
            const capitalRestante = parseEuropeanNumber(c.capital_restante);
            return capitalRestante > 0 && (parseInt(c.plazo) || 0) > (parseInt(c.cuota_pagada) || 0) && (dias !== null && dias < 0);
        });

        currentView = tieneAtrasados ? 'atrasados' : 'cobros';
        
    } catch (err) {
        console.error('❌ Error al obtener cartera:', err);
        const tbody = document.getElementById('table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-red-500"><i class="fas fa-exclamation-circle mr-2"></i>Error al cargar datos. Por favor reintente.</td></tr>`;
    } finally {
        switchView(currentView); // Aseguramos que se renderice algo (aunque sea vacío)
        hideLoadingScreen();
    }
}

function updateStats() {
    let atrasados = 0;
    let cobros = 0;
    let montoTotal = 0;

    CARTERA_DATA.forEach(c => {
        const dias = diasHastaFecha(c.dia_pago, getMesAnioPrimerPago(c), parseInt(c.cuota_pagada) || 0);
        const capitalRestante = parseEuropeanNumber(c.capital_restante);
        const activa = (parseInt(c.plazo) || 0) > (parseInt(c.cuota_pagada) || 0) && capitalRestante > 0;

        if (activa) {
            if (dias < 0) atrasados++;
            else if (dias <= 5) cobros++;
            montoTotal += parseFloat(c.monto_aprobado) || 0;
        }
    });

    document.getElementById('stat-atrasados').textContent = atrasados;
    document.getElementById('stat-cobros').textContent = cobros;
    document.getElementById('stat-monto').textContent = '$' + montoTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 });
}

function updateAdminDashboard() {
    const totalCreditos = CARTERA_DATA.length;
    const montoTotalGlobal = CARTERA_DATA.reduce((sum, c) => sum + (parseFloat(c.monto_aprobado) || 0), 0);
    const capitalVigenteGlobal = CARTERA_DATA.reduce((sum, c) => sum + parseEuropeanNumber(c.capital_restante), 0);
    const promedio = totalCreditos > 0 ? montoTotalGlobal / totalCreditos : 0;

    // Métricas principales
    document.getElementById('dashboard-total-creditos').textContent = totalCreditos;
    document.getElementById('dashboard-monto-total').textContent = '$' + montoTotalGlobal.toLocaleString('es-ES', { maximumFractionDigits: 0 });
    document.getElementById('dashboard-capital-vigente').textContent = '$' + formatEuropeanNumber(capitalVigenteGlobal);
    document.getElementById('dashboard-promedio-monto').textContent = '$' + promedio.toLocaleString('es-ES', { maximumFractionDigits: 0 });

    // Conteo de Asesores únicos (por correo)
    const asesoresUnicos = new Set(CARTERA_DATA.map(c => c.correo_asesor || c.asesor_credito).filter(a => a));
    document.getElementById('dashboard-total-asesores').textContent = asesoresUnicos.size;

    // Ranking de Asesores (Agrupado por Correo para exactitud)
    const asesoresData = {};
    CARTERA_DATA.forEach(c => {
        const idAsesor = c.correo_asesor || 'sin_correo';
        const nombreAsesor = c.asesor_credito || 'Sin Asesor';
        
        if (!asesoresData[idAsesor]) {
            asesoresData[idAsesor] = { nombre: nombreAsesor, monto: 0, cant: 0 };
        }
        asesoresData[idAsesor].monto += parseFloat(c.monto_aprobado) || 0;
        asesoresData[idAsesor].cant++;
    });

    const rankingArr = Object.values(asesoresData).sort((a, b) => b.monto - a.monto);
    const rankingContainer = document.getElementById('asesores-ranking-container');
    
    if (rankingContainer && rankingArr.length > 0) {
        const maxMonto = Math.max(...rankingArr.map(a => a.monto)) || 1;
        rankingContainer.innerHTML = rankingArr.slice(0, 6).map(a => `
            <div class="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col justify-between">
                <div class="flex justify-between items-start mb-3">
                    <div class="overflow-hidden">
                        <p class="text-xs font-bold text-slate-700 truncate">${a.nombre}</p>
                        <p class="text-[10px] text-slate-400 font-medium">${a.cant} créditos otorgados</p>
                    </div>
                    <span class="text-sm font-black text-indigo-700">$${a.monto.toLocaleString('es-ES', {maximumFractionDigits:0})}</span>
                </div>
                <div class="w-full bg-indigo-200 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-indigo-600 h-full transition-all duration-1000" style="width: ${(a.monto / maxMonto * 100)}%"></div>
                </div>
            </div>
        `).join('');
    } else if (rankingContainer) {
        rankingContainer.innerHTML = '<div class="col-span-full py-10 text-center text-slate-400">No hay datos de asesores</div>';
    }

    // Lógica últimos 3 meses
    const mesesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const hoy = new Date();
    
    for (let i = 0; i < 3; i++) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const currentMonth = d.getMonth();
        const currentYear = d.getFullYear();
        
        const delMes = CARTERA_DATA.filter(c => {
            const fechaVal = c.created_at || c.fecha_hora;
            if (!fechaVal) return false;
            const f = new Date(fechaVal);
            return f.getMonth() === currentMonth && f.getFullYear() === currentYear;
        });

        const montoMes = delMes.reduce((sum, c) => sum + (parseFloat(c.monto_aprobado) || 0), 0);
        const capitalMes = delMes.reduce((sum, c) => sum + parseEuropeanNumber(c.capital_restante), 0);

        // Agrupar por asesor para este mes
        const asesoresDelMes = {};
        delMes.forEach(c => {
            const id = c.correo_asesor || 'sin_correo';
            if (!asesoresDelMes[id]) {
                asesoresDelMes[id] = { nombre: c.asesor_credito || 'Desconocido', cant: 0, monto: 0 };
            }
            asesoresDelMes[id].cant++;
            asesoresDelMes[id].monto += parseFloat(c.monto_aprobado) || 0;
        });

        const listAsesoresSorted = Object.values(asesoresDelMes).sort((a, b) => b.monto - a.monto);

        const nameEl = document.getElementById(`dashboard-month-${i}-name`);
        const countEl = document.getElementById(`dashboard-month-${i}-count`);
        const amountEl = document.getElementById(`dashboard-month-${i}-amount`);
        const capitalEl = document.getElementById(`dashboard-month-${i}-capital`);
        const asesoresContainer = document.getElementById(`dashboard-month-${i}-asesores`);

        if (nameEl) nameEl.textContent = mesesNombres[currentMonth] + ' ' + currentYear;
        if (countEl) countEl.textContent = delMes.length;
        if (amountEl) amountEl.textContent = '$' + montoMes.toLocaleString('es-ES', { maximumFractionDigits: 0 });
        if (capitalEl) capitalEl.textContent = '$' + formatEuropeanNumber(capitalMes);
        
        if (asesoresContainer) {
            if (listAsesoresSorted.length > 0) {
                asesoresContainer.innerHTML = listAsesoresSorted.map(as => `
                    <div class="flex justify-between items-center text-[11px] py-1 border-b border-white/10 last:border-0 uppercase font-medium">
                        <span class="truncate pr-2">${as.nombre}</span>
                        <span class="flex-shrink-0 font-bold">${as.cant} | $${as.monto.toLocaleString('es-ES', {maximumFractionDigits:0})}</span>
                    </div>
                `).join('');
            } else {
                asesoresContainer.innerHTML = '<p class="text-[11px] opacity-60 italic text-center py-2">Sin datos</p>';
            }
        }
    }
}

function renderData(view, searchTerm = '') {
    const tbody = document.getElementById('table-body');
    const thead = document.getElementById('table-head');
    if (!tbody || !thead) return;

    let data = CARTERA_DATA;
    if (searchTerm) {
        data = data.filter(c => 
            (c.nombre_socio && c.nombre_socio.toLowerCase().includes(searchTerm)) ||
            (c.cedula_socio && c.cedula_socio.includes(searchTerm)) ||
            (c.acta && c.acta.includes(searchTerm))
        );
    }

    tbody.innerHTML = '';

    if (view === 'atrasados') {
        thead.innerHTML = `<tr><th>Vencimiento</th><th>Días Mora</th><th>Socio</th><th>Cédula</th><th>Monto</th><th>Score</th><th>Acciones</th></tr>`;
        const filtered = data.filter(c => {
            const dias = diasHastaFecha(c.dia_pago, getMesAnioPrimerPago(c), parseInt(c.cuota_pagada) || 0);
            const capitalRestante = parseEuropeanNumber(c.capital_restante);
            return capitalRestante > 0 && (parseInt(c.plazo) || 0) > (parseInt(c.cuota_pagada) || 0) && (dias !== null && dias < 0);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">No hay pagos atrasados</td></tr>`;
            return;
        }

        filtered.forEach(item => {
            const dias = diasHastaFecha(item.dia_pago, getMesAnioPrimerPago(item), parseInt(item.cuota_pagada) || 0);
            const fecha = calcularFechaVencida(item.dia_pago, getMesAnioPrimerPago(item), parseInt(item.cuota_pagada) || 0);
            const stars = '★'.repeat(item.tupak_score || 1) + '☆'.repeat(5 - (item.tupak_score || 1));
            
            tbody.innerHTML += `
                <tr>
                    <td><span class="text-red-700 font-bold">${fecha}</span></td>
                    <td><span class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">${Math.abs(dias)} días</span></td>
                    <td class="font-medium">${item.nombre_socio}</td>
                    <td>${item.cedula_socio}</td>
                    <td class="font-bold text-gray-900">$${parseFloat(item.monto_aprobado).toFixed(2)}</td>
                    <td class="text-amber-500 font-bold">${stars}</td>
                    <td>
                        <div class="flex items-center gap-1">
                            <button class="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors" title="Ver Detalles" onclick="viewCreditoDetails('${item.id}')"><i class="fas fa-eye"></i></button>
                            <button class="text-green-600 hover:bg-green-50 p-2 rounded-lg transition-colors" title="Notificar WhatsApp" onclick="confirmarNotificarWhatsApp('${item.id}')"><i class="fab fa-whatsapp"></i></button>
                            ${item.acta ? `<button class="text-slate-600 hover:bg-slate-50 p-2 rounded-lg transition-colors" title="Amortización" onclick="viewAmortizationTable('${item.acta}')"><i class="fas fa-table"></i></button>` : ''}
                            <button class="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition-colors" title="Registrar Pago" onclick="prepararPagoCuota('${item.id}')"><i class="fas fa-check-circle"></i></button>
                            <button class="text-amber-600 hover:bg-amber-50 p-2 rounded-lg transition-colors" title="Liquidar Crédito" onclick="prepararLiquidacion('${item.id}')"><i class="fas fa-money-bill-wave"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } else if (view === 'cobros') {
        thead.innerHTML = `<tr><th>Fecha Pago</th><th>Estado</th><th>Socio</th><th>Cédula</th><th>Monto</th><th>Score</th><th>Acciones</th></tr>`;
        const filtered = data.filter(c => {
            const dias = diasHastaFecha(c.dia_pago, getMesAnioPrimerPago(c), parseInt(c.cuota_pagada) || 0);
            const capitalRestante = parseEuropeanNumber(c.capital_restante);
            return capitalRestante > 0 && (parseInt(c.plazo) || 0) > (parseInt(c.cuota_pagada) || 0) && (dias !== null && dias >= 0 && dias <= 5);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">No hay cobros en los próximos 5 días</td></tr>`;
            return;
        }

        filtered.forEach(item => {
            const dias = diasHastaFecha(item.dia_pago, getMesAnioPrimerPago(item), parseInt(item.cuota_pagada) || 0);
            const fecha = calcularFechaVencida(item.dia_pago, getMesAnioPrimerPago(item), parseInt(item.cuota_pagada) || 0);
            const stars = '★'.repeat(item.tupak_score || 1) + '☆'.repeat(5 - (item.tupak_score || 1));
            
            tbody.innerHTML += `
                <tr>
                    <td>${fecha}</td>
                    <td>${getUrgenciaBadge(dias)}</td>
                    <td class="font-medium">${item.nombre_socio}</td>
                    <td>${item.cedula_socio}</td>
                    <td class="font-bold text-gray-900">$${parseFloat(item.monto_aprobado).toFixed(2)}</td>
                    <td class="text-amber-500 font-bold">${stars}</td>
                    <td>
                        <div class="flex items-center gap-1">
                            <button class="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors" title="Ver Detalles" onclick="viewCreditoDetails('${item.id}')"><i class="fas fa-eye"></i></button>
                            <button class="text-green-600 hover:bg-green-50 p-2 rounded-lg transition-colors" title="Notificar WhatsApp" onclick="confirmarNotificarWhatsApp('${item.id}')"><i class="fab fa-whatsapp"></i></button>
                            ${item.acta ? `<button class="text-slate-600 hover:bg-slate-50 p-2 rounded-lg transition-colors" title="Amortización" onclick="viewAmortizationTable('${item.acta}')"><i class="fas fa-table"></i></button>` : ''}
                            <button class="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition-colors" title="Registrar Pago" onclick="prepararPagoCuota('${item.id}')"><i class="fas fa-check-circle"></i></button>
                            <button class="text-amber-600 hover:bg-amber-50 p-2 rounded-lg transition-colors" title="Liquidar Crédito" onclick="prepararLiquidacion('${item.id}')"><i class="fas fa-money-bill-wave"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } else {
        thead.innerHTML = `<tr><th>Socio</th><th>Cédula</th><th>Monto Aprob.</th><th>Capital Rest.</th><th>Plazo</th><th>Cuota</th><th>Acciones</th></tr>`;
        
        data.forEach(item => {
            tbody.innerHTML += `
                <tr>
                    <td class="font-medium">${item.nombre_socio}</td>
                    <td>${item.cedula_socio}</td>
                    <td class="font-bold text-gray-900">$${parseFloat(item.monto_aprobado).toFixed(2)}</td>
                    <td class="text-indigo-700 font-semibold">$${item.capital_restante || '0,00'}</td>
                    <td>${item.plazo} m</td>
                    <td>${item.cuota_pagada || 0}/${item.plazo}</td>
                    <td>
                        <div class="flex items-center gap-1">
                            <button class="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors" title="Ver Detalles" onclick="viewCreditoDetails('${item.id}')"><i class="fas fa-eye"></i></button>
                            <button class="text-orange-600 hover:bg-orange-50 p-2 rounded-lg transition-colors" title="Autorización Buró" onclick="abrirAutorizacion('${item.cedula_socio}', '${item.nombre_socio}')"><i class="fas fa-user-shield"></i></button>
                            ${item.acta ? `<button class="text-slate-600 hover:bg-slate-50 p-2 rounded-lg transition-colors" title="Amortización" onclick="viewAmortizationTable('${item.acta}')"><i class="fas fa-table"></i></button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });
    }
}

function viewCreditoDetails(creditoId) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(creditoId));
    if (!credito) return;

    const modal = document.getElementById('modal-container');
    const wrapper = document.getElementById('modal-content-wrapper');
    if (!modal || !wrapper) return;

    document.body.classList.add('overflow-hidden');
    wrapper.innerHTML = `
        <div class="flex flex-col h-full bg-white">
            <div class="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-700 p-6 relative">
                <button onclick="closeModal()" class="absolute top-4 right-4 text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full">
                    <i class="fas fa-times"></i>
                </button>
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white text-2xl">
                        <i class="fas fa-file-invoice-dollar"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-white uppercase tracking-wide">Detalles del Crédito</h3>
                        <p class="text-indigo-100 text-sm opacity-80">Acta: ${credito.acta || 'No asignada'}</p>
                    </div>
                </div>
            </div>

            <div class="p-8 overflow-y-auto custom-scrollbar">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Información del Socio</p>
                        <div class="space-y-3">
                            <div>
                                <p class="text-xs text-slate-500">Nombre Completo</p>
                                <p class="font-bold text-slate-800">${credito.nombre_socio || 'N/A'}</p>
                            </div>
                            <div class="flex gap-4">
                                <div class="flex-1">
                                    <p class="text-xs text-slate-500">Cédula</p>
                                    <p class="font-bold text-slate-800">${credito.cedula_socio || 'N/A'}</p>
                                </div>
                                <div class="flex-1">
                                    <p class="text-xs text-slate-500">Teléfono</p>
                                    <p class="font-bold text-slate-800">${credito.telefono_socio || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Finanzas</p>
                        <div class="space-y-3">
                            <div class="flex gap-4">
                                <div class="flex-1">
                                    <p class="text-xs text-slate-500">Monto Aprobado</p>
                                    <p class="font-black text-indigo-700 text-lg">$${parseFloat(credito.monto_aprobado || 0).toLocaleString('es-ES', {minimumFractionDigits:2})}</p>
                                </div>
                                <div class="flex-1">
                                    <p class="text-xs text-slate-500">Interés</p>
                                    <p class="font-bold text-slate-800">${credito.interes || '0'}%</p>
                                </div>
                            </div>
                            <div class="flex gap-4 border-t border-slate-50 pt-2">
                                <div class="flex-1">
                                    <p class="text-xs text-slate-500">Plazo</p>
                                    <p class="font-bold text-slate-800">${credito.plazo || '0'} meses</p>
                                </div>
                                <div class="flex-1">
                                    <p class="text-xs text-slate-500">Día Pago</p>
                                    <p class="font-bold text-emerald-600">${credito.dia_pago || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Frecuencia</p>
                                <p class="text-sm font-semibold text-slate-700">${credito.frecuencia_pago || 'MENSUAL'}</p>
                            </div>
                            <div>
                                <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Cuotas Pagadas</p>
                                <p class="text-sm font-semibold text-slate-700">${credito.cuota_pagada || 0} de ${credito.plazo || 0}</p>
                            </div>
                            <div>
                                <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Primer Pago</p>
                                <p class="text-sm font-semibold text-slate-700">${formatearPrimerPago(getMesAnioPrimerPago(credito), credito.dia_pago)}</p>
                            </div>
                            <div>
                                <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Sesión</p>
                                <p class="text-sm font-semibold text-slate-700">${credito.sesion || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div class="md:col-span-2">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Detalles Operativos</p>
                        <div class="space-y-4">
                            <div>
                                <p class="text-xs text-slate-500">Destino del Crédito</p>
                                <p class="text-xs font-semibold text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">${credito.destino_credito || 'No especificado'}</p>
                            </div>
                            <div class="flex gap-4">
                                <div class="flex-1">
                                    <p class="text-xs text-slate-500">Asesor</p>
                                    <p class="text-sm font-bold text-slate-800">${credito.asesor_credito || 'N/A'}</p>
                                </div>
                                <div class="flex-1">
                                    <p class="text-xs text-slate-500">Correo Asesor</p>
                                    <p class="text-sm text-slate-600">${credito.correo_asesor || 'N/A'}</p>
                                </div>
                            </div>
                            <div>
                                <p class="text-xs text-slate-500">Observaciones</p>
                                <p class="text-xs italic text-slate-500 bg-amber-50 p-3 rounded-lg border border-amber-100">${credito.observaciones || 'Sin observaciones registradas.'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                <button onclick="closeModal()" class="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm">
                    Cerrar Detalle
                </button>
                <button onclick="viewAmortizationTable('${credito.acta}')" class="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                    <i class="fas fa-table mr-2"></i>Ver Tabla Amortización
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
    setTimeout(() => {
        wrapper.classList.remove('scale-95', 'opacity-0');
        wrapper.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeModal() {
    const modal = document.getElementById('modal-container');
    const wrapper = document.getElementById('modal-content-wrapper');
    if (!modal || !wrapper) return;

    wrapper.classList.remove('scale-100', 'opacity-100');
    wrapper.classList.add('scale-95', 'opacity-0');
    document.body.classList.remove('overflow-hidden');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

function viewAmortizationTable(acta) {
    if (!acta) {
        alert('No hay acta asociada a este crédito.');
        return;
    }
    const url = `https://cajatupakrantina.webcoopec.com/view/${acta}`;
    window.open(url, '_blank');
}

function abrirAutorizacion(cedula, nombre) {
    const encodedNombre = encodeURIComponent(nombre);
    window.location.href = `autorizacion_buro.html?cedula=${cedula}&nombre=${encodedNombre}`;
}

async function enviarWhatsApp(id) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    // Obtener config (si no existe, usamos un objeto vacío para generar el JSON de todas formas)
    const userNotificationConfig = JSON.parse(localStorage.getItem('userNotificationConfig')) || { user: 'Simulación', instance: 'SIM-XXXX', apikey: 'NO-KEY' };

    let telefono = (credito.telefono_socio || '').replace(/\D/g, '');
    const ultimosNueve = telefono.slice(-9);
    telefono = `+593${ultimosNueve}`;

    const cuotaPagada = parseInt(credito.cuota_pagada) || 0;
    const mesAnioPrimerPago = getMesAnioPrimerPago(credito);
    const fechaPagoTexto = formatearFechaTexto(credito.dia_pago, mesAnioPrimerPago, cuotaPagada);

    const nombreSocio = credito.nombre_socio || 'Estimado socio';
    const userName = userNotificationConfig.user || 'La Caja';

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
        showCustomToast('Socio no tiene teléfono registrado.', 'error');
        return;
    }

    if (!canSendNotifications()) {
        showCustomToast('La configuración de notificaciones de WhatsApp no está activa o completa.', 'error');
        console.warn("⚠️ Notificación no enviada: Configuración incompleta.");
        return;
    }

    try {
        const url = `https://api.luispinta.com/message/sendMedia/${userNotificationConfig.instance}`;
        
        showCustomToast('Enviando notificación...', 'info');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': userNotificationConfig.apikey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (response.ok) {
            showCustomToast(`🌿 Notificación enviada a ${nombreSocio}`, 'success', 5000);
        } else {
            showCustomToast('Error al enviar. Verifique su configuración.', 'error');
        }
    } catch (error) {
        console.error('Error WhatsApp:', error);
        showCustomToast('Error al procesar la notificación.', 'error');
    }
}

function confirmarNotificarWhatsApp(id) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;
    
    const cuotaPagada = parseInt(credito.cuota_pagada) || 0;
    const mesAnioPrimerPago = getMesAnioPrimerPago(credito);
    const fechaPagoTexto = formatearFechaTexto(credito.dia_pago, mesAnioPrimerPago, cuotaPagada);
    const valorMonto = formatEuropeanNumber(parseFloat(credito.monto_aprobado));

    showConfirmModal(
        'Enviar Notificación',
        `<div class="space-y-3">
            <p class="font-semibold text-gray-800">¿Enviar recordatorio de pago por WhatsApp?</p>
            <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                <p class="text-[11px] text-gray-500 uppercase font-bold mb-1">Detalles del Socio</p>
                <p class="text-sm"><strong>Socio:</strong> ${credito.nombre_socio || 'N/A'}</p>
                <p class="text-sm"><strong>Teléfono:</strong> ${credito.telefono_socio || 'N/A'}</p>
                <p class="text-sm"><strong>Fecha Pago:</strong> ${fechaPagoTexto}</p>
                <p class="text-sm"><strong>Monto Total:</strong> $${valorMonto}</p>
            </div>
            <p class="text-xs text-gray-600 italic">
                <i class="fab fa-whatsapp text-green-600 mr-1"></i>
                Se enviará un mensaje automático usando el servicio oficial.
            </p>
        </div>`,
        () => enviarWhatsApp(id),
        'from-green-500 to-green-600',
        'fab fa-whatsapp'
    );
}

// ===== SISTEMA DE MODALES Y ACCIONES (REPLICADO DE APP MADRE) =====

function showConfirmModal(title, message, onConfirm, headerColor = 'from-indigo-600 to-indigo-700', icon = 'fas fa-question-circle') {
    const modal = document.getElementById('confirm-modal');
    const header = document.getElementById('confirm-modal-header');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const acceptBtn = document.getElementById('confirm-modal-accept');

    if (titleEl) titleEl.innerHTML = `<i class="${icon} mr-3"></i>${title}`;
    if (messageEl) messageEl.innerHTML = message;
    if (header) header.className = `bg-gradient-to-r ${headerColor} p-6 rounded-t-2xl`;
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.classList.add('overflow-hidden');
    }

    const newAcceptBtn = acceptBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);

    newAcceptBtn.addEventListener('click', () => {
        closeConfirmModal();
        if (onConfirm) onConfirm();
    });
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.classList.remove('overflow-hidden');
    }
}

function showCustomToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('custom-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const icons = {
        success: '<i class="fas fa-check-circle text-green-500 text-xl"></i>',
        error: '<i class="fas fa-times-circle text-red-500 text-xl"></i>',
        warning: '<i class="fas fa-exclamation-triangle text-yellow-500 text-xl"></i>',
        info: '<i class="fas fa-info-circle text-blue-500 text-xl"></i>'
    };

    const colors = {
        success: 'bg-green-50 border-green-200',
        error: 'bg-red-50 border-red-200',
        warning: 'bg-yellow-50 border-yellow-200',
        info: 'bg-indigo-50 border-indigo-200'
    };

    toast.className = `${colors[type]} border-l-4 border-indigo-600 rounded-xl shadow-xl p-4 flex items-start gap-4 min-w-[320px] transform transition-all duration-300 translate-x-full`;
    toast.innerHTML = `
        <div class="mt-1">${icons[type]}</div>
        <div class="flex-1">
            <p class="text-slate-800 font-bold text-sm leading-tight">${message}</p>
        </div>
        <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 transition-colors">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-x-full'), 10);

    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

// ===== FLUJO REGISTRAR PAGO (MODAL CAPITAL) =====

function prepararPagoCuota(id) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    const cuotaActual = parseInt(credito.cuota_pagada) || 0;
    const plazoTotal = parseInt(credito.plazo) || 0;
    const siguienteCuota = cuotaActual + 1;
    const capitalActual = credito.capital_restante || '0,00';
    const capitalActualNumero = parseEuropeanNumber(capitalActual);

    const modalHTML = `
        <div id="modal-capital-pagado" class="fixed inset-0 bg-black/60 flex items-center justify-center z-[2000] p-4 backdrop-blur-sm">
            <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col transform animate-modalIn">
                <div class="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6">
                    <div class="flex justify-between items-center text-white">
                        <h3 class="text-2xl font-black flex items-center tracking-tight">
                            <i class="fas fa-cash-register mr-3"></i> REGISTRAR PAGO
                        </h3>
                        <button onclick="cerrarModalCapital()" class="hover:rotate-90 transition-transform duration-300">
                            <i class="fas fa-times text-2xl"></i>
                        </button>
                    </div>
                </div>
                
                <div class="p-8 space-y-6 overflow-y-auto">
                    <!-- Caja de Información (Réplica exacta de la imagen) -->
                    <div class="bg-blue-50/50 p-5 rounded-xl border border-blue-100 space-y-2 text-sm">
                        <div class="flex items-start gap-2">
                            <span class="font-bold text-slate-700 w-24">Socio:</span>
                            <span class="text-slate-900 font-black uppercase">${credito.nombre_socio}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-700 w-24">Cédula:</span>
                            <span class="text-slate-900 font-medium">${credito.cedula_socio}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-700 w-24">Acta:</span>
                            <span class="text-slate-900 font-medium">${credito.acta || 'N/A'}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-700 w-24">Cuota actual:</span>
                            <span class="text-slate-900 font-medium">${cuotaActual} de ${plazoTotal}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-700 w-24">Nueva cuota:</span>
                            <span class="text-emerald-600 font-black">${siguienteCuota} de ${plazoTotal}</span>
                        </div>
                    </div>

                    <!-- Caja Capital Actual (Color Ámbar/Amarillo) -->
                    <div class="bg-[#fffbeb] p-6 rounded-2xl border-2 border-[#fef3c7] text-center shadow-sm">
                        <p class="text-sm font-bold text-[#b45309] uppercase tracking-wider mb-1">Capital Actual:</p>
                        <p class="text-5xl font-black text-[#1e293b] leading-none">$${capitalActual}</p>
                    </div>

                    <!-- Botón Ver Tabla -->
                    ${credito.acta ? `
                    <div class="flex justify-center -mt-2">
                        <button onclick="viewAmortizationTable('${credito.acta}')" class="flex items-center gap-3 px-8 py-3.5 bg-[#5c56e0] hover:bg-[#4a44cc] text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-100 active:scale-95">
                            <i class="fas fa-table text-xl"></i> Ver Tabla de Amortización
                        </button>
                    </div>` : ''}

                    <!-- Input Nuevo Capital -->
                    <div class="space-y-3 pt-2">
                        <label class="block">
                            <span class="text-sm font-black text-slate-700 uppercase flex items-center gap-2">
                                Nuevo Capital Vigente <span class="text-red-500 font-bold">*</span>
                            </span>
                            <p class="text-[11px] text-slate-400 mt-1">Usa . para miles y , para decimales (Ejemplo: 8.500,50)</p>
                            <div class="mt-3 relative">
                                <input type="text" id="input-nuevo-capital" placeholder="Ejemplo: ${capitalActual}" 
                                    class="w-full px-6 py-5 bg-white border-2 border-slate-300 rounded-2xl focus:border-emerald-500 outline-none text-2xl font-black transition-all shadow-sm placeholder:text-slate-200">
                            </div>
                        </label>
                        <p id="error-capital" class="text-red-500 text-xs font-bold hidden bg-red-50 p-3 rounded-lg border border-red-100"></p>
                    </div>
                </div>
                
                <div class="p-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                    <button onclick="cerrarModalCapital()" class="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors">
                        CANCELAR
                    </button>
                    <button onclick="validarYConfirmarPago()" class="flex-1 px-6 py-3 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-95">
                        CONTINUAR
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.classList.add('overflow-hidden'); // Bloquear scroll
    window.tempCreditoData = { credito, capitalActualNumero, siguienteCuota, plazoTotal };
    setTimeout(() => document.getElementById('input-nuevo-capital').focus(), 100);
}

function cerrarModalCapital() {
    const modal = document.getElementById('modal-capital-pagado');
    if (modal) modal.remove();
    document.body.classList.remove('overflow-hidden'); // Restaurar scroll
    window.tempCreditoData = null;
}

function validarYConfirmarPago() {
    const input = document.getElementById('input-nuevo-capital');
    const errorEl = document.getElementById('error-capital');
    const valor = input.value.trim();

    if (!valor) {
        errorEl.textContent = "⚠ Ingrese el nuevo capital";
        errorEl.classList.remove('hidden');
        return;
    }

    const formatoValido = /^[\d.]+,\d{2}$/.test(valor);
    if (!formatoValido) {
        errorEl.textContent = "⚠ Use formato 0.000,00";
        errorEl.classList.remove('hidden');
        return;
    }

    const nuevoCapitalNum = parseEuropeanNumber(valor);
    if (nuevoCapitalNum >= window.tempCreditoData.capitalActualNumero) {
        errorEl.textContent = "⚠ El capital debe disminuir";
        errorEl.classList.remove('hidden');
        return;
    }

    const data = { ...window.tempCreditoData };
    cerrarModalCapital();
    
    showConfirmModal(
        'Confirmar Pago',
        `<div class="space-y-6">
            <div class="text-center bg-emerald-50 p-6 rounded-2xl border-2 border-emerald-200">
                <p class="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Nuevo Saldo</p>
                <p class="text-4xl font-black text-emerald-700">$${valor}</p>
            </div>
            <div class="space-y-2 text-sm">
                <p class="flex justify-between"><span>Socio:</span> <span class="font-bold">${data.credito.nombre_socio}</span></p>
                <p class="flex justify-between"><span>Cuota:</span> <span class="font-bold">${data.siguienteCuota}/${data.plazoTotal}</span></p>
                <p class="flex justify-between text-slate-400"><span>Anterior:</span> <span class="line-through">$${formatEuropeanNumber(data.capitalActualNumero)}</span></p>
            </div>
        </div>`,
        () => ejecutarAccionPago(data.credito.id, data.siguienteCuota, valor, "REGISTRAR_PAGO_CUOTA"),
        'from-emerald-600 to-emerald-700',
        'fas fa-cash-register'
    );
}

// ===== FLUJO LIQUIDACIÓN =====

function prepararLiquidacion(id) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    showConfirmModal(
        'Liquidar Credito',
        `<div class="space-y-6">
            <div class="text-center bg-amber-50 p-6 rounded-2xl border-2 border-amber-200">
                <p class="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">El saldo pasará a:</p>
                <p class="text-4xl font-black text-amber-700">$0,00</p>
            </div>
            <div class="p-4 bg-amber-100/50 rounded-xl text-amber-800 text-sm font-medium">
                <i class="fas fa-exclamation-circle mr-2"></i> Esta acción marcará el crédito como finalizado y desaparecerá de los listados operativos.
            </div>
            <div class="space-y-2 text-sm">
                <p class="flex justify-between"><span>Socio:</span> <span class="font-bold">${credito.nombre_socio}</span></p>
                <p class="flex justify-between"><span>Saldo Actual:</span> <span class="font-bold">$${credito.capital_restante}</span></p>
            </div>
        </div>`,
        () => ejecutarAccionPago(credito.id, credito.plazo, "0,00", "LIQUIDAR_CREDITO"),
        'from-amber-500 to-amber-600',
        'fas fa-money-bill-wave'
    );
}

// ===== EJECUCIÓN FINAL (JSON SIMULADO) =====

function ejecutarAccionPago(id, cuota, capital, accion) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    
    const payload = {
        id_credito: id,
        cedula_socio: credito.cedula_socio,
        cuota_pagada: String(cuota),
        capital_restante: capital,
        accion: accion,
        timestamp: new Date().toISOString()
    };

    console.log("📤 JSON GENERADO PARA EL SERVIDOR:", payload);
    
    // Simular el éxito de la actualización local
    credito.cuota_pagada = cuota;
    credito.capital_restante = capital;
    
    renderData(currentView, document.getElementById('search-input')?.value.toLowerCase());
    updateStats();
    
    showCustomToast(`Acción ${accion} procesada exitosamente (Simulación JSON)`, 'success');
}

function simulateAction(action, context) {
    alert(`[Módulo Cartera] Acción: ${action} para ${context}`);
}

async function generarReporteCarteraCompleto() {
    if (window.CarteraReportes && typeof window.CarteraReportes.generarReporteCartera === 'function') {
        await window.CarteraReportes.generarReporteCartera(CARTERA_DATA);
    } else {
        alert('El generador de PDF no se ha cargado correctamente.');
    }
}

// ===== EVENT LISTENERS =====

document.addEventListener('DOMContentLoaded', () => {
    setupUserInfo();
    fetchCartera();

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderData(currentView, e.target.value.toLowerCase());
        });
    }

    // Cerrar modal al hacer click fuera
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        modalContainer.addEventListener('click', (e) => {
            if (e.target === modalContainer) {
                closeModal();
            }
        });
    }
});

