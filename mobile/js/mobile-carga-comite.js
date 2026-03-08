// =====================================================
// MOBILE-CARGA_COMITE.JS - Versión móvil del módulo Cargar Comité
// Misma funcionalidad que la versión desktop
// =====================================================

let protectedPage = null;

let nombreAsesor = '';
let numeroAsesorWhatsapp = '';
let ultimoLinkDescarga = null;

// Funciones para gestionar el loading screen
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 300);
    }
    document.body.classList.add('loaded');
}

// Actualizar información del usuario en el header
function setupUserInfo(session) {
    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    
    if (nameEl && session.name) {
        // Mostrar solo el primer nombre en el header
        const firstName = session.name.split(' ')[0];
        nameEl.textContent = firstName;
    }
    
    if (roleEl && session.rol) {
        const roles = (session.rol || "").split(',').map(r => r.trim().toUpperCase());
        const filtered = roles.filter(r => r === 'ASESOR' || r === 'ADMIN').join(', ');
        roleEl.textContent = filtered;
    }
    
    // Actualizar nombre del asesor para los PDFs (nombre completo)
    if (session.name) {
        nombreAsesor = session.name.toUpperCase();
    }
}

// Inicializar nombre de asesor desde sesión
function inicializarAsesor() {
    hideLoadingScreen();
}

function handleSessionExpired() {
    showSessionExpiredScreen();
}

function showSessionExpiredScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div class="text-center">
                <i class="fas fa-user-lock" style="font-size: 3rem; color: var(--accent-color); margin-bottom: 1rem;"></i>
                <div class="loading-text" style="font-size: 1.2rem; font-weight: 600;">Sesión Expirada</div>
                <div class="loading-brand" style="margin-bottom: 1.5rem;">Su token de seguridad ha sido invalidado.</div>
                <button onclick="if (window.TupakAuth) { window.TupakAuth.logout(); } else { window.location.href='../login.html'; }" style="background: var(--accent-color); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 0.95rem;">
                    <i class="fas fa-sign-in-alt" style="margin-right: 8px;"></i>VOLVER AL INICIO
                </button>
            </div>
            <div class="loading-footer">
                <span>POWERED BY</span>
                <img src="../../shared/img/lpsolutionswithe.webp" alt="LP Solutions">
            </div>
        `;
        loadingScreen.style.display = 'flex';
        loadingScreen.classList.remove('fade-out');
    } else {
        window.location.href = '../login.html';
    }
}

// Función para formatear números a USD
function formatearUSD(numero) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(numero);
}

// Formatear fecha en español: "22 DE OCTUBRE DE 2025"
function fechaEnEspanol(fecha) {
    try {
        const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
        const d = fecha.getDate();
        const m = fecha.getMonth();
        const y = fecha.getFullYear();
        return `${d} DE ${meses[m]} DE ${y}`;
    } catch (e) {
        return new Date().toLocaleDateString();
    }
}

// Función mejorada para convertir número a texto en español
function numeroATexto(numero) {
    if (!numero || isNaN(numero)) return '';

    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    const veintes = ['VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];

    function convertirGrupo(n) {
        if (n === 0) return '';
        if (n === 100) return 'CIEN';

        let texto = '';
        const c = Math.floor(n / 100);
        const d = Math.floor((n % 100) / 10);
        const u = n % 10;

        if (c > 0) texto += centenas[c] + ' ';

        const dosDigitos = n % 100;

        if (dosDigitos >= 10 && dosDigitos < 20) {
            texto += especiales[dosDigitos - 10];
        } else if (dosDigitos >= 20 && dosDigitos < 30) {
            texto += veintes[dosDigitos - 20];
        } else {
            if (d > 0) texto += decenas[d];
            if (d > 2 && u > 0) texto += ' Y ';
            if (u > 0 && (d === 0 || d > 2)) texto += unidades[u];
        }

        return texto.trim();
    }

    const entero = Math.floor(numero);
    const decimales = Math.round((numero - entero) * 100);

    let texto = '';

    if (entero === 0) {
        if (decimales > 0) {
            let textoCentavos = convertirGrupo(decimales);
            if (decimales === 1) {
                return 'UN CENTAVO';
            } else {
                return textoCentavos + ' CENTAVOS';
            }
        } else {
            return 'CERO DÓLARES';
        }
    } else {
        const millones = Math.floor(entero / 1000000);
        const miles = Math.floor((entero % 1000000) / 1000);
        const cientos = entero % 1000;

        if (millones > 0) {
            if (millones === 1) {
                texto += 'UN MILLÓN ';
            } else {
                texto += convertirGrupo(millones) + ' MILLONES ';
            }
        }

        if (miles > 0) {
            if (miles === 1) {
                texto += 'MIL ';
            } else {
                texto += convertirGrupo(miles) + ' MIL ';
            }
        }

        if (cientos > 0) {
            texto += convertirGrupo(cientos);
        }

        texto = texto.trim();

        if (entero === 1) {
            texto += ' DÓLAR';
        } else {
            texto += ' DÓLARES';
        }

        if (decimales > 0) {
            let textoCentavos = convertirGrupo(decimales);
            if (decimales === 1) {
                texto += ' CON UN CENTAVO';
            } else {
                texto += ' CON ' + textoCentavos + ' CENTAVOS';
            }
        }
    }

    return texto;
}

// Función para convertir número de meses a texto
function plazoATexto(numero) {
    if (!numero || isNaN(numero) || numero <= 0) return '';

    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const veintes = ['VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    function convertirGrupo(n) {
        if (n === 0) return '';
        if (n === 100) return 'CIEN';

        let texto = '';
        const c = Math.floor(n / 100);
        const d = Math.floor((n % 100) / 10);
        const u = n % 10;

        if (c > 0) texto += centenas[c] + ' ';

        const dosDigitos = n % 100;

        if (dosDigitos >= 10 && dosDigitos < 20) {
            texto += especiales[dosDigitos - 10];
        } else if (dosDigitos >= 20 && dosDigitos < 30) {
            texto += veintes[dosDigitos - 20];
        } else {
            if (d > 0) texto += decenas[d];
            if (d > 2 && u > 0) texto += ' Y ';
            if (u > 0 && (d === 0 || d > 2)) texto += unidades[u];
        }

        return texto.trim();
    }

    let texto = '';

    if (numero >= 1000) {
        const miles = Math.floor(numero / 1000);
        const resto = numero % 1000;

        if (miles === 1) {
            texto += 'MIL';
        } else {
            texto += convertirGrupo(miles) + ' MIL';
        }

        if (resto > 0) {
            texto += ' ' + convertirGrupo(resto);
        }
    } else {
        texto = convertirGrupo(numero);
    }

    texto = texto.trim();

    return texto + (numero === 1 ? ' MES' : ' MESES');
}

// Función para generar ID del comité
function generarIDComite(nombreSocio, segundoNombre, nombreAsesor) {
    const rand1 = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const rand2 = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const rand3 = Math.floor(Math.random() * 100).toString().padStart(2, '0');

    const primerNombre = nombreSocio.trim().substring(0, 2).toUpperCase();
    const segundoNom = segundoNombre.trim().substring(0, 2).toUpperCase();
    const asesor = nombreAsesor.trim().substring(0, 2).toUpperCase();

    return `${primerNombre}${rand1}${segundoNom}${rand2}${asesor}${rand3}`;
}

// Calcular edad en años y meses con redondeo
function calcularEdad(dia, mes, anio) {
    const hoy = new Date();
    const fechaNac = new Date(anio, mes - 1, dia);

    let anios = hoy.getFullYear() - fechaNac.getFullYear();
    let meses = hoy.getMonth() - fechaNac.getMonth();
    let dias = hoy.getDate() - fechaNac.getDate();

    if (meses < 0) {
        anios--;
        meses += 12;
    }

    if (dias < 0) {
        meses--;
        if (meses < 0) {
            anios--;
            meses += 12;
        }
        const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        dias += mesAnterior.getDate();
    }

    if (dias >= 15) {
        meses++;
        if (meses >= 12) {
            anios++;
            meses = 0;
        }
    }

    let textoEdad = '';
    if (anios > 0) {
        textoEdad += `${anios} ${anios === 1 ? 'año' : 'años'}`;
    }
    if (meses > 0) {
        if (textoEdad !== '') textoEdad += ' ';
        textoEdad += `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    }

    return textoEdad || '0 meses';
}

