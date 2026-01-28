# Documentación de Base de Datos - GestionER

**Sistema de gestión de inquilinos y pagos de renta.**  
Última actualización: Enero 2026 | Versión: 2.0

---

## 📊 Colecciones Principales

### 1. **UNIDADES** (Propiedades/Inmuebles)

Almacena información de las propiedades disponibles para arrendar.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String | ID único de la unidad (ej: "apt_001") |
| `id_inquilino` | String | ID del inquilino actual ocupando la unidad |
| `nombre_inquilino` | String | Nombre completo del inquilino actual |
| `renta_mensual` | Number | Monto mensual de renta en vigencia |
| `estado` | String | "Disponible" o "Ocupado" |
| `id_propiedad` | String | ID de la propiedad a la que pertenece |
| `id_contrato_actual` | String | ID del contrato activo en la unidad |
| `no_depto` | Number | Número de departamento |
| `no_personas` | Number | Cantidad de personas en la unidad |

---

### 2. **PROPIEDADES** (Conjunto de Unidades)

Información centralizada de propiedades con límites de servicios.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String | ID único de la propiedad (ej: "chilpancingo") |
| `fecha_creacion` | String | Fecha de alta de la propiedad |
| `nombre` | String | Nombre formal de la propiedad |
| `prefijo` | Number | Prefijo para ID de unidades |
| `estado` | String | "Activa", "Inactiva" o "Clausurada" |
| `total_unidades` | Number | Cantidad total de unidades |
| `limite_agua` | Number | Límite de agua condonada (m³) |
| `limite_luz` | Number | Límite de luz condonada (kWh) |

---

### 3. **INQUILINOS** (Arrendatarios)

Datos personales y contractuales de los inquilinos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String | ID único (ej: "inq_1234567890") |
| `nombre_completo` | String | Nombre completo |
| `telefono_contacto` | String | Teléfono principal |
| `telefono_emergencia` | String | Teléfono de emergencia |
| `deposito_garantia_inicial` | Number | Monto del depósito |
| `dia_pago` | Number | Día de vencimiento del pago |
| `renta_actual` | Number | Monto actual de renta |
| `no_personas` | Number | Número de ocupantes |
| `acompanantes` | Array | Lista de acompañantes |
| `docs` | Object | Estado docs: `{ ine, carta, contrato }` |
| `fecha_inicio_contrato` | Timestamp | Inicio del contrato |
| `fecha_fin_contrato` | Timestamp | Fin del contrato |
| `activo` | Boolean | ¿Inquilino activo? |
| `id_contrato_actual` | String | ID del contrato actual |
| `id_unidad_actual` | String | ID de la unidad que ocupa |
| `historial_contratos` | Array | Lista de IDs de contratos previos |
| `fecha_registro` | Timestamp | Fecha de registro |
| `ultima_modificacion` | Timestamp | Última actualización |

---

### 4. **CONTRATOS** (Acuerdos de Arrendamiento)

Detalles de los contratos con seguimiento de períodos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String | ID único del contrato |
| `id_inquilino` | String | ID del inquilino |
| `id_unidad` | String | ID de la unidad |
| `nombre_inquilino` | String | Nombre (copia para referencia) |
| `monto_renta` | Number | Renta mensual del contrato |
| `monto_deposito` | Number | Depósito de garantía |
| `dia_pago` | Number | Día de vencimiento |
| `fecha_inicio` | Timestamp | Fecha de inicio |
| `fecha_fin` | Timestamp | Fecha de fin |
| `estatus` | String | "activo", "finalizado" o "renovado" |
| `periodos_esperados` | Array[Object] | **Array de períodos (ver abajo)** |
| `total_periodos` | Number | Cantidad de períodos en el contrato |
| `periodos_pagados` | Number | Períodos completamente pagados |
| `fecha_creacion` | Timestamp | Fecha de creación |
| `fecha_finalizacion` | Timestamp | Fecha de finalización |

#### Estructura de `periodos_esperados[]`

Cada período representa un mes del contrato:

