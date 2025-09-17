document.getElementById('authForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const nombre = document.getElementById('nombre').value;
    const cedula = document.getElementById('cedula').value;
    const whatsapp = document.getElementById('whatsapp').value;
    
    const data = {
        nombre: nombre,
        cedula: cedula,
        whatsapp: whatsapp
    };
    
    try {
        const response = await fetch('https://lpn8n.luispinta.com/webhook-test/9a99c66a-74c1-428d-aadc-31b07e1ee026', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        const messageDiv = document.getElementById('message');
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
                messageDiv.textContent = 'Datos enviados exitosamente. Enlace generado.';
                messageDiv.style.color = 'green';
            } else {
                messageDiv.textContent = 'Datos enviados, pero no se recibió enlace.';
                messageDiv.style.color = 'orange';
            }
        } else {
            messageDiv.textContent = 'Error al enviar los datos.';
            messageDiv.style.color = 'red';
        }
    } catch (error) {
        console.log('Error:', error);
        document.getElementById('message').textContent = 'Error de conexión: ' + error.message;
        document.getElementById('message').style.color = 'red';
    }
});

document.getElementById('copyBtn').addEventListener('click', function() {
    const link = document.getElementById('linkText').textContent;
    navigator.clipboard.writeText(link).then(() => {
        alert('Enlace copiado al portapapeles!');
    }).catch(err => {
        console.error('Error al copiar: ', err);
        alert('Error al copiar el enlace.');
    });
});