// Auto-mayúsculas para campos de texto
document.querySelectorAll('input[type="text"]:not(#monto):not(#cedula)').forEach(input => {
    input.addEventListener('input', function (e) {
        this.value = this.value.toUpperCase();
    });
});

// Toast notification function (mobile version)
let toastTimeout = null;
let toastHideTimeout = null;

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastMessage) return;
    
    // Limpiar timeouts anteriores
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }
    if (toastHideTimeout) {
        clearTimeout(toastHideTimeout);
        toastHideTimeout = null;
    }
    
    // Reset inmediato del toast
    toast.classList.remove('show', 'toast-error', 'toast-success');
    
    // Pequeño delay para reiniciar la animación
    toastTimeout = setTimeout(() => {
        toastMessage.textContent = message;
        
        // Aplicar tipo
        if (type === 'error') {
            toast.classList.add('toast-error');
        } else if (type === 'success') {
            toast.classList.add('toast-success');
        }
        
        // Show toast
        toast.classList.add('show');
        
        // Vibrate on mobile if available
        if (navigator.vibrate) {
            navigator.vibrate(type === 'error' ? [50, 50, 50] : 30);
        }
        
        // Hide after 4 seconds
        toastHideTimeout = setTimeout(() => {
            toast.classList.remove('show');
            // Limpiar clases después de la transición
            setTimeout(() => {
                toast.classList.remove('toast-error', 'toast-success');
            }, 300);
        }, 4000);
    }, 100);
}

// Fetch cedula data from API (WEBHOOK REAL)
async function fetchCedulaData(cedula) {
    const nombreInput = document.getElementById('nombreCompleto');

    if (!/^\d{10}$/.test(cedula)) {
        return;
    }

    try {
        showToast('Buscando información de la cédula...', 'info');

        const data = window.APP_CONFIG?.fetchCedulaLookup
            ? await window.APP_CONFIG.fetchCedulaLookup(cedula)
            : await fetch('https://lpn8nwebhook.luispintasolutions.com/webhook/c460611e-8d0c-4a7b-bfcc-50b1e5858048', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ cedula })
            }).then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            });

        const result = Array.isArray(data) ? data[0] : null;

        if (result && result.encontrado && result.nombre) {
            nombreInput.value = result.nombre.toUpperCase();
            nombreInput.disabled = false;
            nombreInput.classList.remove('form-input-disabled');
            showToast('Nombre encontrado', 'success');
        } else {
            nombreInput.value = '';
            nombreInput.disabled = false;
            nombreInput.classList.remove('form-input-disabled');
            nombreInput.focus();
            showToast(result?.mensaje || 'Revise la cédula. Si no existe, ingrese manualmente.', 'error');
        }
    } catch (error) {
        console.error('Error fetching cedula:', error);
        nombreInput.value = '';
        nombreInput.disabled = false;
        nombreInput.classList.remove('form-input-disabled');
        nombreInput.focus();
        showToast('El servidor no responde. Ingrese manualmente.', 'error');
    }
}

// Add event listener to cedula field
const cedulaInput = document.getElementById('cedula');
cedulaInput.addEventListener('blur', function () {
    const cedula = this.value.trim();
    if (cedula) {
        fetchCedulaData(cedula);
    }
});

cedulaInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const cedula = this.value.trim();
        if (cedula) {
            fetchCedulaData(cedula);
        }
    }
});

// Validar nombre completo
const nombreCompletoInput = document.getElementById('nombreCompleto');
const nombreError = document.getElementById('nombreError');

nombreCompletoInput.addEventListener('blur', function (e) {
    const palabras = this.value.trim().split(/\s+/).filter(p => p.length > 0);
    if (palabras.length < 3) {
        nombreError.classList.remove('hidden');
        this.setCustomValidity('Debe ingresar al menos 3 palabras');
    } else {
        nombreError.classList.add('hidden');
        this.setCustomValidity('');
    }
});

nombreCompletoInput.addEventListener('input', function (e) {
    const palabras = this.value.trim().split(/\s+/).filter(p => p.length > 0);
    if (palabras.length >= 3) {
        nombreError.classList.add('hidden');
        this.setCustomValidity('');
    }
});

// Formatear monto (tipo caja registradora)
const montoInput = document.getElementById('monto');
const montoTexto = document.getElementById('montoTexto');
let valorMontoCentavos = 0;

montoInput.addEventListener('keydown', function (e) {
    const permitidas = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];

    if (!permitidas.includes(e.key) && (e.key < '0' || e.key > '9')) {
        e.preventDefault();
        return;
    }

    if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        valorMontoCentavos = (valorMontoCentavos * 10) + parseInt(e.key);
        actualizarMonto();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        valorMontoCentavos = Math.floor(valorMontoCentavos / 10);
        actualizarMonto();
    }
});

