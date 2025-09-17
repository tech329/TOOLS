// Función para validar campos requeridos y marcar errores
function validateRequiredFields() {
    const fields = [
        { id: 'nombre', label: 'Nombre Completo' },
        { id: 'cedula', label: 'Número de Cédula' },
        { id: 'whatsapp', label: 'Número de WhatsApp' }
    ];

    let hasErrors = false;
    let firstEmptyField = null;

    // Limpiar errores previos
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        element.classList.remove('field-error');
        // Limpiar mensajes de error específicos
        hideFieldError(field.id);
    });

    // Validar cada campo
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        const value = element.value.trim();

        if (!value) {
            element.classList.add('field-error');
            hasErrors = true;
            if (!firstEmptyField) {
                firstEmptyField = element;
            }
        } else {
            // Validaciones específicas
            if (field.id === 'nombre') {
                if (!validateNombreCompleto(value)) {
                    element.classList.add('field-error');
                    showFieldError('nombre', 'Ingrese el nombre COMPLETO');
                    hasErrors = true;
                    if (!firstEmptyField) {
                        firstEmptyField = element;
                    }
                }
            } else if (field.id === 'cedula') {
                if (!validateCedula(value)) {
                    element.classList.add('field-error');
                    showFieldError('cedula', 'Ingrese una cédula válida');
                    hasErrors = true;
                    if (!firstEmptyField) {
                        firstEmptyField = element;
                    }
                }
            }
        }
    });

    // Hacer foco en el primer campo con error
    if (firstEmptyField) {
        firstEmptyField.focus();
        firstEmptyField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return !hasErrors;
}

// Función para validar nombre completo (mínimo 3 palabras)
function validateNombreCompleto(nombre) {
    const palabras = nombre.trim().split(/\s+/);
    return palabras.length >= 3;
}

// Función para validar cédula (exactamente 10 dígitos)
function validateCedula(cedula) {
    // Remover cualquier caracter que no sea dígito
    const cedulaLimpia = cedula.replace(/\D/g, '');
    return cedulaLimpia.length === 10;
}

