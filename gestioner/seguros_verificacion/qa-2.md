# 🏁 CH-1. Verificación de Integridad - GestionER

Este documento sirve para validar que las operaciones atómicas se ejecutaron correctamente en todas las colecciones implicadas.

---
28 de Enero del 2026

## 🟢 1. Registro de Nuevo Inquilino
**Objetivo:** Validar la triangulación entre Inquilino, Contrato y Unidad.

- [] **Colección INQUILINOS:**
    - [] Se creó el documento con ID prefijado `inq_`.
    - [] `id_contrato_actual` coincide exactamente con el ID del contrato creado.
    - [] `id_unidad_actual` coincide con el ID de la unidad seleccionada.
    - [] `activo` está en `true`.
    - [] Los demas campso informativos se crean correctamente.
- [] **Colección CONTRATOS:**
    - [] El campo `id_inquilino` apunta al ID del inquilino creado.
    - [] El campo `id_unidad` apunta a la unidad correcta.
    - [] `periodos_esperados` se generó con la cantidad correcta de meses según las fechas.
    - [] `estatus` es `"activo"`.
- [] **Colección UNIDADES:**
    - [] `estado` cambió a `"Ocupado"`.
    - [] `id_inquilino` y `nombre_inquilino` están actualizados.
    - [] `id_contrato_actual` apunta al nuevo contrato.

---

## 🔵 2. Registro de Pago (Primer Pago del Mes)
**Objetivo:** Validar cálculos de excedentes y actualización de saldos.

- [] **Colección PAGOS:**
    - [] Se registró el `monto_pagado` enviado.
    - [] `total_esperado_periodo` incluye Renta + Excedentes (si aplica).
    - [] El `saldo_restante_periodo` se calcula correctamente.
    - [] El objeto `servicios` contiene las lecturas de agua/luz capturadas.
- [] **Colección CONTRATOS:**
    - [] El array `periodos_esperados` en el índice del mes:
        - [] El ID del pago se agregó al array `id_pagos`.
        - [] `monto_pagado` se actualizó correctamente.
        - [] `saldo_restante` refleja la resta (Esperado - Pagado).
        - [] `estatus` cambió a `"parcial"` o `"pagado"`.
    - [] El contador global `periodos_pagados` se incrementó (si el estatus es "pagado").
- [] **Sincronización de Depósito (Si aplica):**
    - [] Si se cobró de depósito, el `monto_deposito` en la colección **CONTRATOS** disminuyó.

### 🔵 2.1 Registro de Pago (Primer Pago del Mes)
#### **Objetivo:** Que los pagos parciales se realicen correctamente.

- [] **Colección PAGOS:**
    - [] Los servicios no se sobreescriben, la cantidad de luz y agua se definio en el primer pago.
- [] **Colección CONTRATOS:**
    - [] El array `periodos_esperados` en el índice del mes:
        - [] El ID del pago se agregó al array `id_pagos`.
        - [] `monto_pagado` se actualizó correctamente.
        - [] `saldo_restante` refleja la resta se actualiza correctamente
        - [] `estatus` cambió a `"parcial"` o `"pagado"` dependidendo de las cantidades de pago parcial hecho.
    - [] El contador global `periodos_pagados` se incrementó (si el estatus es "pagado") solo en caso de que el pago parcial haya completado la cantidad de renta o renta y servicios.

---

## 🟠 3. Edición de Pago / Datos de Inquilino
**Objetivo:** Evitar divergencia de datos históricos.

- [] **Validación de Restricciones:**
    - [] Si existen pagos, el sistema bloqueó el cambio de fechas de contrato.
    - [] Si se cambió la renta, solo se afectaron los periodos con estatus `"pendiente"`.
- [] **Sincronía de Edición:**
    - [] Al cambiar el monto de un pago, el `saldo_restante_periodo` se actualizó en TODOS los documentos de pago de ese mismo mes.
    - [] El `monto_pagado` total en el Contrato coincide con la suma de los recibos en la colección Pagos.

---

## 🔴 4. Finalización de Contrato (Check-out)
**Objetivo:** Asegurar que la unidad quede libre y el inquilino inactivo.

- [] **Colección CONTRATOS:**
    - [] `estatus` cambió a `"finalizado"`.
    - [] No existen periodos con saldo pendiente (debió validarse antes).
- [] **Colección INQUILINOS:**
    - [] `activo` cambió a `false`.
      [] `estado` cambió a `Inactivo`.
    - [] `id_contrato_actual` e `id_unidad_actual` son `null`.
    - [] El ID del contrato se movió al array `historial_contratos`.