// Mobile: También manejar input event para teclados virtuales
montoInput.addEventListener('input', function (e) {
    // Obtener solo dígitos
    const soloDigitos = this.value.replace(/[^0-9]/g, '');
    valorMontoCentavos = parseInt(soloDigitos) || 0;
    actualizarMonto();
});

function actualizarMonto() {
    const numero = valorMontoCentavos / 100;
    montoInput.value = formatearUSD(numero).replace('$', '');

    if (numero > 0) {
        montoTexto.textContent = numeroATexto(numero);
    } else {
        montoTexto.textContent = '';
    }
    validateFormReady();
}

// Convertir plazo a texto
const plazoInput = document.getElementById('plazo');
const plazoTexto = document.getElementById('plazoTexto');

plazoInput.addEventListener('input', function (e) {
    const numero = parseInt(this.value);
    if (!isNaN(numero) && numero > 0) {
        plazoTexto.textContent = plazoATexto(numero);
    } else {
        plazoTexto.textContent = '';
    }
});

// Advertencia de plazo mayor a 12 meses al abandonar el campo
plazoInput.addEventListener('blur', function (e) {
    const numero = parseInt(this.value);
    if (!isNaN(numero) && numero > 12) {
        mostrarModalPlazo();
    }
});

// Convertir tasa/porcentaje a texto y cambiar tipo de crédito
const tasaInput = document.getElementById('tasa');
const tasaTexto = document.getElementById('tasaTexto');
const tipoCreditoSelect = document.getElementById('tipoCredito');

tasaInput.addEventListener('change', function (e) {
    const tasa = parseFloat(this.value);

    if (!isNaN(tasa) && tasa > 0) {
        let tipoCredito = '';
        if (tasa === 26 || tasa === 23) {
            tipoCredito = 'MICROCRÉDITO';
        } else if (tasa === 24) {
            tipoCredito = 'NUESTRAS RAÍCES';
        } else if (tasa === 19) {
            tipoCredito = 'CRÉDITO DE CONSUMO';
        }

        if (tipoCredito) {
            tipoCreditoSelect.value = tipoCredito;
        }

        const entero = Math.floor(tasa);
        const decimales = Math.round((tasa - entero) * 100);

        let texto = '';

        if (entero > 0) {
            const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
            const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
            const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
            const veintes = ['VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];

            if (entero < 10) {
                texto = unidades[entero];
            } else if (entero >= 10 && entero < 20) {
                texto = especiales[entero - 10];
            } else if (entero >= 20 && entero < 30) {
                texto = veintes[entero - 20];
            } else {
                const d = Math.floor(entero / 10);
                const u = entero % 10;
                texto = decenas[d];
                if (u > 0) {
                    texto += ' Y ' + unidades[u];
                }
            }
        }

        if (decimales > 0) {
            const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
            const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
            const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
            const veintes = ['VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];

            let textoDecimal = '';
            if (decimales < 10) {
                textoDecimal = 'CERO ' + unidades[decimales];
            } else if (decimales >= 10 && decimales < 20) {
                textoDecimal = especiales[decimales - 10];
            } else if (decimales >= 20 && decimales < 30) {
                textoDecimal = veintes[decimales - 20];
            } else {
                const d = Math.floor(decimales / 10);
                const u = decimales % 10;
                textoDecimal = decenas[d];
                if (u > 0) {
                    textoDecimal += ' Y ' + unidades[u];
                }
            }

            if (entero > 0) {
                texto += ' PUNTO ' + textoDecimal;
            } else {
                texto = 'CERO PUNTO ' + textoDecimal;
            }
        }

        texto += ' POR CIENTO';
        tasaTexto.textContent = texto;
        validateFormReady();
    } else {
        tasaTexto.textContent = '';
        tipoCreditoSelect.value = '';
        validateFormReady();
    }
});

// === MANEJO DE SUBIDA DE PDF ===
let pdfFileSelected = null;

const dropZone = document.getElementById('dropZone');
const pdfFileInput = document.getElementById('pdfFile');
const dropZoneContent = document.getElementById('dropZoneContent');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFile');

// Función para agregar metadatos al PDF
async function agregarMetadatosPDF(file, metadata) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const newPdf = await PDFLib.PDFDocument.create();
        const pages = await newPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        pages.forEach(p => newPdf.addPage(p));

        newPdf.setTitle(metadata.title || '');
        newPdf.setAuthor(metadata.author || '');
        newPdf.setSubject(metadata.subject || '');
        newPdf.setKeywords((metadata.keywords && metadata.keywords.length) ? [metadata.keywords] : []);
        newPdf.setProducer('Caja de Ahorro Tupak Rantina');
        newPdf.setCreator('');
        newPdf.setCreationDate(new Date());
        newPdf.setModificationDate(new Date());

        try {
            const escapeXml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
            const xmpTitle = escapeXml(metadata.title || '');
            const xmpAuthor = escapeXml(metadata.author || '');
            const xmpKeywords = escapeXml((metadata.keywords && metadata.keywords.length) ? metadata.keywords : metadata.subject || '');

            const xmp = `<?xpacket begin='﻿' id='W5M0MpCehiHzreSzNTczkc9d'?>\n<x:xmpmeta xmlns:x='adobe:ns:meta/'>\n  <rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>\n    <rdf:Description rdf:about='' xmlns:dc='http://purl.org/dc/elements/1.1/'>\n      <dc:title><rdf:Alt><rdf:li xml:lang='x-default'>${xmpTitle}</rdf:li></rdf:Alt></dc:title>\n      <dc:creator><rdf:Seq><rdf:li>${xmpAuthor}</rdf:li></rdf:Seq></dc:creator>\n    </rdf:Description>\n    <rdf:Description rdf:about='' xmlns:pdf='http://ns.adobe.com/pdf/1.3/'>\n      <pdf:Keywords>${xmpKeywords}</pdf:Keywords>\n    </rdf:Description>\n  </rdf:RDF>\n</x:xmpmeta>\n<?xpacket end='w'?>`;

            const metadataStream = newPdf.context.flateStream(xmp, { Type: PDFLib.PDFName.of('Metadata'), Subtype: PDFLib.PDFName.of('XML') });
            const metadataRef = newPdf.context.register(metadataStream);
            newPdf.catalog.set(PDFLib.PDFName.of('Metadata'), metadataRef);
        } catch (e) {
            console.warn('No se pudieron añadir metadatos XMP (no crítico):', e);
        }

        const pdfBytes = await newPdf.save({
            useObjectStreams: true,
            addDefaultPage: false,
            objectsPerTick: 50
        });

        const modifiedFile = new File([pdfBytes], file.name, { type: 'application/pdf' });

        console.log(`PDF procesado: Tamaño original: ${formatFileSize(file.size)}, Tamaño nuevo: ${formatFileSize(modifiedFile.size)}`);

        return modifiedFile;
    } catch (error) {
        console.error('Error al agregar metadatos:', error);
        return file;
    }
}