// Función para mostrar errores específicos en campos
function showFieldError(fieldId, message) {
    const errorElement = document.getElementById(fieldId + '-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Función para ocultar errores específicos
function hideFieldError(fieldId) {
    const errorElement = document.getElementById(fieldId + '-error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

// Función para verificar si todos los campos requeridos están llenos y válidos
function areAllFieldsFilled() {
    const nombre = document.getElementById('nombre').value.trim();
    const cedula = document.getElementById('cedula').value.trim();
    const whatsapp = document.getElementById('whatsapp').value.trim();

    // Verificar que todos los campos estén llenos
    if (!nombre || !cedula || !whatsapp) {
        return false;
    }

    // Verificar validaciones específicas
    if (!validateNombreCompleto(nombre)) {
        return false;
    }

    if (!validateCedula(cedula)) {
        return false;
    }

    return true;
}

// Función para limpiar errores de campos
function clearFieldErrors() {
    const fields = ['nombre', 'cedula', 'whatsapp'];
    fields.forEach(fieldId => {
        const element = document.getElementById(fieldId);
        element.classList.remove('field-error');
        // Ocultar mensajes de error específicos
        hideFieldError(fieldId);
    });
}

// Función para verificar si el WhatsApp está validado
function isWhatsAppValidated() {
    const whatsappIcon = document.getElementById('whatsappIcon');
    return whatsappIcon.classList.contains('fa-check-circle');
}

// Función para habilitar/deshabilitar el botón de submit
function toggleSubmitButton(enabled) {
    const submitBtn = document.querySelector('button[type="submit"]');
    if (enabled) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// Función para actualizar el estado del botón de submit
function updateSubmitButtonState() {
    const allFieldsFilled = areAllFieldsFilled();
    const whatsappValidated = isWhatsAppValidated();

    if (allFieldsFilled && whatsappValidated) {
        toggleSubmitButton(true);
    } else {
        toggleSubmitButton(false);
    }
}

// Función para mostrar alerta personalizada
function showCustomAlert(message, type = 'success') {
    // Remover modal existente si hay uno
    const existingModal = document.getElementById('customAlertModal');
    if (existingModal) {
        existingModal.remove();
    }

    const alertModal = document.createElement('div');
    alertModal.id = 'customAlertModal';
    alertModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    alertModal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all">
            <div class="p-6">
                <div class="flex items-center mb-4">
                    <div class="flex-shrink-0">
                        <i id="alertIcon" class="fas ${type === 'success' ? 'fa-check-circle text-green-500' : 'fa-exclamation-triangle text-red-500'} text-2xl"></i>
                    </div>
                    <div class="ml-3">
                        <h3 id="alertTitle" class="text-lg font-semibold text-gray-900">${type === 'success' ? '¡Éxito!' : 'Error'}</h3>
                    </div>
                </div>
                <div class="mb-6">
                    <p id="alertMessage" class="text-sm text-gray-600">${message}</p>
                </div>
                <div class="flex justify-end">
                    <button id="alertConfirmBtn" class="bg-brand-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        Aceptar
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(alertModal);

    // Asegurarse de que el botón de confirmar existe antes de agregar el event listener
    const confirmBtn = document.getElementById('alertConfirmBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function() {
            if (alertModal && alertModal.parentNode) {
                alertModal.remove();
            }
        });
    }
}

// Función para hacer scroll suave a un elemento
function scrollToElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}

document.getElementById('authForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    // Limpiar errores previos
    clearFieldErrors();

    // Validar campos requeridos
    if (!validateRequiredFields()) {
        return;
    }

    const submitBtn = document.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    // Cambiar el botón a estado de carga
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generando enlace...';
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

    // Verificar que el número de WhatsApp esté validado
    const whatsappIcon = document.getElementById('whatsappIcon');
    if (!whatsappIcon.classList.contains('fa-check-circle')) {
        showCustomAlert('Por favor, verifique que el número de WhatsApp sea válido antes de continuar', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        return;
    }

    const nombre = document.getElementById('nombre').value;
    const cedula = document.getElementById('cedula').value;
    const whatsappRaw = document.getElementById('whatsapp').value;

    // Asegurarse de que el número de WhatsApp tenga exactamente 11 dígitos
    if (whatsappRaw.length !== 11) {
        showCustomAlert('El número de WhatsApp debe tener exactamente 11 dígitos', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        return;
    }

    const data = {
        nombre: nombre,
        cedula: "'" + cedula,
        whatsapp: whatsappRaw
    };

    try {
        const response = await fetch('https://lpn8n.luispinta.com/webhook/9a99c66a-74c1-428d-aadc-31b07e1ee026', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);

        if (response.ok) {
            const result = await response.json();
            console.log('Result:', result);
            let link;
            if (Array.isArray(result) && result.length > 0 && result[0].Link) {
                link = result[0].Link;
            } else if (result.Link) {
                link = result.Link;
            } else {
                link = null;
            }

            if (link) {
                document.getElementById('linkText').textContent = link.trim();
                document.getElementById('linkContainer').style.display = 'block';

                // Mostrar alerta de éxito
                showCustomAlert('Enlace generado exitosamente', 'success');

                // Hacer scroll a la zona copiable después de un breve delay
                setTimeout(() => {
                    scrollToElement('linkContainer');
                }, 500);

            } else {
                showCustomAlert('Datos enviados, pero no se recibió enlace.', 'error');
            }
        } else {
            showCustomAlert('Error al enviar los datos. Por favor, inténtelo de nuevo.', 'error');
        }
    } catch (error) {
        console.log('Error:', error);
        showCustomAlert('Error de conexión: ' + error.message, 'error');
    } finally {
        // Restaurar el botón a su estado original
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }
});

document.getElementById('copyBtn').addEventListener('click', function() {
    const link = document.getElementById('linkText').textContent;
    const copyBtnText = document.getElementById('copyBtnText');
    const originalText = copyBtnText.textContent;

    navigator.clipboard.writeText(link).then(() => {
        copyBtnText.textContent = '¡Copiado!';
        copyBtnText.previousElementSibling.className = 'fas fa-check mr-2 text-green-600';

        // Mostrar alerta de éxito
        showCustomAlert('Enlace copiado al portapapeles exitosamente', 'success');

        // Restaurar el botón después de 2 segundos
        setTimeout(() => {
            copyBtnText.textContent = originalText;
            copyBtnText.previousElementSibling.className = 'fas fa-copy mr-2';
        }, 2000);
    }).catch(err => {
        console.error('Error al copiar: ', err);
        showCustomAlert('Error al copiar el enlace. Inténtelo manualmente.', 'error');
    });
});

// Función para seleccionar automáticamente el texto del enlace al hacer clic
document.getElementById('linkText').addEventListener('click', function() {
    const range = document.createRange();
    range.selectNodeContents(this);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
});

// Función para verificar número de WhatsApp
async function verifyWhatsAppNumber(phoneNumber) {
    const url = 'https://api.luispinta.com/chat/whatsappNumbers/CajaGerencia';
    const options = {
        method: 'POST',
        headers: {
            'apikey': 'smaksnaHG',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "numbers": [phoneNumber]
        })
    };

    try {
        const response = await fetch(url, options);
        const data = await response.json();
        console.log('WhatsApp verification response:', data);

        if (Array.isArray(data) && data.length > 0) {
            const result = data[0];
            return {
                exists: result.exists,
                number: result.number,
                jid: result.jid
            };
        }
        return { exists: false, number: phoneNumber };
    } catch (error) {
        console.error('Error verifying WhatsApp number:', error);
        return { exists: false, number: phoneNumber, error: true };
    }
}

// Función para actualizar el estado visual del campo WhatsApp
function updateWhatsAppStatus(status, message = '') {
    const whatsappInput = document.getElementById('whatsapp');
    const whatsappIcon = document.getElementById('whatsappIcon');
    const whatsappStatus = document.getElementById('whatsappStatus');

    // Limpiar clases anteriores
    whatsappInput.classList.remove('whatsapp-field-valid', 'whatsapp-field-invalid');
    whatsappIcon.className = 'fas text-sm';

    switch (status) {
        case 'validating':
            whatsappIcon.className = 'fas fa-spinner fa-spin text-yellow-500 text-sm';
            break;
        case 'valid':
            whatsappIcon.className = 'fas fa-check-circle whatsapp-valid text-sm';
            whatsappInput.classList.add('whatsapp-field-valid');
            break;
        case 'invalid':
            whatsappIcon.className = 'fas fa-times-circle text-red-500 text-sm';
            whatsappInput.classList.add('whatsapp-field-invalid');
            break;
        default:
            whatsappIcon.className = 'fas fa-question-circle text-gray-400 text-sm';
    }

    // Mostrar tooltip si hay mensaje
    if (message) {
        whatsappStatus.title = message;
    }
}

// Función para formatear número de WhatsApp
function formatWhatsAppNumber(value) {
    if (!value) return '';

    // Remover todos los caracteres no numéricos, incluyendo espacios, paréntesis, guiones, etc.
    const cleanValue = value.toString().replace(/[^\d]/g, '');

    // Asegurarse de que empiece con 1 si no lo hace y tiene al menos 10 dígitos
    if (cleanValue.length === 10 && !cleanValue.startsWith('1')) {
        return '1' + cleanValue;
    }

    return cleanValue;
}

// Event listener para el campo WhatsApp
document.getElementById('whatsapp').addEventListener('blur', async function(e) {
    // Solo validar si no hay una validación en proceso y tiene 11 dígitos
    if (!isValidatingWhatsApp && this.value.length === 11) {
        validateWhatsAppNumber();
    }
});

document.getElementById('whatsapp').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        // Solo validar si no hay una validación en proceso y tiene 11 dígitos
        if (!isValidatingWhatsApp && this.value.length === 11) {
            validateWhatsAppNumber();
        }
    }
});

