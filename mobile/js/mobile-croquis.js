/**
 * MOBILE CROQUIS - JavaScript
 * Generador de mapas para carpeta de crédito
 * Versión Móvil con html2pdf.js
 */

// Variables globales
let currentLat = null;
let currentLng = null;
let currentZoom = 18;
const defaultZoom = 18;
const minZoom = 10;
const maxZoom = 21;

/**
 * Inicialización
 */
document.addEventListener('DOMContentLoaded', function() {
    initPage();
});

/**
 * Inicializar página
 */
function initPage() {
    // Verificar sesión
    const sessionData = localStorage.getItem('appSession');
    if (!sessionData) {
        window.location.href = '../login.html';
        return;
    }

    // Parsear sesión y mostrar usuario
    try {
        const session = JSON.parse(sessionData);
        updateUserDisplay(session);
    } catch (e) {
        console.error('Error parsing session:', e);
    }

    // Mostrar body
    document.body.classList.add('loaded');

    // Ocultar loading
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
        }
    }, 400);

    // Enter key para cargar mapa
    const mapUrlInput = document.getElementById('mapUrl');
    if (mapUrlInput) {
        mapUrlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loadMap();
            }
        });
    }
}

/**
 * Actualizar display del usuario
 */
function updateUserDisplay(session) {
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    
    if (nameEl && session.name) {
        const firstName = session.name.split(' ')[0];
        nameEl.textContent = firstName;
    }
    
    if (roleEl && session.rol) {
        const roles = (session.rol || "").split(',').map(r => r.trim().toUpperCase());
        const filtered = roles.filter(r => r === 'ASESOR' || r === 'ADMIN').join(', ');
        roleEl.textContent = filtered;
    }
}

/**
 * Navegar hacia atrás
 */
function goBack() {
    if (document.referrer.includes('documentacion')) {
        window.history.back();
    } else {
        window.location.href = 'documentacion.html';
    }
}

/**
 * Toggle tipo de ubicación (Casa/Negocio)
 */
function toggleTipoUbicacion() {
    const checkbox = document.getElementById('tipoUbicacion');
    const descripcionLabel = document.getElementById('descripcionLabel');
    const descripcionIcon = document.getElementById('descripcionIcon');
    const descripcionInput = document.getElementById('descripcionInput');
    const labelCasa = document.getElementById('labelCasa');
    const labelNegocio = document.getElementById('labelNegocio');
    
    if (checkbox.checked) {
        descripcionLabel.textContent = 'Nombre del Negocio';
        descripcionIcon.className = 'fas fa-store-alt';
        descripcionInput.placeholder = 'Nombre del negocio';
        labelCasa.classList.remove('active');
        labelNegocio.classList.add('active');
    } else {
        descripcionLabel.textContent = 'Descripción';
        descripcionIcon.className = 'fas fa-info-circle';
        descripcionInput.placeholder = 'Ej: Color, pisos, acabado, techo...';
        labelCasa.classList.add('active');
        labelNegocio.classList.remove('active');
    }
    
    descripcionInput.value = '';
    checkFormComplete();
}

/**
 * Actualizar nombre del socio
 */
function updateSocioName() {
    const socioNameInput = document.getElementById('socioName');
    const previewSocio = document.getElementById('previewSocio');
    
    if (socioNameInput && previewSocio) {
        previewSocio.textContent = socioNameInput.value.trim() || '-';
    }
}

/**
 * Validar nombre del socio (mínimo 3 palabras)
 */
function validateSocioName() {
    const socioNameInput = document.getElementById('socioName');
    const socioNameError = document.getElementById('socioNameError');
    const name = socioNameInput.value.trim();
    const words = name.split(/\s+/).filter(word => word.length > 0);
    
    if (name && words.length < 3) {
        socioNameError.style.display = 'flex';
        socioNameInput.style.borderColor = '#e48410';
        return false;
    } else {
        socioNameError.style.display = 'none';
        socioNameInput.style.borderColor = '#e5e7eb';
        return true;
    }
}

/**
 * Verificar si el formulario está completo
 */