```javascript
{
  periodo: "2026-01",           // Formato YYYY-MM
  anio: 2026,                   // Año
  mes: 1,                       // Mes (1-12)
  estatus: "pendiente",         // pendiente|parcial|pagado|condonado
  monto_esperado: 5000,         // Renta + servicios
  monto_pagado: 0,              // Total abonado
  saldo_restante: 5000,         // Deuda pendiente
  fecha_ultimo_pago: null,      // Timestamp del último abono
  id_pagos: [],                 // Array de IDs de documentos de pago
  metodo_condonacion: false     // ¿Fue condonado?
}
```

---

### 5. **PAGOS** (Registros de Transacciones)

Cada pago registrado en el sistema.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String | ID único (auto-generado por Firebase) |
| `id_unidad` | String | ID de la unidad |
| `id_inquilino` | String | ID del inquilino |
| `id_contrato` | String | ID del contrato |
| `periodo` | String | Período pagado (YYYY-MM) |
| `anio` | Number | Año |
| `mes` | Number | Mes (1-12) |
| `monto_pagado` | Number | Monto abonado en esta transacción |
| `total_esperado_periodo` | Number | Total esperado del período |
| `saldo_restante_periodo` | Number | Saldo después del pago |
| `estatus` | String | "pendiente", "parcial" o "pagado" |
| `medio_pago` | String | "transferencia", "efectivo", "deposito", "condonacion" |
| `fecha_pago_realizado` | Date | Fecha del pago |
| `fecha_registro` | Timestamp | Fecha de registro en BD |
| `servicios` | Object | Detalles de agua/luz |
| `condonado` | Boolean | ¿Es condonación? |
| `fecha_condonacion` | Timestamp | Fecha de condonación |
| `motivo_condonacion` | String | Motivo de la condonación |
| `monto_condonado` | Number | Monto perdonado |
| `estado_previo` | Object | Registro del estado anterior |

#### Estructura de `servicios`

```javascript
{
  agua_lectura: 150,                      // Lectura de agua
  luz_lectura: 200,                       // Lectura de luz
  limite_agua_aplicado: 250,              // Límite utilizado
  limite_luz_aplicado: 250,               // Límite utilizado
  excedentes_cobrados_de: "renta",        // O "deposito"
  excedentes_del_deposito: 0              // Monto descargado del depósito
}
```

---

### 6. **MANTENIMIENTO** (Registros de Reparaciones)

Tickets de mantenimiento de unidades.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String | ID único (auto-generado) |
| `id_propiedad` | String | ID de la propiedad |
| `id_unidad` | String | ID de la unidad |
| `id_inquilino_afectado` | String\|null | ID del inquilino |
| `categoria` | String | "plomeria", "electricidad", etc. |
| `concepto` | String | Título corto del problema |
| `descripcion` | String | Descripción detallada |
| `tipo` | String | "preventivo" o "correctivo" |
| `prioridad` | String | "baja", "media" o "alta" |
| `estatus` | String | "pendiente", "en_proceso", "completado" |
| `periodo` | String | Período del reporte (YYYY-MM) |
| `costo_estimado` | Number | Presupuesto |
| `costo_real` | Number | Costo final |
| `responsable` | String | Persona/empresa responsable |
| `telefono_responsable` | String | Contacto del responsable |
| `afecta_inquilino` | Boolean | ¿Afecta al inquilino? |
| `requiere_entrada_unidad` | Boolean | ¿Requiere acceso? |
| `fotos_antes` | Array | URLs de fotos antes |
| `fotos_despues` | Array | URLs de fotos después |
| `notas` | Array | Historial de comentarios |
| `fecha_registro` | Timestamp | Fecha de creación |
| `fecha_ultima_actualizacion` | Timestamp | Última actualización |
| `fecha_finalizacion` | Timestamp\|null | Fecha de término |

---

## 🔄 Operaciones Críticas y Sincronización

### ⚠️ **1. REGISTRAR UN NUEVO INQUILINO**

**Componente:** `FormularioNuevoInquilino.jsx`  
**Función Firebase:** `registrarNuevoInquilino(idUnidad, datos)`

