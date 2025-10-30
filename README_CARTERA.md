# Módulo de Reportes de Cartera

## Descripción
Sistema de reportes administrativos para la Caja de Ahorro y Crédito Tupak Rantina. Este módulo proporciona análisis detallados de la cartera de créditos, incluyendo estadísticas de colocaciones y análisis de mora.

## 🔑 Características Principales

### 1. **Comparación Mensual de Colocaciones**
- Visualización de créditos colocados en el mes actual vs mes anterior
- Cálculo de variación absoluta y porcentual
- Montos totales por período

### 2. **Gráfico de Tendencias**
- Gráfico de líneas mostrando colocaciones día por día
- Visualización de la actividad crediticia del mes actual
- Identificación de picos de colocación

### 3. **Análisis por Asesor**
- Resumen de créditos colocados por cada asesor en los últimos 30 días
- Montos totales por asesor
- Estadísticas de desempeño

### 4. **Reporte de Mora**
- Identificación de créditos con pagos atrasados
- Agrupación por asesor responsable
- Información de contacto de socios en mora
- Montos en riesgo

## 🚀 Uso

### Acceso al Reporte
El botón "Generar Reporte" se encuentra en el **Dashboard Administrativo** dentro de la pestaña **Cartera**.

**Requisitos:**
- Usuario administrador (contacto@tupakrantina.com)
- Sesión activa en el sistema

### Pasos para Generar el Reporte

1. Iniciar sesión con credenciales de administrador
2. Navegar a la pestaña **Cartera**
3. El Dashboard Administrativo aparecerá automáticamente
4. Hacer clic en el botón **"Generar Reporte"** (esquina superior derecha)
5. Esperar mientras se recopilan los datos
6. Visualizar el reporte completo en el modal

### Funcionalidades del Reporte

#### Imprimir
- Botón "Imprimir Reporte" para generar versión imprimible
- Formato optimizado para papel

#### Navegación
- Scroll vertical para revisar todas las secciones
- Botón "Cerrar" para regresar al dashboard

## 📊 Estructura de Datos

### Créditos Mes Actual
```javascript
{
    cantidad: number,        // Número de créditos
    montoTotal: number,      // Suma de montos aprobados
    creditos: Array          // Lista de créditos
}
```

### Colocaciones por Día
```javascript
{
    dia: number,            // Día del mes
    cantidad: number,       // Número de colocaciones
    monto: number,          // Monto total del día
    fecha: Date             // Fecha completa
}
```

### Análisis por Asesor
```javascript
{
    asesor: string,         // Nombre del asesor
    correo: string,         // Email del asesor
    creditos: Array,        // Lista de créditos
    total: number,          // Cantidad de créditos
    montoTotal: number      // Suma de montos
}
```

### Créditos en Mora
```javascript
{
    nombre_socio: string,   // Nombre del socio
    cedula_socio: string,   // Cédula del socio
    monto_aprobado: number, // Monto del crédito
    dia_pago: Date,         // Fecha de pago programada
    telefono_socio: string, // Teléfono de contacto
    asesor: string          // Asesor responsable
}
```

## 🔒 Seguridad

### Validación de Permisos
- Solo usuarios con email `contacto@tupakrantina.com` pueden acceder
- Validación mediante Supabase Auth
- Mensaje de error si usuario no autorizado intenta acceder

### Protección de Datos
- Los datos se obtienen mediante queries autenticadas
- Respeta las políticas RLS (Row Level Security) de Supabase
- No se exponen datos sensibles en logs públicos

## 🛠️ Archivos del Módulo

### `cartera.js`
Archivo principal con toda la lógica de reportes:
- Funciones de obtención de datos
- Procesamiento y análisis
- Generación de visualizaciones
- Creación de reportes HTML

### Integración en `index.html`
```html
<!-- Script de Reportes de Cartera -->
<script src="cartera.js"></script>
<script>
    async function generarReporteCarteraCompleto() {
        if (window.CarteraReportes) {
            await window.CarteraReportes.generarReporteCartera();
        }
    }
</script>
```

### Botón en Dashboard
```html
<button onclick="generarReporteCarteraCompleto()" 
        class="bg-white text-purple-600 hover:bg-purple-50 px-6 py-3 rounded-lg...">
    <i class="fas fa-file-chart-line"></i>
    <span>Generar Reporte</span>
</button>
```

## 📈 Métricas Calculadas

### Variación Mensual
```
Variación = MontoMesActual - MontoMesAnterior
Porcentaje = (Variación / MontoMesAnterior) × 100
```

### Criterio de Mora
Un crédito se considera en mora si:
- Tiene fecha de pago programada (`dia_pago`)
- Han transcurrido más de 5 días desde la fecha de pago
- No se ha marcado como pagado

### Promedio de Monto
```
Promedio = SumaMontos / TotalCréditos
```

## 🎨 Personalización

### Colores por Sección
- **Mes Actual:** Azul (`from-blue-500 to-blue-600`)
- **Mes Anterior:** Púrpura (`from-purple-500 to-purple-600`)
- **Variación Positiva:** Verde (`text-green-600`)
- **Variación Negativa:** Rojo (`text-red-600`)
- **Mora:** Rojo (`from-red-500 to-red-600`)

### Iconos Font Awesome
- Calendario: `fa-calendar-check`, `fa-calendar-alt`
- Gráficos: `fa-chart-line`, `fa-chart-pie`
- Usuarios: `fa-user-tie`, `fa-users`
- Alertas: `fa-exclamation-triangle`

## 🐛 Solución de Problemas

### El botón no aparece
**Causa:** Usuario no es administrador  
**Solución:** Verificar que el email sea `contacto@tupakrantina.com`

### Error al generar reporte
**Causa:** Problemas de conexión con Supabase  
**Solución:** Verificar conexión a internet y configuración de Supabase

### Gráfico no se muestra
**Causa:** Canvas no se renderiza correctamente  
**Solución:** Esperar 1-2 segundos después de abrir el modal

### Datos inconsistentes
**Causa:** Caché desactualizado  
**Solución:** El módulo obtiene datos frescos en cada generación

## 📝 Notas Técnicas

### Dependencias
- Supabase JS Client (v2)
- Tailwind CSS
- Font Awesome 6.0
- JavaScript ES6+

### Compatibilidad
- Navegadores modernos (Chrome, Firefox, Safari, Edge)
- Requiere JavaScript habilitado
- Responsive design (móvil y desktop)

### Rendimiento
- Carga asíncrona de datos
- Procesamiento optimizado
- Modal con scroll para grandes volúmenes de datos
- Gráficos generados en Canvas nativo (sin librerías pesadas)

## 📞 Soporte

Para reportar problemas o solicitar mejoras, contactar al equipo de desarrollo de Tupak Rantina.

---

**Versión:** 1.0.0  
**Fecha:** Octubre 2025  
**Desarrollado para:** Caja de Ahorro y Crédito Tupak Rantina