// Crear un PDF con portada
async function crearPDFConPortadaSinComprimir(file, coverData, metadata) {
    try {
        const coverDiv = document.createElement('div');
        coverDiv.style.width = '595px';
        coverDiv.style.height = '842px';
        coverDiv.style.position = 'absolute';
        coverDiv.style.left = '-9999px';
        coverDiv.style.top = '-9999px';
        coverDiv.style.padding = '0';
        coverDiv.style.margin = '0';
        coverDiv.style.boxSizing = 'border-box';
        coverDiv.style.fontFamily = 'Arial, sans-serif';
        coverDiv.innerHTML = `
            <div style="width:595px;height:842px;box-sizing:border-box;padding:12px;background:linear-gradient(135deg,#f8fafc 0%, #e2e8f0 100%);margin:0;">
                <div style="display:flex;gap:16px;align-items:center;padding-top:4px;">
                    <img src="../../shared/img/logo.webp" style="width:90px;height:auto;"/>
                    <div style="flex:1;">
                        <h1 style="margin:0;color:#001749;font-size:20px;font-weight:700;letter-spacing:1px;">CAJA DE AHORRO TUPAK RANTINA</h1>
                        <p style="margin:0;color:#3b82f6;font-size:13px;font-weight:600;">ASESORÍA DE CRÉDITOS</p>
                    </div>
                    <div style="text-align:right;min-width:140px;font-size:12px;color:#374151;">
                        <div>Fecha:</div>
                        <div>${fechaEnEspanol(new Date())}</div>
                    </div>
                </div>
                <div style="height:8px;background:linear-gradient(90deg,#001749 0%, #001749 50%, #e48410 50%);margin:18px 0 8px 0;border-radius:4px;"></div>
                <div style="background:#ffffff;border-radius:10px;padding:18px 22px;box-shadow:0 8px 20px rgba(0,0,0,0.12);width:100%;max-height:520px;overflow:auto;">
                    <h2 style="margin:0 0 6px 0;color:#0f172a;font-size:16px;font-weight:700;">Comité: <span style="color:#e48410;">${coverData.idComite}</span></h2>
                    <div style="padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.04);"><strong style="width:36%;display:inline-block;color:#6b7280;font-size:12px;">Asesor</strong><span style="color:#0f172a;font-weight:600;">${coverData.nombreAsesor}</span></div>
                    <div style="padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.04);"><strong style="width:36%;display:inline-block;color:#6b7280;font-size:12px;">Solicitante</strong><span style="color:#0f172a;font-weight:600;">${coverData.nombreCompleto}</span></div>
                    <div style="padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.04);"><strong style="width:36%;display:inline-block;color:#6b7280;font-size:12px;">Edad</strong><span style="color:#0f172a;font-weight:600;">${coverData.edad}</span></div>
                    <div style="padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.04);"><strong style="width:36%;display:inline-block;color:#6b7280;font-size:12px;">Monto</strong><span style="color:#0f172a;font-weight:600;">${coverData.monto}</span></div>
                    <div style="padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.04);"><strong style="width:36%;display:inline-block;color:#6b7280;font-size:12px;">Plazo</strong><span style="color:#0f172a;font-weight:600;">${coverData.plazo}</span></div>
                    <div style="padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.04);"><strong style="width:36%;display:inline-block;color:#6b7280;font-size:12px;">Interés</strong><span style="color:#0f172a;font-weight:600;">${coverData.interes}</span></div>
                    <div style="padding:10px 0;border-bottom:1px solid rgba(0,0,0,0.04);"><strong style="width:36%;display:inline-block;color:#6b7280;font-size:12px;">Tipo de crédito</strong><span style="color:#0f172a;font-weight:600;">${coverData.tipoCredito}</span></div>
                    <div style="padding:10px 0;"><strong style="width:36%;display:inline-block;color:#6b7280;font-size:12px;">Destino</strong><span style="color:#0f172a;font-weight:600;">${coverData.destino}</span></div>
                </div>
            </div>
        `;
        document.body.appendChild(coverDiv);
        const canvas = await html2canvas(coverDiv, { width: 595, height: 842, scale: 2, useCORS: true });
        document.body.removeChild(coverDiv);
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgArrayBuffer = await (await fetch(imgData)).arrayBuffer();

        const originalBytes = await file.arrayBuffer();
        const origPdf = await PDFLib.PDFDocument.load(originalBytes);
        const newPdf = await PDFLib.PDFDocument.create();

        let jpgImage;
        try {
            jpgImage = await newPdf.embedJpg(imgArrayBuffer);
        } catch (e) {
            jpgImage = await newPdf.embedPng(imgArrayBuffer);
        }

        const coverPage = newPdf.addPage([595, 842]);
        coverPage.drawImage(jpgImage, { x: 0, y: 0, width: 595, height: 842 });

        const copied = await newPdf.copyPages(origPdf, origPdf.getPageIndices());
        copied.forEach(p => newPdf.addPage(p));

        newPdf.setTitle(metadata.title || '');
        newPdf.setAuthor(metadata.author || '');
        newPdf.setSubject(metadata.subject || '');
        newPdf.setKeywords((metadata.keywords && metadata.keywords.length) ? [metadata.keywords] : []);
        newPdf.setProducer('Caja de Ahorro Tupak Rantina');
        newPdf.setCreator('');
        newPdf.setCreationDate(new Date());
        newPdf.setModificationDate(new Date());

        try {
            const escapeXml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
            const xmpTitle = escapeXml(metadata.title || '');
            const xmpAuthor = escapeXml(metadata.author || '');
            const xmpKeywords = escapeXml((metadata.keywords && metadata.keywords.length) ? metadata.keywords : metadata.subject || '');
            const xmp = `<?xpacket begin='﻿' id='W5M0MpCehiHzreSzNTczkc9d'?>\n<x:xmpmeta xmlns:x='adobe:ns:meta/'>\n  <rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>\n    <rdf:Description rdf:about='' xmlns:dc='http://purl.org/dc/elements/1.1/'>\n      <dc:title><rdf:Alt><rdf:li xml:lang='x-default'>${xmpTitle}</rdf:li></rdf:Alt></dc:title>\n      <dc:creator><rdf:Seq><rdf:li>${xmpAuthor}</rdf:li></rdf:Seq></dc:creator>\n    </rdf:Description>\n    <rdf:Description rdf:about='' xmlns:pdf='http://ns.adobe.com/pdf/1.3/'>\n      <pdf:Keywords>${xmpKeywords}</pdf:Keywords>\n    </rdf:Description>\n  </rdf:RDF>\n</x:xmpmeta>\n<?xpacket end='w'?>`;
            const metadataStream = newPdf.context.flateStream(xmp, { Type: PDFLib.PDFName.of('Metadata'), Subtype: PDFLib.PDFName.of('XML') });
            const metadataRef = newPdf.context.register(metadataStream);
            newPdf.catalog.set(PDFLib.PDFName.of('Metadata'), metadataRef);
        } catch (e) {
            // no crítico
        }

        const pdfBytes = await newPdf.save({ useObjectStreams: true });
        const outFile = new File([pdfBytes], file.name, { type: 'application/pdf' });
        return outFile;
    } catch (err) {
        try {
            return await agregarMetadatosPDF(file, metadata);
        } catch (e) {
            return file;
        }
    }
}

