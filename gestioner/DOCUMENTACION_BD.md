# Documentación de Base de Datos - GestionER

## Descripción General

Este documento describe la estructura completa de la base de datos de Firebase utilizada en la aplicación GestionER, un sistema de gestión de inquilinos y pagos de renta.

---

## 📊 Colecciones Principales

### 1. **UNIDADES** (Propiedades/Inmuebles)

Almacena información de las propiedades disponibles para arrendar.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_unidad` | String | ID único de la unidad (ej: "apt_001") |
| `id_inquilino` | String | ID del inquilino actual ocupando la unidad |
| `nombre_inquilino` | String | Nombre completo del inquilino actual |
| `renta_mensual` | Number | Monto mensual de renta en vigencia |
| `estado` | String | Estado de la unidad: "Disponible" o "Ocupado" |
| `id_propiedad` | String | ID de la propiedad a la que pertenece |
| `id_contrato_actual` | String | ID del contrato activo en la unidad |
| `no_depto` | Number | Numero de departamento |

---
### 2. **PROPIEDADES** (Propiedades/Inmuebles)

Almacena información de las propiedades disponibles para arrendar.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String | ID único de la propiedad (ej: "chilpancingo") |
| `fecha_creacion` | String | La fecha en la que se dio de alta la propiedad |
| `nombre` | String | Nombre formal de la propiedad |
| `prefijo` | Number | Prefijo de la unidad para operaciones basicas |
| `estado` | String | Estado de la propiedad: "Activa", "Inactiva" o "Clausurada" |
| `total_unidades` | String | La cantidad total de unidades que tiene la propiedad |
| `limite_luz` | String | Cantidad condonada por recibo de luz |
| `limite_agua` | Number | Cantidad condonada por recibo de agua |

---

### 3. **INQUILINOS** (Arrendatarios)

Datos de los inquilinos registrados en el sistema.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String | ID único del inquilino (ej: "inq_1234567890") |
| `nombre_completo` | String | Nombre completo del inquilino |
| `telefono_contacto` | String | Teléfono principal de contacto |
| `telefono_emergencia` | String | Teléfono de emergencia |
| `deposito_garantia_inicial` | Number | Monto del depósito de garantía |
| `dia_pago` | Number | Día del mes en que vence el pago (ej: 5) |
| `renta_actual` | Number | Monto actual de la renta mensual |
| `no_personas` | Number | Número de personas en el inmueble |
| `acompanantes` | Array | Lista de acompañantes/dependientes |
| `docs` | Object | Estado de documentos: `{ ine, carta, contrato }` |
| `fecha_inicio_contrato` | Timestamp | Fecha de inicio del contrato actual |
| `fecha_fin_contrato` | Timestamp | Fecha de vencimiento del contrato |
| `activo` | Boolean | Indica si el inquilino está activo |
| `id_contrato_actual` | String | ID del contrato activo |
| `id_unidad_actual` | String | ID de la unidad que ocupa |
| `historial_contratos` | Array | Lista de IDs de contratos anteriores |
| `fecha_registro` | Timestamp | Fecha de registro del inquilino |
| `ultima_modificacion` | Timestamp | Última actualización del registro |

---

### 4. **CONTRATOS** (Acuerdos de Arrendamiento)

Detalles de los contratos de arrendamiento.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_inquilino` | String | ID del inquilino del contrato |
| `id_unidad` | String | ID de la unidad arrendada |
| `nombre_inquilino` | String | Nombre del inquilino (copia para referencia rápida) |
| `monto_renta` | Number | Monto mensual de renta del contrato |
| `monto_deposito` | Number | Monto del depósito de garantía |
| `dia_pago` | Number | Día del mes vence el pago |
| `fecha_inicio` | Timestamp | Fecha de inicio del contrato |
| `fecha_fin` | Timestamp | Fecha de vencimiento del contrato |
| `estatus` | String | "activo", "finalizado" o "renovado" |
| `periodos_esperados` | Array[Object] | **Estructura clave** - Ver detalle abajo |
| `total_periodos` | Number | Cantidad total de períodos del contrato |
| `periodos_pagados` | Number | Cantidad de períodos completamente pagados |
| `fecha_creacion` | Timestamp | Fecha de creación del contrato |
| `fecha_finalizacion` | Timestamp | Fecha en que se finalizó |

#### **Estructura de `periodos_esperados[]`**

Cada periodo es un objeto dentro del array que representa un mes de vigencia del contrato:

```javascript
{
  periodo: "2026-01",           // Formato YYYY-MM
  anio: 2026,                    // Año
  mes: 1,                        // Mes (1-12)
  estatus: "pendiente",          // pendiente | parcial | pagado | condonado
  monto_esperado: 5000,          // Renta + servicios esperados
  monto_pagado: 0,               // Total abonado en el período
  saldo_restante: 5000,          // Lo que falta pagar
  fecha_ultimo_pago: null,       // Timestamp del último pago
  id_pagos: [],                  // Array de IDs de documentos de pago
  metodo_condonacion: false      // Indica si fue condonado
}
```

---

### 5. **PAGOS** (Registros de Pagos)

Cada transacción de pago registrada.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_unidad` | String | ID de la unidad relacionada |
| `id_inquilino` | String | ID del inquilino que paga |
| `id_contrato` | String | ID del contrato asociado |
| `periodo` | String | Período pagado (formato: "YYYY-MM") |
| `anio` | Number | Año del período |
| `mes` | Number | Mes del período (1-12) |
| `monto_pagado` | Number | Monto abonado en esta transacción |
| `total_esperado_periodo` | Number | Total esperado (renta + servicios) |
| `saldo_restante_periodo` | Number | Saldo que queda después del pago |
| `estatus` | String | "pendiente", "parcial" o "pagado" |
| `medio_pago` | String | Forma de pago: "efectivo", "transferencia", "cheque", "condonacion" |
| `fecha_pago_realizado` | Date | Fecha en que se realizó el pago |
| `fecha_registro` | Timestamp | Fecha de registro en BD |
| `servicios` | Object | Detalles de servicios cobrados |
| `condonado` | Boolean | true si fue una condonación de deuda |
| `fecha_condonacion` | Timestamp | Fecha de la condonación (si aplica) |
| `motivo_condonacion` | String | Motivo de la condonación |
| `monto_condonado` | Number | Monto de deuda condonada |
| `estado_previo` | Object | Registro del estado antes del pago |

#### **Estructura de `servicios` (dentro de PAGOS)**

```javascript
{
  agua_lectura: 150,              // Lectura de agua (m³ o monto)
  luz_lectura: 200,               // Lectura de luz (kWh o monto)
  limite_luz_aplicado: 250        // Maximo a condonacion 
  limite_agua_aplicado: 250        // Maximo a condonacion 
  excedentes_cobrados_de: null,   // null | "renta" | "deposito"
  excedentes_del_deposito: 0      // Monto cobrado del depósito por excedentes
}
```

---

### 5. **MANTENIMIENTO** (Registros de Mantenimiento)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id_propiedad` | String | ID de la propiedad (ej. "dorado") |
| `id_unidad` | String | ID de la unidad relacionada (ej. "DO-1") |
| `id_inquilino_afectado` | String/Null | ID del inquilino relacionado al reporte |
| `categoria` | String | Categoría del trabajo (ej. "plomeria") |
| `concepto` | String | Título corto del problema (ej. "Tuberias rotas") |
| `descripcion` | String | Detalle completo del daño o servicio |
| `tipo` | String | Clasificación del trabajo (ej. "preventivo") |
| `prioridad` | String | Nivel de urgencia (ej. "media") |
| `estatus` | String | Estado del ticket (ej. "pendiente") |
| `periodo` | String | Período de registro (formato: "YYYY-MM") |
| `costo_estimado` | String | Presupuesto inicial proyectado |
| `costo_real` | Number | Gasto final ejecutado |
| `responsable` | String | Persona o empresa encargada (ej. "Luis Herrera") |
| `telefono_responsable` | String | Contacto del responsable |
| `afecta_inquilino` | Boolean | Indica si el problema impacta al habitante |
| `requiere_entrada_unidad` | Boolean | Indica si se requiere acceso al interior |
| `fotos_antes` | Array | Lista de enlaces a imágenes del problema |
| `fotos_despues` | Array | Lista de enlaces a imágenes de la solución |
| `notas` | Array | Historial de comentarios o actualizaciones |
| `fecha_registro` | Timestamp | Fecha y hora de creación del registro |
| `fecha_ultima_actualizacion` | Timestamp | Fecha del último cambio realizado |
| `fecha_finalizacion` | Timestamp/Null | Fecha en que se marcó como terminado |
---

## 🔄 Operaciones Críticas y Sincronización de Datos

### ⚠️ **1. REGISTRAR UN NUEVO INQUILINO**

**Colecciones afectadas:** INQUILINOS, CONTRATOS, UNIDADES

**Campos que deben actualizarse juntos:**

1. **En INQUILINOS:**
   - `id_contrato_actual` = `nuevoContratoId`
   - `id_unidad_actual` = `idUnidad`
   - `activo` = `true`
   - `fecha_inicio_contrato` y `fecha_fin_contrato`
   - `renta_actual`, `dia_pago`, `deposito_garantia_inicial`