document.getElementById('whatsapp').addEventListener('input', function(e) {
    let value = e.target.value;

    // Formatear el valor (solo números)
    const formattedValue = formatWhatsAppNumber(value);

    // Solo permitir hasta 11 dígitos
    const finalValue = formattedValue.substring(0, 11);

    // Solo actualizar si el valor cambió
    if (e.target.value !== finalValue) {
        e.target.value = finalValue;
    }

    // Limpiar error si hay contenido
    if (finalValue.trim()) {
        e.target.classList.remove('field-error');
    }

    // Si llega exactamente a 11 dígitos y no hay validación en proceso, validar automáticamente
    if (finalValue.length === 11 && !isValidatingWhatsApp) {
        // Pequeño delay para evitar llamadas excesivas mientras el usuario escribe
        clearTimeout(window.whatsappValidationTimeout);
        window.whatsappValidationTimeout = setTimeout(() => {
            validateWhatsAppNumber();
        }, 500);
    } else if (finalValue.length !== 11) {
        // Limpiar timeout si no tiene 11 dígitos
        clearTimeout(window.whatsappValidationTimeout);
        // Resetear estado si no tiene 11 dígitos
        updateWhatsAppStatus('default');
        updateSubmitButtonState();
    }
});

// Variable para controlar si hay una validación en proceso
let isValidatingWhatsApp = false;