// Función para comprimir PDF
async function comprimirPDF(file, onProgress, coverData, skipAddCover = false) {
    try {
        console.log('Iniciando compresión de PDF...');

        if (onProgress) onProgress(5);

        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const arrayBuffer = await file.arrayBuffer();

        if (onProgress) onProgress(10);

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        if (onProgress) onProgress(15);

        const { jsPDF } = window.jspdf;

        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.src = '../../shared/img/logo.webp';
        await new Promise((resolve, reject) => {
            logoImg.onload = resolve;
            logoImg.onerror = reject;
        });

        if (onProgress) onProgress(20);

        const newPdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });
        let firstPageAdded = false;
        
        if (!skipAddCover && coverData) {
            firstPageAdded = true;
        }

        if (onProgress) onProgress(25);

        const totalPages = pdf.numPages;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);

            const realViewport = page.getViewport({ scale: 1 });
            const pageWidth = realViewport.width;
            const pageHeight = realViewport.height;

            const pageOrientation = pageWidth > pageHeight ? 'landscape' : 'portrait';

            const renderViewport = page.getViewport({ scale: 2.5 });

            const pageCanvas = document.createElement('canvas');
            const pageContext = pageCanvas.getContext('2d');
            pageCanvas.width = renderViewport.width;
            pageCanvas.height = renderViewport.height;

            try {
                await page.render({
                    canvasContext: pageContext,
                    viewport: renderViewport
                }).promise;
            } catch (renderError) {
                console.warn(`Error al renderizar página ${pageNum}:`, renderError);
                continue;
            }

            const imgData = pageCanvas.toDataURL('image/jpeg', 0.85);

            if (pageNum === 1 && skipAddCover) {
                newPdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
            } else {
                newPdf.addPage([pageWidth, pageHeight], pageOrientation);
                newPdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
            }

            if (onProgress) {
                const progress = 25 + Math.floor((pageNum / totalPages) * 70);
                onProgress(progress);
            }
        }

        if (onProgress) onProgress(95);

        try {
            if (coverData && typeof newPdf.setProperties === 'function') {
                newPdf.setProperties({
                    title: coverData.idComite || '',
                    author: coverData.nombreAsesor || ''
                });
            }
        } catch (e) {
            console.warn('No se pudo establecer propiedades en jsPDF:', e);
        }

        const pdfBlob = newPdf.output('blob');

        if (onProgress) onProgress(100);

        const compressedFile = new File([pdfBlob], file.name, { type: 'application/pdf' });

        const reduccion = ((file.size - compressedFile.size) / file.size * 100).toFixed(1);
        console.log(`Compresión exitosa: ${formatFileSize(file.size)} → ${formatFileSize(compressedFile.size)} (${reduccion}% reducción)`);

        return compressedFile;
    } catch (error) {
        console.error('Error al comprimir PDF:', error);
        return file;
    }
}

// Función para formatear tamaño de archivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Función para validar y mostrar archivo
async function handleFile(file) {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        showToast('Solo se permiten archivos PDF', 'error');
        return;
    }

    const originalSize = file.size;

    dropZoneContent.classList.add('hidden');
    fileInfo.classList.remove('hidden');
    fileName.textContent = file.name;
    fileSize.textContent = `Tamaño: ${formatFileSize(originalSize)}`;

    pdfFileSelected = file;

    validateFormReady();

    dropZone.classList.add('drop-zone-success');
    dropZone.classList.remove('drop-zone-active');
    
    // Haptic feedback
    if (navigator.vibrate) {
        navigator.vibrate(30);
    }
    
    showToast('PDF seleccionado', 'success');
}

// Click en la zona de drop
dropZone.addEventListener('click', function (e) {
    if (e.target !== removeFileBtn && !removeFileBtn.contains(e.target)) {
        pdfFileInput.click();
    }
});

// Cambio en el input file
pdfFileInput.addEventListener('change', function (e) {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// Drag over
dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drop-zone-active');
});

dropZone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (!pdfFileSelected) {
        dropZone.classList.remove('drop-zone-active');
    }
});

// Drop
dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drop-zone-active');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// Paste (Ctrl+V)
document.addEventListener('paste', function (e) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('application/pdf') !== -1 || items[i].kind === 'file') {
            const file = items[i].getAsFile();
            if (file && file.type === 'application/pdf') {
                e.preventDefault();
                handleFile(file);
                break;
            }
        }
    }
});

// Remover archivo
removeFileBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    pdfFileSelected = null;
    pdfFileInput.value = '';
    dropZoneContent.classList.remove('hidden');
    fileInfo.classList.add('hidden');
    dropZone.classList.remove('drop-zone-success', 'drop-zone-active');

    validateFormReady();
});

// ===== MODAL DE ADVERTENCIA DE PLAZO =====
let plazoAceptado = false;

function mostrarModalPlazo() {
    const modal = document.getElementById('plazoWarningModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Pequeño delay para la animación
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }
}

