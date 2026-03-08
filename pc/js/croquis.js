/**
 * CROQUIS DE UBICACIÓN - JavaScript
 * Generador de mapas para carpeta de crédito
 * Versión PC
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
    // Mostrar loading brevemente
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
        }
        document.body.classList.add('loaded');
        
        // Cargar datos del usuario
        loadUserData();
        updatePrintDate();
    }, 800);

    // Enter key para cargar mapa
    const mapUrlInput = document.getElementById('mapUrl');
    if (mapUrlInput) {
        mapUrlInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loadMap();
            }
        });
    }
});

/**
 * Cargar datos del usuario desde la sesión
 */
function loadUserData() {
    try {
        const sessionData = localStorage.getItem('appSession');
        
        if (sessionData) {
            const session = JSON.parse(sessionData);
            const userName = session.name || session.nombre || 'Asesor';
            
            // Header
            const nameEl = document.getElementById('user-name');
            const avatarEl = document.getElementById('user-avatar');
            const roleEl = document.getElementById('user-role');

            if (nameEl) nameEl.textContent = userName;
            if (avatarEl) avatarEl.textContent = userName.charAt(0).toUpperCase();

            if (roleEl && session.rol) {
                const roles = (session.rol || "").split(',').map(r => r.trim().toUpperCase());
                const filtered = roles.filter(r => r === 'ASESOR' || r === 'ADMIN').join(', ');
                roleEl.textContent = filtered;
            }
            
            // Impresión
            const printAsesorNameEl = document.getElementById('printAsesorName');
            if (printAsesorNameEl) printAsesorNameEl.textContent = userName.toUpperCase();
        } else {
            const nameEl = document.getElementById('user-name');
            const avatarEl = document.getElementById('user-avatar');
            const printAsesorNameEl = document.getElementById('printAsesorName');

            if (nameEl) nameEl.textContent = 'Usuario';
            if (avatarEl) avatarEl.textContent = 'U';
            if (printAsesorNameEl) printAsesorNameEl.textContent = 'ASESOR';
        }
        
        checkFormComplete();
    } catch (error) {
        console.error('Error cargando usuario:', error);
        const nameEl = document.getElementById('user-name');
        const avatarEl = document.getElementById('user-avatar');
        const printAsesorNameEl = document.getElementById('printAsesorName');

        if (nameEl) nameEl.textContent = 'Usuario';
        if (avatarEl) avatarEl.textContent = 'U';
        if (printAsesorNameEl) printAsesorNameEl.textContent = 'ASESOR';
    }
}

/**
 * Actualizar fecha de impresión
 */
function updatePrintDate() {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('printDate').textContent = formattedDate;
}

/**
 * Navegar hacia atrás
 */
function goBack() {
    // Intentar ir a documentación primero, si no, al index
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
        descripcionInput.placeholder = 'Ingrese el nombre del negocio';
        labelCasa.style.color = '#666';
        labelNegocio.style.color = '#015cd0';
    } else {
        descripcionLabel.textContent = 'Descripción';
        descripcionIcon.className = 'fas fa-info-circle';
        descripcionInput.placeholder = 'Ej: Color, número de pisos, acabado, techo, etc.';
        labelCasa.style.color = '#015cd0';
        labelNegocio.style.color = '#666';
    }
    
    descripcionInput.value = '';
    checkFormComplete();
}

/**
 * Actualizar nombre del socio
 */
function updateSocioName() {
    const socioNameInput = document.getElementById('socioName');
    const printSocioName = document.getElementById('printSocioName');
    
    if (socioNameInput && printSocioName) {
        const nombre = socioNameInput.value.trim();
        printSocioName.textContent = nombre || '';
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
        socioNameError.style.display = 'block';
        socioNameInput.style.borderColor = '#e48410';
        return false;
    } else {
        socioNameError.style.display = 'none';
        socioNameInput.style.borderColor = '#e0e0e0';
        return true;
    }
}

/**
 * Verificar si el formulario está completo
 */