- [] **Colección UNIDADES:**
    - [] `estado` volvió a `"Disponible"`.
    - [] `id_inquilino` y `id_contrato_actual` son `null` o vacíos.
  - [] `nombre_inquilino` y `renta_actual` y `no_personas` vuelven a valores neturales.
---

## 🛠️ 5. Mantenimiento
**Objetivo:** Registro operativo sin afectar finanzas (a menos que se acuerde).

- [] **Colección MANTENIMIENTO:**
    - [] El ticket se creó con la `prioridad` y `categoria` correcta.
    - [] `id_unidad` está correctamente vinculado.
    - [] Si la unidad estaba ocupada, `afecta_inquilino` es `true` y guardó el `id_inquilino_afectado`.

---

## 🟡 6. Edición de Datos de Inquilino (Modo Edición)
**Objetivo:** Validar restricciones de cambios según estado de pagos.

- [] **Validación de Restricciones:**
    - [] Si existen pagos registrados:
        - [] El sistema BLOQUEÓ el cambio de `fecha_inicio_contrato`.
        - [] El sistema BLOQUEÓ el cambio de `fecha_fin_contrato`.
        - [] El sistema BLOQUEÓ el cambio de `monto_deposito`.
        - [] Se mostró error descriptivo: "NO_SE_PUEDE_MODIFICAR_FECHAS" o "NO_SE_PUEDE_MODIFICAR_DEPOSITO".
    - [] Si NO existen pagos:
        - [ ] El sistema PERMITE cambiar fechas y regenerar periodos.
        - [ ] El sistema PERMITE cambiar depósito sin restricciones.
- [ ] **Cambios de Renta:**
    - [ ] Si hay pagos registrados Y cambió la renta:
        - [ ] Solo se actualizó `monto_esperado` en periodos con estatus `"pendiente"`.
        - [ ] Periodos con estatus `"pagado"` o `"parcial"` NO se modificaron.
    - [ ] Si NO hay pagos:
        - [ ] Se permite cambiar renta libremente en todos los periodos.
- [ ] **Colección INQUILINOS:**
    - [ ] Todos los campos informativos se actualizaron: nombre, teléfonos, documentos, etc.
    - [ ] `renta_actual` se actualizó con el nuevo monto.
    - [ ] `ultima_modificacion` se grabó con `serverTimestamp()`.
- [ ] **Colección UNIDADES:**
    - [ ] `nombre_inquilino` se actualizó.
    - [ ] `renta_mensual` se actualizó.
- [ ] **Colección CONTRATOS:**
    - [ ] `nombre_inquilino` se actualizó.
    - [ ] `monto_renta` se actualizó (si fue permitido).
    - [ ] `monto_deposito` se actualizó SOLO si no hay pagos.
    - [ ] `periodos_esperados` se regeneró (si cambiaron fechas y no hay pagos).
    - [ ] `total_periodos` se recalculó.

---

## 🔄 7. Reactivación de Inquilino (Renovación de Contrato)
**Objetivo:** Validar que el inquilino inactivo se reactiva correctamente con nuevo contrato.

- [ ] **Condición Previa:**
    - [ ] El inquilino tiene `activo = false` en INQUILINOS.
    - [ ] El inquilino tiene `estado = "Inactivo"` en INQUILINOS.
- [ ] **Colección INQUILINOS:**
    - [ ] `activo` cambió a `true`.
    - [ ] `estado` cambió a `"Activo"`.
    - [ ] `id_contrato_actual` apunta al nuevo contrato (formato: `con_R${timestamp}_...`).
    - [ ] `id_unidad_actual` apunta a la unidad seleccionada.
    - [ ] `renta_actual`, `dia_pago`, `no_personas` se actualizaron con los nuevos datos.
    - [ ] `fecha_inicio_contrato` y `fecha_fin_contrato` se actualizaron.
    - [ ] El contrato anterior NO aparece en `id_contrato_actual` (es reemplazado).
    - [ ] El contrato anterior SÍ está en `historial_contratos` (si estaba previamente).
- [ ] **Colección CONTRATOS (NUEVO):**
    - [ ] Se creó un nuevo contrato con ID especial: `con_R${timestamp}_${id_inquilino}`.
    - [ ] `id_inquilino` apunta al inquilino reactivado.
    - [ ] `id_unidad` apunta a la nueva unidad.
    - [ ] `estatus` es `"activo"`.
    - [ ] `periodos_esperados` se generó desde cero con nuevas fechas.
    - [ ] `periodos_pagados` es `0` (nuevo contrato).
    - [ ] `total_periodos` coincide con la cantidad de meses.
