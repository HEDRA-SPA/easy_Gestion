# 🏁 CH-1. Verificación de Integridad - GestionER

Este documento sirve para validar que las operaciones atómicas se ejecutaron correctamente en todas las colecciones implicadas.

---
28 de Enero del 2026

## 🟢 1. Registro de Nuevo Inquilino
**Objetivo:** Validar la triangulación entre Inquilino, Contrato y Unidad.

- [SI] **Colección INQUILINOS:**
    - [SI] Se creó el documento con ID prefijado `inq_`.
    - [SI] `id_contrato_actual` coincide exactamente con el ID del contrato creado.
    - [SI] `id_unidad_actual` coincide con el ID de la unidad seleccionada.
    - [SI] `activo` está en `true`.
    - [SI] Los demas campso informativos se crean correctamente.
- [SI] **Colección CONTRATOS:**
    - [SI] El campo `id_inquilino` apunta al ID del inquilino creado.
    - [SI] El campo `id_unidad` apunta a la unidad correcta.
    - [SI] `periodos_esperados` se generó con la cantidad correcta de meses según las fechas.
    - [SI] `estatus` es `"activo"`.
- [SI] **Colección UNIDADES:**
    - [SI] `estado` cambió a `"Ocupado"`.
    - [SI] `id_inquilino` y `nombre_inquilino` están actualizados.
    - [SI] `id_contrato_actual` apunta al nuevo contrato.

---

## 🔵 2. Registro de Pago (Primer Pago del Mes)
**Objetivo:** Validar cálculos de excedentes y actualización de saldos.

- [SI] **Colección PAGOS:**
    - [SI] Se registró el `monto_pagado` enviado.
    - [SI] `total_esperado_periodo` incluye Renta + Excedentes (si aplica).
    - [SI] El `saldo_restante_periodo` se calcula correctamente.
    - [SI] El objeto `servicios` contiene las lecturas de agua/luz capturadas.
- [SI] **Colección CONTRATOS:**
    - [SI] El array `periodos_esperados` en el índice del mes:
        - [SI] El ID del pago se agregó al array `id_pagos`.
        - [SI] `monto_pagado` se actualizó correctamente.
        - [SI] `saldo_restante` refleja la resta (Esperado - Pagado).
        - [SI] `estatus` cambió a `"parcial"` o `"pagado"`.
    - [SI] El contador global `periodos_pagados` se incrementó (si el estatus es "pagado").
- [SI] **Sincronización de Depósito (Si aplica):**
    - [SI] Si se cobró de depósito, el `monto_deposito` en la colección **CONTRATOS** disminuyó.

### 🔵 2.1 Registro de Pago (Primer Pago del Mes)
#### **Objetivo:** Que los pagos parciales se realicen correctamente.

- [SI] **Colección PAGOS:**
    - [SI] Los servicios no se sobreescriben, la cantidad de luz y agua se definio en el primer pago.
- [SI] **Colección CONTRATOS:**
    - [SI] El array `periodos_esperados` en el índice del mes:
        - [SI] El ID del pago se agregó al array `id_pagos`.
        - [SI] `monto_pagado` se actualizó correctamente.
        - [SI] `saldo_restante` refleja la resta se actualiza correctamente
        - [SI] `estatus` cambió a `"parcial"` o `"pagado"` dependidendo de las cantidades de pago parcial hecho.
    - [SI] El contador global `periodos_pagados` se incrementó (si el estatus es "pagado") solo en caso de que el pago parcial haya completado la cantidad de renta o renta y servicios.

---

## 🟠 3. Edición de Pago / Datos de Inquilino
**Objetivo:** Evitar divergencia de datos históricos.

- [SI] **Validación de Restricciones:**
    - [SI] Si existen pagos, el sistema bloqueó el cambio de fechas de contrato.
    - [SI] Si se cambió la renta, solo se afectaron los periodos con estatus `"pendiente"`.