// Función para validar el número de WhatsApp
async function validateWhatsAppNumber() {
    // Evitar múltiples validaciones simultáneas
    if (isValidatingWhatsApp) {
        return;
    }

    const whatsappInput = document.getElementById('whatsapp');
    const value = whatsappInput.value;

    // Verificar que tenga exactamente 11 dígitos y empiece con 1
    if (value.length === 11 && value.startsWith('1')) {
        isValidatingWhatsApp = true;
        updateWhatsAppStatus('validating', 'Verificando número...');

        try {
            const result = await verifyWhatsAppNumber(value);

            if (result.error) {
                updateWhatsAppStatus('invalid', 'Error al verificar el número');
                updateSubmitButtonState();
                showCustomAlert('Error al verificar el número de WhatsApp. Verifique su conexión e inténtelo de nuevo.', 'error');
            } else if (result.exists) {
                updateWhatsAppStatus('valid', 'Número verificado correctamente ✓');
                updateSubmitButtonState();
                showCustomAlert('✅ Número de WhatsApp verificado correctamente', 'success');
            } else {
                updateWhatsAppStatus('invalid', 'Número no encontrado en WhatsApp');
                updateSubmitButtonState();
                showCustomAlert('❌ El número no está registrado en WhatsApp o no es válido', 'error');
            }
        } catch (error) {
            updateWhatsAppStatus('invalid', 'Error al verificar el número');
            updateSubmitButtonState();
            showCustomAlert('Error al verificar el número de WhatsApp. Verifique su conexión e inténtelo de nuevo.', 'error');
        } finally {
            isValidatingWhatsApp = false;
        }
    } else if (value.length === 11 && !value.startsWith('1')) {
        updateWhatsAppStatus('invalid', 'El número debe comenzar con 1 (código de país USA)');
        updateSubmitButtonState();
        showCustomAlert('❌ El número debe comenzar con 1 (código de país USA)', 'error');
    } else if (value.length !== 11) {
        updateWhatsAppStatus('invalid', 'El número debe tener exactamente 11 dígitos');
        updateSubmitButtonState();
        showCustomAlert('❌ El número debe tener exactamente 11 dígitos', 'error');
    }
}

// Event listeners para limpiar errores al escribir
document.getElementById('nombre').addEventListener('input', function() {
    const value = this.value.trim();
    if (value) {
        this.classList.remove('field-error');
        if (validateNombreCompleto(value)) {
            hideFieldError('nombre');
        } else {
            showFieldError('nombre', 'Ingrese el nombre COMPLETO');
        }
    } else {
        hideFieldError('nombre');
    }
    updateSubmitButtonState();
});

document.getElementById('cedula').addEventListener('input', function() {
    const value = this.value.trim();
    if (value) {
        this.classList.remove('field-error');
        if (validateCedula(value)) {
            hideFieldError('cedula');
        } else {
            showFieldError('cedula', 'Ingrese una cédula válida');
        }
    } else {
        hideFieldError('cedula');
    }
    updateSubmitButtonState();
});

// Prevenir pegar caracteres no numéricos y formatear correctamente
document.getElementById('whatsapp').addEventListener('paste', function(e) {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    const formattedText = formatWhatsAppNumber(pastedText);
    const currentValue = this.value;
    const newValue = currentValue + formattedText;

    // Solo permitir hasta 11 dígitos
    this.value = newValue.substring(0, 11);

    // Limpiar error si hay contenido
    if (this.value.trim()) {
        this.classList.remove('field-error');
    }

    // Si llega a 11 dígitos y no hay validación en proceso, validar automáticamente
    if (this.value.length === 11 && !isValidatingWhatsApp) {
        // Pequeño delay para procesar el paste completamente
        clearTimeout(window.whatsappValidationTimeout);
        window.whatsappValidationTimeout = setTimeout(() => {
            validateWhatsAppNumber();
        }, 100);
    } else if (this.value.length !== 11) {
        // Limpiar timeout si no tiene 11 dígitos
        clearTimeout(window.whatsappValidationTimeout);
        // Resetear estado si no tiene 11 dígitos
        updateWhatsAppStatus('default');
        updateSubmitButtonState();
    }

    // Disparar el evento input para que se procese normalmente
    this.dispatchEvent(new Event('input', { bubbles: true }));
});

// Inicializar estado del botón al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    // Limpiar cualquier timeout pendiente
    if (window.whatsappValidationTimeout) {
        clearTimeout(window.whatsappValidationTimeout);
    }
    updateSubmitButtonState();
});

// Limpiar timeouts cuando se resetea el formulario
document.getElementById('authForm').addEventListener('reset', function() {
    // Limpiar timeout de validación
    if (window.whatsappValidationTimeout) {
        clearTimeout(window.whatsappValidationTimeout);
    }
    // Resetear estado de validación
    isValidatingWhatsApp = false;
    // Actualizar estado del botón
    setTimeout(() => {
        updateSubmitButtonState();
    }, 100);
});