- [ ] **Colección UNIDADES:**
    - [ ] `id_inquilino` apunta al inquilino reactivado.
    - [ ] `id_contrato_actual` apunta al nuevo contrato.
    - [ ] `estado` es `"Ocupado"`.
    - [ ] `nombre_inquilino` y `renta_mensual` se actualizaron.
    - [ ] `no_personas` se actualizó.

---

## 💰 8. Condonación de Deuda
**Objetivo:** Validar que la deuda se perdona correctamente y se sincroniza con el contrato.

- [ ] **Colección PAGOS (NUEVO REGISTRO):**
    - [ ] Se creó un nuevo documento de pago.
    - [ ] `estatus` es `"condonado"`.
    - [ ] `medio_pago` es `"condonacion"`.
    - [ ] `condonado` es `true`.
    - [ ] `monto_pagado` es el monto que ya se había pagado (si había).
    - [ ] `saldo_restante_periodo` es `0`.
    - [ ] `monto_condonado` es igual a la deuda que se perdonó.
    - [ ] `motivo_condonacion` contiene la razón ingresada.
    - [ ] `estado_previo` contiene el estado antes de la condonación:
        - [ ] `saldo_antes` = saldo que había.
        - [ ] `pagado_antes` = monto pagado antes.
        - [ ] `estatus_antes` = estado anterior ("pendiente" o "parcial").
    - [ ] `servicios` contiene los servicios del período (si aplica).
    - [ ] El ID del pago de condonación se registró.
- [ ] **Colección CONTRATOS:**
    - [ ] En `periodos_esperados[periodo]`:
        - [ ] `estatus` cambió a `"pagado"`.
        - [ ] `monto_pagado` ahora iguala a `monto_esperado`.
        - [ ] `saldo_restante` es `0`.
        - [ ] `fecha_ultimo_pago` se actualizó a `Timestamp.now()`.
        - [ ] El ID de la condonación se agregó al array `id_pagos`.
        - [ ] `metodo_condonacion` es `true`.
    - [ ] `periodos_pagados` se incrementó (si el período ahora está "pagado").
- [ ] **Integridad de Datos:**
    - [ ] No se modificó el `monto_deposito` (la condonación es solo de renta).
    - [ ] Otros periodos del mismo contrato NO se afectaron.

---

## 🗑️ 9. Eliminación de Pago
**Objetivo:** Validar que el pago se elimina y el período se resetea correctamente.

- [ ] **Validación Previa:**
    - [ ] Se identificó el pago a eliminar.
    - [ ] Se validó que pertenece al período correcto.
    - [ ] Se verificó si se cobraron excedentes del depósito.
- [ ] **Colección PAGOS:**
    - [ ] El documento de pago fue eliminado.
    - [ ] Si había múltiples pagos en el mes, solo se eliminó el seleccionado.
- [ ] **Colección CONTRATOS:**
    - [ ] En `periodos_esperados[periodo]`:
        - [ ] `estatus` volvió a `"pendiente"` o `"parcial"`.
        - [ ] `monto_pagado` se reinició a `0`.
        - [ ] `monto_esperado` volvió a la `renta_actual` del contrato (o renta_base).
        - [ ] `saldo_restante` es ahora igual a `monto_esperado`.
        - [ ] `fecha_ultimo_pago` se limpió (volvió a `null`).
        - [ ] El array `id_pagos` se vacío (se removieron todas las referencias).
        - [ ] `metodo_condonacion` volvió a `false`.
    - [ ] `periodos_pagados` se recalculó y se decrementó (si es necesario).
- [ ] **Sincronización de Depósito:**
    - [ ] Si el pago eliminado tenía excedentes cobrados del depósito:
        - [ ] `monto_deposito` se incrementó con el monto devuelto.
        - [ ] Ejemplo: Si se cobraron $100 del depósito, `monto_deposito += 100`.
    - [ ] Si NO había excedentes, el depósito permanece igual.
- [ ] **Integridad Multi-Pago:**
    - [ ] Si hay otros pagos en el mismo período, sus registros se sincronizaron:
        - [ ] Su `total_esperado_periodo` se actualizó (si cambió).
        - [ ] Su `saldo_restante_periodo` se recalculó.
        - [ ] Su `estatus` se ajustó según nuevo saldo.

---

## 📋 10. Edición de Pago Existente
**Objetivo:** Validar cambios de montos y servicios manteniendo coherencia.

### **Caso A: Edición del Primer Pago (con Lecturas)**
- [ ] **Restricciones según tipo:**
    - [ ] Es el `esPrimerPago = true`.
    - [ ] PERMITE: cambiar monto, lecturas de agua/luz, medio de pago.
    - [ ] PERMITE: cambiar opción de cobrar excedentes ("renta" o "deposito").