function ocultarModalPlazo() {
    const modal = document.getElementById('plazoWarningModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
}

// Botón modificar plazo
document.getElementById('btnModificarPlazo')?.addEventListener('click', function() {
    ocultarModalPlazo();
    const plazoInput = document.getElementById('plazo');
    if (plazoInput) {
        plazoInput.focus();
        plazoInput.select();
    }
});

// Botón continuar
document.getElementById('btnContinuarPlazo')?.addEventListener('click', function() {
    plazoAceptado = true;
    ocultarModalPlazo();
    // Enviar el formulario
    document.getElementById('comiteForm').dispatchEvent(new Event('submit'));
});

// Resetear plazoAceptado cuando cambia el plazo
document.getElementById('plazo')?.addEventListener('input', function() {
    plazoAceptado = false;
});

// Enviar formulario
document.getElementById('comiteForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const statusMessage = document.getElementById('statusMessage');
    
    // Verificar si el plazo es > 12 y no se ha aceptado la advertencia
    const plazoVal = parseInt(document.getElementById('plazo')?.value || '0');
    if (plazoVal > 12 && !plazoAceptado) {
        mostrarModalPlazo();
        return;
    }
    
    // Resetear link de descarga
    ultimoLinkDescarga = null;

    if (!isFormReady()) {
        console.warn('Formulario no listo — acción ignorada.');
        validateFormReady();
        return;
    }

    const nombreCompleto = document.getElementById('nombreCompleto').value.trim();
    const palabras = nombreCompleto.split(/\s+/).filter(p => p.length > 0);

    if (palabras.length < 3) {
        nombreError.classList.remove('hidden');
        document.getElementById('nombreCompleto').focus();
        return;
    }

    const primerNombre = palabras[0];
    const segundoNombre = palabras[1];

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Enviando...</span>';

    const cedula = document.getElementById('cedula').value.trim();
    const diaNacimiento = document.getElementById('diaNacimiento').value;
    const mesNacimiento = document.getElementById('mesNacimiento').value;
    const anioNacimiento = document.getElementById('anioNacimiento').value;
    const fechaNacimiento = `${diaNacimiento}/${mesNacimiento}/${anioNacimiento}`;
    const monto = parseFloat(document.getElementById('monto').value.replace(/,/g, ''));
    const plazo = parseInt(document.getElementById('plazo').value);
    const tasa = parseFloat(document.getElementById('tasa').value);
    const tipoCredito = document.getElementById('tipoCredito').value;
    const destino = document.getElementById('destino').value;

    const idComite = generarIDComite(primerNombre, segundoNombre, nombreAsesor);

    const edadTexto = calcularEdad(parseInt(diaNacimiento), parseInt(mesNacimiento), parseInt(anioNacimiento));

    const montoEnTexto = numeroATexto(monto);
    const plazoEnTexto = plazoATexto(plazo);
    const tasaEnTextoVal = tasaTexto.textContent || tasa + ' POR CIENTO';

    const webhookData = {
        IDCOMITE: idComite,
        NOMBRECOMPLETO: nombreCompleto,
        PRIMERNOMBRE: primerNombre,
        SEGUNDONOMBRE: segundoNombre,
        CEDULA: cedula,
        FECHA_NACIMIENTO: fechaNacimiento,
        MONTO: monto,
        MONTO_EN_TEXTO: montoEnTexto,
        PLAZO: plazo,
        PLAZO_EN_TEXTO: plazoEnTexto,
        TASA: tasa,
        TASA_EN_TEXTO: tasaEnTextoVal,
        TIPOCREDITO: tipoCredito,
        DESTINO: destino,
        NOMBREASESOR: nombreAsesor
    };

    console.log('Datos a enviar:', webhookData);

    let url = null;
    let pdfFileName = '';
    let pdfPath = '';
    const storageBucket = 'TUPAK_RANTINA';

    try {
        if (pdfFileSelected) {
            const safeNombreCompleto = nombreCompleto.replace(/\s+/g, '_').replace(/[^A-Z0-9_ÁÉÍÓÚÜÑáéíóúüñ]/gi, '');
            pdfFileName = `${idComite}_${safeNombreCompleto}_${monto}.pdf`;
            pdfPath = `/TUPAK_RANTINA/COMITES/${pdfFileName}`;

            console.log('Preparando subida de PDF:', { fileName: pdfFileName, path: pdfPath, originalSize: formatFileSize(pdfFileSelected.size) });

            const primerNombreMeta = primerNombre || '';
            const tercerNombreMeta = palabras.length >= 3 ? palabras[2] : '';
            let montoEnLetrasMeta = montoEnTexto || '';
            const idxCon = montoEnLetrasMeta.indexOf(' CON ');
            if (idxCon !== -1) montoEnLetrasMeta = montoEnLetrasMeta.substring(0, idxCon);
            montoEnLetrasMeta = montoEnLetrasMeta.trim().replace(/\s+/g, '_');
            const plazoMeta = `${plazo}_MESES`;
            const titleMeta = `${primerNombreMeta}_${tercerNombreMeta}/${montoEnLetrasMeta}/${plazoMeta}/${tasa}%`;

            const interesShort = `${tasa}%`;
            const coverData = {
                idComite,
                nombreAsesor,
                nombreCompleto,
                edad: edadTexto,
                monto: `${formatearUSD(monto)} (${montoEnTexto})`,
                plazo: `${plazo} (${plazoEnTexto})`,
                interes: `${tasa}% (${tasaEnTextoVal})`,
                interesShort,
                tipoCredito,
                destino
            };

            // Mostrar progreso
            const compressionProgress = document.getElementById('compressionProgress');
            const progressBar = document.getElementById('progressBar');
            if (compressionProgress) {
                compressionProgress.classList.remove('hidden');
                const label = compressionProgress.querySelector('span');
                if (label) label.textContent = 'Procesando PDF...';
            }
            if (progressBar) progressBar.style.width = '10%';

            // PASO 1: Crear PDF con portada y metadatos usando pdf-lib (sin compresión jsPDF)
            console.log('Creando PDF con portada y metadatos...');
            if (progressBar) progressBar.style.width = '30%';
            
            const pdfWithCover = await crearPDFConPortadaSinComprimir(pdfFileSelected, coverData, {
                title: titleMeta,
                author: nombreAsesor || '',
                subject: `${tasa}%`,
                keywords: `${tasa}%`
            });
            
            if (progressBar) progressBar.style.width = '60%';
            console.log('PDF con portada creado, tamaño:', formatFileSize(pdfWithCover.size));

            // PASO 2: Asegurar metadatos están correctos
            let pdfConMetadatos = await agregarMetadatosPDF(pdfWithCover, {
                title: titleMeta,
                author: nombreAsesor || '',
                subject: interesShort,
                keywords: interesShort
            });

            if (progressBar) progressBar.style.width = '80%';
            console.log('PDF con metadatos listo, tamaño:', formatFileSize(pdfConMetadatos.size));

            // ========== AUTO-DESCARGA LOCAL DEL PDF ==========
            const nombreDescarga = `${nombreCompleto.replace(/\s+/g, '_')}_${monto}.pdf`;
            const blobUrl = URL.createObjectURL(pdfConMetadatos);
            const linkDescarga = document.createElement('a');
            linkDescarga.href = blobUrl;
            linkDescarga.download = nombreDescarga;
            document.body.appendChild(linkDescarga);
            linkDescarga.click();
            document.body.removeChild(linkDescarga);
            URL.revokeObjectURL(blobUrl);
            console.log('PDF descargado localmente como:', nombreDescarga);

            const formData = new FormData();
            formData.append('file', pdfConMetadatos, pdfFileName);
            formData.append('filename', pdfFileName);

            console.log('FormData preparado con archivo:', pdfFileName);
            if (progressBar) progressBar.style.width = '90%';

            if (compressionProgress) {
                const label = compressionProgress.querySelector('span');
                if (label) label.textContent = 'Subiendo archivo...';
            }

            // ========== WEBHOOK REAL DE SUBIDA DE ARCHIVO ==========
            const uploadUrl = window.APP_CONFIG?.WEBHOOKS?.FILE_UPLOAD || 'https://lpn8nwebhook.luispintasolutions.com/webhook/cfec9893-74d7-4eb3-aa7d-d9f09a7441';
            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });

            const uploadText = await uploadResponse.text();
            console.log('Upload response status:', uploadResponse.status, 'body:', uploadText);

            if (!uploadResponse.ok) {
                if (compressionProgress) compressionProgress.classList.add('hidden');
                throw new Error('Error al subir PDF: ' + uploadText);
            }

            let uploadJson = null;
            try {
                uploadJson = JSON.parse(uploadText);
            } catch (e) {
                console.warn('Respuesta upload no es JSON:', uploadText);
            }

            console.log('Upload JSON parseado:', uploadJson);

            if (uploadJson && uploadJson.link) {
                url = uploadJson.link;
                if (url.endsWith('/') || !url.includes(pdfFileName)) {
                    url = url.endsWith('/') ? url + pdfFileName : url + '/' + pdfFileName;
                }
            } else if (typeof uploadText === 'string' && uploadText.startsWith('http')) {
                url = uploadText.trim();
            }

            if (compressionProgress) compressionProgress.classList.add('hidden');
            if (progressBar) progressBar.style.width = '100%';

            if (!url) {
                throw new Error('No se recibió url desde el upload webhook. Body: ' + uploadText);
            }
            
            console.log('URL final del documento:', url);

            webhookData.DOCUMENTO_URL = url;
            webhookData.DOCUMENTO_PATH = pdfPath;
        }

        const session = typeof TupakAuth !== 'undefined' && typeof TupakAuth.getSession === 'function'
            ? TupakAuth.getSession()
            : JSON.parse(localStorage.getItem('appSession') || 'null');
        const asesorCedula = String(session?.cedula || '').trim();
        const asesorCorreo = String(session?.email || session?.correo || session?.mail || '').trim();
        const asesorWhatsapp = String(session?.whatsapp || '').trim();
        const asesorToken = String(session?.token || '').trim();
        const detallesCredito = `Socio: ${nombreCompleto}, Monto: ${monto}, Plazo: ${plazo} meses, Tasa: ${tasa}%, Destino: ${destino}`;
        const enlaceComite = `https://comite.tupakrantina.com/comite/${idComite}`;
        const comiteDataUrl = window.APP_CONFIG?.WEBHOOKS?.COMITE_DATA || 'https://lpn8nwebhook.luispintasolutions.com/webhook/comites_insert';

        if (asesorCedula) {
            webhookData.CEDULA_ASESOR = asesorCedula;
        }

        if (asesorCorreo) {
            webhookData.CORREO_ASESOR = asesorCorreo;
        }

        if (asesorWhatsapp) {
            webhookData.WHATSAPP_ASESOR = asesorWhatsapp;
        }

        webhookData.ENLACE_COMITE = enlaceComite;

        const fechaEnvio = new Date().toISOString();
        const socioWhatsapp = '';
        const observaciones = '';
        const estadoCarpeta = 'presentada';
        const respuestaInicial = 'pendiente';

        webhookData.SOCIO_EDAD_TEXTO = edadTexto;
        webhookData.SOCIO_WHATSAPP = socioWhatsapp;
        webhookData.STORAGE_BUCKET = storageBucket;
        webhookData.ARCHIVO_NOMBRE = pdfFileName;
        webhookData.ESTADO_CARPETA = estadoCarpeta;
        webhookData.OBSERVACIONES = observaciones;

        const carpetaInsert = {
            id_comite: idComite,
            socio_cedula: cedula,
            socio_nombre_completo: nombreCompleto,
            socio_primer_nombre: primerNombre,
            socio_segundo_nombre: segundoNombre,
            socio_fecha_nacimiento_texto: fechaNacimiento,
            socio_whatsapp: socioWhatsapp,
            socio_edad_texto: edadTexto,
            monto,
            monto_en_texto: montoEnTexto,
            plazo_meses: plazo,
            plazo_en_texto: plazoEnTexto,
            tasa,
            tasa_en_texto: tasaEnTextoVal,
            tipo_credito: tipoCredito,
            destino,
            nombre_asesor: nombreAsesor,
            correo_asesor: asesorCorreo,
            documento_url: url || '',
            documento_path: pdfPath || '',
            storage_bucket: storageBucket,
            archivo_nombre: pdfFileName || '',
            enlace_comite: enlaceComite,
            estado_carpeta: estadoCarpeta,
            observaciones,
            metadata: {
                fechaEnvio,
                asesorNombre: nombreAsesor,
                asesorCedula,
                asesorCorreo,
                detallesCredito,
                enlaceComite,
                storageBucket,
                archivoNombre: pdfFileName || '',
                documentoPath: pdfPath || '',
                origen: 'mobile-web'
            },
            payload_original: webhookData
        };

        const respuestaComiteInicial = {
            id_comite: idComite,
            socio_id: cedula,
            whatsapp: socioWhatsapp,
            token: '',
            respuesta: respuestaInicial,
            motivo: 'Carpeta presentada desde la aplicacion movil.',
            respondido_por: 'sistema-web',
            metadata: {
                fechaEnvio,
                origen: 'mobile-web'
            }
        };

        const datosCompletos = {
            cedula: asesorCedula,
            correo: asesorCorreo,
            whatsapp_asesor: asesorWhatsapp,
            carpeta: carpetaInsert,
            respuesta_comite_inicial: respuestaComiteInicial,
            comite: webhookData,
            metadata: {
                fechaEnvio,
                asesorNombre: nombreAsesor,
                asesorCedula,
                asesorCorreo,
                asesorWhatsapp,
                detallesCredito,
                enlaceComite,
                storageBucket,
                archivoNombre: pdfFileName || '',
                documentoPath: pdfPath || '',
                estadoCarpeta,
                observaciones,
                socioWhatsapp,
                socioEdadTexto: edadTexto,
                origen: 'mobile-web'
            }
        };

        const comiteResponse = await fetch(comiteDataUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'Authorization': asesorToken
            },
            body: JSON.stringify(datosCompletos)
        });
        const comiteResponseText = await comiteResponse.text();

        if (!comiteResponse.ok) {
            throw new Error(`Webhook comite respondio ${comiteResponse.status}: ${comiteResponseText || 'sin detalle'}`);
        }

        try {
            console.log('Respuesta webhook comite:', JSON.parse(comiteResponseText));
        } catch (e) {
            console.log('Respuesta webhook comite:', comiteResponseText || 'OK');
        }

        showToast('Comité enviado correctamente', 'success');

        // Éxito - Guardar link para descarga
        ultimoLinkDescarga = url;
        
        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate([50, 30, 50]);
        }
        
        statusMessage.classList.remove('hidden');
        const statusContent = statusMessage.querySelector('.status-content');
        statusContent.className = 'status-content status-success';
        
        // Mostrar mensaje de éxito con botón de descarga
        let successHtml = '<i class="fas fa-check-circle"></i> ¡Enviado! ID: ' + idComite;
        if (url) {
            successHtml += `<br><a href="${url}" target="_blank" class="download-btn">
                <i class="fas fa-download"></i> Descargar
            </a>`;
        }
        statusMessage.querySelector('p').innerHTML = successHtml;

        // Limpiar formulario
        document.getElementById('comiteForm').reset();
        montoTexto.textContent = '';
        plazoTexto.textContent = '';
        tasaTexto.textContent = '';
        valorMontoCentavos = 0;

        pdfFileSelected = null;
        pdfFileInput.value = '';
        dropZoneContent.classList.remove('hidden');
        fileInfo.classList.add('hidden');
        dropZone.classList.remove('drop-zone-success', 'drop-zone-active');
    } catch (error) {
        statusMessage.classList.remove('hidden');
        const statusContent = statusMessage.querySelector('.status-content');
        statusContent.className = 'status-content status-error';
        statusMessage.querySelector('p').innerHTML = '<i class="fas fa-exclamation-circle"></i> Error: ' + error.message;
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i><span>Enviar al Comité</span>';

        // Solo ocultar automáticamente si fue error
        if (!ultimoLinkDescarga) {
            setTimeout(() => {
                statusMessage.classList.add('hidden');
            }, 5000);
        }
    }
});