2. **En CONTRATOS (crear nuevo):**
   - `id_inquilino` = `idInquilino`
   - `id_unidad` = `idUnidad`
   - `periodos_esperados[]` = **GENERADOS AUTOMÁTICAMENTE** (ver función `generarPeriodosEsperados`)
   - `total_periodos` = cantidad de periodos
   - `periodos_pagados` = 0
   - `estatus` = "activo"

3. **En UNIDADES:**
   - `id_inquilino` = `idInquilino`
   - `nombre_inquilino` = nombre del inquilino
   - `renta_mensual` = monto de renta
   - `estado` = "Ocupado"
   - `id_contrato_actual` = `nuevoContratoId`

**⚡ Usar operación atómica (Batch/Transaction)** para garantizar integridad

---

### ⚠️ **2. REGISTRAR UN PAGO**

**Colecciones afectadas:** PAGOS, CONTRATOS

**Flujo:**

1. **Crear documento en PAGOS** con:
   - `id_unidad`, `id_inquilino`, `id_contrato`
   - `periodo` (formato "YYYY-MM")
   - `monto_pagado`, `total_esperado_periodo`
   - `fecha_pago_realizado`
   - `servicios` (si aplica)
   - Obtener automático `docRef.id` como `idPago`

2. **Actualizar CONTRATO** en `periodos_esperados[periodo]`:
   - Buscar el periodo en el array
   - Actualizar:
     ```
     monto_esperado = monto_pagado.total_esperado_periodo
     monto_pagado += monto_pagado.monto_pagado
     saldo_restante = monto_esperado - monto_pagado (≥0)
     estatus = determinar("pendiente" | "parcial" | "pagado")
     id_pagos.push(idPago)
     fecha_ultimo_pago = Timestamp.now()
     ```
   - Recalcular `periodos_pagados` = contar periodos con estatus "pagado"

3. **Validación importante:**
   - Si hay servicios y se cobra del depósito, restar de `monto_deposito`
   - Si el periodo ya tiene pagos previos, SUMAR (no reemplazar)

---

### ⚠️ **3. TERMINAR/FINALIZAR UN CONTRATO**

**Colecciones afectadas:** CONTRATOS, INQUILINOS, UNIDADES

**Validaciones necesarias:**
- ✅ Todos los periodos deben tener `estatus === "pagado"` o `"condonado"`
- ❌ Si hay periodos pendientes → rechazar con error descriptivo

**Actualizar:**

1. **CONTRATO:**
   - `estatus` = "finalizado"
   - `fecha_finalizacion` = Timestamp.now()

2. **INQUILINO:**
   - `activo` = false
   - `estado` = "Inactivo"
   - `id_contrato_actual` = null
   - `id_unidad_actual` = null
   - `historial_contratos.push(idContrato)` (si no estaba)

3. **UNIDAD:**
   - `estado` = "Disponible"
   - `id_contrato_actual` = null
   - `id_inquilino` = null
   - `nombre_inquilino` = ""
   - `renta_mensual` = 0

**⚡ Usar Transaction** para validar pagos y actualizar todo atómicamente

---

### ⚠️ **4. RENOVAR UN INQUILINO (Después de finalizar)**

**Colecciones afectadas:** INQUILINOS, CONTRATOS, UNIDADES

**Cambios respecto a "Finalizar":**

1. **En INQUILINO:**
   - `activo` = true **(vuelve a estar activo)**
   - `estado` = "Activo" **(cambio importante)**
   - Actualizar fechas: `fecha_inicio_contrato`, `fecha_fin_contrato`
   - Actualizar renta si cambió

2. **Crear NUEVO CONTRATO** con:
   - ID único: `con_R${timestamp}_${idInquilino}`
   - `periodos_esperados[]` regenerados con nuevas fechas
   - `periodos_pagados` = 0 (nuevo contrato)
   - `estatus` = "activo"

3. **En UNIDAD:**
   - `estado` = "Ocupado"
   - `id_inquilino` = `idInquilino`
   - `id_contrato_actual` = `nuevoContratoId`

---

### ⚠️ **5. ACTUALIZAR DATOS DE UN INQUILINO (Mientras está activo)**

**Colecciones afectadas:** INQUILINOS, CONTRATOS, UNIDADES

**Validaciones:**
- 🚨 **Si hay pagos registrados:**
  - ❌ NO permitir cambiar `fecha_inicio_contrato` o `fecha_fin_contrato`
  - ❌ NO permitir cambiar `monto_deposito`
  - ✅ PERMITIR cambiar `renta_actual` solo en periodos **pendientes**

- 🟢 **Si NO hay pagos:**
  - ✅ Permitir cambios de fechas (regenerar periodos)
  - ✅ Permitir cambios de depósito