**Colecciones afectadas:** INQUILINOS, CONTRATOS, UNIDADES

**Actualizar estas 3 colecciones JUNTAS:**

```javascript
// INQUILINOS (crear)
{
  id: "inq_${Date.now()}",
  nombre_completo: datos.nombre_completo,
  telefono_contacto: datos.telefono_contacto,
  telefono_emergencia: datos.telefono_emergencia || "",
  deposito_garantia_inicial: Number(datos.deposito_garantia_inicial),
  dia_pago: Number(datos.dia_pago),
  renta_actual: Number(datos.renta_actual),
  no_personas: Number(datos.no_personas) || 1,
  acompanantes: datos.acompanantes || [],
  docs: datos.docs || { ine: "no", carta: "no", contrato: "no" },
  fecha_inicio_contrato: Timestamp(datos.fecha_inicio_contrato),
  fecha_fin_contrato: Timestamp(datos.fecha_fin_contrato),
  activo: true,
  id_contrato_actual: nuevoContratoId,    // ⭐ LINK A CONTRATO
  id_unidad_actual: idUnidad,             // ⭐ LINK A UNIDAD
  fecha_registro: serverTimestamp()
}

// CONTRATOS (crear)
{
  id: "con_${Date.now()}",
  id_inquilino: nuevoInqId,
  id_unidad: idUnidad,
  nombre_inquilino: datos.nombre_completo,
  monto_renta: Number(datos.renta_actual),
  monto_deposito: Number(datos.deposito_garantia_inicial),
  dia_pago: Number(datos.dia_pago),
  fecha_inicio: Timestamp(datos.fecha_inicio_contrato),
  fecha_fin: Timestamp(datos.fecha_fin_contrato),
  estatus: "activo",
  periodos_esperados: generarPeriodosEsperados(),  // ⭐ AUTO-GENERADO
  total_periodos: periodos.length,
  periodos_pagados: 0,
  fecha_creacion: serverTimestamp()
}

// UNIDADES (update)
{
  id_inquilino: nuevoInqId,
  nombre_inquilino: datos.nombre_completo,
  renta_mensual: Number(datos.renta_actual),
  estado: "Ocupado",
  id_contrato_actual: nuevoContratoId,
  no_personas: Number(datos.no_personas) || 1
}
```

**⚡ USAR:** `writeBatch()` - Operación atómica

---

### ⚠️ **2. REGISTRAR UN PAGO (Flujo Completo)**

**Componente:** `FormularioRegistroPago.jsx`  
**Función Firebase:** `registrarPagoFirebase(datosPago)`

**Colecciones afectadas:** PAGOS, CONTRATOS

**Existen dos casos:**

#### **CASO A: PRIMER PAGO del mes** (esPrimerPago = true)
- Captura lecturas de agua/luz
- Calcula excedentes
- Define `total_esperado_periodo`

```javascript
// PAGOS (crear)
{
  id_unidad: unidad.id,
  id_inquilino: inquilino.id,
  id_contrato: contrato.id,
  periodo: "2026-01",
  anio: 2026,
  mes: 1,
  
  monto_pagado: Number(formData.monto_recibido),
  total_esperado_periodo: rentaBase + (excedentes_si_cargan_a_renta),
  saldo_restante_periodo: total_esperado - monto_pagado,
  
  estatus: "pendiente" | "parcial" | "pagado",
  medio_pago: "transferencia",
  fecha_pago_realizado: fecha,
  
  servicios: {
    agua_lectura: 150,
    luz_lectura: 200,
    limite_agua_aplicado: 250,
    limite_luz_aplicado: 250,
    excedentes_cobrados_de: "renta" | "deposito",
    excedentes_del_deposito: monto_si_de_deposito
  },
  
  fecha_registro: serverTimestamp()
}

// CONTRATO (update periodos_esperados)
periodos_esperados[i] = {
  periodo: "2026-01",
  estatus: "pagado" | "parcial",
  monto_esperado: total_con_servicios,
  monto_pagado: monto_pagado,
  saldo_restante: Math.max(0, monto_esperado - monto_pagado),
  fecha_ultimo_pago: Timestamp.now(),
  id_pagos: [...previos, idPago]
}

// Recalcular:
periodos_pagados = contar periodos con estatus === "pagado"
```

