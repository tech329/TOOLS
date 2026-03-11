// =====================================================
// CARTERA.JS - Lógica del módulo de Cartera (PC)
// =====================================================

const MIN_LOADER_TIME = 1200;
let currentView = 'atrasados';
let CARTERA_DATA = [];
let filteredData = [];
let isAdmin = false;
let generalSortState = { key: 'fecha_hora', direction: 'desc' };
let atrasadosSortState = { key: 'dias_mora', direction: 'desc' };
let cobrosSortState = { key: 'dias_restantes', direction: 'asc' };
let approvedEvolutionChart = null;
const ACTUALIZAR_CREDITO_WEBHOOK = 'https://lpn8nwebhook.luispintasolutions.com/webhook/actualizar_credito';
const REGISTRAR_PAGO_WEBHOOK = 'https://lpn8nwebhook.luispintasolutions.com/webhook/registrar_pago';
const LIQUIDAR_CREDITO_WEBHOOK = 'https://lpn8nwebhook.luispintasolutions.com/webhook/liquidar_credito';

// ===== UTILIDADES DE NÚMEROS (MIGRADAS DE APP MADRE) =====

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

function formatEuropeanNumber(value) {
    if (!Number.isFinite(value)) return '0,00';
    return value.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatStoredAmount(value) {
    return formatEuropeanNumber(parseEuropeanNumber(value));
}

function getCurrentSessionData() {
    return typeof TupakAuth !== 'undefined'
        ? TupakAuth.getSession()
        : JSON.parse(localStorage.getItem('appSession') || 'null');
}

function isValidCapitalInputFormat(value) {
    const normalized = String(value || '').trim();
    return /^(?:\d{1,3}|\d{1,3}(?:\.\d{3})+),\d{2}$/.test(normalized);
}

// ===== UTILIDADES DE FECHA =====

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

function canEditCartera() {
    return !isAdmin;
}

function showAdminReadOnlyToast() {
    showCustomToast('Los administradores tienen acceso de solo lectura en cartera.', 'info');
}

function getCreditoDias(credito) {
    return diasHastaFecha(credito.dia_pago, getMesAnioPrimerPago(credito), parseInt(credito.cuota_pagada, 10) || 0);
}

function getRegistroTimestamp(credito) {
    const rawValue = credito?.fecha_hora || credito?.created_at || credito?.fecha || '';
    const timestamp = rawValue ? new Date(rawValue).getTime() : 0;
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatRegistroFecha(credito) {
    const timestamp = getRegistroTimestamp(credito);
    if (!timestamp) return 'N/A';

    return new Date(timestamp).toLocaleString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function isLiquidatedCredit(credito) {
    return parseEuropeanNumber(credito?.capital_restante) <= 0;
}

function getDueTimestamp(credito) {
    const diaPago = credito?.dia_pago;
    const mesAnioPrimerPago = getMesAnioPrimerPago(credito);
    const cuotaPagada = parseInt(credito?.cuota_pagada, 10) || 0;
    if (!diaPago || !mesAnioPrimerPago) return 0;

    try {
        const [mes, anio] = mesAnioPrimerPago.split('/');
        const fechaBase = new Date(parseInt(anio, 10), parseInt(mes, 10) - 1, parseInt(diaPago, 10));
        fechaBase.setMonth(fechaBase.getMonth() + cuotaPagada);
        fechaBase.setHours(0, 0, 0, 0);
        return fechaBase.getTime();
    } catch (error) {
        return 0;
    }
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

function sortGeneralData(creditos) {
    const { key, direction } = generalSortState;
    const factor = direction === 'asc' ? 1 : -1;

    return [...creditos].sort((a, b) => {
        let valueA;
        let valueB;

        switch (key) {
            case 'nombre_socio':
                valueA = String(a.nombre_socio || '').toLowerCase();
                valueB = String(b.nombre_socio || '').toLowerCase();
                break;
            case 'cedula_socio':
                valueA = String(a.cedula_socio || '');
                valueB = String(b.cedula_socio || '');
                break;
            case 'fecha_hora':
                valueA = getRegistroTimestamp(a);
                valueB = getRegistroTimestamp(b);
                break;
            case 'monto_aprobado':
                valueA = parseEuropeanNumber(a.monto_aprobado);
                valueB = parseEuropeanNumber(b.monto_aprobado);
                break;
            case 'capital_restante':
                valueA = parseEuropeanNumber(a.capital_restante);
                valueB = parseEuropeanNumber(b.capital_restante);
                break;
            case 'plazo':
                valueA = parseInt(a.plazo, 10) || 0;
                valueB = parseInt(b.plazo, 10) || 0;
                break;
            case 'cuota_pagada':
                valueA = parseInt(a.cuota_pagada, 10) || 0;
                valueB = parseInt(b.cuota_pagada, 10) || 0;
                break;
            default:
                valueA = String(a[key] || '').toLowerCase();
                valueB = String(b[key] || '').toLowerCase();
        }

        if (valueA < valueB) return -1 * factor;
        if (valueA > valueB) return 1 * factor;

        return getRegistroTimestamp(b) - getRegistroTimestamp(a);
    });
}

function sortAtrasadosData(creditos) {
    const { key, direction } = atrasadosSortState;
    const factor = direction === 'asc' ? 1 : -1;

    return [...creditos].sort((a, b) => {
        let valueA;
        let valueB;

        switch (key) {
            case 'fecha_pago':
                valueA = getDueTimestamp(a);
                valueB = getDueTimestamp(b);
                break;
            case 'dias_mora':
                valueA = Math.abs(getCreditoDias(a) || 0);
                valueB = Math.abs(getCreditoDias(b) || 0);
                break;
            case 'nombre_socio':
                valueA = String(a.nombre_socio || '').toLowerCase();
                valueB = String(b.nombre_socio || '').toLowerCase();
                break;
            case 'cedula_socio':
                valueA = String(a.cedula_socio || '');
                valueB = String(b.cedula_socio || '');
                break;
            case 'monto_aprobado':
                valueA = parseEuropeanNumber(a.monto_aprobado);
                valueB = parseEuropeanNumber(b.monto_aprobado);
                break;
            case 'score':
                valueA = parseInt(a.tupak_score, 10) || 0;
                valueB = parseInt(b.tupak_score, 10) || 0;
                break;
            default:
                valueA = getDueTimestamp(a);
                valueB = getDueTimestamp(b);
        }

        if (valueA < valueB) return -1 * factor;
        if (valueA > valueB) return 1 * factor;
        return getRegistroTimestamp(b) - getRegistroTimestamp(a);
    });
}

function sortCobrosData(creditos) {
    const { key, direction } = cobrosSortState;
    const factor = direction === 'asc' ? 1 : -1;

    return [...creditos].sort((a, b) => {
        let valueA;
        let valueB;

        switch (key) {
            case 'fecha_pago':
                valueA = getDueTimestamp(a);
                valueB = getDueTimestamp(b);
                break;
            case 'dias_restantes':
                valueA = getCreditoDias(a) ?? Number.POSITIVE_INFINITY;
                valueB = getCreditoDias(b) ?? Number.POSITIVE_INFINITY;
                break;
            case 'nombre_socio':
                valueA = String(a.nombre_socio || '').toLowerCase();
                valueB = String(b.nombre_socio || '').toLowerCase();
                break;
            case 'cedula_socio':
                valueA = String(a.cedula_socio || '');
                valueB = String(b.cedula_socio || '');
                break;
            case 'monto_aprobado':
                valueA = parseEuropeanNumber(a.monto_aprobado);
                valueB = parseEuropeanNumber(b.monto_aprobado);
                break;
            case 'score':
                valueA = parseInt(a.tupak_score, 10) || 0;
                valueB = parseInt(b.tupak_score, 10) || 0;
                break;
            default:
                valueA = getCreditoDias(a) ?? Number.POSITIVE_INFINITY;
                valueB = getCreditoDias(b) ?? Number.POSITIVE_INFINITY;
        }

        if (valueA < valueB) return -1 * factor;
        if (valueA > valueB) return 1 * factor;
        return getRegistroTimestamp(b) - getRegistroTimestamp(a);
    });
}

function getSortIndicator(sortState, columnKey) {
    const isActive = sortState.key === columnKey;
    const upClass = isActive && sortState.direction === 'asc' ? 'text-indigo-600' : 'text-slate-300';
    const downClass = isActive && sortState.direction === 'desc' ? 'text-indigo-600' : 'text-slate-300';

    return `<span class="inline-flex flex-col ml-2 leading-none align-middle"><i class="fas fa-chevron-up text-[10px] ${upClass}"></i><i class="fas fa-chevron-down text-[10px] -mt-0.5 ${downClass}"></i></span>`;
}

function getGeneralSortIndicator(columnKey) {
    return getSortIndicator(generalSortState, columnKey);
}

function renderGeneralSortableHeader(label, columnKey) {
    return `<th><button type="button" onclick="toggleGeneralSort('${columnKey}')" class="inline-flex items-center font-bold text-slate-700 hover:text-indigo-700 transition-colors">${label}${getGeneralSortIndicator(columnKey)}</button></th>`;
}

function renderAtrasadosSortableHeader(label, columnKey) {
    return `<th><button type="button" onclick="toggleAtrasadosSort('${columnKey}')" class="inline-flex items-center font-bold text-slate-700 hover:text-indigo-700 transition-colors">${label}${getSortIndicator(atrasadosSortState, columnKey)}</button></th>`;
}

function renderCobrosSortableHeader(label, columnKey) {
    return `<th><button type="button" onclick="toggleCobrosSort('${columnKey}')" class="inline-flex items-center font-bold text-slate-700 hover:text-indigo-700 transition-colors">${label}${getSortIndicator(cobrosSortState, columnKey)}</button></th>`;
}

function toggleGeneralSort(columnKey) {
    if (generalSortState.key === columnKey) {
        generalSortState.direction = generalSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        generalSortState = { key: columnKey, direction: 'asc' };
    }

    renderData(currentView, document.getElementById('search-input')?.value.toLowerCase() || '');
}

function toggleAtrasadosSort(columnKey) {
    if (atrasadosSortState.key === columnKey) {
        atrasadosSortState.direction = atrasadosSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        atrasadosSortState = { key: columnKey, direction: columnKey === 'dias_mora' ? 'desc' : 'asc' };
    }

    renderData(currentView, document.getElementById('search-input')?.value.toLowerCase() || '');
}

function toggleCobrosSort(columnKey) {
    if (cobrosSortState.key === columnKey) {
        cobrosSortState.direction = cobrosSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        cobrosSortState = { key: columnKey, direction: columnKey === 'dias_restantes' ? 'asc' : 'asc' };
    }

    renderData(currentView, document.getElementById('search-input')?.value.toLowerCase() || '');
}

function buildCategorySeparatorRow(label, count, colspan, theme) {
    const themeClasses = theme === 'liquidado'
        ? 'bg-slate-100 text-slate-700 border-slate-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return `<tr class="${themeClasses}"><td colspan="${colspan}" class="px-4 py-3 border-y font-black uppercase tracking-wide text-xs">${label} (${count})</td></tr>`;
}

function getCreditCreatedDate(credito) {
    const timestamp = getRegistroTimestamp(credito);
    if (!timestamp) return null;

    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
}

function getMonthLabel(date, short = false) {
    return date.toLocaleDateString('es-EC', {
        month: short ? 'short' : 'long',
        year: 'numeric'
    }).replace('.', '');
}

function shouldProjectNextMonth(referenceDate = new Date()) {
    return referenceDate.getDate() >= 15;
}

function calculateProjectedNextMonthTotal(months, referenceDate = new Date()) {
    const currentMonthKey = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, '0')}`;
    const completedMonths = months.filter(month => month.key !== currentMonthKey);
    const referenceMonths = completedMonths.slice(-3);

    if (!referenceMonths.length) {
        const currentMonth = months.find(month => month.key === currentMonthKey);
        return currentMonth?.total || 0;
    }

    const total = referenceMonths.reduce((sum, month) => sum + month.total, 0);
    return total / referenceMonths.length;
}

function buildMonthlyApprovedSeries(monthCount, options = {}) {
    const { includeProjection = false } = options;
    const today = new Date();
    const months = [];

    for (let offset = monthCount - 1; offset >= 0; offset--) {
        const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
        months.push({
            key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
            label: getMonthLabel(date, true),
            fullLabel: getMonthLabel(date, false),
            total: 0,
            projected: false
        });
    }

    const monthMap = new Map(months.map(month => [month.key, month]));

    CARTERA_DATA.forEach(credito => {
        const createdDate = getCreditCreatedDate(credito);
        if (!createdDate) return;

        const key = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
        const bucket = monthMap.get(key);
        if (!bucket) return;

        bucket.total += parseEuropeanNumber(credito.monto_aprobado);
    });

    if (includeProjection && shouldProjectNextMonth(today)) {
        const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        months.push({
            key: `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`,
            label: getMonthLabel(nextMonthDate, true),
            fullLabel: getMonthLabel(nextMonthDate, false),
            total: calculateProjectedNextMonthTotal(months, today),
            projected: true
        });
    }

    return months;
}

function buildTopCreditsList(limit, direction = 'desc') {
    const sorted = CARTERA_DATA
        .filter(credito => parseEuropeanNumber(credito.monto_aprobado) > 0)
        .sort((a, b) => {
            const amountA = parseEuropeanNumber(a.monto_aprobado);
            const amountB = parseEuropeanNumber(b.monto_aprobado);
            if (amountA !== amountB) {
                return direction === 'desc' ? amountB - amountA : amountA - amountB;
            }

            return getRegistroTimestamp(b) - getRegistroTimestamp(a);
        });

    return sorted.slice(0, limit);
}

function renderTopCreditsList(containerId, credits, accentClass) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!credits.length) {
        container.innerHTML = '<div class="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">No hay datos disponibles.</div>';
        return;
    }

    container.innerHTML = credits.map((credito, index) => `
        <article class="bg-white border border-slate-200 rounded-2xl px-4 py-4 shadow-sm">
            <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                    <div class="flex items-center gap-3 mb-1">
                        <span class="w-8 h-8 rounded-full ${accentClass} text-white text-xs font-black flex items-center justify-center">${index + 1}</span>
                        <p class="text-sm font-black text-slate-800 uppercase truncate">${credito.nombre_socio || 'N/A'}</p>
                    </div>
                    <p class="text-xs text-slate-500">Cédula: ${credito.cedula_socio || 'N/A'}</p>
                    <p class="text-xs text-slate-500">Registro: ${formatRegistroFecha(credito)}</p>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-lg font-black text-slate-900">$${formatStoredAmount(credito.monto_aprobado)}</p>
                    <p class="text-[11px] text-slate-500">Capital vigente: $${formatStoredAmount(credito.capital_restante)}</p>
                </div>
            </div>
        </article>
    `).join('');
}

function renderLastThreeMonthsStats(months) {
    const container = document.getElementById('stats-last-3-months');
    if (!container) return;

    const safeMonths = shouldProjectNextMonth() ? months : months.filter(month => !month.projected);

    if (!safeMonths.length) {
        container.innerHTML = '<div class="md:col-span-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">No hay datos suficientes.</div>';
        return;
    }

    const actualMonths = safeMonths.filter(month => !month.projected).reverse();
    const projectedMonths = safeMonths.filter(month => month.projected);
    const displayMonths = [...actualMonths, ...projectedMonths];

    container.innerHTML = displayMonths.map(month => `
        <article class="rounded-2xl border ${month.projected ? 'border-indigo-300 bg-indigo-50/70' : 'border-slate-200 bg-white'} p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3 mb-2">
                <p class="text-xs font-black uppercase tracking-wide ${month.projected ? 'text-indigo-700' : 'text-slate-500'}">${month.fullLabel}</p>
                ${month.projected ? '<span class="px-2 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wide">Proyección</span>' : ''}
            </div>
            <p class="text-3xl font-black text-slate-900 mb-1">$${formatEuropeanNumber(month.total)}</p>
            <p class="text-xs ${month.projected ? 'text-indigo-700' : 'text-slate-500'}">${month.projected ? 'Estimación del próximo mes basada en el promedio de los últimos 3 meses cerrados' : 'Monto aprobado acumulado del mes'}</p>
        </article>
    `).join('');
}

function renderApprovedEvolutionChart(months) {
    const canvas = document.getElementById('stats-approved-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const safeMonths = shouldProjectNextMonth() ? months : months.filter(month => !month.projected);

    const labels = safeMonths.map(month => month.label);
    const actualValues = safeMonths.map(month => month.projected ? null : month.total);
    const projectedIndex = safeMonths.findIndex(month => month.projected);
    const projectionValues = safeMonths.map((month, index) => {
        if (projectedIndex === -1) return null;
        if (index === projectedIndex) return month.total;
        if (index === projectedIndex - 1) return safeMonths[index].total;
        return null;
    });

    if (approvedEvolutionChart) {
        approvedEvolutionChart.destroy();
    }

    approvedEvolutionChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Monto aprobado',
                data: actualValues,
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.16)',
                fill: true,
                borderWidth: 3,
                tension: 0.35,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#4f46e5',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }, {
                label: 'Proyección',
                data: projectionValues,
                borderColor: '#f59e0b',
                backgroundColor: 'transparent',
                fill: false,
                borderWidth: 3,
                tension: 0.35,
                borderDash: [8, 6],
                pointRadius(context) {
                    return context.dataIndex === projectedIndex ? 5 : 0;
                },
                pointHoverRadius(context) {
                    return context.dataIndex === projectedIndex ? 7 : 0;
                },
                pointBackgroundColor: '#f59e0b',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: projectedIndex !== -1
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            const prefix = context.dataset.label === 'Proyección' ? 'Proyección: ' : 'Monto aprobado: ';
                            return `${prefix}$${formatEuropeanNumber(context.parsed.y || 0)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback(value) {
                            return `$${formatEuropeanNumber(Number(value) || 0)}`;
                        }
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.18)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function renderStatisticsView() {
    const projectionEnabled = shouldProjectNextMonth();
    const totalColocado = CARTERA_DATA.reduce((sum, credito) => sum + parseEuropeanNumber(credito.monto_aprobado), 0);
    const capitalVigente = CARTERA_DATA.reduce((sum, credito) => sum + parseEuropeanNumber(credito.capital_restante), 0);
    const largestCredits = buildTopCreditsList(5, 'desc');
    const smallestCredits = buildTopCreditsList(5, 'asc');
    const lastThreeMonths = buildMonthlyApprovedSeries(3, { includeProjection: projectionEnabled });
    const lastSixMonths = buildMonthlyApprovedSeries(6, { includeProjection: projectionEnabled });

    const totalColocadoEl = document.getElementById('stats-total-colocado');
    const capitalVigenteEl = document.getElementById('stats-capital-vigente');

    if (totalColocadoEl) totalColocadoEl.textContent = `$${formatEuropeanNumber(totalColocado)}`;
    if (capitalVigenteEl) capitalVigenteEl.textContent = `$${formatEuropeanNumber(capitalVigente)}`;

    renderTopCreditsList('stats-largest-credits', largestCredits, 'bg-emerald-600');
    renderTopCreditsList('stats-smallest-credits', smallestCredits, 'bg-amber-500');
    renderLastThreeMonthsStats(lastThreeMonths);
    renderApprovedEvolutionChart(lastSixMonths);
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
        <article class="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <p class="text-sm font-black text-slate-800 uppercase">${credito.nombre_socio || 'N/A'}</p>
                    <p class="text-xs text-slate-500 mt-1">Cédula: ${credito.cedula_socio || 'N/A'}</p>
                    <p class="text-xs text-slate-500">Monto: $${formatStoredAmount(credito.monto_aprobado)}</p>
                </div>
                <span class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-black uppercase">Pendiente</span>
            </div>
            <div class="flex flex-wrap gap-2 items-center">
                ${canEditCartera() ? `<button onclick="openAsignarFechaModal('${credito.id}')" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-colors shadow-sm"><i class="fas fa-calendar-plus mr-2"></i>Asignar Fecha</button>` : `<span class="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">Solo visualización para admin</span>`}
                ${credito.acta ? `<button onclick="viewAmortizationTable('${credito.acta}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-colors shadow-sm"><i class="fas fa-table mr-2"></i>Ver Tabla</button>` : ''}
            </div>
        </article>
    `).join('');
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

    const montos = creditos.map(c => parseEuropeanNumber(c.monto_aprobado));
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
    
    const dataCard = document.getElementById('data-card');
    const statisticsView = document.getElementById('statistics-view');
    const missingScheduleSection = document.getElementById('missing-payment-schedule-section');
    const isStatisticsView = view === 'estadisticas';
    
    const titles = {
        atrasados: 'Pagos Atrasados / Mora',
        cobros: 'Cobros Próximos (Próximos 5 días)',
        general: 'Base de Datos de Cartera',
        estadisticas: 'Estadísticas de Cartera'
    };
    const titleEl = document.getElementById('card-main-title');
    if (titleEl) titleEl.textContent = titles[view] || titles.general;

    if (statisticsView) statisticsView.classList.toggle('hidden', !isStatisticsView);
    if (dataCard) dataCard.classList.toggle('hidden', isStatisticsView);
    if (missingScheduleSection) {
        if (isStatisticsView) {
            missingScheduleSection.classList.add('hidden');
        } else {
            renderMissingPaymentScheduleSection();
        }
    }

    // Controlar visibilidad del Dashboard Admin (Solo en Vista General para Admins)
    const adminDashboard = document.getElementById('admin-dashboard');
    if (adminDashboard) {
        if (isAdmin && view === 'general') {
            adminDashboard.classList.remove('hidden');
        } else {
            adminDashboard.classList.add('hidden');
        }
    }

    if (isStatisticsView) {
        renderStatisticsView();
        return;
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
        renderMissingPaymentScheduleSection();
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
            montoTotal += parseEuropeanNumber(c.monto_aprobado);
        }
    });

    document.getElementById('stat-atrasados').textContent = atrasados;
    document.getElementById('stat-cobros').textContent = cobros;
    document.getElementById('stat-monto').textContent = '$' + formatEuropeanNumber(montoTotal);

    renderStatisticsView();
}

function updateAdminDashboard() {
    const totalCreditos = CARTERA_DATA.length;
    const montoTotalGlobal = CARTERA_DATA.reduce((sum, c) => sum + parseEuropeanNumber(c.monto_aprobado), 0);
    const capitalVigenteGlobal = CARTERA_DATA.reduce((sum, c) => sum + parseEuropeanNumber(c.capital_restante), 0);
    const promedio = totalCreditos > 0 ? montoTotalGlobal / totalCreditos : 0;

    // Métricas principales
    document.getElementById('dashboard-total-creditos').textContent = totalCreditos;
    document.getElementById('dashboard-monto-total').textContent = '$' + formatEuropeanNumber(montoTotalGlobal);
    document.getElementById('dashboard-capital-vigente').textContent = '$' + formatEuropeanNumber(capitalVigenteGlobal);
    document.getElementById('dashboard-promedio-monto').textContent = '$' + formatEuropeanNumber(promedio);

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
        asesoresData[idAsesor].monto += parseEuropeanNumber(c.monto_aprobado);
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
                    <span class="text-sm font-black text-indigo-700">$${formatEuropeanNumber(a.monto)}</span>
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

        const montoMes = delMes.reduce((sum, c) => sum + parseEuropeanNumber(c.monto_aprobado), 0);
        const capitalMes = delMes.reduce((sum, c) => sum + parseEuropeanNumber(c.capital_restante), 0);

        // Agrupar por asesor para este mes
        const asesoresDelMes = {};
        delMes.forEach(c => {
            const id = c.correo_asesor || 'sin_correo';
            if (!asesoresDelMes[id]) {
                asesoresDelMes[id] = { nombre: c.asesor_credito || 'Desconocido', cant: 0, monto: 0 };
            }
            asesoresDelMes[id].cant++;
            asesoresDelMes[id].monto += parseEuropeanNumber(c.monto_aprobado);
        });

        const listAsesoresSorted = Object.values(asesoresDelMes).sort((a, b) => b.monto - a.monto);

        const nameEl = document.getElementById(`dashboard-month-${i}-name`);
        const countEl = document.getElementById(`dashboard-month-${i}-count`);
        const amountEl = document.getElementById(`dashboard-month-${i}-amount`);
        const capitalEl = document.getElementById(`dashboard-month-${i}-capital`);
        const asesoresContainer = document.getElementById(`dashboard-month-${i}-asesores`);

        if (nameEl) nameEl.textContent = mesesNombres[currentMonth] + ' ' + currentYear;
        if (countEl) countEl.textContent = delMes.length;
        if (amountEl) amountEl.textContent = '$' + formatEuropeanNumber(montoMes);
        if (capitalEl) capitalEl.textContent = '$' + formatEuropeanNumber(capitalMes);
        
        if (asesoresContainer) {
            if (listAsesoresSorted.length > 0) {
                asesoresContainer.innerHTML = listAsesoresSorted.map(as => `
                    <div class="flex justify-between items-center text-[11px] py-1 border-b border-white/10 last:border-0 uppercase font-medium">
                        <span class="truncate pr-2">${as.nombre}</span>
                        <span class="flex-shrink-0 font-bold">${as.cant} | $${formatEuropeanNumber(as.monto)}</span>
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

    if (view === 'estadisticas') {
        thead.innerHTML = '';
        tbody.innerHTML = '';
        renderStatisticsView();
        return;
    }

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
        thead.innerHTML = `<tr>${renderAtrasadosSortableHeader('Vencimiento', 'fecha_pago')}${renderAtrasadosSortableHeader('Días Mora', 'dias_mora')}${renderAtrasadosSortableHeader('Socio', 'nombre_socio')}${renderAtrasadosSortableHeader('Cédula', 'cedula_socio')}${renderAtrasadosSortableHeader('Monto Aprob.', 'monto_aprobado')}${renderAtrasadosSortableHeader('Score', 'score')}<th>Acciones</th></tr>`;
        const filtered = sortAtrasadosData(data.filter(c => {
            const dias = diasHastaFecha(c.dia_pago, getMesAnioPrimerPago(c), parseInt(c.cuota_pagada) || 0);
            const capitalRestante = parseEuropeanNumber(c.capital_restante);
            return capitalRestante > 0 && (parseInt(c.plazo) || 0) > (parseInt(c.cuota_pagada) || 0) && (dias !== null && dias < 0);
        }));

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">No hay pagos atrasados</td></tr>`;
            return;
        }

        filtered.forEach(item => {
            const dias = diasHastaFecha(item.dia_pago, getMesAnioPrimerPago(item), parseInt(item.cuota_pagada) || 0);
            const fecha = calcularFechaVencida(item.dia_pago, getMesAnioPrimerPago(item), parseInt(item.cuota_pagada) || 0);
            const stars = '★'.repeat(item.tupak_score || 1) + '☆'.repeat(5 - (item.tupak_score || 1));
            const actionButtons = [
                `<button class="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors" title="Ver Detalles" onclick="viewCreditoDetails('${item.id}')"><i class="fas fa-eye"></i></button>`,
                item.acta ? `<button class="text-slate-600 hover:bg-slate-50 p-2 rounded-lg transition-colors" title="Amortización" onclick="viewAmortizationTable('${item.acta}')"><i class="fas fa-table"></i></button>` : ''
            ];

            if (canEditCartera()) {
                actionButtons.splice(1, 0, `<button class="text-green-600 hover:bg-green-50 p-2 rounded-lg transition-colors" title="Notificar WhatsApp" onclick="confirmarNotificarWhatsApp('${item.id}')"><i class="fab fa-whatsapp"></i></button>`);
                actionButtons.push(`<button class="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition-colors" title="Registrar Pago" onclick="prepararPagoCuota('${item.id}')"><i class="fas fa-check-circle"></i></button>`);
                actionButtons.push(`<button class="text-amber-600 hover:bg-amber-50 p-2 rounded-lg transition-colors" title="Liquidar Crédito" onclick="prepararLiquidacion('${item.id}')"><i class="fas fa-money-bill-wave"></i></button>`);
            }
            
            tbody.innerHTML += `
                <tr>
                    <td><span class="text-red-700 font-bold">${fecha}</span></td>
                    <td><span class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">${Math.abs(dias)} días</span></td>
                    <td class="font-medium">${item.nombre_socio}</td>
                    <td>${item.cedula_socio}</td>
                    <td class="font-bold text-gray-900">$${formatStoredAmount(item.monto_aprobado)}</td>
                    <td class="text-amber-500 font-bold">${stars}</td>
                    <td>
                        <div class="flex items-center gap-1">${actionButtons.join('')}</div>
                    </td>
                </tr>
            `;
        });
    } else if (view === 'cobros') {
        thead.innerHTML = `<tr>${renderCobrosSortableHeader('Fecha Pago', 'fecha_pago')}${renderCobrosSortableHeader('Estado', 'dias_restantes')}${renderCobrosSortableHeader('Socio', 'nombre_socio')}${renderCobrosSortableHeader('Cédula', 'cedula_socio')}${renderCobrosSortableHeader('Monto Aprob.', 'monto_aprobado')}${renderCobrosSortableHeader('Score', 'score')}<th>Acciones</th></tr>`;
        const filtered = sortCobrosData(data.filter(c => {
            const dias = diasHastaFecha(c.dia_pago, getMesAnioPrimerPago(c), parseInt(c.cuota_pagada) || 0);
            const capitalRestante = parseEuropeanNumber(c.capital_restante);
            return capitalRestante > 0 && (parseInt(c.plazo) || 0) > (parseInt(c.cuota_pagada) || 0) && (dias !== null && dias >= 0 && dias <= 5);
        }));

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">No hay cobros en los próximos 5 días</td></tr>`;
            return;
        }

        filtered.forEach(item => {
            const dias = diasHastaFecha(item.dia_pago, getMesAnioPrimerPago(item), parseInt(item.cuota_pagada) || 0);
            const fecha = calcularFechaVencida(item.dia_pago, getMesAnioPrimerPago(item), parseInt(item.cuota_pagada) || 0);
            const stars = '★'.repeat(item.tupak_score || 1) + '☆'.repeat(5 - (item.tupak_score || 1));
            const actionButtons = [
                `<button class="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors" title="Ver Detalles" onclick="viewCreditoDetails('${item.id}')"><i class="fas fa-eye"></i></button>`,
                item.acta ? `<button class="text-slate-600 hover:bg-slate-50 p-2 rounded-lg transition-colors" title="Amortización" onclick="viewAmortizationTable('${item.acta}')"><i class="fas fa-table"></i></button>` : ''
            ];

            if (canEditCartera()) {
                actionButtons.splice(1, 0, `<button class="text-green-600 hover:bg-green-50 p-2 rounded-lg transition-colors" title="Notificar WhatsApp" onclick="confirmarNotificarWhatsApp('${item.id}')"><i class="fab fa-whatsapp"></i></button>`);
                actionButtons.push(`<button class="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition-colors" title="Registrar Pago" onclick="prepararPagoCuota('${item.id}')"><i class="fas fa-check-circle"></i></button>`);
                actionButtons.push(`<button class="text-amber-600 hover:bg-amber-50 p-2 rounded-lg transition-colors" title="Liquidar Crédito" onclick="prepararLiquidacion('${item.id}')"><i class="fas fa-money-bill-wave"></i></button>`);
            }
            
            tbody.innerHTML += `
                <tr>
                    <td>${fecha}</td>
                    <td>${getUrgenciaBadge(dias)}</td>
                    <td class="font-medium">${item.nombre_socio}</td>
                    <td>${item.cedula_socio}</td>
                    <td class="font-bold text-gray-900">$${formatStoredAmount(item.monto_aprobado)}</td>
                    <td class="text-amber-500 font-bold">${stars}</td>
                    <td>
                        <div class="flex items-center gap-1">${actionButtons.join('')}</div>
                    </td>
                </tr>
            `;
        });
    } else {
        thead.innerHTML = `<tr>${renderGeneralSortableHeader('Fecha Registro', 'fecha_hora')}${renderGeneralSortableHeader('Socio', 'nombre_socio')}${renderGeneralSortableHeader('Cédula', 'cedula_socio')}${renderGeneralSortableHeader('Monto Aprob.', 'monto_aprobado')}${renderGeneralSortableHeader('Capital Rest.', 'capital_restante')}${renderGeneralSortableHeader('Plazo', 'plazo')}${renderGeneralSortableHeader('Cuota', 'cuota_pagada')}<th>Acciones</th></tr>`;

        const activeCredits = sortGeneralData(data.filter(item => !isLiquidatedCredit(item)));
        const liquidatedCredits = sortGeneralData(data.filter(item => isLiquidatedCredit(item)));

        if (activeCredits.length === 0 && liquidatedCredits.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-gray-500">No hay registros en cartera</td></tr>`;
            return;
        }

        if (activeCredits.length > 0) {
            tbody.innerHTML += buildCategorySeparatorRow('Créditos Activos', activeCredits.length, 8, 'activo');
        }

        activeCredits.forEach(item => {
            const missingSchedule = hasMissingPaymentSchedule(item);
            const actionButtons = [
                `<button class="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors" title="Ver Detalles" onclick="viewCreditoDetails('${item.id}')"><i class="fas fa-eye"></i></button>`,
                item.acta ? `<button class="text-slate-600 hover:bg-slate-50 p-2 rounded-lg transition-colors" title="Amortización" onclick="viewAmortizationTable('${item.acta}')"><i class="fas fa-table"></i></button>` : ''
            ];

            if (!isAdmin) {
                actionButtons.splice(1, 0, `<button class="text-orange-600 hover:bg-orange-50 p-2 rounded-lg transition-colors" title="Autorización Buró" onclick="abrirAutorizacion('${item.cedula_socio}', '${item.nombre_socio}')"><i class="fas fa-user-shield"></i></button>`);
                if (missingSchedule) {
                    actionButtons.push(`<button class="text-amber-600 hover:bg-amber-50 p-2 rounded-lg transition-colors" title="Asignar Fecha" onclick="openAsignarFechaModal('${item.id}')"><i class="fas fa-calendar-plus"></i></button>`);
                } else {
                    actionButtons.push(`<button class="text-amber-600 hover:bg-amber-50 p-2 rounded-lg transition-colors" title="Liquidar Crédito" onclick="prepararLiquidacion('${item.id}')"><i class="fas fa-money-bill-wave"></i></button>`);
                }
            }

            tbody.innerHTML += `
                <tr class="${missingSchedule ? 'bg-amber-50 hover:bg-amber-100' : ''}">
                    <td class="text-sm text-slate-600 whitespace-nowrap">${formatRegistroFecha(item)}</td>
                    <td class="font-medium">${item.nombre_socio}</td>
                    <td>${item.cedula_socio}</td>
                    <td class="font-bold text-gray-900">$${formatStoredAmount(item.monto_aprobado)}</td>
                    <td class="text-indigo-700 font-semibold">$${formatStoredAmount(item.capital_restante)}</td>
                    <td>${item.plazo} m</td>
                    <td>${missingSchedule ? '<span class="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Falta fecha</span>' : `${item.cuota_pagada || 0}/${item.plazo}`}</td>
                    <td>
                        <div class="flex items-center gap-1">${actionButtons.join('')}</div>
                    </td>
                </tr>
            `;
        });

        if (liquidatedCredits.length > 0) {
            tbody.innerHTML += buildCategorySeparatorRow('Créditos Liquidados', liquidatedCredits.length, 8, 'liquidado');
        }

        liquidatedCredits.forEach(item => {
            const missingSchedule = hasMissingPaymentSchedule(item);
            const actionButtons = [
                `<button class="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors" title="Ver Detalles" onclick="viewCreditoDetails('${item.id}')"><i class="fas fa-eye"></i></button>`,
                item.acta ? `<button class="text-slate-600 hover:bg-slate-50 p-2 rounded-lg transition-colors" title="Amortización" onclick="viewAmortizationTable('${item.acta}')"><i class="fas fa-table"></i></button>` : ''
            ];

            if (!isAdmin) {
                actionButtons.splice(1, 0, `<button class="text-orange-600 hover:bg-orange-50 p-2 rounded-lg transition-colors" title="Autorización Buró" onclick="abrirAutorizacion('${item.cedula_socio}', '${item.nombre_socio}')"><i class="fas fa-user-shield"></i></button>`);
                if (missingSchedule) {
                    actionButtons.push(`<button class="text-amber-600 hover:bg-amber-50 p-2 rounded-lg transition-colors" title="Asignar Fecha" onclick="openAsignarFechaModal('${item.id}')"><i class="fas fa-calendar-plus"></i></button>`);
                }
            }

            tbody.innerHTML += `
                <tr class="${missingSchedule ? 'bg-slate-50 hover:bg-slate-100' : ''}">
                    <td class="text-sm text-slate-600 whitespace-nowrap">${formatRegistroFecha(item)}</td>
                    <td class="font-medium">${item.nombre_socio}</td>
                    <td>${item.cedula_socio}</td>
                    <td class="font-bold text-gray-900">$${formatStoredAmount(item.monto_aprobado)}</td>
                    <td class="text-indigo-700 font-semibold">$${formatStoredAmount(item.capital_restante)}</td>
                    <td>${item.plazo} m</td>
                    <td><span class="px-2 py-1 bg-slate-200 text-slate-700 rounded-full text-xs font-bold">${item.cuota_pagada || 0}/${item.plazo}</span></td>
                    <td>
                        <div class="flex items-center gap-1">${actionButtons.join('')}</div>
                    </td>
                </tr>
            `;
        });
    }
}

