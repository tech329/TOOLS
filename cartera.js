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

    const LOGO_URL = 'https://lh3.googleusercontent.com/d/1idgiPohtekZVIYJ-pmza9PSQqEamUvfH=w2048';

    // ===== FUNCIÓN PRINCIPAL PARA GENERAR EL REPORTE =====
    async function generarReporteCartera(creditosData) {
        try {
            console.log('🚀 Iniciando generación de reporte con HTML2Canvas...');
            console.log('📊 Total de créditos recibidos:', creditosData?.length || 0);

            if (!creditosData || creditosData.length === 0) {
                alert('⚠️ No hay datos de créditos para generar el reporte.');
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
            alert('Error al generar el reporte: ' + error.message);
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
            const fecha = new Date(c.created_at || c.fecha_solicitud || c.fecha);
            return fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
        });

        // Calcular Tupak Score
        const creditosConScore = calcularTupakScore(creditosMes);

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
            const fecha = new Date(c.created_at || c.fecha_solicitud || c.fecha);
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
    function calcularTupakScore(creditos) {
        if (creditos.length === 0) return creditos;

        // Extraer valores
        const montos = creditos.map(c => parseFloat(c.monto_aprobado) || 0);
        const plazos = creditos.map(c => {
            const plazoStr = c.plazo || '0';
            return parseInt(plazoStr.toString().replace(/\D/g, '')) || 1;
        });
        const retornos = creditos.map((c, i) => plazos[i] > 0 ? montos[i] / plazos[i] : 0);
        const tasas = creditos.map(c => {
            const tasaStr = c.interes || c.tasa_interes || '0';
            return parseFloat(tasaStr.toString().replace(/[^\d.]/g, '')) || 0;
        });

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
        const scorePromedioMes = datos.mes.reduce((sum, c) => sum + c.tupak_score, 0) / datos.mes.length;
        const plazoPromedioMes = datos.mes.reduce((sum, c) => sum + c.plazo_numerico, 0) / datos.mes.length;
        
        const montoTotalGeneral = datos.todos.reduce((sum, c) => sum + (parseFloat(c.monto_aprobado) || 0), 0);
        const plazoPromedioGeneral = datos.todos.reduce((sum, c) => {
            const plazoStr = c.plazo || '0';
            const plazo = parseInt(plazoStr.toString().replace(/\D/g, '')) || 1;
            return sum + plazo;
        }, 0) / datos.todos.length;

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
            <!-- Header -->
            <div style="border-bottom: 4px solid ${COLORS.primary}; padding-bottom: 12px; margin-bottom: 20px;">
                <h2 style="color: ${COLORS.primary}; font-size: 26px; margin: 0;">RESUMEN EJECUTIVO</h2>
            </div>

            <!-- MÉTRICAS DEL MES -->
            <div style="background: linear-gradient(135deg, ${COLORS.secondary}, #f59e0b); 
                        color: white; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: bold;">
                    <i class="fas fa-calendar-alt" style="margin-right: 8px;"></i>${mesNombre.toUpperCase()}
                </h3>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 25px;">
                <div style="background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent2}); 
                            color: white; padding: 16px; border-radius: 8px; box-shadow: 0 3px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">
                        <i class="fas fa-dollar-sign" style="margin-right: 5px;"></i>Monto Colocado
                    </div>
                    <div style="font-size: 20px; font-weight: bold;">${formatearMoneda(montoTotalMes)}</div>
                </div>
                <div style="background: linear-gradient(135deg, ${COLORS.secondary}, #f59e0b); 
                            color: white; padding: 16px; border-radius: 8px; box-shadow: 0 3px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">
                        <i class="fas fa-file-invoice-dollar" style="margin-right: 5px;"></i>Total Créditos
                    </div>
                    <div style="font-size: 20px; font-weight: bold;">${totalCreditosMes}</div>
                </div>
                <div style="background: linear-gradient(135deg, ${COLORS.accent1}, #0ea5e9); 
                            color: white; padding: 16px; border-radius: 8px; box-shadow: 0 3px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">
                        <i class="fas fa-star" style="margin-right: 5px;"></i>Score Promedio
                    </div>
                    <div style="font-size: 24px; font-weight: bold;">${'★'.repeat(Math.round(scorePromedioMes))}</div>
                    <div style="font-size: 12px; margin-top: 2px; opacity: 0.9;">${scorePromedioMes.toFixed(2)}</div>
                </div>
                <div style="background: linear-gradient(135deg, #059669, #10b981); 
                            color: white; padding: 16px; border-radius: 8px; box-shadow: 0 3px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">
                        <i class="fas fa-chart-line" style="margin-right: 5px;"></i>Monto Promedio
                    </div>
                    <div style="font-size: 20px; font-weight: bold;">${formatearMoneda(montoPromedioMes)}</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 30px;">
                <div style="background: linear-gradient(135deg, #7c3aed, #a855f7); 
                            color: white; padding: 16px; border-radius: 8px; box-shadow: 0 3px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">
                        <i class="fas fa-clock" style="margin-right: 5px;"></i>Plazo Promedio
                    </div>
                    <div style="font-size: 20px; font-weight: bold;">${plazoPromedioMes.toFixed(1)} meses</div>
                </div>
                <div style="background: linear-gradient(135deg, #dc2626, #ef4444); 
                            color: white; padding: 16px; border-radius: 8px; box-shadow: 0 3px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">
                        <i class="fas fa-calendar-check" style="margin-right: 5px;"></i>Créditos por Día
                    </div>
                    <div style="font-size: 20px; font-weight: bold;">${(totalCreditosMes / new Date().getDate()).toFixed(1)}</div>
                </div>
            </div>

            <!-- MÉTRICAS HISTÓRICAS GENERALES -->
            <div style="background: linear-gradient(135deg, ${COLORS.accent1}, #0ea5e9); 
                        color: white; padding: 12px 20px; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: bold;">
                    <i class="fas fa-chart-bar" style="margin-right: 8px;"></i>HISTÓRICO GENERAL
                </h3>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px;">
                <div style="background: linear-gradient(135deg, #059669, #10b981); 
                            color: white; padding: 16px; border-radius: 8px; box-shadow: 0 3px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">
                        <i class="fas fa-dollar-sign" style="margin-right: 5px;"></i>Monto Total
                    </div>
                    <div style="font-size: 20px; font-weight: bold;">${formatearMoneda(montoTotalGeneral)}</div>
                </div>
                <div style="background: linear-gradient(135deg, #7c3aed, #a855f7); 
                            color: white; padding: 16px; border-radius: 8px; box-shadow: 0 3px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">
                        <i class="fas fa-file-invoice-dollar" style="margin-right: 5px;"></i>Total Créditos
                    </div>
                    <div style="font-size: 20px; font-weight: bold;">${totalCreditosGeneral}</div>
                </div>
                <div style="background: linear-gradient(135deg, #dc2626, #ef4444); 
                            color: white; padding: 16px; border-radius: 8px; box-shadow: 0 3px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">
                        <i class="fas fa-chart-line" style="margin-right: 5px;"></i>Monto Promedio
                    </div>
                    <div style="font-size: 20px; font-weight: bold;">${formatearMoneda(montoPromedioGeneral)}</div>
                </div>
                <div style="background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent2}); 
                            color: white; padding: 16px; border-radius: 8px; box-shadow: 0 3px 6px rgba(0,0,0,0.1);">
                    <div style="font-size: 11px; opacity: 0.9; margin-bottom: 5px;">
                        <i class="fas fa-clock" style="margin-right: 5px;"></i>Plazo Promedio
                    </div>
                    <div style="font-size: 20px; font-weight: bold;">${plazoPromedioGeneral.toFixed(1)} meses</div>
                </div>
            </div>
        </div>
        `;
    }

    // ===== TABLA COMPARATIVA DE ASESORES =====
    function generarTablaComparativaAsesores(estadisticas, mesNombre) {
        return `
        <div style="width: 210mm; padding: 20mm 20mm 10mm 20mm;">
            <!-- Header -->
            <div style="border-bottom: 4px solid ${COLORS.secondary}; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="color: ${COLORS.primary}; font-size: 24px; margin: 0;">COMPARATIVA POR ASESOR</h2>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <thead>
                    <tr>
                        <th rowspan="2" style="padding: 10px; background: ${COLORS.primary}; color: white; border: 1px solid #ddd; text-align: left;">
                            ASESOR
                        </th>
                        <th colspan="2" style="padding: 10px; background: ${COLORS.secondary}; color: white; border: 1px solid #ddd; text-align: center;">
                            ${mesNombre.toUpperCase()}
                        </th>
                        <th colspan="3" style="padding: 10px; background: ${COLORS.accent1}; color: white; border: 1px solid #ddd; text-align: center;">
                            HISTÓRICO GENERAL
                        </th>
                    </tr>
                    <tr>
                        <th style="padding: 8px; background: #fef3c7; color: #78350f; border: 1px solid #ddd; font-weight: bold;">Créditos</th>
                        <th style="padding: 8px; background: #fef3c7; color: #78350f; border: 1px solid #ddd; font-weight: bold;">Monto</th>
                        <th style="padding: 8px; background: #dbeafe; color: #1e3a8a; border: 1px solid #ddd; font-weight: bold;">Créditos</th>
                        <th style="padding: 8px; background: #dbeafe; color: #1e3a8a; border: 1px solid #ddd; font-weight: bold;">Monto</th>
                        <th style="padding: 8px; background: #fee2e2; color: #991b1b; border: 1px solid #ddd; font-weight: bold;">% Mora</th>
                    </tr>
                </thead>
                <tbody>
                    ${estadisticas.map((e, idx) => {
                        const bgColor = idx % 2 === 0 ? '#f9fafb' : 'white';
                        const moraColor = e.porcentajeMora > 10 ? '#ef4444' : e.porcentajeMora > 5 ? '#f59e0b' : '#22c55e';
                        return `
                        <tr style="background: ${bgColor};">
                            <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; color: ${COLORS.primary};">
                                ${e.asesor}
                            </td>
                            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; background: #fffbeb;">
                                ${e.cantidadMes}
                            </td>
                            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; background: #fffbeb; font-weight: 600;">
                                ${formatearMoneda(e.montoMes)}
                            </td>
                            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; background: #eff6ff;">
                                ${e.cantidadTotal}
                            </td>
                            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right; background: #eff6ff; font-weight: 600;">
                                ${formatearMoneda(e.montoTotal)}
                            </td>
                            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; background: #fef2f2;">
                                <span style="color: ${moraColor}; font-weight: bold;">
                                    ${e.porcentajeMora.toFixed(1)}%
                                </span>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                    <tr style="background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent2}); color: white; font-weight: bold;">
                        <td style="padding: 10px; border: 1px solid #ddd;">TOTALES</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                            ${estadisticas.reduce((sum, e) => sum + e.cantidadMes, 0)}
                        </td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">
                            ${formatearMoneda(estadisticas.reduce((sum, e) => sum + e.montoMes, 0))}
                        </td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                            ${estadisticas.reduce((sum, e) => sum + e.cantidadTotal, 0)}
                        </td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">
                            ${formatearMoneda(estadisticas.reduce((sum, e) => sum + e.montoTotal, 0))}
                        </td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                            ${((estadisticas.reduce((sum, e) => sum + (e.porcentajeMora * e.cantidadTotal), 0) / estadisticas.reduce((sum, e) => sum + e.cantidadTotal, 0)) || 0).toFixed(1)}%
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        `;
    }

    // ===== GENERAR PÁGINA CON TABLA COMPARATIVA + GRÁFICO (50/50) =====
    async function generarPaginaComparativaYGrafico(estadisticas, datosGrafico, mesNombre) {
        // Primero generar el gráfico como imagen
        const canvas = document.createElement('canvas');
        canvas.width = 1400;
        canvas.height = 600;
        canvas.style.cssText = 'position: fixed; left: -9999px;';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const asesores = Object.keys(datosGrafico.datosPorAsesor);
        const coloresAsesores = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

        // Datasets de puntos por asesor
        const datasets = asesores.map((asesor, idx) => {
            const puntosAsesor = [];
            datosGrafico.datosPorAsesor[asesor].forEach((cantidad, diaIdx) => {
                if (cantidad > 0) {
                    puntosAsesor.push({ x: diaIdx + 1, y: cantidad });
                }
            });
            
            return {
                label: asesor,
                data: puntosAsesor,
                backgroundColor: coloresAsesores[idx % coloresAsesores.length],
                borderColor: coloresAsesores[idx % coloresAsesores.length],
                pointRadius: 6,
                pointHoverRadius: 8,
                showLine: false
            };
        });

        // Dataset de línea total
        const puntosTotal = datosGrafico.totalesPorDia.map((cantidad, diaIdx) => ({
            x: diaIdx + 1,
            y: cantidad
        })).filter(p => p.y > 0);

        datasets.push({
            label: 'Total Diario',
            data: puntosTotal,
            borderColor: COLORS.primary,
            backgroundColor: COLORS.primary,
            pointRadius: 4,
            pointHoverRadius: 6,
            showLine: true,
            borderWidth: 3,
            tension: 0.3
        });

        const chart = new Chart(ctx, {
            type: 'scatter',
            data: { datasets: datasets },
            options: {
                responsive: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Colocación Diaria de Créditos - ${mesNombre}`,
                        font: { size: 18, weight: 'bold' },
                        color: COLORS.primary
                    },
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: { font: { size: 11 }, boxWidth: 15 }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Día del Mes', font: { size: 12 } },
                        min: 1,
                        max: datosGrafico.diasMes,
                        ticks: { stepSize: 1 }
                    },
                    y: {
                        title: { display: true, text: 'Cantidad de Créditos', font: { size: 12 } },
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });

        await new Promise(resolve => setTimeout(resolve, 500));
        const graficoPNG = canvas.toDataURL('image/png');
        document.body.removeChild(canvas);
        chart.destroy();

        // Generar HTML con tabla arriba (50%) y gráfico abajo (50%)
        return `
        <div style="width: 210mm; padding: 15mm 20mm; page-break-after: always;">
            <!-- TABLA COMPARATIVA (50% superior) -->
            <div style="margin-bottom: 15mm;">
                <div style="border-bottom: 4px solid ${COLORS.secondary}; padding-bottom: 8px; margin-bottom: 12px;">
                    <h2 style="color: ${COLORS.primary}; font-size: 20px; margin: 0;">COMPARATIVA POR ASESOR</h2>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 9px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <thead>
                        <tr>
                            <th rowspan="2" style="padding: 8px; background: ${COLORS.primary}; color: white; border: 1px solid #ddd; text-align: left; font-size: 9px;">
                                ASESOR
                            </th>
                            <th colspan="2" style="padding: 8px; background: ${COLORS.secondary}; color: white; border: 1px solid #ddd; text-align: center; font-size: 9px;">
                                ${mesNombre.toUpperCase()}
                            </th>
                            <th colspan="3" style="padding: 8px; background: ${COLORS.accent1}; color: white; border: 1px solid #ddd; text-align: center; font-size: 9px;">
                                HISTÓRICO GENERAL
                            </th>
                        </tr>
                        <tr>
                            <th style="padding: 6px; background: #fef3c7; color: #78350f; border: 1px solid #ddd; font-weight: bold; font-size: 8px;">Créditos</th>
                            <th style="padding: 6px; background: #fef3c7; color: #78350f; border: 1px solid #ddd; font-weight: bold; font-size: 8px;">Monto</th>
                            <th style="padding: 6px; background: #dbeafe; color: #1e3a8a; border: 1px solid #ddd; font-weight: bold; font-size: 8px;">Créditos</th>
                            <th style="padding: 6px; background: #dbeafe; color: #1e3a8a; border: 1px solid #ddd; font-weight: bold; font-size: 8px;">Monto</th>
                            <th style="padding: 6px; background: #fee2e2; color: #991b1b; border: 1px solid #ddd; font-weight: bold; font-size: 8px;">% Mora</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${estadisticas.map((e, idx) => {
                            const bgColor = idx % 2 === 0 ? '#f9fafb' : 'white';
                            const moraColor = e.porcentajeMora > 10 ? '#ef4444' : e.porcentajeMora > 5 ? '#f59e0b' : '#22c55e';
                            return `
                            <tr style="background: ${bgColor};">
                                <td style="padding: 6px; border: 1px solid #e5e7eb; font-weight: bold; color: ${COLORS.primary}; font-size: 9px;">
                                    ${e.asesor}
                                </td>
                                <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; background: #fffbeb; font-size: 9px;">
                                    ${e.cantidadMes}
                                </td>
                                <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: right; background: #fffbeb; font-weight: 600; font-size: 9px;">
                                    ${formatearMoneda(e.montoMes)}
                                </td>
                                <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; background: #eff6ff; font-size: 9px;">
                                    ${e.cantidadTotal}
                                </td>
                                <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: right; background: #eff6ff; font-weight: 600; font-size: 9px;">
                                    ${formatearMoneda(e.montoTotal)}
                                </td>
                                <td style="padding: 6px; border: 1px solid #e5e7eb; text-align: center; background: #fef2f2; font-size: 9px;">
                                    <span style="color: ${moraColor}; font-weight: bold;">
                                        ${e.porcentajeMora.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                        <tr style="background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent2}); color: white; font-weight: bold;">
                            <td style="padding: 8px; border: 1px solid #ddd; font-size: 9px;">TOTALES</td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 9px;">
                                ${estadisticas.reduce((sum, e) => sum + e.cantidadMes, 0)}
                            </td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-size: 9px;">
                                ${formatearMoneda(estadisticas.reduce((sum, e) => sum + e.montoMes, 0))}
                            </td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 9px;">
                                ${estadisticas.reduce((sum, e) => sum + e.cantidadTotal, 0)}
                            </td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-size: 9px;">
                                ${formatearMoneda(estadisticas.reduce((sum, e) => sum + e.montoTotal, 0))}
                            </td>
                            <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-size: 9px;">
                                ${((estadisticas.reduce((sum, e) => sum + (e.porcentajeMora * e.cantidadTotal), 0) / estadisticas.reduce((sum, e) => sum + e.cantidadTotal, 0)) || 0).toFixed(1)}%
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- GRÁFICO DE DISPERSIÓN (50% inferior) -->
            <div style="margin-top: 10mm;">
                <div style="border-bottom: 4px solid ${COLORS.secondary}; padding-bottom: 8px; margin-bottom: 12px;">
                    <h2 style="color: ${COLORS.primary}; font-size: 20px; margin: 0;">GRÁFICO DE COLOCACIÓN DIARIA</h2>
                </div>
                <div style="text-align: center;">
                    <img src="${graficoPNG}" style="width: 100%; max-width: 180mm; height: auto;" />
                </div>
            </div>
        </div>
        `;
    }

    // ===== GENERAR GRÁFICO DE DISPERSIÓN =====
    async function generarPaginaGrafico(datosGrafico, mesNombre) {
        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 700;
        canvas.style.cssText = 'position: fixed; left: -9999px;';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const asesores = Object.keys(datosGrafico.datosPorAsesor);
        const coloresAsesores = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

        // Datasets de puntos por asesor
        const datasets = asesores.map((asesor, idx) => {
            const puntosAsesor = [];
            datosGrafico.datosPorAsesor[asesor].forEach((cantidad, diaIdx) => {
                if (cantidad > 0) {
                    puntosAsesor.push({ x: diaIdx + 1, y: cantidad });
                }
            });
            
            return {
                label: asesor,
                data: puntosAsesor,
                backgroundColor: coloresAsesores[idx % coloresAsesores.length],
                borderColor: coloresAsesores[idx % coloresAsesores.length],
                pointRadius: 6,
                pointHoverRadius: 8,
                showLine: false
            };
        });

        // Dataset de línea total
        const puntosTotal = datosGrafico.totalesPorDia.map((cantidad, diaIdx) => ({
            x: diaIdx + 1,
            y: cantidad
        })).filter(p => p.y > 0);

        datasets.push({
            label: 'Total Diario',
            data: puntosTotal,
            borderColor: COLORS.primary,
            backgroundColor: COLORS.primary,
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: COLORS.primary,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            showLine: true,
            fill: false,
            tension: 0.3
        });

        new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Créditos Colocados por Día - ${mesNombre}`,
                        font: { size: 24, weight: 'bold' },
                        color: COLORS.primary,
                        padding: { top: 5, bottom: 20 }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { 
                            font: { size: 14 }, 
                            padding: 15,
                            usePointStyle: true
                        }
                    }
                },
                scales: {
                    x: {
                        title: { 
                            display: true, 
                            text: 'Día del Mes', 
                            font: { size: 16, weight: 'bold' },
                            color: COLORS.primary
                        },
                        min: 1,
                        max: datosGrafico.diasMes,
                        ticks: { 
                            font: { size: 12 },
                            stepSize: 2
                        },
                        grid: { color: '#f3f4f6' }
                    },
                    y: {
                        title: { 
                            display: true, 
                            text: 'Cantidad de Créditos', 
                            font: { size: 16, weight: 'bold' },
                            color: COLORS.primary
                        },
                        beginAtZero: true,
                        ticks: {
                            font: { size: 12 },
                            stepSize: 1
                        },
                        grid: { color: '#e5e7eb' }
                    }
                }
            }
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        const graficoImg = canvas.toDataURL('image/png');
        document.body.removeChild(canvas);

        return `
        <div style="width: 210mm; padding: 10mm 20mm 20mm 20mm; page-break-after: always;">
            <div style="border-bottom: 4px solid ${COLORS.accent1}; padding-bottom: 8px; margin-bottom: 15px;">
                <h2 style="color: ${COLORS.primary}; font-size: 20px; margin: 0;">GRÁFICO DE COLOCACIÓN DIARIA</h2>
            </div>
            <img src="${graficoImg}" style="width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
        </div>
        `;
    }

    // ===== PÁGINA POR ASESOR =====
    function generarPaginaAsesor(asesor, creditos) {
        creditos.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const totalCreditos = creditos.length;
        const montoTotal = creditos.reduce((sum, c) => sum + (parseFloat(c.monto_aprobado) || 0), 0);
        const montoPromedio = montoTotal / totalCreditos;
        const scorePromedio = creditos.reduce((sum, c) => sum + c.tupak_score, 0) / totalCreditos;
        const plazoPromedio = creditos.reduce((sum, c) => sum + c.plazo_numerico, 0) / totalCreditos;
        const retornoPromedio = creditos.reduce((sum, c) => sum + c.retorno_mensual, 0) / totalCreditos;

        let tablaCreditosHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-radius: 8px; overflow: hidden;">
            <thead>
                <tr style="background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent2}); color: white;">
                    <th style="padding: 8px; text-align: left; border: none; font-weight: 600;">Acta</th>
                    <th style="padding: 8px; text-align: left; border: none; font-weight: 600;">Socio</th>
                    <th style="padding: 8px; text-align: right; border: none; font-weight: 600;">Monto</th>
                    <th style="padding: 8px; text-align: center; border: none; font-weight: 600;">Int.</th>
                    <th style="padding: 8px; text-align: center; border: none; font-weight: 600;">Plazo</th>
                    <th style="padding: 8px; text-align: center; border: none; font-weight: 600;">Score</th>
                </tr>
            </thead>
            <tbody>
        `;

        creditos.forEach((c, idx) => {
            const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            const scoreColor = getScoreColor(c.tupak_score);
            const borderBottom = idx < creditos.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : '';
            tablaCreditosHTML += `
                <tr style="background: ${bgColor}; transition: all 0.2s;">
                    <td style="padding: 6px 8px; ${borderBottom} font-weight: 500; color: ${COLORS.primary};">${c.acta || 'N/A'}</td>
                    <td style="padding: 6px 8px; ${borderBottom}">${c.nombre_socio || 'N/A'}</td>
                    <td style="padding: 6px 8px; text-align: right; ${borderBottom} font-weight: 600; color: ${COLORS.accent2};">${formatearMoneda(parseFloat(c.monto_aprobado) || 0)}</td>
                    <td style="padding: 6px 8px; text-align: center; ${borderBottom}">${c.interes || c.tasa_interes || 'N/A'}%</td>
                    <td style="padding: 6px 8px; text-align: center; ${borderBottom}">${c.plazo || 'N/A'}</td>
                    <td style="padding: 6px 8px; text-align: center; ${borderBottom}">
                        <span style="background: ${scoreColor}; color: white; padding: 4px 10px; border-radius: 20px; font-weight: bold; display: inline-block; font-size: 11px;">
                            ${'★'.repeat(c.tupak_score)}
                        </span>
                    </td>
                </tr>
            `;
        });

        tablaCreditosHTML += '</tbody></table>';

        return `
        <div style="width: 210mm; padding: 20mm; page-break-after: always;">
            <!-- Header con gradiente -->
            <div style="background: linear-gradient(135deg, ${COLORS.secondary}, #f59e0b); padding: 20px; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 12px rgba(228, 132, 16, 0.3);">
                <h2 style="color: white; font-size: 24px; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">ASESOR: ${asesor.toUpperCase()}</h2>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${totalCreditos} crédito${totalCreditos !== 1 ? 's' : ''} • ${formatearMoneda(montoTotal)}</p>
            </div>

            <!-- Tabla de créditos modernizada -->
            ${tablaCreditosHTML}

            <!-- Dashboard con tarjetas modernas -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 20px;">
                <div style="background: linear-gradient(135deg, #e0e7ff, #c7d2fe); padding: 18px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                    <div style="font-size: 11px; color: #3730a3; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Total Créditos</div>
                    <div style="font-size: 24px; font-weight: bold; color: #312e81;">${totalCreditos}</div>
                </div>
                <div style="background: linear-gradient(135deg, #d1fae5, #a7f3d0); padding: 18px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                    <div style="font-size: 11px; color: #065f46; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Monto Total</div>
                    <div style="font-size: 20px; font-weight: bold; color: #064e3b;">${formatearMoneda(montoTotal)}</div>
                </div>
                <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 18px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                    <div style="font-size: 11px; color: #78350f; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Score Promedio</div>
                    <div style="font-size: 24px; font-weight: bold; color: #78350f;">
                        ${generarEstrellasHTML(scorePromedio)}
                    </div>
                    <div style="font-size: 12px; color: #92400e; margin-top: 4px;">${scorePromedio.toFixed(2)} / 5.00</div>
                </div>
                <div style="background: linear-gradient(135deg, #fecaca, #fca5a5); padding: 18px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                    <div style="font-size: 11px; color: #7f1d1d; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Monto Promedio</div>
                    <div style="font-size: 18px; font-weight: bold; color: #7f1d1d;">${formatearMoneda(montoPromedio)}</div>
                </div>
                <div style="background: linear-gradient(135deg, #e9d5ff, #d8b4fe); padding: 18px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                    <div style="font-size: 11px; color: #581c87; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Plazo Promedio</div>
                    <div style="font-size: 20px; font-weight: bold; color: #581c87;">${plazoPromedio.toFixed(1)} m</div>
                </div>
                <div style="background: linear-gradient(135deg, #cffafe, #a5f3fc); padding: 18px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                    <div style="font-size: 11px; color: #164e63; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Retorno Mensual</div>
                    <div style="font-size: 18px; font-weight: bold; color: #164e63;">${formatearMoneda(retornoPromedio)}</div>
                </div>
            </div>
        </div>
        `;
    }

    // ===== PÁGINA ESTADÍSTICAS =====
    function generarPaginaEstadisticas(creditos) {
        const distribucion = {
            5: creditos.filter(c => c.tupak_score === 5).length,
            4: creditos.filter(c => c.tupak_score === 4).length,
            3: creditos.filter(c => c.tupak_score === 3).length,
            2: creditos.filter(c => c.tupak_score === 2).length,
            1: creditos.filter(c => c.tupak_score === 1).length
        };

        const total = creditos.length;

        return `
        <div style="width: 210mm; padding: 20mm; page-break-after: always;">
            <div style="border-bottom: 4px solid ${COLORS.accent1}; padding-bottom: 15px; margin-bottom: 30px;">
                <h2 style="color: ${COLORS.primary}; font-size: 28px; margin: 0;">DISTRIBUCIÓN DE TUPAK SCORE</h2>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: ${COLORS.primary}; color: white;">
                        <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Calificación</th>
                        <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Cantidad</th>
                        <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Porcentaje</th>
                        <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Barra Visual</th>
                    </tr>
                </thead>
                <tbody>
                    ${[5, 4, 3, 2, 1].map(score => {
                        const cantidad = distribucion[score];
                        const porcentaje = ((cantidad / total) * 100).toFixed(1);
                        const barWidth = porcentaje;
                        const scoreColor = getScoreColor(score);
                        const scoreLabel = ['Muy Bajo', 'Bajo', 'Regular', 'Bueno', 'Excelente'][score - 1];
                        return `
                        <tr style="background: ${score % 2 === 0 ? '#f9fafb' : 'white'};">
                            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">${'●'.repeat(score)} ${scoreLabel} (${score})</td>
                            <td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">${cantidad}</td>
                            <td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">${porcentaje}%</td>
                            <td style="padding: 12px; border: 1px solid #e5e7eb;">
                                <div style="width: ${barWidth}%; height: 20px; background: ${scoreColor}; border-radius: 4px;"></div>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        `;
    }

    // ===== CONVERTIR HTML A PDF =====
    async function convertirAPDF(container) {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const pages = container.querySelectorAll('[style*="page-break-after"]');
        
        for (let i = 0; i < pages.length; i++) {
            if (i > 0) pdf.addPage();
            
            const canvas = await html2canvas(pages[i], {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
        }
        
        // Limpiar contenedor
        document.body.removeChild(container);
        
        // Guardar PDF
        const fecha = new Date().toISOString().split('T')[0];
        pdf.save(`Reporte_Cartera_TupakRantina_${fecha}.pdf`);
    }

    // ===== UTILIDADES =====
    function formatearMoneda(valor) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(valor);
    }

    function generarEstrellasHTML(score) {
        const parteEntera = Math.floor(score);
        const parteDecimal = score - parteEntera;
        
        // Crear canvas para dibujar estrellas
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 30;
        const ctx = canvas.getContext('2d');
        
        ctx.font = '24px Arial';
        ctx.textBaseline = 'top';
        
        const starWidth = 28;
        
        // Dibujar estrellas completas doradas
        ctx.fillStyle = '#fbbf24';
        for (let i = 0; i < parteEntera && i < 5; i++) {
            ctx.fillText('★', i * starWidth, 0);
        }
        
        // Dibujar estrella parcial
        if (parteEntera < 5 && parteDecimal >= 0.05) {
            const x = parteEntera * starWidth;
            
            // Estrella gris de fondo
            ctx.fillStyle = '#d1d5db';
            ctx.fillText('★', x, 0);
            
            // Parte dorada con clip
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, 0, starWidth * parteDecimal, 30);
            ctx.clip();
            ctx.fillStyle = '#fbbf24';
            ctx.fillText('★', x, 0);
            ctx.restore();
        }
        
        // Dibujar estrellas vacías grises
        ctx.fillStyle = '#d1d5db';
        const estrellasUsadas = parteEntera + (parteDecimal >= 0.05 ? 1 : 0);
        for (let i = estrellasUsadas; i < 5; i++) {
            ctx.fillText('☆', i * starWidth, 0);
        }
        
        const imgData = canvas.toDataURL('image/png');
        return `<img src="${imgData}" style="height: 24px; vertical-align: middle; display: inline-block;" />`;
    }

    function obtenerNombreMes(fecha) {
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return meses[fecha.getMonth()];
    }

    function getScoreColor(score) {
        const colors = {
            5: '#22c55e',  // Verde
            4: '#3b82f6',  // Azul
            3: '#f59e0b',  // Amarillo/Naranja
            2: '#f97316',  // Naranja
            1: '#ef4444'   // Rojo
        };
        return colors[score] || '#6b7280';
    }

    function mostrarLoading() {
        const loading = document.createElement('div');
        loading.id = 'pdf-loading';
        loading.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            background: rgba(0, 23, 73, 0.9); z-index: 9999; 
            display: flex; align-items: center; justify-content: center; 
            flex-direction: column; color: white;
        `;
        loading.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
            <div style="font-size: 24px; font-weight: bold;">Generando Reporte...</div>
            <div style="font-size: 16px; margin-top: 10px; opacity: 0.8;">Por favor espera</div>
        `;
        document.body.appendChild(loading);
    }

    function ocultarLoading() {
        const loading = document.getElementById('pdf-loading');
        if (loading) loading.remove();
    }

    // ===== EXPORTAR =====
    window.CarteraReportes = {
        generarReporteCartera: generarReporteCartera
    };

    console.log('✅ Módulo CarteraReportes cargado (HTML2Canvas version)');
})();