#### **CASO B: PAGOS ADICIONALES** del mismo mes (esPrimerPago = false)
- NO captura nuevas lecturas
- Suma al `monto_pagado` existente
- NO cambia `total_esperado_periodo` ni servicios

```javascript
// PAGOS (crear)
{
  // Mismo estructura, pero los servicios se dejan vacíos
  servicios: null  // O los servicios existentes del primer pago
}

// CONTRATO (update periodos_esperados)
periodos_esperados[i] = {
  monto_pagado: monto_pagado_anterior + nuevo_monto,
  saldo_restante: monto_esperado - nuevo_monto_total,
  estatus: determinar_estado(),
  id_pagos: [...previos, idPago]
}
```

**⚠️ VALIDACIONES:**
- Si hay excedentes y se cargan del depósito → `monto_deposito -= excedentes`
- Si hay múltiples pagos → SUMAR montos (no reemplazar)
- Todos los pagos del período deben tener el MISMO `total_esperado_periodo`

**⚡ USAR:** `addDoc()` + `updateDoc()` en secuencia

---

### ⚠️ **3. EDITAR UN PAGO EXISTENTE**

**Componente:** `ModalEditarPago.jsx`  
**Función Firebase:** `updateDoc()` múltiples documentos

**Colecciones afectadas:** PAGOS, CONTRATOS

**Restricciones según tipo de pago:**

#### **Si es el PRIMER PAGO (esPrimerPago = true):**
- ✅ Puede cambiar: monto, lecturas de agua/luz, medio de pago
- ⚠️ Cambiar servicios afecta el depósito

```javascript
// LÓGICA CRÍTICA:

// 1. Restaurar depósito si cambió la opción
const anteriorDescuento = datosPagoActual.servicios?.excedentes_del_deposito || 0;
const depRestaurado = depositoActual + anteriorDescuento;

// 2. Aplicar nueva lógica
if (cobrar_excedentes_de === 'deposito') {
  montoFinalDeposito = depRestaurado - excedentes_nuevos;
  nuevoTotalEsperado = rentaBase;
} else {
  montoFinalDeposito = depRestaurado;
  nuevoTotalEsperado = rentaBase + excedentes_nuevos;
}

// 3. Recalcular con TODOS los pagos del período
const sumaOtros = todosLosPagos
  .filter(p => p.id !== pagoEditando.id)
  .reduce((acc, p) => acc + p.monto_pagado, 0);

const nuevoTotalAbonado = sumaOtros + nuevoMonto;
const nuevoSaldo = Math.max(0, nuevoTotalEsperado - nuevoTotalAbonado);
```

#### **Si es un PAGO ADICIONAL (esPrimerPago = false):**
- ✅ Puede cambiar: monto, medio de pago
- ❌ NO puede cambiar servicios
- ⚠️ Cambiar monto afecta el saldo global

**ACTUALIZAR en CONTRATO:**
```javascript
periodos_esperados[periodo] = {
  monto_pagado: nuevoTotalAbonado,
  monto_esperado: nuevoTotalEsperado,
  saldo_restante: nuevoSaldo,
  estatus: nuevoSaldo <= 0 ? "pagado" : "parcial"
}
```

**SINCRONIZAR en TODOS los PAGOS del período:**
```javascript
// ⚡ CRÍTICO: Todos los pagos del mes deben tener coherencia
todos_pagos_del_mes.forEach(pago => {
  updateDoc(pago.ref, {
    total_esperado_periodo: nuevoTotalEsperado,
    saldo_restante_periodo: nuevoSaldo,
    estatus: nuevoEstatus,
    fecha_ultima_modificacion: Timestamp.now()
  })
})
```

**⚡ USAR:** `Promise.all()` con múltiples `updateDoc()`

---

### ⚠️ **4. TERMINAR/FINALIZAR UN CONTRATO**