function viewCreditoDetails(creditoId) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(creditoId));
    if (!credito) return;

    const missingSchedule = hasMissingPaymentSchedule(credito);

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
                                    <p class="font-black text-indigo-700 text-lg">$${formatStoredAmount(credito.monto_aprobado)}</p>
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

                    ${missingSchedule ? `
                    <div class="md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <p class="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Fecha de Pago Pendiente</p>
                            <p class="text-sm font-semibold text-amber-800">Este crédito aún no tiene día de pago ni mes y año asignados.</p>
                        </div>
                        ${canEditCartera() ? `<button onclick="closeModal(); openAsignarFechaModal('${credito.id}')" class="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-black transition-colors shadow-sm whitespace-nowrap"><i class="fas fa-calendar-plus mr-2"></i>Asignar Fecha</button>` : `<span class="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold whitespace-nowrap">Solo visualización para admin</span>`}
                    </div>` : ''}

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
        showCustomToast('No hay acta asociada a este crédito.', 'warning');
        return;
    }
    const url = `https://cajatupakrantina.webcoopec.com/view/${acta}`;
    window.open(url, '_blank');
}

function abrirAutorizacion(cedula, nombre) {
    const encodedNombre = encodeURIComponent(nombre);
    window.location.href = `autorizacion_buro.html?cedula=${cedula}&nombre=${encodedNombre}`;
}

