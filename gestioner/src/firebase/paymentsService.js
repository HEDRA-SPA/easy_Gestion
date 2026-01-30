import { doc, getDoc, updateDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';

/**
 * Elimina uno o varios pagos de un periodo y actualiza el contrato
 * @param {Array<string>} idsPagos - Array de IDs de pagos a eliminar
 * @param {string} idContrato - ID del contrato
 * @param {string} periodoNombre - Periodo afectado (ej: "2026-04")
 * @returns {Object} - { exito: boolean, error?: string, mensaje?: string }
 */
export const eliminarPago = async (idsPagos, idContrato, periodoNombre) => {
  try {
    console.log(`🗑️ Iniciando eliminación de ${idsPagos.length} pago(s) del periodo ${periodoNombre}`);
    
    // 1. Obtener TODOS los pagos del periodo ANTES de eliminar
    const pagosRef = collection(db, 'pagos');
    const qPagos = query(
      pagosRef, 
      where('id_contrato', '==', idContrato),
      where('periodo', '==', periodoNombre)
    );
    const pagosDocs = await getDocs(qPagos);
    const todosLosPagosDelPeriodo = [];
    
    pagosDocs.forEach(doc => {
      todosLosPagosDelPeriodo.push({ id: doc.id, ...doc.data() });
    });
    
    // Ordenar por fecha de registro para identificar el primer pago
    todosLosPagosDelPeriodo.sort((a, b) => 
      a.fecha_registro?.seconds - b.fecha_registro?.seconds
    );
    
    const primerPagoId = todosLosPagosDelPeriodo.length > 0 ? todosLosPagosDelPeriodo[0].id : null;
    const seEliminaPrimerPago = idsPagos.includes(primerPagoId);
    
    console.log(`🔍 Total de pagos en el periodo: ${todosLosPagosDelPeriodo.length}`);
    console.log(`🔍 Primer pago ID: ${primerPagoId}`);
    console.log(`🔍 ¿Se elimina el primer pago?: ${seEliminaPrimerPago ? 'SÍ ⚠️' : 'NO'}`);
    
    // 2. Crear un Batch para operación atómica
    const batch = writeBatch(db);
    const contratoRef = doc(db, 'contratos', idContrato);
    
    // 3. Acumular datos de los pagos a eliminar
    let montoTotalADevolverAlDeposito = 0;
    let montoTotalEliminado = 0;
    let cantidadPagosEliminados = 0;
    
    for (const idPago of idsPagos) {
      const pagoRef = doc(db, 'pagos', idPago);
      const pagoSnap = await getDoc(pagoRef);
      
      if (pagoSnap.exists()) {
        const datosPago = pagoSnap.data();
        
        // Acumular monto eliminado
        montoTotalEliminado += Number(datosPago.monto_pagado || 0);
        
        // Si se cobraron excedentes del depósito, los devolvemos
        if (datosPago.servicios?.excedentes_cobrados_de === "deposito") {
          const excedentes = Number(datosPago.servicios?.excedentes_del_deposito || 0);
          montoTotalADevolverAlDeposito += excedentes;
          console.log(`💰 Devolviendo $${excedentes} al depósito (pago: ${idPago})`);
        }
        
        // Marcar el pago para eliminación en el batch
        batch.delete(pagoRef);
        cantidadPagosEliminados++;
      } else {
        console.warn(`⚠️ Pago ${idPago} no existe, se omite`);
      }
    }

    // 4. Obtener el contrato actual
    const contratoSnap = await getDoc(contratoRef);
    if (!contratoSnap.exists()) {
      throw new Error("El contrato no existe");
    }
    
    const datosContrato = contratoSnap.data();
    const rentaBase = Number(datosContrato.monto_renta || 0);
    const depositoActual = Number(datosContrato.monto_deposito || 0);
    const nuevoDeposito = depositoActual + montoTotalADevolverAlDeposito;

    console.log(`📊 Depósito: $${depositoActual} → $${nuevoDeposito} (+$${montoTotalADevolverAlDeposito})`);
    console.log(`📊 Monto total eliminado: $${montoTotalEliminado}`);

    // 5. Actualizar el periodo afectado en periodos_esperados
    let periodosActualizados;
    
    if (seEliminaPrimerPago) {
      // ⚠️ CASO 1: SE ELIMINA EL PRIMER PAGO → RESETEAR TODO EL PERIODO
      console.log('⚠️ RESETEANDO PERIODO COMPLETO (se eliminó el primer pago)');
      
      periodosActualizados = datosContrato.periodos_esperados.map((p) => {
        if (p.periodo === periodoNombre) {
          return {
            ...p,
            estatus: "pendiente",
            monto_pagado: 0,
            monto_esperado: rentaBase, 
            saldo_restante: rentaBase, 
            fecha_ultimo_pago: null,
            id_pagos: [], // Limpiar todas las referencias
            // Las lecturas de servicios se perderán y se capturarán en el siguiente pago
          };
        }
        return p;
      });
      
    } else {
      // ✅ CASO 2: SE ELIMINA UN ABONO POSTERIOR → SOLO ACTUALIZAR MONTOS
      console.log('✅ ACTUALIZANDO MONTOS (se eliminó un abono posterior)');
      
      periodosActualizados = datosContrato.periodos_esperados.map((p) => {
        if (p.periodo === periodoNombre) {
          const montoActual = Number(p.monto_pagado || 0);
          const nuevoMontoPagado = Math.max(0, montoActual - montoTotalEliminado);
          const nuevoSaldo = Number(p.monto_esperado || rentaBase) - nuevoMontoPagado;
          
          // Determinar nuevo estatus
          let nuevoEstatus = "pendiente";
          if (nuevoMontoPagado >= Number(p.monto_esperado || rentaBase)) {
            nuevoEstatus = "pagado";
          } else if (nuevoMontoPagado > 0) {
            nuevoEstatus = "parcial";
          }
          
          // Remover los IDs de pagos eliminados del array
          const nuevosIdPagos = (p.id_pagos || []).filter(id => !idsPagos.includes(id));
          
          console.log(`   Periodo ${periodoNombre}:`);
          console.log(`   - Monto pagado: $${montoActual} → $${nuevoMontoPagado}`);
          console.log(`   - Saldo: $${p.saldo_restante} → $${nuevoSaldo}`);
          console.log(`   - Estatus: ${p.estatus} → ${nuevoEstatus}`);
          console.log(`   - IDs de pagos: ${p.id_pagos?.length || 0} → ${nuevosIdPagos.length}`);
          
          return {
            ...p,
            monto_pagado: nuevoMontoPagado,
            saldo_restante: nuevoSaldo,
            estatus: nuevoEstatus,
            id_pagos: nuevosIdPagos,
            // IMPORTANTE: Mantener las lecturas de servicios y fecha del primer pago
            // fecha_ultimo_pago: se mantiene como estaba
          };
        }
        return p;
      });
    }

    // 6. Calcular periodos pagados actualizados
    const periodosPagados = periodosActualizados.filter(p => p.estatus === "pagado").length;

    // 7. Actualizar el contrato en el batch
    batch.update(contratoRef, {
      monto_deposito: nuevoDeposito,
      periodos_esperados: periodosActualizados,
      periodos_pagados: periodosPagados
    });

    // 8. Ejecutar todas las operaciones de forma atómica
    await batch.commit();

    const mensaje = seEliminaPrimerPago
      ? `✅ Eliminados ${cantidadPagosEliminados} pago(s). PERIODO RESETEADO. Depósito restaurado: +$${montoTotalADevolverAlDeposito}`
      : `✅ Eliminados ${cantidadPagosEliminados} abono(s). Monto ajustado: -$${montoTotalEliminado}. Depósito restaurado: +$${montoTotalADevolverAlDeposito}`;
    
    console.log(mensaje);
    
    return { 
      exito: true, 
      mensaje,
      depositoDevuelto: montoTotalADevolverAlDeposito,
      pagosEliminados: cantidadPagosEliminados,
      seReseteo: seEliminaPrimerPago
    };

  } catch (error) {
    console.error("❌ Error en eliminarPago:", error);
    return { 
      exito: false, 
      error: error.message 
    };
  }
};