function checkFormComplete() {
    const socioName = document.getElementById('socioName').value.trim();
    const descripcion = document.getElementById('descripcionInput').value.trim();
    const referencia = document.getElementById('referenciaInput').value.trim();
    const mapUrlSection = document.getElementById('mapUrlSection');
    
    const words = socioName.split(/\s+/).filter(word => word.length > 0);
    const hasValidName = words.length >= 3;
    const prevFieldsComplete = socioName && hasValidName && descripcion && referencia;
    
    // Mostrar sección de mapa si campos previos completos
    if (prevFieldsComplete) {
        mapUrlSection.style.display = 'block';
    } else {
        mapUrlSection.style.display = 'none';
    }
    
    // Actualizar preview
    updatePreview();
}

/**
 * Actualizar vista previa
 */
function updatePreview() {
    const tipoUbicacion = document.getElementById('tipoUbicacion').checked;
    const descripcion = document.getElementById('descripcionInput').value.trim();
    const referencia = document.getElementById('referenciaInput').value.trim();
    const socioName = document.getElementById('socioName').value.trim();
    
    document.getElementById('previewSocio').textContent = socioName || '-';
    document.getElementById('previewTipo').textContent = tipoUbicacion ? 'Negocio' : 'Casa';
    document.getElementById('previewDescLabel').textContent = tipoUbicacion ? 'Nombre:' : 'Descripción:';
    document.getElementById('previewDesc').textContent = descripcion || '-';
    document.getElementById('previewRef').textContent = referencia || '-';
}

/**
 * Extraer coordenadas de diferentes formatos
 */
function extractCoordinates(input) {
    input = input.trim();
    
    // Coordenadas directas: -0.5145441,-78.5706978
    const directPattern = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/;
    const directMatch = input.match(directPattern);
    if (directMatch) {
        return { lat: parseFloat(directMatch[1]), lng: parseFloat(directMatch[2]) };
    }

    // URL de Google Maps: ?q=lat,lng
    const urlPattern = /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const urlMatch = input.match(urlPattern);
    if (urlMatch) {
        return { lat: parseFloat(urlMatch[1]), lng: parseFloat(urlMatch[2]) };
    }

    // URL con @: @lat,lng,zoom
    const atPattern = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const atMatch = input.match(atPattern);
    if (atMatch) {
        return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    }

    return null;
}

/**
 * Cargar mapa con coordenadas
 */