**Función Firebase:** `finalizarContrato(idUnidad, idInquilino, idContrato)`

**Colecciones afectadas:** CONTRATOS, INQUILINOS, UNIDADES

**VALIDACIÓN CRÍTICA ANTES de actualizar:**

```javascript
const periodos = contrato.periodos_esperados || [];

// ❌ RECHAZAR si hay pendientes
const pendientes = periodos.filter(p => 
  p.estatus !== "pagado" && p.estatus !== "condonado"
);

if (pendientes.length > 0) {
  throw new Error(`No se puede finalizar: ${pendientes.length} periodos pendientes`);
}

// ✅ Solo continuar si TODOS están pagados/condonados
const todosPagados = periodos.every(p => 
  p.estatus === "pagado" || p.estatus === "condonado"
);
```

**Actualizar si pasa validación:**

```javascript
// CONTRATO
{ estatus: "finalizado", fecha_finalizacion: Timestamp.now() }

// INQUILINO
{
  activo: false,
  estado: "Inactivo",
  id_contrato_actual: null,
  id_unidad_actual: null,
  historial_contratos: [...historial, idContrato]
}

// UNIDAD
{
  estado: "Disponible",
  id_contrato_actual: null,
  id_inquilino: null,
  nombre_inquilino: "",
  renta_mensual: 0,
  no_personas: 0
}
```

**⚡ USAR:** `runTransaction()` para validar y actualizar atómicamente

---

### ⚠️ **5. RENOVAR UN INQUILINO (Re-activación)**

**Componente:** `FormularioRenovacionArchivo.jsx`  
**Función Firebase:** `renovarInquilinoDesdeArchivo(idInquilino, idUnidad, datosNuevos)`

**Colecciones afectadas:** INQUILINOS, CONTRATOS, UNIDADES

**Condición previa:** Inquilino debe tener `activo = false`

**ID del nuevo contrato:**
```javascript
const customContratoId = `con_R${Date.now().toString().slice(-4)}_${idInquilino.replace('inq_', '')}`;
```

**Actualizar:**

```javascript
// INQUILINO
{
  activo: true,                           // ⭐ Vuelve activo
  estado: "Activo",                       // ⭐ Cambio importante
  id_unidad_actual: idUnidad,
  id_contrato_actual: customContratoId,
  renta_actual: Number(datosNuevos.renta_actual),
  dia_pago: Number(datosNuevos.dia_pago),
  no_personas: Number(datosNuevos.no_personas),
  fecha_inicio_contrato: Timestamp(datosNuevos.fecha_inicio),
  fecha_fin_contrato: Timestamp(datosNuevos.fecha_fin),
  ultima_modificacion: Timestamp.now()
}

// CONTRATO (CREAR)
{
  id: customContratoId,
  id_inquilino: idInquilino,
  id_unidad: idUnidad,
  nombre_inquilino: datosNuevos.nombre_completo,
  monto_renta: Number(datosNuevos.renta_actual),
  monto_deposito: Number(datosNuevos.deposito_garantia_inicial),
  dia_pago: Number(datosNuevos.dia_pago),
  fecha_inicio: Timestamp(datosNuevos.fecha_inicio),
  fecha_fin: Timestamp(datosNuevos.fecha_fin),
  fecha_creacion: Timestamp.now(),
  estatus: "activo",
  periodos_esperados: generarPeriodosEsperados(),  // ⭐ Nuevos
  total_periodos: periodos.length,
  periodos_pagados: 0
}

// UNIDAD
{
  estado: "Ocupado",
  id_inquilino: idInquilino,
  nombre_inquilino: datosNuevos.nombre_completo,
  id_contrato_actual: customContratoId,
  renta_mensual: Number(datosNuevos.renta_actual),
  no_personas: Number(datosNuevos.no_personas)
}
```

**⚡ USAR:** `writeBatch()`

---

### ⚠️ **6. EDITAR DATOS DE INQUILINO (Modo Edición)**