**Actualización de campos en periodos pendientes:**
```
Si cambió renta y no hay pagos:
  periodos_esperados[i].monto_esperado = nueva_renta (si estatus === "pendiente")
```

---

### ⚠️ **6. CONDONAR DEUDA**

**Colecciones afectadas:** PAGOS, CONTRATOS

**Flujo:**

1. **Crear documento en PAGOS** con:
   - `estatus` = "condonado"
   - `medio_pago` = "condonacion"
   - `condonado` = true
   - `monto_pagado` = pagado hasta ahora
   - `total_esperado_periodo` = lo que debía
   - `saldo_restante_periodo` = 0
   - `monto_condonado` = deuda perdonada
   - `motivo_condonacion` = razón
   - Obtener `idPago` de `docRef.id`

2. **Actualizar CONTRATO en `periodos_esperados[periodo]`:**
   - `estatus` = "pagado" (se trata como pagado para el sistema)
   - `monto_pagado` = `total_esperado_periodo`
   - `saldo_restante` = 0
   - `id_pagos.push(idPago)`
   - `metodo_condonacion` = true

3. **Recalcular:**
   - `periodos_pagados` = contar periodos con `estatus === "pagado"`

---

### ⚠️ **7. ELIMINAR UN PAGO**

**Colecciones afectadas:** PAGOS, CONTRATOS

**Operación compleja - Ver detalles en paymentsService.js**

**Flujo:**

1. **Para cada pago a eliminar:**
   - Si cobró excedentes del depósito → devolver al `monto_deposito`
   - Marcar pago para eliminación

2. **Resetear periodo en CONTRATO:**
   ```
   periodos_esperados[periodo] = {
     estatus: "pendiente",
     monto_pagado: 0,
     monto_esperado: renta_base,
     saldo_restante: renta_base,
     fecha_ultimo_pago: null,
     id_pagos: []  // Limpiar referencias
   }
   ```

3. **Actualizar:**
   - `monto_deposito` += excedentes devueltos
   - `periodos_pagados` = recalcular

---

## 📋 Validaciones Globales

### En Dashboard (getDatosDashboard)

```javascript
// NO contar periodos condonados en adeudos
const pagosLookup[key] = acumular solo pagos donde condonado !== true

// Un inquilino debe tener contrato activo en ese periodo
const validacionContrato = inquilinoTeniaContratoEnPeriodo(inquilino, periodo)
if (!validacionContrato.activo) return; // No incluir en adeudos
```

---

## 🔐 Buenas Prácticas

### ✅ HACER:
- Usar **Batch** o **Transaction** para múltiples actualizaciones
- Convertir `Timestamp` a `Date` antes de enviar a UI
- Validar que IDs existan antes de actualizar referencias
- Mantener sincronía entre INQUILINO → CONTRATO → UNIDAD
- Usar `serverTimestamp()` para fechas del servidor
- Documentar el estado previo en cambios críticos

### ❌ NO HACER:
- Actualizar periodos con pagos directamente (usar función `actualizarPeriodoEnContrato`)
- Cambiar fecha de contrato si hay pagos registrados
- Permitir eliminar pagos sin resetear el periodo
- Dejar inconsistencias entre INQUILINO.renta_actual y CONTRATO.monto_renta
- Olvidar recalcular `periodos_pagados` después de cualquier cambio

---

## 📝 Ejemplo Completo: Ciclo de Vida de un Inquilino

```
1. REGISTRO
   → Crear INQUILINO (activo=true)
   → Crear CONTRATO (periodos auto-generados, estatus="activo")
   → Actualizar UNIDAD (estado="Ocupado")

2. PAGOS
   → Crear documento en PAGOS
   → Actualizar periodo en CONTRATO.periodos_esperados[periodo]
   → Recalcular CONTRATO.periodos_pagados

3. CAMBIOS
   → Actualizar INQUILINO y UNIDAD en paralelo
   → Actualizar CONTRATO solo si es seguro (sin pagos previos)

4. FINALIZACIÓN
   → Validar que TODOS los periodos estén pagados
   → Si OK: Cambiar CONTRATO.estatus="finalizado"
   → Cambiar INQUILINO: activo=false, id_contrato_actual=null
   → Cambiar UNIDAD: estado="Disponible"
   → Agregar ID contrato a INQUILINO.historial_contratos

5. RENOVACIÓN
   → Crear NUEVO CONTRATO
   → Actualizar INQUILINO: activo=true, id_contrato_actual=nuevoId
   → Actualizar UNIDAD: id_contrato_actual=nuevoId
```

---

**Última actualización:** Enero 2026  
**Versión:** 1.0  
**Sistema:** GestionER