// --- Validación general de formulario ---
function isFormReady() {
    const nombreCompleto = document.getElementById('nombreCompleto').value.trim();
    const palabras = nombreCompleto.split(/\s+/).filter(p => p.length > 0);
    if (palabras.length < 3) return false;

    const cedula = document.getElementById('cedula').value.trim();
    if (!cedula) return false;

    const diaVal = document.getElementById('diaNacimiento').value;
    const mesVal = document.getElementById('mesNacimiento').value;
    const anioVal = document.getElementById('anioNacimiento').value;
    if (!diaVal || !mesVal || !anioVal) return false;

    const montoVal = parseFloat(document.getElementById('monto').value.replace(/,/g, ''));
    if (isNaN(montoVal) || montoVal <= 0) return false;

    const plazoVal = parseInt(document.getElementById('plazo').value);
    if (isNaN(plazoVal) || plazoVal <= 0) return false;

    const tasaVal = document.getElementById('tasa').value;
    if (!tasaVal) return false;

    const tipoCreditoVal = document.getElementById('tipoCredito').value;
    if (!tipoCreditoVal) return false;

    const destinoVal = document.getElementById('destino').value;
    if (!destinoVal) return false;

    if (!pdfFileSelected) return false;

    return true;
}

function validateFormReady() {
    const submitBtn = document.getElementById('submitBtn');
    if (!submitBtn) return;

    if (isFormReady()) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('submit-btn-disabled');
    } else {
        submitBtn.disabled = true;
        submitBtn.classList.add('submit-btn-disabled');
    }
}