**Componente:** `FormularioNuevoInquilino.jsx` (esEdicion = true)  
**Función Firebase:** `actualizarInquilino(idInquilino, idUnidad, datos)`

**Colecciones afectadas:** INQUILINOS, CONTRATOS, UNIDADES

**VALIDACIONES ESTRICTAS:**

```javascript
// Verificar pagos registrados
const periodosConPagos = contrato.periodos_esperados.filter(p => 
  p.estatus === "pagado" || p.estatus === "parcial" || p.monto_pagado > 0
);
const hayPagosRegistrados = periodosConPagos.length > 0;

if (hayPagosRegistrados) {
  // ❌ NO permitir cambiar fechas
  if (fechasCambiaron) {
    throw new Error("NO_SE_PUEDE_MODIFICAR_FECHAS - Hay pagos registrados");
  }
  
  // ❌ NO permitir cambiar depósito
  if (depositoCambió) {
    throw new Error("NO_SE_PUEDE_MODIFICAR_DEPOSITO - Hay pagos registrados");
  }
  
  // ✅ PERMITIR cambiar renta SOLO en períodos pendientes
  if (rentaCambió) {
    periodos = periodos.map(p => 
      p.estatus === "pendiente" 
        ? { ...p, monto_esperado: nueva_renta }
        : p
    );
  }
}

if (!hayPagosRegistrados && fechasCambiaron) {
  // ✅ REGENERAR períodos si NO hay pagos
  periodos = generarPeriodosEsperados(nueva_inicio, nueva_fin, nueva_renta);
}
```

**Actualizar:**

```javascript
// INQUILINO
{
  nombre_completo: datos.nombre_completo,
  telefono_contacto: datos.telefono_contacto,
  telefono_emergencia: datos.telefono_emergencia || "",
  deposito_garantia_inicial: nuevoDeposito,
  dia_pago: nuevoDiaPago,
  renta_actual: nuevaRenta,
  no_personas: datos.no_personas,
  acompanantes: datos.acompanantes,
  docs: datos.docs,
  fecha_inicio_contrato: Timestamp(nuevas_fechas),
  fecha_fin_contrato: Timestamp(nuevas_fechas),
  ultima_modificacion: serverTimestamp()
}

// UNIDAD
{
  nombre_inquilino: datos.nombre_completo,
  renta_mensual: nuevaRenta
}

// CONTRATO (si aplica)
{
  monto_renta: nuevaRenta,
  monto_deposito: nuevoDeposito,
  dia_pago: nuevoDiaPago,
  fecha_inicio: Timestamp(nuevas_fechas),
  fecha_fin: Timestamp(nuevas_fechas),
  nombre_inquilino: datos.nombre_completo,
  periodos_esperados: periodos_actualizados,
  total_periodos: periodos_actualizados.length
}
```

**⚡ USAR:** `writeBatch()`

---

### ⚠️ **7. CONDONAR DEUDA**

**Función Firebase:** `condonarDeuda(adeudo, motivo)`

**Colecciones afectadas:** PAGOS, CONTRATOS

**Crear documento en PAGOS:**

```javascript
{
  id_unidad: adeudo.id_unidad,
  id_inquilino: adeudo.id_inquilino,
  id_contrato: adeudo.id_contrato,
  periodo: adeudo.periodo,
  anio: parseInt(adeudo.periodo.split('-')[0]),
  mes: parseInt(adeudo.periodo.split('-')[1]),
  
  // Mantener lo que ya se pagó
  monto_pagado: adeudo.monto_pagado,
  total_esperado_periodo: adeudo.total_esperado_periodo,
  saldo_restante_periodo: 0,             // ⭐ Se anula
  
  estatus: "condonado",
  medio_pago: "condonacion",
  condonado: true,
  
  fecha_condonacion: serverTimestamp(),
  motivo_condonacion: motivo,
  monto_condonado: adeudo.saldo_restante_periodo,
  
  servicios: adeudo.servicios || {},
  estado_previo: {
    saldo_antes: adeudo.saldo_restante_periodo,
    pagado_antes: adeudo.monto_pagado,
    estatus_antes: adeudo.estatus
  },
  
  fecha_registro: serverTimestamp()
}
```