function getWhatsAppUserName() {
    const session = typeof TupakAuth !== 'undefined'
        ? TupakAuth.getSession()
        : JSON.parse(localStorage.getItem('appSession') || 'null');
    if (session && session.name) return session.name;

    const userNotificationConfig = JSON.parse(localStorage.getItem('userNotificationConfig') || 'null');
    return userNotificationConfig?.user || 'La Caja';
}

function buildWhatsAppLink(telefono, mensaje) {
    return `https://api.whatsapp.com/send?phone=${encodeURIComponent(telefono)}&text=${encodeURIComponent(mensaje)}`;
}

function enviarWhatsApp(id) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    let telefono = (credito.telefono_socio || '').replace(/\D/g, '');
    if (!telefono) {
        showCustomToast('Socio no tiene teléfono registrado.', 'error');
        return;
    }

    const ultimosNueve = telefono.slice(-9);
    if (ultimosNueve.length !== 9) {
        showCustomToast('El teléfono del socio no es válido.', 'error');
        return;
    }

    telefono = `+593${ultimosNueve}`;

    const cuotaPagada = parseInt(credito.cuota_pagada) || 0;
    const mesAnioPrimerPago = getMesAnioPrimerPago(credito);
    const fechaPagoTexto = formatearFechaTexto(credito.dia_pago, mesAnioPrimerPago, cuotaPagada);

    const nombreSocio = credito.nombre_socio || 'Estimado socio';
    const userName = getWhatsAppUserName();

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

    const url = buildWhatsAppLink(telefono, mensaje);
    window.open(url, '_blank', 'noopener,noreferrer');
    showCustomToast(`WhatsApp abierto para ${nombreSocio}`, 'success', 4000);
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
    const valorMonto = formatStoredAmount(credito.monto_aprobado);

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
                Se abrirá WhatsApp con el número del socio y el mensaje listo para enviar.
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

