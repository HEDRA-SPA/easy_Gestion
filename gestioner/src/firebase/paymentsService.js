import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
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
    
    // 1. Crear un Batch para operación atómica
    const batch = writeBatch(db);
    const contratoRef = doc(db, 'contratos', idContrato);
    
    // 2. Acumular excedentes del depósito a devolver
    let montoTotalADevolverAlDeposito = 0;
    let cantidadPagosEliminados = 0;
    
    for (const idPago of idsPagos) {
      const pagoRef = doc(db, 'pagos', idPago);
      const pagoSnap = await getDoc(pagoRef);
      
      if (pagoSnap.exists()) {
        const datosPago = pagoSnap.data();
        
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

    // 3. Obtener el contrato actual
    const contratoSnap = await getDoc(contratoRef);
    if (!contratoSnap.exists()) {
      throw new Error("El contrato no existe");
    }
    
    const datosContrato = contratoSnap.data();
    const rentaBase = Number(datosContrato.monto_renta || 0);
    const depositoActual = Number(datosContrato.monto_deposito || 0);
    const nuevoDeposito = depositoActual + montoTotalADevolverAlDeposito;

    console.log(`📊 Depósito: $${depositoActual} → $${nuevoDeposito} (+$${montoTotalADevolverAlDeposito})`);

    // 4. Resetear el periodo afectado en periodos_esperados
    const periodosActualizados = datosContrato.periodos_esperados.map((p) => {
      if (p.periodo === periodoNombre) {
        return {
          ...p,
          estatus: "pendiente",
          monto_pagado: 0,
          monto_esperado: rentaBase, 
          saldo_restante: rentaBase, 
          fecha_ultimo_pago: null,
          id_pagos: [], // Limpiar todas las referencias a pagos
          // Nota: Las lecturas originales se perderán, se capturarán en el siguiente pago
        };
      }
      return p;
    });

    // 5. Calcular periodos pagados actualizados
    const periodosPagados = periodosActualizados.filter(p => p.estatus === "pagado").length;

    // 6. Actualizar el contrato en el batch
    batch.update(contratoRef, {
      monto_deposito: nuevoDeposito,
      periodos_esperados: periodosActualizados,
      periodos_pagados: periodosPagados
    });

    // 7. Ejecutar todas las operaciones de forma atómica
    await batch.commit();

    const mensaje = `✅ Eliminados ${cantidadPagosEliminados} pago(s). Depósito restaurado: +$${montoTotalADevolverAlDeposito}`;
    console.log(mensaje);
    
    return { 
      exito: true, 
      mensaje,
      depositoDevuelto: montoTotalADevolverAlDeposito,
      pagosEliminados: cantidadPagosEliminados
    };

  } catch (error) {
    console.error("❌ Error en eliminarPago:", error);
    return { 
      exito: false, 
      error: error.message 
    };
  }
};
/*
CONTRATOS POR VENCER
RENOVACIONES DE CONTRATOS

ESTADO DE RESULTADOS 
EN LA RENOVACION PEDIR TAMBIEN EL DEPOSITO
*/