- [SI] **Sincronía de Edición:**
    - [SI] Al cambiar el monto de un pago, el `saldo_restante_periodo` se actualizó en TODOS los documentos de pago de ese mismo mes.
    - [SI] El `monto_pagado` total en el Contrato coincide con la suma de los recibos en la colección Pagos.

---

## 🔴 4. Finalización de Contrato (Check-out)
**Objetivo:** Asegurar que la unidad quede libre y el inquilino inactivo.

- [SI] **Colección CONTRATOS:**
    - [SI] `estatus` cambió a `"finalizado"`.
    - [SI] No existen periodos con saldo pendiente (debió validarse antes).
- [SI] **Colección INQUILINOS:**
    - [SI] `activo` cambió a `false`.
      [SI] `estado` cambió a `Inactivo`.
    - [SI] `id_contrato_actual` e `id_unidad_actual` son `null`.
    - [SI] El ID del contrato se movió al array `historial_contratos`.
- [SI] **Colección UNIDADES:**
    - [SI] `estado` volvió a `"Disponible"`.
    - [SI] `id_inquilino` y `id_contrato_actual` son `null` o vacíos.
  - [SI] `nombre_inquilino` y `renta_actual` y `no_personas` vuelven a valores neturales.
---

## 🛠️ 5. Mantenimiento
**Objetivo:** Registro operativo sin afectar finanzas (a menos que se acuerde).

- [SI] **Colección MANTENIMIENTO:**
    - [SI] El ticket se creó con la `prioridad` y `categoria` correcta.
    - [SI] `id_unidad` está correctamente vinculado.
    - [SI] Si la unidad estaba ocupada, `afecta_inquilino` es `true` y guardó el `id_inquilino_afectado`.

---

## 🟡 6. Edición de Datos de Inquilino (Modo Edición)
**Objetivo:** Validar restricciones de cambios según estado de pagos.

- [SI] **Validación de Restricciones:**
    - [SI] Si existen pagos registrados:
        - [SI] El sistema BLOQUEÓ el cambio de `fecha_inicio_contrato`.
        - [SI] El sistema BLOQUEÓ el cambio de `fecha_fin_contrato`.
        - [SI] El sistema BLOQUEÓ el cambio de `monto_deposito`.
        - [SI] Se mostró error descriptivo: "NO_SE_PUEDE_MODIFICAR_FECHAS" o "NO_SE_PUEDE_MODIFICAR_DEPOSITO".
    - [SI] Si NO existen pagos:
        - [SI] El sistema PERMITE cambiar fechas y regenerar periodos.
        - [SI] El sistema PERMITE cambiar depósito sin restricciones.
- [SI] **Cambios de Renta:**
    - [SI] Si hay pagos registrados Y cambió la renta:
        - [SI] Solo se actualizó `monto_esperado` en periodos con estatus `"pendiente"`.
        - [SI] Periodos con estatus `"pagado"` o `"parcial"` NO se modificaron.
    - [SI] Si NO hay pagos:
        - [SI] Se permite cambiar renta libremente en todos los periodos.
- [SI] **Colección INQUILINOS:**
    - [SI] Todos los campos informativos se actualizaron: nombre, teléfonos, documentos, etc.
    - [SI] `renta_actual` se actualizó con el nuevo monto.
    - [SI] `ultima_modificacion` se grabó con `serverTimestamp()`.
- [SI] **Colección UNIDADES:**
    - [SI] `nombre_inquilino` se actualizó.
    - [SI] `renta_mensual` se actualizó.
- [SI] **Colección CONTRATOS:**
    - [SI] `nombre_inquilino` se actualizó.
    - [SI] `monto_renta` se actualizó (si fue permitido).
    - [SI] `monto_deposito` se actualizó SOLO si no hay pagos.
    - [SI] `periodos_esperados` se regeneró (si cambiaron fechas y no hay pagos).
    - [SI] `total_periodos` se recalculó.

---

## 🔄 7. Reactivación de Inquilino (Renovación de Contrato)
**Objetivo:** Validar que el inquilino inactivo se reactiva correctamente con nuevo contrato.