function checkFormComplete() {
    const socioName = document.getElementById('socioName').value.trim();
    const mapUrl = document.getElementById('mapUrl').value.trim();
    const descripcion = document.getElementById('descripcionInput').value.trim();
    const referencia = document.getElementById('referenciaInput').value.trim();
    const printBtn = document.getElementById('printBtn');
    const userName = document.getElementById('user-name').textContent;
    const mapUrlSection = document.getElementById('mapUrlSection');
    const mapContainer = document.getElementById('mapContainer');
    
    const words = socioName.split(/\s+/).filter(word => word.length > 0);
    const hasValidName = words.length >= 3;
    const prevFieldsComplete = socioName && hasValidName && descripcion && referencia;
    
    if (prevFieldsComplete) {
        mapUrlSection.style.display = 'block';
        mapUrlSection.classList.add('visible');
    } else {
        mapUrlSection.style.display = 'none';
        mapUrlSection.classList.remove('visible');
    }
    
    const mapLoaded = mapContainer.classList.contains('visible') && currentLat !== null && currentLng !== null;
    const isComplete = socioName && hasValidName && mapUrl && descripcion && referencia && userName !== 'cargando...' && mapLoaded;
    
    if (isComplete) {
        printBtn.disabled = false;
        printBtn.style.opacity = '1';
        printBtn.style.cursor = 'pointer';
    } else {
        printBtn.disabled = true;
        printBtn.style.opacity = '0.5';
        printBtn.style.cursor = 'not-allowed';
    }
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
        showToast('No se pudieron extraer las coordenadas. Verifica el formato.', 'error');
        return;
    }

    if (coords.lat < -90 || coords.lat > 90 || coords.lng < -180 || coords.lng > 180) {
        showToast('Coordenadas inválidas. Latitud: -90 a 90, Longitud: -180 a 180.', 'error');
        return;
    }

    currentLat = coords.lat;
    currentLng = coords.lng;
    currentZoom = defaultZoom;

    const mapContainer = document.getElementById('mapContainer');
    mapContainer.style.display = 'block';
    mapContainer.classList.add('visible');

    updateMapFrame();
    generateQRCode();

    setTimeout(() => {
        mapContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    setTimeout(() => {
        checkFormComplete();
        showToast('Mapa generado correctamente', 'success');
    }, 800);
}

/**
 * Actualizar iframe del mapa
 */
function updateMapFrame() {
    const mapFrame = document.getElementById('map');
    mapFrame.src = `https://www.google.com/maps?q=${currentLat},${currentLng}&output=embed&t=k&z=${currentZoom}`;
    
    mapFrame.style.opacity = '0.5';
    setTimeout(() => {
        mapFrame.style.opacity = '1';
    }, 300);

    document.getElementById('coordsDisplay').textContent = `Coordenadas: ${currentLat}, ${currentLng} | Zoom: ${currentZoom}`;
    document.getElementById('printCoords').textContent = `${currentLat}, ${currentLng}`;
}

/**
 * Controles de zoom
 */
function zoomIn() {
    if (currentZoom < maxZoom) {
        currentZoom++;
        updateMapFrame();
    } else {
        showToast('Ya estás en el nivel máximo de zoom (21)', 'info');
    }
}

function zoomOut() {
    if (currentZoom > minZoom) {
        currentZoom--;
        updateMapFrame();
    } else {
        showToast('Ya estás en el nivel mínimo de zoom (10)', 'info');
    }
}

function resetZoom() {
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
        document.getElementById('qrCodeImage').src = qrApiUrl;
    }
}

/**
 * Validar antes de imprimir
 */
function validateBeforePrint() {
    const socioName = document.getElementById('socioName').value.trim();
    const mapUrl = document.getElementById('mapUrl').value.trim();
    const descripcion = document.getElementById('descripcionInput').value.trim();
    const referencia = document.getElementById('referenciaInput').value.trim();
    const tipoUbicacion = document.getElementById('tipoUbicacion').checked;

    if (!socioName) {
        showToast('Por favor ingrese el nombre completo del socio', 'warning');
        return false;
    }

    const words = socioName.split(/\s+/).filter(word => word.length > 0);
    if (words.length < 3) {
        showToast('El nombre del socio debe tener al menos 3 palabras', 'warning');
        return false;
    }

    if (!descripcion) {
        const tipo = tipoUbicacion ? 'el nombre del negocio' : 'la descripción';
        showToast(`Por favor ingrese ${tipo}`, 'warning');
        return false;
    }

    if (!referencia) {
        showToast('Por favor ingrese la referencia de la ubicación', 'warning');
        return false;
    }

    if (!mapUrl || !currentLat || !currentLng) {
        showToast('Por favor genere el mapa antes de imprimir', 'warning');
        return false;
    }

    // Actualizar info de impresión
    updatePrintInfo();
    return true;
}

/**
 * Actualizar información de impresión
 */
function updatePrintInfo() {
    const tipoUbicacion = document.getElementById('tipoUbicacion').checked;
    const descripcion = document.getElementById('descripcionInput').value.trim();
    const referencia = document.getElementById('referenciaInput').value.trim();
    const socioName = document.getElementById('socioName').value.trim();
    
    document.getElementById('printTipoUbicacion').textContent = tipoUbicacion ? 'Negocio' : 'Casa';
    
    const printDescripcionLabel = document.getElementById('printDescripcionLabel');
    const printDescripcionValue = document.getElementById('printDescripcionValue');
    
    printDescripcionLabel.textContent = tipoUbicacion ? 'Nombre del negocio:' : 'Descripción:';
    printDescripcionValue.textContent = descripcion || 'N/A';
    
    document.getElementById('printReferencia').textContent = referencia || 'N/A';
    
    const printHeaderTitle = document.getElementById('printHeaderTitle');
    if (socioName) {
        if (tipoUbicacion && descripcion) {
            printHeaderTitle.textContent = `UBICACIÓN DE "${descripcion}"`;
        } else {
            printHeaderTitle.textContent = `UBICACIÓN DE LA VIVIENDA DE ${socioName}`;
        }
    }
    
    updatePrintDate();
    generateQRCode();
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
        <div class="toast-icon"><i class="fas ${icon}"></i></div>
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Evento antes de imprimir
window.addEventListener('beforeprint', function() {
    updatePrintDate();
    updatePrintInfo();
});