**Actualizar en CONTRATO:**

```javascript
periodos_esperados[i] = {
  ...periodoActual,
  estatus: "pagado",                     // ⭐ Se trata como pagado
  monto_pagado: total_esperado,
  saldo_restante: 0,
  fecha_ultimo_pago: Timestamp.now(),
  id_pagos: [...id_pagos_previos, idCondonacion],
  metodo_condonacion: true
}

// Recalcular
periodos_pagados = contar periodos con estatus === "pagado"
```

**⚡ USAR:** `addDoc()` + `updateDoc()`

---

### ⚠️ **8. ELIMINAR UN PAGO**

**Función Firebase:** `eliminarPago(idsPagos, idContrato, periodoNombre)`

**Colecciones afectadas:** PAGOS, CONTRATOS

**Para cada pago a eliminar:**

```javascript
// 1. Obtener datos del pago
const pagoSnap = await getDoc(doc(db, 'pagos', idPago));
const datosPago = pagoSnap.data();

// 2. Si cobró excedentes del depósito → DEVOLVER
let montoADevolver = 0;
if (datosPago.servicios?.excedentes_cobrados_de === "deposito") {
  montoADevolver = datosPago.servicios?.excedentes_del_deposito || 0;
}

// 3. Marcar para eliminación
batch.delete(doc(db, 'pagos', idPago));
```

**Resetear el PERÍODO en CONTRATO:**

```javascript
periodos_esperados[i] = {
  periodo: "2026-01",
  estatus: "pendiente",              // ⭐ Vuelve a pendiente
  monto_pagado: 0,                   // ⭐ Se limpia
  monto_esperado: rentaBase,
  saldo_restante: rentaBase,
  fecha_ultimo_pago: null,
  id_pagos: [],                      // ⭐ Se vacía
  metodo_condonacion: false
}

// Restaurar depósito
monto_deposito = monto_deposito + montoADevolver
periodos_pagados = recalcular()
```

**⚡ USAR:** `writeBatch()` para operación atómica

---

### ⚠️ **9. CREAR REGISTRO DE MANTENIMIENTO**

**Componente:** `MantenimientoForm.jsx`  
**Función Firebase:** `addDoc(collection(db, "mantenimiento"), {...})`

**Colecciones afectadas:** MANTENIMIENTO

**Crear documento:**

```javascript
{
  id_propiedad: formData.id_propiedad,
  id_unidad: formData.id_unidad,
  id_inquilino_afectado: unidadData.id_inquilino || null,
  
  categoria: formData.categoria,           // plomeria, electricidad, etc.
  concepto: formData.concepto,             // Título corto
  descripcion: formData.descripcion,       // Detalle completo
  tipo: formData.tipo,                     // preventivo o correctivo
  prioridad: formData.prioridad,           // baja, media o alta
  
  estatus: "pendiente",
  costo_estimado: Number(formData.costo_estimado),
  costo_real: 0,                           // Se actualiza después
  
  responsable: formData.responsable,
  telefono_responsable: formData.telefono_responsable,
  requiere_entrada_unidad: formData.requiere_entrada_unidad,
  afecta_inquilino: unidadData.id_inquilino ? true : false,
  
  periodo: "2026-01",                      // Auto-generado
  fotos_antes: [],
  fotos_despues: [],
  notas: [],
  
  fecha_registro: Timestamp.fromDate(new Date()),
  fecha_ultima_actualizacion: Timestamp.fromDate(new Date()),
  fecha_finalizacion: null
}
```

**⚡ USAR:** `addDoc()`

---

## 🔗 Matriz de Relaciones