function loadMap() {
    const urlInput = document.getElementById('mapUrl').value;
    const coords = extractCoordinates(urlInput);

    if (!coords) {
        showToast('No se pudieron extraer las coordenadas', 'error');
        return;
    }

    if (coords.lat < -90 || coords.lat > 90 || coords.lng < -180 || coords.lng > 180) {
        showToast('Coordenadas inválidas', 'error');
        return;
    }

    currentLat = coords.lat;
    currentLng = coords.lng;
    currentZoom = defaultZoom;

    // Mostrar contenedor del mapa
    const mapContainer = document.getElementById('mapContainer');
    mapContainer.style.display = 'block';

    // Actualizar mapa iframe (solo para vista previa)
    updateMapFrame();
    
    // Generar QR
    generateQRCode();
    
    // Mostrar preview y botón de descargar
    document.getElementById('printPreview').style.display = 'block';
    document.getElementById('printBtn').style.display = 'flex';
    document.getElementById('printNote').style.display = 'flex';
    
    // Actualizar preview
    updatePreview();
    document.getElementById('previewCoords').textContent = `${currentLat}, ${currentLng}`;

    // Scroll al mapa
    setTimeout(() => {
        mapContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    // Feedback háptico
    if ('vibrate' in navigator) {
        navigator.vibrate(50);
    }
    
    showToast('Mapa generado correctamente', 'success');
}

/**
 * Actualizar iframe del mapa (solo vista previa)
 */
function updateMapFrame() {
    const mapFrame = document.getElementById('map');
    mapFrame.src = `https://www.google.com/maps?q=${currentLat},${currentLng}&output=embed&t=k&z=${currentZoom}`;
    
    mapFrame.style.opacity = '0.5';
    setTimeout(() => {
        mapFrame.style.opacity = '1';
    }, 300);

    document.getElementById('coordsDisplay').innerHTML = `
        <i class="fas fa-crosshairs"></i>
        ${currentLat}, ${currentLng} | Zoom: ${currentZoom}
    `;
    
    document.getElementById('previewCoords').textContent = `${currentLat}, ${currentLng}`;
}

/**
 * Controles de zoom
 */
function zoomIn() {
    if (currentLat === null) {
        showToast('Primero genera el mapa', 'warning');
        return;
    }
    if (currentZoom < maxZoom) {
        currentZoom++;
        updateMapFrame();
        if ('vibrate' in navigator) navigator.vibrate(30);
    } else {
        showToast('Zoom máximo alcanzado', 'info');
    }
}

function zoomOut() {
    if (currentLat === null) {
        showToast('Primero genera el mapa', 'warning');
        return;
    }
    if (currentZoom > minZoom) {
        currentZoom--;
        updateMapFrame();
        if ('vibrate' in navigator) navigator.vibrate(30);
    } else {
        showToast('Zoom mínimo alcanzado', 'info');
    }
}

function resetZoom() {
    if (currentLat === null) {
        showToast('Primero genera el mapa', 'warning');
        return;
    }
    currentZoom = defaultZoom;
    updateMapFrame();
    showToast('Zoom restablecido', 'info');
}

/**
 * Generar código QR
 */
function generateQRCode() {
    if (currentLat && currentLng) {
        const mapsUrl = `https://www.google.com/maps?q=${currentLat},${currentLng}`;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mapsUrl)}`;
        
        // QR para preview móvil
        const qrImg = document.getElementById('qrCodeImage');
        if (qrImg) {
            qrImg.src = qrApiUrl;
        }
        
        // QR para PDF
        const pdfQr = document.getElementById('pdfQrCode');
        if (pdfQr) {
            pdfQr.src = qrApiUrl;
        }
    }
}

/**
 * Esperar a que una imagen cargue y retornar como base64
 */
function loadImageAsBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataURL = canvas.toDataURL('image/png');
                resolve(dataURL);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
    });
}

/**
 * Convertir lat/lng a tile x/y de OSM
 */
function latLngToTile(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
}

/**
 * Generar imagen del mapa usando Google Static Maps API
 */
async function generateMapImage(lat, lng, zoom, width, height) {
    return new Promise(async (resolve) => {
        try {
            // API Key de Google Static Maps
            const apiKey = 'AIzaSyDWIY87ZEffjEbSOrkf1cVxJBc8hl_1IzM';
            
            // Ajustar tamaño máximo permitido por Google (640x640 sin premium)
            const mapWidth = Math.min(width, 640);
            const mapHeight = Math.min(height, 640);
            
            // URL de Google Static Maps con vista satelital y marcador
            const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
                `center=${lat},${lng}` +
                `&zoom=${zoom}` +
                `&size=${mapWidth}x${mapHeight}` +
                `&maptype=hybrid` +  // hybrid = satelital con calles
                `&markers=color:red%7Csize:mid%7C${lat},${lng}` +
                `&key=${apiKey}`;
            
            // Cargar imagen del mapa
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = function() {
                try {
                    // Crear canvas del tamaño deseado
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    
                    // Fondo por si la imagen es más pequeña
                    ctx.fillStyle = '#e8f4f8';
                    ctx.fillRect(0, 0, width, height);
                    
                    // Calcular posición para centrar
                    const drawX = (width - img.naturalWidth) / 2;
                    const drawY = (height - img.naturalHeight) / 2;
                    
                    // Dibujar mapa escalado para llenar el canvas
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Borde del mapa
                    ctx.strokeStyle = '#001749';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(2, 2, width - 4, height - 4);
                    
                    // Esquinas decorativas naranjas
                    const cornerSize = 25;
                    ctx.strokeStyle = '#e48410';
                    ctx.lineWidth = 4;
                    
                    // Esquina superior izquierda
                    ctx.beginPath();
                    ctx.moveTo(10, 10 + cornerSize);
                    ctx.lineTo(10, 10);
                    ctx.lineTo(10 + cornerSize, 10);
                    ctx.stroke();
                    
                    // Esquina superior derecha
                    ctx.beginPath();
                    ctx.moveTo(width - 10 - cornerSize, 10);
                    ctx.lineTo(width - 10, 10);
                    ctx.lineTo(width - 10, 10 + cornerSize);
                    ctx.stroke();
                    
                    // Esquina inferior izquierda
                    ctx.beginPath();
                    ctx.moveTo(10, height - 10 - cornerSize);
                    ctx.lineTo(10, height - 10);
                    ctx.lineTo(10 + cornerSize, height - 10);
                    ctx.stroke();
                    
                    // Esquina inferior derecha
                    ctx.beginPath();
                    ctx.moveTo(width - 10 - cornerSize, height - 10);
                    ctx.lineTo(width - 10, height - 10);
                    ctx.lineTo(width - 10, height - 10 - cornerSize);
                    ctx.stroke();
                    
                    // Coordenadas en el mapa (parte inferior)
                    ctx.fillStyle = 'rgba(0, 23, 73, 0.85)';
                    const coordsBoxWidth = 220;
                    const coordsBoxHeight = 28;
                    ctx.fillRect((width - coordsBoxWidth) / 2, height - coordsBoxHeight - 15, coordsBoxWidth, coordsBoxHeight);
                    
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 13px Courier New';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${lat}, ${lng}`, width / 2, height - 23);
                    
                    resolve(canvas.toDataURL('image/jpeg', 0.92));
                } catch (e) {
                    console.error('Error procesando imagen:', e);
                    resolve(null);
                }
            };
            
            img.onerror = function() {
                console.error('Error cargando mapa de Google');
                resolve(null);
            };
            
            img.src = staticMapUrl;
            
        } catch (e) {
            console.error('Error generando mapa:', e);
            resolve(null);
        }
    });
}