function openAsignarFechaModal(creditoId) {
    if (!canEditCartera()) {
        showAdminReadOnlyToast();
        return;
    }

    const credito = CARTERA_DATA.find(c => String(c.id) === String(creditoId));
    if (!credito) {
        showCustomToast('No se encontró el crédito.', 'error');
        return;
    }

    const existing = document.getElementById('modal-asignar-fecha');
    if (existing) existing.remove();

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

    const modalHTML = `
        <div id="modal-asignar-fecha" class="fixed inset-0 bg-black/60 flex items-center justify-center z-[2100] p-4 backdrop-blur-sm">
            <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                <div class="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5 text-white flex items-center justify-between">
                    <div>
                        <h3 class="text-xl font-black flex items-center gap-3"><i class="fas fa-calendar-plus"></i>Asignar Fecha de Pago</h3>
                        <p class="text-sm text-amber-50/90 mt-1">Complete los campos faltantes para este crédito.</p>
                    </div>
                    <button onclick="closeAsignarFechaModal()" class="text-white/90 hover:text-white"><i class="fas fa-times text-xl"></i></button>
                </div>
                <div class="p-6 space-y-5">
                    <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm space-y-1">
                        <p><strong>Socio:</strong> ${credito.nombre_socio || 'N/A'}</p>
                        <p><strong>Cédula:</strong> ${credito.cedula_socio || 'N/A'}</p>
                        <p><strong>Monto:</strong> $${formatStoredAmount(credito.monto_aprobado)}</p>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-2">Día de Pago</label>
                        <input id="assign-dia-pago" type="number" min="1" max="31" value="${currentDay}" placeholder="15" class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-500">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-sm font-bold text-slate-700 mb-2">Mes Primer Pago</label>
                            <select id="assign-mes-primer-pago" class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-500">${monthOptions}</select>
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-slate-700 mb-2">Año Primer Pago</label>
                            <select id="assign-anio-primer-pago" class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-100 focus:border-amber-500">${yearOptions}</select>
                        </div>
                    </div>
                    <p id="assign-fecha-error" class="hidden text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3"></p>
                    <div class="flex gap-3 pt-2">
                        <button onclick="closeAsignarFechaModal()" class="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50">Cancelar</button>
                        <button onclick="guardarFechaPago('${credito.id}')" class="flex-1 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black shadow-sm">Guardar</button>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.classList.add('overflow-hidden');
}

function closeAsignarFechaModal() {
    const modal = document.getElementById('modal-asignar-fecha');
    if (modal) modal.remove();
    document.body.classList.remove('overflow-hidden');
}

async function guardarFechaPago(creditoId) {
    if (!canEditCartera()) {
        showAdminReadOnlyToast();
        return;
    }

    const credito = CARTERA_DATA.find(c => String(c.id) === String(creditoId));
    if (!credito) return;

    const dayInput = document.getElementById('assign-dia-pago');
    const monthInput = document.getElementById('assign-mes-primer-pago');
    const yearInput = document.getElementById('assign-anio-primer-pago');
    const errorEl = document.getElementById('assign-fecha-error');

    const day = parseInt(dayInput?.value, 10);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
        if (errorEl) {
            errorEl.textContent = 'El día debe estar entre 1 y 31.';
            errorEl.classList.remove('hidden');
        }
        return;
    }

    const diaFormateado = String(day).padStart(2, '0');
    const mesAnioPrimerPago = `${monthInput?.value || ''}/${yearInput?.value || ''}`;
    const session = typeof TupakAuth !== 'undefined'
        ? TupakAuth.getSession()
        : JSON.parse(localStorage.getItem('appSession') || 'null');
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

    console.log('📤 JSON GENERADO PARA ASIGNAR FECHA:', payload);

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

        closeAsignarFechaModal();
        renderData(currentView, document.getElementById('search-input')?.value.toLowerCase());
        updateStats();
        renderMissingPaymentScheduleSection();
        showCustomToast('Fecha de pago asignada correctamente.', 'success');
    } catch (error) {
        console.error('❌ Error al asignar fecha de pago:', error);
        if (errorEl) {
            errorEl.textContent = 'No se pudo actualizar la fecha de pago. Intenta nuevamente.';
            errorEl.classList.remove('hidden');
        }
        showCustomToast('No se pudo actualizar la fecha de pago.', 'error');
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
    if (!canEditCartera()) {
        showAdminReadOnlyToast();
        return;
    }

    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    const cuotaActual = parseInt(credito.cuota_pagada) || 0;
    const plazoTotal = parseInt(credito.plazo) || 0;
    const siguienteCuota = cuotaActual + 1;
    const capitalActualRaw = credito.capital_restante || '0,00';
    const capitalActual = formatStoredAmount(capitalActualRaw);
    const capitalActualNumero = parseEuropeanNumber(capitalActualRaw);

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
    const capitalInput = document.getElementById('input-nuevo-capital');
    const errorEl = document.getElementById('error-capital');
    if (capitalInput && errorEl) {
        capitalInput.addEventListener('input', () => {
            if (!errorEl.classList.contains('hidden')) {
                errorEl.classList.add('hidden');
            }
        });
    }
    setTimeout(() => capitalInput?.focus(), 100);
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

    const formatoValido = isValidCapitalInputFormat(valor);
    if (!formatoValido) {
        errorEl.textContent = "⚠ Corrija el valor. Use . para miles y , para decimales. Ejemplo: 8.500,50";
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
    if (!canEditCartera()) {
        showAdminReadOnlyToast();
        return;
    }

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
                <p class="flex justify-between"><span>Saldo Actual:</span> <span class="font-bold">$${formatStoredAmount(credito.capital_restante)}</span></p>
            </div>
        </div>`,
        () => ejecutarAccionPago(credito.id, credito.plazo, "0,00", "LIQUIDAR_CREDITO"),
        'from-amber-500 to-amber-600',
        'fas fa-money-bill-wave'
    );
}

