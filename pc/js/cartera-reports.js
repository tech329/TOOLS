// ================================================
// MÓDULO DE REPORTES DE CARTERA - TUPAK RANTINA
// Con HTML2Canvas + jsPDF
// ================================================

(function() {
    'use strict';

    // Colores oficiales Tupak Rantina
    const COLORS = {
        primary: '#001749',    // Azul oscuro
        secondary: '#e48410',  // Naranja
        accent1: '#3787c6',    // Azul claro
        accent2: '#015cd0'     // Azul medio
    };

    const LOGO_URL = '../../shared/img/logo.webp';

    // ===== FUNCIÓN PRINCIPAL PARA GENERAR EL REPORTE =====
    async function generarReporteCartera(creditosData) {
        try {
            console.log('🚀 Iniciando generación de reporte con HTML2Canvas...');
            console.log('📊 Total de créditos recibidos:', creditosData?.length || 0);

            if (!creditosData || creditosData.length === 0) {
                showReportToast('No hay datos de créditos para generar el reporte.', 'warning');
                return;
            }

            // Mostrar loading
            mostrarLoading();

            // Preparar datos
            const creditosProcesados = prepararDatos(creditosData);
            
            // Generar HTML del reporte
            const reporteHTML = await generarHTMLReporte(creditosProcesados);
            
            // Convertir a PDF
            await convertirAPDF(reporteHTML);

            ocultarLoading();
            console.log('✅ Reporte generado exitosamente');

        } catch (error) {
            console.error('❌ Error al generar el reporte:', error);
            showReportToast('Error al generar el reporte: ' + error.message, 'error');
            ocultarLoading();
        }
    }

    // ===== PREPARAR DATOS =====
    function prepararDatos(creditos) {
        const ahora = new Date();
        const mesActual = ahora.getMonth();
        const añoActual = ahora.getFullYear();

        // Filtrar créditos del mes actual
        const creditosMes = creditos.filter(c => {
            const fecha = new Date(c.created_at || c.fecha_solicitud || c.fecha_hora);
            return fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
        });

        // Calcular Tupak Score
        const creditosConScore = calcularTupakScoreInterno(creditosMes);

        // Agrupar por asesor
        const asesores = {};
        creditosConScore.forEach(c => {
            const asesor = c.asesor_credito || 'Sin Asesor';
            if (!asesores[asesor]) {
                asesores[asesor] = [];
            }
            asesores[asesor].push(c);
        });

        // Calcular estadísticas por asesor para tabla comparativa
        const estadisticasAsesores = calcularEstadisticasPorAsesor(creditosConScore, creditos);

        // Preparar datos para gráfico de dispersión
        const datosGrafico = prepararDatosGrafico(creditosMes);

        return {
            todos: creditos,
            mes: creditosConScore,
            asesores: asesores,
            estadisticasAsesores: estadisticasAsesores,
            datosGrafico: datosGrafico,
            mesNombre: obtenerNombreMes(ahora),
            año: añoActual,
            mesActual: mesActual
        };
    }

    // ===== CALCULAR ESTADÍSTICAS POR ASESOR =====
    function calcularEstadisticasPorAsesor(creditosMes, todosCred) {
        const asesores = [...new Set(creditosMes.map(c => c.asesor_credito || 'Sin Asesor'))];
        const estadisticas = [];

        asesores.forEach(asesor => {
            const creditosAsesorMes = creditosMes.filter(c => (c.asesor_credito || 'Sin Asesor') === asesor);
            const creditosAsesorTotal = todosCred.filter(c => (c.asesor_credito || 'Sin Asesor') === asesor);

            // Calcular mora (créditos con estado "moroso" o "vencido")
            const moraTotal = creditosAsesorTotal.filter(c => {
                const estado = (c.estado_credito || c.estado || '').toLowerCase();
                return estado.includes('mora') || estado.includes('vencido') || estado.includes('atrasado');
            }).length;
            const porcentajeMora = creditosAsesorTotal.length > 0 ? (moraTotal / creditosAsesorTotal.length) * 100 : 0;

            estadisticas.push({
                asesor: asesor,
                cantidadMes: creditosAsesorMes.length,
                montoMes: creditosAsesorMes.reduce((sum, c) => sum + (parseFloat(c.monto_aprobado) || 0), 0),
                cantidadTotal: creditosAsesorTotal.length,
                montoTotal: creditosAsesorTotal.reduce((sum, c) => sum + (parseFloat(c.monto_aprobado) || 0), 0),
                porcentajeMora: porcentajeMora
            });
        });

        return estadisticas.sort((a, b) => b.montoMes - a.montoMes);
    }

    // ===== PREPARAR DATOS PARA GRÁFICO =====
    function prepararDatosGrafico(creditosMes) {
        const diasMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const asesores = [...new Set(creditosMes.map(c => c.asesor_credito || 'Sin Asesor'))];
        
        // Inicializar contadores por día y asesor
        const datosPorAsesor = {};
        const totalesPorDia = Array(diasMes).fill(0);
        
        asesores.forEach(asesor => {
            datosPorAsesor[asesor] = Array(diasMes).fill(0);
        });

        // Contar créditos por día
        creditosMes.forEach(c => {
            const fecha = new Date(c.created_at || c.fecha_solicitud || c.fecha_hora);
            const dia = fecha.getDate() - 1; // 0-indexed
            const asesor = c.asesor_credito || 'Sin Asesor';
            
            if (dia >= 0 && dia < diasMes) {
                datosPorAsesor[asesor][dia]++;
                totalesPorDia[dia]++;
            }
        });

        return { datosPorAsesor, totalesPorDia, diasMes };
    }

    // ===== CALCULAR TUPAK SCORE =====
    function calcularTupakScoreInterno(creditos) {
        if (creditos.length === 0) return creditos;

        // Extraer valores
        const montos = creditos.map(c => parseFloat(c.monto_aprobado) || 0);
        const plazos = creditos.map(c => parseInt(c.plazo || 0) || 1);
        const retornos = creditos.map((c, i) => plazos[i] > 0 ? montos[i] / plazos[i] : 0);
        const tasas = creditos.map(c => parseFloat(c.interes || 0) || 0);

        // Min/Max
        const montoMin = Math.min(...montos);
        const montoMax = Math.max(...montos);
        const plazoMin = Math.min(...plazos.filter(p => p > 0));
        const plazoMax = Math.max(...plazos);
        const retornoMin = Math.min(...retornos.filter(r => r > 0));
        const retornoMax = Math.max(...retornos);
        const tasaMin = Math.min(...tasas.filter(t => t > 0));
        const tasaMax = Math.max(...tasas);

        return creditos.map((c, i) => {
            const monto = montos[i];
            const plazo = plazos[i];
            const retorno = retornos[i];
            const tasa = tasas[i];

            // Normalizar (0-1)
            const montoNorm = montoMax > montoMin ? (monto - montoMin) / (montoMax - montoMin) : 0.5;
            const plazoNorm = plazoMax > plazoMin ? 1 - ((plazo - plazoMin) / (plazoMax - plazoMin)) : 0.5;
            const retornoNorm = retornoMax > retornoMin ? (retorno - retornoMin) / (retornoMax - retornoMin) : 0.5;
            const tasaNorm = tasaMax > tasaMin ? (tasa - tasaMin) / (tasaMax - tasaMin) : 0.5;

            // ICE: 25% monto + 20% plazo + 40% retorno + 15% tasa
            const ice = 0.25 * montoNorm + 0.20 * plazoNorm + 0.40 * retornoNorm + 0.15 * tasaNorm;

            // Score 1-5
            let score;
            if (ice >= 0.80) score = 5;
            else if (ice >= 0.60) score = 4;
            else if (ice >= 0.40) score = 3;
            else if (ice >= 0.20) score = 2;
            else score = 1;

            return {
                ...c,
                tupak_score: score,
                ice: ice,
                retorno_mensual: retorno,
                tasa_efectiva: tasa,
                plazo_numerico: plazo
            };
        });
    }

    // ===== GENERAR HTML DEL REPORTE =====
    async function generarHTMLReporte(datos) {
        const container = document.createElement('div');
        container.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 210mm; background: white; font-family: Arial, sans-serif;';
        
        let html = '';

        // ===== PORTADA =====
        html += `
        <div style="width: 210mm; height: 297mm; background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.accent2} 100%); 
                    display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; page-break-after: always;">
            <img src="${LOGO_URL}" style="width: 400px; margin-bottom: 40px;" crossorigin="anonymous" />
            <h1 style="font-size: 42px; font-weight: bold; margin: 0 0 20px 0; text-align: center;">REPORTE DE CARTERA</h1>
            <h2 style="font-size: 28px; margin: 0 0 10px 0;">${datos.mesNombre.toUpperCase()} ${datos.año}</h2>
            <div style="background: rgba(255,255,255,0.2); padding: 20px 40px; border-radius: 10px; margin-top: 30px;">
                <p style="font-size: 20px; margin: 5px 0;">Total de Créditos: <strong>${datos.mes.length}</strong></p>
                <p style="font-size: 20px; margin: 5px 0;">Fecha de generación: <strong>${new Date().toLocaleDateString('es-ES')}</strong></p>
            </div>
        </div>
        `;

        // ===== RESUMEN EJECUTIVO =====
        const montoTotalMes = datos.mes.reduce((sum, c) => sum + (parseFloat(c.monto_aprobado) || 0), 0);
        const scorePromedioMes = datos.mes.reduce((sum, c) => sum + c.tupak_score, 0) / (datos.mes.length || 1);
        const plazoPromedioMes = datos.mes.reduce((sum, c) => sum + c.plazo_numerico, 0) / (datos.mes.length || 1);
        
        const montoTotalGeneral = datos.todos.reduce((sum, c) => sum + (parseFloat(c.monto_aprobado) || 0), 0);
        const plazoPromedioGeneral = (datos.todos.reduce((sum, c) => sum + (parseInt(c.plazo) || 0), 0) / (datos.todos.length || 1));

        html += generarPaginaResumen(
            montoTotalMes, scorePromedioMes, plazoPromedioMes, datos.mes.length,
            montoTotalGeneral, plazoPromedioGeneral, datos.todos.length,
            datos.mesNombre
        );

        // ===== TABLA COMPARATIVA + GRÁFICO (MISMA PÁGINA) =====
        html += await generarPaginaComparativaYGrafico(datos.estadisticasAsesores, datos.datosGrafico, datos.mesNombre);

        // ===== TABLAS POR ASESOR =====
        for (const [asesor, creditos] of Object.entries(datos.asesores)) {
            html += generarPaginaAsesor(asesor, creditos);
        }

        // ===== ESTADÍSTICAS =====
        html += generarPaginaEstadisticas(datos.mes);

        container.innerHTML = html;
        document.body.appendChild(container);
        
        return container;
    }

    // ===== PÁGINA RESUMEN =====
    function generarPaginaResumen(montoTotalMes, scorePromedioMes, plazoPromedioMes, totalCreditosMes,
                                   montoTotalGeneral, plazoPromedioGeneral, totalCreditosGeneral, mesNombre) {
        
        const montoPromedioMes = totalCreditosMes > 0 ? montoTotalMes / totalCreditosMes : 0;
        const montoPromedioGeneral = totalCreditosGeneral > 0 ? montoTotalGeneral / totalCreditosGeneral : 0;
        
        return `
        <div style="width: 210mm; padding: 18mm 20mm; page-break-after: always;">
            <div style="border-bottom: 4px solid ${COLORS.primary}; padding-bottom: 12px; margin-bottom: 20px;">
                <h2 style="color: ${COLORS.primary}; font-size: 26px; margin: 0;">RESUMEN EJECUTIVO</h2>
            </div>
            <div style="background: ${COLORS.secondary}; color: white; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: bold;">${mesNombre.toUpperCase()} (ESTADÍSTICAS DEL MES)</h3>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px;">
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Monto Colocado</div>
                    <div style="font-size: 24px; font-weight: bold; color: ${COLORS.primary};">${formatearMoneda(montoTotalMes)}</div>
                </div>
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Total Créditos</div>
                    <div style="font-size: 24px; font-weight: bold; color: ${COLORS.primary};">${totalCreditosMes}</div>
                </div>
            </div>
            <!-- Histórico -->
            <div style="background: ${COLORS.accent1}; color: white; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: bold;">HISTÓRICO GENERAL</h3>
            </div>
             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Monto Histórico</div>
                    <div style="font-size: 24px; font-weight: bold; color: ${COLORS.primary};">${formatearMoneda(montoTotalGeneral)}</div>
                </div>
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Total Histórico</div>
                    <div style="font-size: 24px; font-weight: bold; color: ${COLORS.primary};">${totalCreditosGeneral}</div>
                </div>
            </div>
        </div>
        `;
    }

    async function generarPaginaComparativaYGrafico(estadisticas, datosGrafico, mesNombre) {
        const canvas = document.createElement('canvas');
        canvas.width = 1400; canvas.height = 600;
        canvas.style.cssText = 'position: fixed; left: -9999px;';
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const asesores = Object.keys(datosGrafico.datosPorAsesor);
        const coloresAsesores = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

        const datasets = asesores.map((asesor, idx) => {
            const puntos = [];
            datosGrafico.datosPorAsesor[asesor].forEach((q, d) => { if(q>0) puntos.push({x:d+1,y:q}); });
            return { label: asesor, data: puntos, backgroundColor: coloresAsesores[idx%5], pointRadius: 6, showLine: false };
        });

        const chart = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: { responsive: false, plugins: { title: { display: true, text: `Colocación Diaria - ${mesNombre}` } } }
        });

        await new Promise(r => setTimeout(r, 600));
        const img = canvas.toDataURL('image/png');
        document.body.removeChild(canvas);

        return `<div style="width: 210mm; padding: 15mm 20mm; page-break-after: always;">
            <h2 style="color:${COLORS.primary};">Comparativa por Asesor</h2>
            <table style="width:100%; border-collapse:collapse; font-size:10px;">
                <thead style="background:${COLORS.primary}; color:white;">
                    <tr><th>Asesor</th><th>Mes (Cant)</th><th>Mes (Monto)</th><th>Total (Cant)</th><th>Total (Monto)</th><th>% Mora</th></tr>
                </thead>
                <tbody>
                    ${estadisticas.map(e => `<tr><td>${e.asesor}</td><td>${e.cantidadMes}</td><td>${formatearMoneda(e.montoMes)}</td><td>${e.cantidadTotal}</td><td>${formatearMoneda(e.montoTotal)}</td><td>${e.porcentajeMora.toFixed(1)}%</td></tr>`).join('')}
                </tbody>
            </table>
            <div style="margin-top:20px;"><img src="${img}" style="width:100%;"></div>
        </div>`;
    }

    function generarPaginaAsesor(asesor, creditos) {
        return `<div style="width: 210mm; padding: 20mm; page-break-after: always;">
            <h2 style="color:${COLORS.secondary};">Asesor: ${asesor}</h2>
            <p>Total Créditos: ${creditos.length}</p>
            <table style="width:100%; border-collapse:collapse; font-size:10px;">
                <thead style="background:${COLORS.primary}; color:white;">
                    <tr><th>Acta</th><th>Socio</th><th>Monto</th><th>Score</th></tr>
                </thead>
                <tbody>
                    ${creditos.map(c => `<tr><td>${c.acta}</td><td>${c.nombre_socio}</td><td>${formatearMoneda(parseFloat(c.monto_aprobado))}</td><td>${'★'.repeat(c.tupak_score)}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    }

    function generarPaginaEstadisticas(creditos) {
        return `<div style="width: 210mm; padding: 20mm; page-break-after: always;">
            <h2 style="color:${COLORS.primary};">Distribución de Tupak Score</h2>
            <p>Total Créditos Analizados: ${creditos.length}</p>
        </div>`;
    }

    async function convertirAPDF(container) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pages = container.querySelectorAll('[style*="page-break-after"]');
        for (let i = 0; i < pages.length; i++) {
            if (i > 0) pdf.addPage();
            const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, (canvas.height * 210) / canvas.width);
        }
        document.body.removeChild(container);
        pdf.save(`Reporte_Cartera_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    function formatearMoneda(v) { return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(v); }
    function obtenerNombreMes(f) { return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][f.getMonth()]; }
    function mostrarLoading() { const l = document.createElement('div'); l.id='pdf-loading'; l.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;color:white;display:flex;align-items:center;justify-content:center;font-size:24px;'; l.innerHTML='Generando PDF...'; document.body.appendChild(l); }
    function ocultarLoading() { const l = document.getElementById('pdf-loading'); if(l) l.remove(); }
    function showReportToast(message, type = 'info') {
        const toast = document.createElement('div');
        const colors = {
            info: 'background:#e0e7ff;color:#312e81;border-left:4px solid #4f46e5;',
            warning: 'background:#fef3c7;color:#92400e;border-left:4px solid #f59e0b;',
            error: 'background:#fee2e2;color:#991b1b;border-left:4px solid #ef4444;'
        };
        toast.style.cssText = `position:fixed;top:24px;right:24px;z-index:10001;min-width:320px;max-width:460px;padding:16px 18px;border-radius:16px;box-shadow:0 20px 45px rgba(15,23,42,.18);font:600 14px/1.45 Arial,sans-serif;${colors[type] || colors.info}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(16px)';
            toast.style.transition = 'all .25s ease';
            setTimeout(() => toast.remove(), 260);
        }, 3800);
    }

    window.CarteraReportes = { generarReporteCartera };
})();