- [ ] **Cambio de Monto:**
    - [ ] `monto_pagado` se actualizó al nuevo valor.
    - [ ] `saldo_restante_periodo` se recalculó en CONTRATO.
    - [ ] Si hay otros pagos del mes, se sincronizaron (actualizó `saldo_restante_periodo` en todos).
- [ ] **Cambio de Lecturas (agua/luz):**
    - [ ] Las nuevas lecturas se grabaron en `servicios.agua_lectura` y `servicios.luz_lectura`.
    - [ ] Se recalcularon excedentes automáticamente.
- [ ] **Cambio de Opción de Excedentes:**
    - [ ] Si cambió de "renta" a "deposito":
        - [ ] `monto_deposito` se decrementó con los excedentes.
        - [ ] `total_esperado_periodo` se ajustó (sin excedentes en renta).
    - [ ] Si cambió de "deposito" a "renta":
        - [ ] `monto_deposito` se restauró (se le devolvió lo que se había descargado).
        - [ ] `total_esperado_periodo` incluyó los excedentes.
    - [ ] En ambos casos, `saldo_restante_periodo` se recalculó correctamente.
- [ ] **Sincronización Crítica:**
    - [ ] TODOS los pagos del período deben tener el MISMO `total_esperado_periodo`.
    - [ ] TODOS los pagos del período deben tener el MISMO `saldo_restante_periodo`.
  
### **Caso B: Edición de Pago Adicional (sin Lecturas)**
- [ ] **Restricciones según tipo:**
    - [ ] Es un `esPrimerPago = false` (pago secundario del mes).
    - [ ] PERMITE: cambiar monto, medio de pago.
    - [ ] BLOQUEA: cambiar lecturas (agua/luz).
    - [ ] BLOQUEA: cambiar opción de excedentes.
- [ ] **Cambio de Monto:**
    - [ ] `monto_pagado` se actualizó.
    - [ ] Se recalculó suma total de abonos (primer pago + otros pagos).
    - [ ] `saldo_restante_periodo` se actualizó en CONTRATO y en TODOS los pagos del mes.
    - [ ] `estatus` se ajustó según nuevo saldo ("pendiente", "parcial" o "pagado").
- [ ] **Sin Cambios en Servicios:**
    - [ ] Los servicios (agua, luz) se mantuvieron iguales.
    - [ ] `total_esperado_periodo` NO cambió.

---

## 🔐 11. Validaciones Globales (Casos Transversales)
**Objetivo:** Verificar que restricciones y consistencias apliquen a todas las operaciones.

- [ ] **Sincronización de IDs:**
    - [ ] INQUILINO.id_contrato_actual == CONTRATO.id (¿iguales?).
    - [ ] INQUILINO.id_unidad_actual == UNIDAD.id (¿iguales?).
    - [ ] UNIDAD.id_inquilino == INQUILINO.id (¿iguales?).
    - [ ] UNIDAD.id_contrato_actual == CONTRATO.id (¿iguales?).
    - [ ] CONTRATO.id_inquilino == INQUILINO.id (¿iguales?).
    - [ ] CONTRATO.id_unidad == UNIDAD.id (¿iguales?).
    - [ ] PAGO.id_inquilino == INQUILINO.id (¿iguales?).
    - [ ] PAGO.id_contrato == CONTRATO.id (¿iguales?).

- [ ] **Coherencia de Montos:**
    - [ ] `INQUILINO.renta_actual` == `CONTRATO.monto_renta` (si están vinculados).
    - [ ] `UNIDAD.renta_mensual` == `INQUILINO.renta_actual` (si están vinculados).
    - [ ] Todos los PAGOS del mismo período tienen `total_esperado_periodo` igual.
    - [ ] Todos los PAGOS del mismo período tienen `saldo_restante_periodo` igual.

- [ ] **Conteos y Resúmenes:**
    - [ ] `CONTRATO.periodos_pagados` = cantidad de periodos con estatus "pagado" (¿correcto?).
    - [ ] `CONTRATO.total_periodos` = cantidad de elementos en `periodos_esperados` (¿correcto?).

- [ ] **Estados Válidos:**
    - [ ] `INQUILINO.activo` es boolean (true o false, nunca null).
    - [ ] `CONTRATO.estatus` es uno de: "activo", "finalizado", "renovado".
    - [ ] Periodo.estatus es uno de: "pendiente", "parcial", "pagado", "condonado".
    - [ ] `PAGO.estatus` coincide con Periodo.estatus.

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