- [SI] **Condición Previa:**
    - [SI] El inquilino tiene `activo = false` en INQUILINOS.
    - [SI] El inquilino tiene `estado = "Inactivo"` en INQUILINOS.
- [SI] **Colección INQUILINOS:**
    - [SI] `activo` cambió a `true`.
    - [SI] `estado` cambió a `"Activo"`.
    - [SI] `id_contrato_actual` apunta al nuevo contrato (formato: `con_R${timestamp}_...`).
    - [SI] `id_unidad_actual` apunta a la unidad seleccionada.
    - [SI] `renta_actual`, `dia_pago`, `no_personas` se actualizaron con los nuevos datos.
    - [SI] `fecha_inicio_contrato` y `fecha_fin_contrato` se actualizaron.
    - [SI] El contrato anterior NO aparece en `id_contrato_actual` (es reemplazado).
    - [SI] El contrato anterior SÍ está en `historial_contratos` (si estaba previamente).
- [SI] **Colección CONTRATOS (NUEVO):**
    - [SI] Se creó un nuevo contrato con ID especial: `con_R${timestamp}_${id_inquilino}`.
    - [SI] `id_inquilino` apunta al inquilino reactivado.
    - [SI] `id_unidad` apunta a la nueva unidad.
    - [SI] `estatus` es `"activo"`.
    - [SI] `periodos_esperados` se generó desde cero con nuevas fechas.
    - [SI] `periodos_pagados` es `0` (nuevo contrato).
    - [SI] `total_periodos` coincide con la cantidad de meses.
- [SI] **Colección UNIDADES:**
    - [SI] `id_inquilino` apunta al inquilino reactivado.
    - [SI] `id_contrato_actual` apunta al nuevo contrato.
    - [SI] `estado` es `"Ocupado"`.
    - [SI] `nombre_inquilino` y `renta_mensual` se actualizaron.
    - [SI] `no_personas` se actualizó.

---

## 💰 8. Condonación de Deuda
**Objetivo:** Validar que la deuda se perdona correctamente y se sincroniza con el contrato.

- [SI] **Colección PAGOS (NUEVO REGISTRO):**
    - [SI] Se creó un nuevo documento de pago.
    - [SI] `estatus` es `"condonado"`.
    - [SI] `medio_pago` es `"condonacion"`.
    - [SI] `condonado` es `true`.
    - [SI] `monto_pagado` es el monto que ya se había pagado (si había).
    - [SI] `saldo_restante_periodo` es `0`.
    - [SI] `monto_condonado` es igual a la deuda que se perdonó.
    - [SI] `motivo_condonacion` contiene la razón ingresada.
    - [SI] `estado_previo` contiene el estado antes de la condonación:
        - [SI] `saldo_antes` = saldo que había.
        - [SI] `pagado_antes` = monto pagado antes.
        - [SI] `estatus_antes` = estado anterior ("pendiente" o "parcial").
    - [SI] `servicios` contiene los servicios del período (si aplica).
    - [SI] El ID del pago de condonación se registró.
- [SI] **Colección CONTRATOS:**
    - [SI] En `periodos_esperados[periodo]`:
        - [SI] `estatus` cambió a `"pagado"`.
        - [SI] `monto_pagado` ahora iguala a `monto_esperado`.
        - [SI] `saldo_restante` es `0`.
        - [SI] `fecha_ultimo_pago` se actualizó a `Timestamp.now()`.
        - [SI] El ID de la condonación se agregó al array `id_pagos`.
        - [SI] `metodo_condonacion` es `true`.
    - [SI] `periodos_pagados` se incrementó (si el período ahora está "pagado").
- [SI] **Integridad de Datos:**
    - [SI] No se modificó el `monto_deposito` (la condonación es solo de renta).
    - [SI] Otros periodos del mismo contrato NO se afectaron.

---

## 🗑️ 9. Eliminación de Pago
**Objetivo:** Validar que el pago se elimina y el período se resetea correctamente.

