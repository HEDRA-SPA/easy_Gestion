import { doc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './config';

export const eliminarPago = async (idPago, idContrato, periodoNombre) => {
  try {
    const pagoRef = doc(db, 'pagos', idPago);
    const contratoRef = doc(db, 'contratos', idContrato);

    // 1. Obtener datos del pago antes de borrarlo
    const pagoSnap = await getDoc(pagoRef);
    if (!pagoSnap.exists()) throw new Error("El pago no existe");
    
    const datosPago = pagoSnap.data();
    let montoADevolverAlDeposito = 0;

    // Verificar si se usó el depósito en este pago
    if (datosPago.servicios?.excedentes_cobrados_de === "deposito") {
      montoADevolverAlDeposito = Number(datosPago.servicios?.excedentes_del_deposito || 0);
    }

    // 2. Obtener contrato para ver el estado actual
    const contratoSnap = await getDoc(contratoRef);
    if (!contratoSnap.exists()) throw new Error("El contrato no existe");
    
    const datosContrato = contratoSnap.data();
    const depositoActual = Number(datosContrato.monto_deposito || 0);
    const rentaBase = Number(datosContrato.monto_renta || 0);

    // 3. Mapear y resetear el periodo afectado
    const periodosActualizados = datosContrato.periodos_esperados.map((p) => {
      if (p.periodo === periodoNombre) {
        return {
          ...p,
          estatus: "pendiente",
          monto_pagado: 0,
          monto_esperado: rentaBase, 
          saldo_restante: rentaBase, 
          fecha_ultimo_pago: null,
          id_pagos: [] // Limpiamos referencias a pagos
        };
      }
      return p;
    });

    // 4. ACTUALIZACIÓN CRÍTICA DEL CONTRATO
    await updateDoc(contratoRef, {
      monto_deposito: depositoActual + montoADevolverAlDeposito, // DEVOLUCIÓN AL DEPÓSITO
      periodos_esperados: periodosActualizados,
      periodos_pagados: periodosActualizados.filter(p => p.estatus === "pagado").length
    });

    // 5. Borrar el pago físicamente
    await deleteDoc(pagoRef);

    console.log(`✅ Pago eliminado. Se restauraron $${montoADevolverAlDeposito} al depósito.`);
    return { exito: true };

  } catch (error) {
    console.error("❌ Error en eliminarPago:", error);
    return { exito: false, error: error.message };
  }
};