// ===== EJECUCIÓN FINAL (JSON SIMULADO) =====

async function ejecutarAccionPago(id, cuota, capital, accion) {
    const credito = CARTERA_DATA.find(c => String(c.id) === String(id));
    if (!credito) return;

    const session = getCurrentSessionData();
    const cuotaAnterior = parseInt(credito.cuota_pagada, 10) || 0;
    const cuotaActualizada = parseInt(cuota, 10) || 0;
    const capitalAnterior = parseEuropeanNumber(credito.capital_restante);
    const capitalNuevo = parseEuropeanNumber(capital);
    const valorRegistrado = formatEuropeanNumber(Math.max(0, capitalAnterior - capitalNuevo));
    
    const payload = {
        id_credito: id,
        cedula_socio: credito.cedula_socio,
        cuota_pagada: String(cuotaActualizada),
        capital_restante: capital,
        valor_registrado: valorRegistrado,
        cedula: session?.cedula || '',
        rol: session?.rol || '',
        asesor: session?.name || '',
        correo: session?.email || '',
        accion: accion,
        timestamp: new Date().toISOString()
    };

    console.log("📤 JSON GENERADO PARA EL SERVIDOR:", payload);

    if (accion === 'REGISTRAR_PAGO_CUOTA') {
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

            credito.cuota_pagada = cuotaActualizada;
            credito.capital_restante = capital;

            renderData(currentView, document.getElementById('search-input')?.value.toLowerCase());
            updateStats();
            renderMissingPaymentScheduleSection();

            showCustomToast(`Pago de cuota #${cuotaActualizada} registrado correctamente.`, 'success');
        } catch (error) {
            console.error('❌ Error al registrar pago:', error);
            showCustomToast('No se pudo registrar el pago. Intenta nuevamente.', 'error');
        }
        return;
    }

    if (accion === 'LIQUIDAR_CREDITO') {
        try {
            const response = await fetch(LIQUIDAR_CREDITO_WEBHOOK, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': session?.token || ''
                },
                body: JSON.stringify({
                    id_credito: id,
                    cedula: session?.cedula || '',
                    rol: session?.rol || '',
                    asesor: session?.name || '',
                    correo: session?.email || '',
                    accion,
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            credito.cuota_pagada = cuotaActualizada;
            credito.capital_restante = capital;

            renderData(currentView, document.getElementById('search-input')?.value.toLowerCase());
            updateStats();
            renderMissingPaymentScheduleSection();

            showCustomToast('Crédito liquidado correctamente.', 'success');
        } catch (error) {
            console.error('❌ Error al liquidar crédito:', error);
            showCustomToast('No se pudo liquidar el crédito. Intenta nuevamente.', 'error');
        }
        return;
    }
    
    // Simular el éxito de la actualización local
    credito.cuota_pagada = cuotaActualizada;
    credito.capital_restante = capital;
    
    renderData(currentView, document.getElementById('search-input')?.value.toLowerCase());
    updateStats();
    renderMissingPaymentScheduleSection();
    
    showCustomToast(`Acción ${accion} procesada exitosamente (Simulación JSON)`, 'success');
}

function simulateAction(action, context) {
    showCustomToast(`[Módulo Cartera] Acción: ${action} para ${context}`, 'info');
}

async function generarReporteCarteraCompleto() {
    if (window.CarteraReportes && typeof window.CarteraReportes.generarReporteCartera === 'function') {
        await window.CarteraReportes.generarReporteCartera(CARTERA_DATA);
    } else {
        showCustomToast('El generador de PDF no se ha cargado correctamente.', 'error');
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