- [SI] **Validación Previa:**
    - [SI] Se identificó el pago a eliminar.
    - [SI] Se validó que pertenece al período correcto.
    - [SI] Se verificó si se cobraron excedentes del depósito.
- [SI] **Colección PAGOS:**
    - [SI] El documento de pago fue eliminado.
    - [SI] Si había múltiples pagos en el mes, solo se eliminó el seleccionado.
- [SI] **Colección CONTRATOS:**
    - [SI] En `periodos_esperados[periodo]`:
        - [SI] `estatus` volvió a `"pendiente"` o `"parcial"`.
        - [SI] `monto_pagado` se reinició a `0`.
        - [SI] `monto_esperado` volvió a la `renta_actual` del contrato (o renta_base).
        - [SI] `saldo_restante` es ahora igual a `monto_esperado`.
        - [SI] `fecha_ultimo_pago` se limpió (volvió a `null`).
        - [SI] El array `id_pagos` se vacío (se removieron todas las referencias).
        - [SI] `metodo_condonacion` volvió a `false`.
    - [SI] `periodos_pagados` se recalculó y se decrementó (si es necesario).
- [SI] **Sincronización de Depósito:**
    - [SI] Si el pago eliminado tenía excedentes cobrados del depósito:
        - [SI] `monto_deposito` se incrementó con el monto devuelto.
        - [SI] Ejemplo: Si se cobraron $100 del depósito, `monto_deposito += 100`.
    - [SI] Si NO había excedentes, el depósito permanece igual.
- [SI] **Integridad Multi-Pago:**
    - [SI] Si hay otros pagos en el mismo período, sus registros se sincronizaron:
        - [SI] Su `total_esperado_periodo` se actualizó (si cambió).
        - [SI] Su `saldo_restante_periodo` se recalculó.
        - [SI] Su `estatus` se ajustó según nuevo saldo.

---

## 📋 10. Edición de Pago Existente
**Objetivo:** Validar cambios de montos y servicios manteniendo coherencia.

### **Caso A: Edición del Primer Pago (con Lecturas)**
- [SI] **Restricciones según tipo:**
    - [SI] Es el `esPrimerPago = true`.
    - [SI] PERMITE: cambiar monto, lecturas de agua/luz, medio de pago.
    - [SI] PERMITE: cambiar opción de cobrar excedentes ("renta" o "deposito").
- [SI] **Cambio de Monto:**
    - [SI] `monto_pagado` se actualizó al nuevo valor.
    - [SI] `saldo_restante_periodo` se recalculó en CONTRATO.
    - [SI] Si hay otros pagos del mes, se sincronizaron (actualizó `saldo_restante_periodo` en todos).
- [SI] **Cambio de Lecturas (agua/luz):**
    - [SI] Las nuevas lecturas se grabaron en `servicios.agua_lectura` y `servicios.luz_lectura`.
    - [SI] Se recalcularon excedentes automáticamente.
- [SI] **Cambio de Opción de Excedentes:**
    - [SI] Si cambió de "renta" a "deposito":
        - [SI] `monto_deposito` se decrementó con los excedentes.
        - [SI] `total_esperado_periodo` se ajustó (sin excedentes en renta).
    - [SI] Si cambió de "deposito" a "renta":
        - [SI] `monto_deposito` se restauró (se le devolvió lo que se había descargado).
        - [SI] `total_esperado_periodo` incluyó los excedentes.
    - [SI] En ambos casos, `saldo_restante_periodo` se recalculó correctamente.
- [SI] **Sincronización Crítica:**
    - [SI] TODOS los pagos del período deben tener el MISMO `total_esperado_periodo`.
    - [SI] TODOS los pagos del período deben tener el MISMO `saldo_restante_periodo`.
  
### **Caso B: Edición de Pago Adicional (sin Lecturas)**
- [SI] **Restricciones según tipo:**
    - [SI] Es un `esPrimerPago = false` (pago secundario del mes).
    - [SI] PERMITE: cambiar monto, medio de pago.
    - [SI] BLOQUEA: cambiar lecturas (agua/luz).
    - [SI] BLOQUEA: cambiar opción de excedentes.