/**
 * Manejar descarga de PDF con jsPDF puro
 */
async function handleDownloadPDF() {
    // Validar campos
    const socioName = document.getElementById('socioName').value.trim();
    const descripcion = document.getElementById('descripcionInput').value.trim();
    const referencia = document.getElementById('referenciaInput').value.trim();
    const tipoUbicacion = document.getElementById('tipoUbicacion').checked;
    
    if (!socioName || !descripcion || !referencia || !currentLat) {
        showToast('Completa todos los campos primero', 'warning');
        return;
    }
    
    const words = socioName.split(/\s+/).filter(word => word.length > 0);
    if (words.length < 3) {
        showToast('El nombre debe tener al menos 3 palabras', 'warning');
        return;
    }
    
    // Feedback háptico
    if ('vibrate' in navigator) {
        navigator.vibrate(100);
    }
    
    // Crear overlay de loading
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'pdfLoadingOverlay';
    loadingOverlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,23,73,0.95); z-index: 10000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;';
    loadingOverlay.innerHTML = `
        <div style="width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid #e48410; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <p style="color: white; font-size: 16px; font-weight: 600; margin: 0;">Generando PDF...</p>
        <p style="color: rgba(255,255,255,0.7); font-size: 12px; margin: 0;">Esto puede tardar unos segundos</p>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(loadingOverlay);
    
    try {
        const { jsPDF } = window.jspdf;
        
        // Crear PDF tamaño carta
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'letter'
        });
        
        // Dimensiones de la página (letter = 215.9 x 279.4 mm)
        const pageWidth = 215.9;
        const pageHeight = 279.4;
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);
        
        // Colores
        const colorAzul = [0, 23, 73];     // #001749
        const colorNaranja = [228, 132, 16]; // #e48410
        const colorAzulClaro = [1, 92, 208]; // #015cd0
        
        // Obtener datos de sesión
        let asesorName = 'ASESOR';
        const sessionData = localStorage.getItem('appSession');
        if (sessionData) {
            const session = JSON.parse(sessionData);
            asesorName = (session.name || session.nombre || 'ASESOR').toUpperCase();
        }
        
        // Fecha formateada
        const now = new Date();
        const formattedDate = now.toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        });
        
        // Título del documento
        const docTitle = tipoUbicacion && descripcion 
            ? `UBICACIÓN DE "${descripcion}"` 
            : 'UBICACIÓN DE LA VIVIENDA';
        
        let y = margin;
        
        // ========== HEADER ==========
        
        // Cargar logo
        try {
            const logoUrl = '../../shared/img/logo.webp';
            const logoBase64 = await loadImageAsBase64(logoUrl);
            doc.addImage(logoBase64, 'PNG', margin, y, 25, 25);
        } catch (e) {
            console.log('No se pudo cargar el logo');
        }
        
        // Título principal
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colorAzul);
        doc.text('CAJA DE AHORRO Y CRÉDITO TUPAK RANTINA', pageWidth / 2, y + 8, { align: 'center' });
        
        // Subtítulo con fondo azul
        const subtitleY = y + 14;
        doc.setFillColor(...colorAzul);
        const subtitleWidth = doc.getTextWidth(docTitle) + 10;
        doc.roundedRect((pageWidth - subtitleWidth) / 2, subtitleY, subtitleWidth, 7, 1, 1, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(docTitle, pageWidth / 2, subtitleY + 5, { align: 'center' });
        
        // QR Code
        try {
            const mapsUrl = `https://www.google.com/maps?q=${currentLat},${currentLng}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mapsUrl)}`;
            const qrBase64 = await loadImageAsBase64(qrUrl);
            doc.addImage(qrBase64, 'PNG', pageWidth - margin - 22, y, 22, 22);
            
            doc.setFontSize(6);
            doc.setTextColor(100, 100, 100);
            doc.text('Escanea el QR', pageWidth - margin - 11, y + 25, { align: 'center' });
        } catch (e) {
            console.log('No se pudo cargar el QR');
        }
        
        // Línea naranja del header
        y += 32;
        doc.setDrawColor(...colorNaranja);
        doc.setLineWidth(1.5);
        doc.line(margin, y, pageWidth - margin, y);
        
        // ========== ÁREA DEL MAPA ==========
        y += 8;
        const mapHeight = 120;
        const mapWidthPx = 700;
        const mapHeightPx = 400;
        
        // Intentar generar mapa real con tiles de OSM
        try {
            const mapZoom = 17; // Zoom para el mapa del PDF
            const mapBase64 = await generateMapImage(currentLat, currentLng, mapZoom, mapWidthPx, mapHeightPx);
            
            if (mapBase64) {
                // Agregar el mapa real al PDF
                doc.addImage(mapBase64, 'JPEG', margin, y, contentWidth, mapHeight);
            } else {
                throw new Error('No se pudo generar el mapa');
            }
        } catch (mapError) {
            console.log('Error con mapa real, usando placeholder:', mapError);
            
            // Fallback: Placeholder si falla el mapa
            doc.setFillColor(232, 244, 248);
            doc.setDrawColor(...colorAzul);
            doc.setLineWidth(1);
            doc.roundedRect(margin, y, contentWidth, mapHeight, 3, 3, 'FD');
            
            // Marcador de ubicación (pin rojo)
            const pinX = pageWidth / 2;
            const pinY = y + 35;
            
            doc.setFillColor(220, 38, 38);
            doc.circle(pinX, pinY, 12, 'F');
            doc.setFillColor(255, 255, 255);
            doc.circle(pinX, pinY, 5, 'F');
            
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...colorAzul);
            doc.text('UBICACIÓN GEOGRÁFICA', pageWidth / 2, pinY + 25, { align: 'center' });
            
            // Coordenadas
            const coordsY = pinY + 35;
            const coordsText = `${currentLat}, ${currentLng}`;
            const coordsWidth = doc.getTextWidth(coordsText) + 20;
            
            doc.setFillColor(...colorAzul);
            doc.roundedRect((pageWidth - coordsWidth) / 2, coordsY, coordsWidth, 10, 2, 2, 'F');
            
            doc.setFontSize(11);
            doc.setFont('courier', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text(coordsText, pageWidth / 2, coordsY + 7, { align: 'center' });
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(75, 85, 99);
            doc.text('Escanea el código QR para ver en Google Maps', pageWidth / 2, coordsY + 18, { align: 'center' });
            
            // Esquinas decorativas
            doc.setDrawColor(...colorNaranja);
            doc.setLineWidth(1);
            doc.line(margin + 5, y + 5, margin + 5, y + 15);
            doc.line(margin + 5, y + 5, margin + 15, y + 5);
            doc.line(pageWidth - margin - 5, y + 5, pageWidth - margin - 5, y + 15);
            doc.line(pageWidth - margin - 5, y + 5, pageWidth - margin - 15, y + 5);
            doc.line(margin + 5, y + mapHeight - 5, margin + 5, y + mapHeight - 15);
            doc.line(margin + 5, y + mapHeight - 5, margin + 15, y + mapHeight - 5);
            doc.line(pageWidth - margin - 5, y + mapHeight - 5, pageWidth - margin - 5, y + mapHeight - 15);
            doc.line(pageWidth - margin - 5, y + mapHeight - 5, pageWidth - margin - 15, y + mapHeight - 5);
        }
        
        // ========== SECCIÓN DE INFORMACIÓN Y FIRMAS ==========
        y += mapHeight + 8;
        
        const boxHeight = 55;
        const col1Width = contentWidth * 0.45;
        const col2Width = contentWidth * 0.275;
        const col3Width = contentWidth * 0.275;
        
        // ---- COLUMNA 1: INFORMACIÓN ----
        let boxX = margin;
        doc.setDrawColor(...colorAzul);
        doc.setLineWidth(0.5);
        doc.rect(boxX, y, col1Width, boxHeight);
        
        // Título de la columna
        doc.setFillColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colorAzul);
        doc.text('INFORMACIÓN Y OBSERVACIONES', boxX + col1Width / 2, y + 6, { align: 'center' });
        
        // Línea bajo título
        doc.setLineWidth(0.5);
        doc.line(boxX + 3, y + 9, boxX + col1Width - 3, y + 9);
        
        // Información
        let infoY = y + 15;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        
        // Tipo
        doc.setTextColor(...colorAzul);
        doc.setFont('helvetica', 'bold');
        doc.text('Tipo:', boxX + 4, infoY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colorAzulClaro);
        doc.text(tipoUbicacion ? 'Negocio' : 'Casa', boxX + 18, infoY);
        
        // Descripción
        infoY += 5;
        doc.setTextColor(...colorAzul);
        doc.setFont('helvetica', 'bold');
        doc.text(tipoUbicacion ? 'Nombre:' : 'Descripción:', boxX + 4, infoY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colorAzulClaro);
        const descLines = doc.splitTextToSize(descripcion, col1Width - 35);
        doc.text(descLines[0] || '', boxX + 28, infoY);
        
        // Referencia
        infoY += 5;
        doc.setTextColor(...colorAzul);
        doc.setFont('helvetica', 'bold');
        doc.text('Referencia:', boxX + 4, infoY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colorAzulClaro);
        const refLines = doc.splitTextToSize(referencia, col1Width - 30);
        doc.text(refLines[0] || '', boxX + 26, infoY);
        
        // Coordenadas
        infoY += 5;
        doc.setTextColor(...colorAzul);
        doc.setFont('helvetica', 'bold');
        doc.text('Coordenadas:', boxX + 4, infoY);
        doc.setFont('courier', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...colorAzulClaro);
        doc.text(`${currentLat}, ${currentLng}`, boxX + 28, infoY);
        
        // Fecha
        infoY += 5;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colorAzul);
        doc.text('Fecha:', boxX + 4, infoY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colorAzulClaro);
        doc.text(formattedDate, boxX + 17, infoY);
        
        // Observaciones
        infoY += 6;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colorAzul);
        doc.text('Observaciones:', boxX + 4, infoY);
        
        // Cuadro para observaciones
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.rect(boxX + 3, infoY + 2, col1Width - 6, 12);
        
        // ---- COLUMNA 2: ASESOR ----
        boxX = margin + col1Width;
        doc.setDrawColor(...colorAzul);
        doc.setLineWidth(0.5);
        doc.rect(boxX, y, col2Width, boxHeight);
        
        // Título
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colorAzul);
        doc.text('ELABORADO POR', boxX + col2Width / 2, y + 6, { align: 'center' });
        
        // Línea bajo título
        doc.line(boxX + 3, y + 9, boxX + col2Width - 3, y + 9);
        
        // Nombre del asesor en recuadro gris
        doc.setFillColor(248, 249, 250);
        doc.setDrawColor(224, 224, 224);
        doc.roundedRect(boxX + 3, y + 12, col2Width - 6, 10, 1, 1, 'FD');
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colorAzul);
        const asesorLines = doc.splitTextToSize(asesorName, col2Width - 10);
        doc.text(asesorLines[0] || asesorName, boxX + col2Width / 2, y + 18, { align: 'center' });
        
        // Línea de firma
        doc.setDrawColor(...colorAzul);
        doc.setLineWidth(0.5);
        doc.line(boxX + 5, y + boxHeight - 8, boxX + col2Width - 5, y + boxHeight - 8);
        
        // Texto firma
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Firma del Asesor', boxX + col2Width / 2, y + boxHeight - 4, { align: 'center' });
        
        // ---- COLUMNA 3: SOCIO ----
        boxX = margin + col1Width + col2Width;
        doc.setDrawColor(...colorAzul);
        doc.setLineWidth(0.5);
        doc.rect(boxX, y, col3Width, boxHeight);
        
        // Título
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colorAzul);
        doc.text('SOCIO SOLICITANTE', boxX + col3Width / 2, y + 6, { align: 'center' });
        
        // Línea bajo título
        doc.line(boxX + 3, y + 9, boxX + col3Width - 3, y + 9);
        
        // Nombre del socio en recuadro gris
        doc.setFillColor(248, 249, 250);
        doc.setDrawColor(224, 224, 224);
        doc.roundedRect(boxX + 3, y + 12, col3Width - 6, 10, 1, 1, 'FD');
        
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colorAzul);
        const socioLines = doc.splitTextToSize(socioName, col3Width - 10);
        doc.text(socioLines[0] || socioName, boxX + col3Width / 2, y + 18, { align: 'center' });
        
        // Línea de firma
        doc.setDrawColor(...colorAzul);
        doc.setLineWidth(0.5);
        doc.line(boxX + 5, y + boxHeight - 8, boxX + col3Width - 5, y + boxHeight - 8);
        
        // Texto firma
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Firma del Socio', boxX + col3Width / 2, y + boxHeight - 4, { align: 'center' });
        
        // ========== GUARDAR PDF ==========
        const fileName = `Croquis_${socioName.replace(/\s+/g, '_').substring(0, 25)}.pdf`;
        doc.save(fileName);
        
        // Remover overlay
        const overlay = document.getElementById('pdfLoadingOverlay');
        if (overlay) overlay.remove();
        
        showToast('PDF descargado correctamente', 'success');
        
        // Feedback háptico de éxito
        if ('vibrate' in navigator) {
            navigator.vibrate([50, 50, 100]);
        }
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        
        // Remover overlay
        const overlay = document.getElementById('pdfLoadingOverlay');
        if (overlay) overlay.remove();
        
        showToast('Error al generar el PDF: ' + error.message, 'error');
    }
}

/**
 * Mostrar notificación toast
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icon}"></i>
        </div>
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Hacer funciones globales para onclick
window.goBack = goBack;
window.toggleTipoUbicacion = toggleTipoUbicacion;
window.updateSocioName = updateSocioName;
window.validateSocioName = validateSocioName;
window.checkFormComplete = checkFormComplete;
window.loadMap = loadMap;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.resetZoom = resetZoom;
window.handleDownloadPDF = handleDownloadPDF;