```
UNIDADES ←→ INQUILINOS
  ├─ UNIDAD.id_inquilino = INQUILINO.id ⭐
  ├─ UNIDAD.id_contrato_actual = CONTRATO.id ⭐
  └─ UNIDAD.id_propiedad = PROPIEDAD.id

INQUILINOS ←→ CONTRATOS
  ├─ INQUILINO.id_contrato_actual = CONTRATO.id ⭐
  ├─ INQUILINO.id_unidad_actual = UNIDAD.id ⭐
  └─ INQUILINO.historial_contratos[] = CONTRATO.id[]

CONTRATOS ←→ PAGOS
  ├─ CONTRATO.id_inquilino = INQUILINO.id ⭐
  ├─ CONTRATO.id_unidad = UNIDAD.id ⭐
  └─ CONTRATO.periodos[].id_pagos[] = PAGOS.id[]

PAGOS (sincronizan con CONTRATOS)
  ├─ PAGO.id_inquilino = INQUILINO.id
  ├─ PAGO.id_unidad = UNIDAD.id
  └─ PAGO.id_contrato = CONTRATO.id ⭐

Leyenda: ⭐ = Relación crítica que debe sincronizarse
```

---

## ⚠️ Errores Críticos a Evitar

### 1. **Divergencia de montos en un período**
```javascript
// ❌ MAL - Montos diferentes:
PAGOS[pago1] = { total_esperado: 5000, saldo: 2000 }
PAGOS[pago2] = { total_esperado: 5500, saldo: 1500 }  // DIFERENTE!

// ✅ BIEN - Todos iguales:
PAGOS[pago1] = { total_esperado: 5000, saldo: 1500 }
PAGOS[pago2] = { total_esperado: 5000, saldo: 1500 }  // IGUAL
```

### 2. **Olvidar recalcular `periodos_pagados`**
```javascript
// ❌ MAL:
periodos[i].estatus = "pagado";
// Olvidó actualizar periodos_pagados

// ✅ BIEN:
periodos[i].estatus = "pagado";
periodos_pagados = periodos.filter(p => p.estatus === "pagado").length;
```

### 3. **Cambiar renta con pagos registrados**
```javascript
// ❌ MAL - Daña la integridad:
if (rentaCambió) {
  periodos.forEach(p => p.monto_esperado = nueva_renta);  // PELIGRO
}

// ✅ BIEN - Solo pendientes:
if (rentaCambió) {
  periodos = periodos.map(p =>
    p.estatus === "pendiente" ? {...p, monto_esperado: nueva_renta} : p
  );
}
```

### 4. **No validar pagos antes de finalizar**
```javascript
// ❌ MAL - Sin validación:
await updateDoc(contratoRef, { estatus: "finalizado" });

// ✅ BIEN - Validar primero:
const pendientes = periodos.filter(p => p.estatus !== "pagado");
if (pendientes.length > 0) throw new Error("Periodos pendientes");
await updateDoc(contratoRef, { estatus: "finalizado" });
```

### 5. **No usar Batch para múltiples cambios**
```javascript
// ❌ MAL - Riesgo de inconsistencia:
await updateDoc(inqRef, {...});
await updateDoc(unitRef, {...});
await updateDoc(ctRef, {...});
// Si falla en el medio, base de datos inconsistente

// ✅ BIEN - Operación atómica:
const batch = writeBatch(db);
batch.update(inqRef, {...});
batch.update(unitRef, {...});
batch.update(ctRef, {...});
await batch.commit();
```

---

## 📝 Checklist para Nuevas Operaciones

Antes de crear una función que escriba en BD:

- [ ] ¿Identifiqué todas las colecciones afectadas?
- [ ] ¿Validated todas las referencias (IDs)?
- [ ] ¿Usé Batch o Transaction si hay múltiples escrituras?
- [ ] ¿Actualicé todos los campos que dependen entre sí?
- [ ] ¿Recalculé conteos (ej: `periodos_pagados`)?
- [ ] ¿Validé restricciones antes de actualizar?
- [ ] ¿Convertí Timestamps a Date antes de enviar a UI?
- [ ] ¿Documenté el estado previo para cambios críticos?
- [ ] ¿Manejé errores con mensajes descriptivos?
- [ ] ¿Probé el caso de error (ej: sin permisos)?

---

**Sistema:** GestionER  
**Última actualización:** Enero 2026  
**Versión:** 2.0 (Documentación completa según componentes reales)