- [SI] **Cambio de Monto:**
    - [SI] `monto_pagado` se actualizó.
    - [SI] Se recalculó suma total de abonos (primer pago + otros pagos).
    - [SI] `saldo_restante_periodo` se actualizó en CONTRATO y en TODOS los pagos del mes.
    - [SI] `estatus` se ajustó según nuevo saldo ("pendiente", "parcial" o "pagado").
- [SI] **Sin Cambios en Servicios:**
    - [SI] Los servicios (agua, luz) se mantuvieron iguales.
    - [SI] `total_esperado_periodo` NO cambió.

---

## 🔐 11. Validaciones Globales (Casos Transversales)
**Objetivo:** Verificar que restricciones y consistencias apliquen a todas las operaciones.

- [SI] **Sincronización de IDs:**
    - [SI] INQUILINO.id_contrato_actual == CONTRATO.id (¿iguales?).
    - [SI] INQUILINO.id_unidad_actual == UNIDAD.id (¿iguales?).
    - [SI] UNIDAD.id_inquilino == INQUILINO.id (¿iguales?).
    - [SI] UNIDAD.id_contrato_actual == CONTRATO.id (¿iguales?).
    - [SI] CONTRATO.id_inquilino == INQUILINO.id (¿iguales?).
    - [SI] CONTRATO.id_unidad == UNIDAD.id (¿iguales?).
    - [SI] PAGO.id_inquilino == INQUILINO.id (¿iguales?).
    - [SI] PAGO.id_contrato == CONTRATO.id (¿iguales?).

- [SI] **Coherencia de Montos:**
    - [SI] `INQUILINO.renta_actual` == `CONTRATO.monto_renta` (si están vinculados).
    - [SI] `UNIDAD.renta_mensual` == `INQUILINO.renta_actual` (si están vinculados).
    - [SI] Todos los PAGOS del mismo período tienen `total_esperado_periodo` igual.
    - [SI] Todos los PAGOS del mismo período tienen `saldo_restante_periodo` igual.

- [SI] **Conteos y Resúmenes:**
    - [SI] `CONTRATO.periodos_pagados` = cantidad de periodos con estatus "pagado" (¿correcto?).
    - [SI] `CONTRATO.total_periodos` = cantidad de elementos en `periodos_esperados` (¿correcto?).

- [SI] **Estados Válidos:**
    - [SI] `INQUILINO.activo` es boolean (true o false, nunca null).
    - [SI] `CONTRATO.estatus` es uno de: "activo", "finalizado", "renovado".
    - [SI] Periodo.estatus es uno de: "pendiente", "parcial", "pagado", "condonado".
    - [SI] `PAGO.estatus` coincide con Periodo.estatus.

---
## 📝 Notas para proximos commits
1. Agregar una seccion desplegable de las unidades particulares de cada propiedad para que se puedan eliminar.


## 📝 Notas para Scripts Automatizados

Al crear scripts de verificación automatizada, considerar:

1. **Verificación de Integridad Referencial:**
   - Cruzar IDs en ambas direcciones (ej: inquilino → contrato Y contrato → inquilino).

2. **Detección de Divergencias:**
   - Comparar `INQUILINO.renta_actual` con `CONTRATO.monto_renta`.
   - Verificar que todos los PAGOS de un período tengan coherencia.

3. **Validación de Conteos:**
   - Recalcular `periodos_pagados` y comparar con el registrado.
   - Contar elementos en `periodos_esperados` y validar contra `total_periodos`.

4. **Auditoría de Cambios:**
   - Registrar timestamps de operaciones.
   - Comparar estado anterior vs estado actual.

5. **Reportes de Anomalías:**
   - Listar inquilinos sin contrato activo pero con `activo = true`.
   - Detectar unidades ocupadas cuyo inquilino está inactivo.
   - Encontrar periodos con saldo inconsistente.