// Inicializar selectores de fecha de nacimiento
function inicializarFechaNacimiento() {
    const diaSelect = document.getElementById('diaNacimiento');
    const mesSelect = document.getElementById('mesNacimiento');
    const anioSelect = document.getElementById('anioNacimiento');

    for (let i = 1; i <= 31; i++) {
        const option = document.createElement('option');
        option.value = i.toString().padStart(2, '0');
        option.textContent = i.toString().padStart(2, '0');
        diaSelect.appendChild(option);
    }

    const anioMaximo = 2008;
    const anioMinimo = 1924;

    for (let i = anioMaximo; i >= anioMinimo; i--) {
        const option = document.createElement('option');
        option.value = i.toString();
        option.textContent = i.toString();
        anioSelect.appendChild(option);
    }
}

inicializarFechaNacimiento();

// Attach listeners para campos de texto
['nombreCompleto', 'cedula', 'monto', 'plazo'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', validateFormReady);
});

// Attach listeners para selectores
['diaNacimiento', 'mesNacimiento', 'anioNacimiento', 'tasa', 'tipoCredito', 'destino'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', validateFormReady);
});

validateFormReady();

// Inicializar
async function initCargacomiteOnce() {
    if (window.__cargacomiteInitDone) return;

    if (typeof TupakAuth === 'undefined' || typeof TupakAuth.initializeProtectedPage !== 'function') {
        window.location.href = '../login.html';
        return;
    }

    protectedPage = TupakAuth.initializeProtectedPage({
        redirectOnFailure: false,
        onSession: setupUserInfo,
        onInvalid: handleSessionExpired
    });

    const isReady = await protectedPage.start();
    if (!isReady) {
        return;
    }

    window.__cargacomiteInitDone = true;
    console.log('DOM cargado (móvil), inicializando...');
    inicializarAsesor();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCargacomiteOnce);
} else {
    initCargacomiteOnce();
}

