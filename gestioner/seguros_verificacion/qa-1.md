# 🏁 CH-1. Verificación de Integridad - GestionER

Este documento sirve para validar que las operaciones atómicas se ejecutaron correctamente en todas las colecciones implicadas.

---
28 de Enero del 2026

## 🟢 1. Registro de Nuevo Inquilino
**Objetivo:** Validar la triangulación entre Inquilino, Contrato y Unidad.

- [ ] **Colección INQUILINOS:**
    - [ ] Se creó el documento con ID prefijado `inq_`.
    - [ ] `id_contrato_actual` coincide exactamente con el ID del contrato creado.
    - [ ] `id_unidad_actual` coincide con el ID de la unidad seleccionada.
    - [ ] `activo` está en `true`.
    - [ ] Los demas campso informativos se crean correctamente.
- [ ] **Colección CONTRATOS:**
    - [ ] El campo `id_inquilino` apunta al ID del inquilino creado.
    - [ ] El campo `id_unidad` apunta a la unidad correcta.
    - [ ] `periodos_esperados` se generó con la cantidad correcta de meses según las fechas.
    - [ ] `estatus` es `"activo"`.
- [ ] **Colección UNIDADES:**
    - [ ] `estado` cambió a `"Ocupado"`.
    - [ ] `id_inquilino` y `nombre_inquilino` están actualizados.
    - [ ] `id_contrato_actual` apunta al nuevo contrato.

---

## 🔵 2. Registro de Pago (Primer Pago del Mes)
**Objetivo:** Validar cálculos de excedentes y actualización de saldos.

- [ ] **Colección PAGOS:**
    - [ ] Se registró el `monto_pagado` enviado.
    - [ ] `total_esperado_periodo` incluye Renta + Excedentes (si aplica).
    - [ ] El `saldo_restante_periodo` se calcula correctamente.
    - [ ] El objeto `servicios` contiene las lecturas de agua/luz capturadas.
- [ ] **Colección CONTRATOS:**
    - [ ] El array `periodos_esperados` en el índice del mes:
        - [ ] El ID del pago se agregó al array `id_pagos`.
        - [ ] `monto_pagado` se actualizó correctamente.
        - [ ] `saldo_restante` refleja la resta (Esperado - Pagado).
        - [ ] `estatus` cambió a `"parcial"` o `"pagado"`.
    - [ ] El contador global `periodos_pagados` se incrementó (si el estatus es "pagado").
- [ ] **Sincronización de Depósito (Si aplica):**
    - [ ] Si se cobró de depósito, el `monto_deposito` en la colección **CONTRATOS** disminuyó.

### 🔵 2.1 Registro de Pago (Primer Pago del Mes)
#### **Objetivo:** Que los pagos parciales se realicen correctamente.

- [ ] **Colección PAGOS:**
    - [ ] Los servicios no se sobreescriben, la cantidad de luz y agua se definio en el primer pago.
- [ ] **Colección CONTRATOS:**
    - [ ] El array `periodos_esperados` en el índice del mes:
        - [ ] El ID del pago se agregó al array `id_pagos`.
        - [ ] `monto_pagado` se actualizó correctamente.
        - [ ] `saldo_restante` refleja la resta se actualiza correctamente
        - [ ] `estatus` cambió a `"parcial"` o `"pagado"` dependidendo de las cantidades de pago parcial hecho.
    - [ ] El contador global `periodos_pagados` se incrementó (si el estatus es "pagado") solo en caso de que el pago parcial haya completado la cantidad de renta o renta y servicios.

---

## 🟠 3. Edición de Pago / Datos de Inquilino
**Objetivo:** Evitar divergencia de datos históricos.

- [ ] **Validación de Restricciones:**
    - [ ] Si existen pagos, el sistema bloqueó el cambio de fechas de contrato.
    - [ ] Si se cambió la renta, solo se afectaron los periodos con estatus `"pendiente"`.
- [ ] **Sincronía de Edición:**
    - [ ] Al cambiar el monto de un pago, el `saldo_restante_periodo` se actualizó en TODOS los documentos de pago de ese mismo mes.
    - [ ] El `monto_pagado` total en el Contrato coincide con la suma de los recibos en la colección Pagos.

---

## 🔴 4. Finalización de Contrato (Check-out)
**Objetivo:** Asegurar que la unidad quede libre y el inquilino inactivo.

- [ ] **Colección CONTRATOS:**
    - [ ] `estatus` cambió a `"finalizado"`.
    - [ ] No existen periodos con saldo pendiente (debió validarse antes).
- [ ] **Colección INQUILINOS:**
    - [ ] `activo` cambió a `false`.
      [ ] `estado` cambió a `Inactivo`.
    - [ ] `id_contrato_actual` e `id_unidad_actual` son `null`.
    - [ ] El ID del contrato se movió al array `historial_contratos`.
- [ ] **Colección UNIDADES:**
    - [ ] `estado` volvió a `"Disponible"`.
    - [ ] `id_inquilino` y `id_contrato_actual` son `null` o vacíos.
  - [ ] `nombre_inquilino` y `renta_actual` y `no_personas` vuelven a valores neturales.
---

## 🛠️ 5. Mantenimiento
**Objetivo:** Registro operativo sin afectar finanzas (a menos que se acuerde).

- [ ] **Colección MANTENIMIENTO:**
    - [ ] El ticket se creó con la `prioridad` y `categoria` correcta.
    - [ ] `id_unidad` está correctamente vinculado.
    - [ ] Si la unidad estaba ocupada, `afecta_inquilino` es `true` y guardó el `id_inquilino_afectado`.