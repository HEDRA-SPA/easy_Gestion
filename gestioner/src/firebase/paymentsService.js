import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './config';

export const eliminarPago = async (idsPagos, idContrato, periodoNombre) => {
  try {
    // 1. Creamos un "Batch" (una operación múltiple atómica)
    const batch = writeBatch(db);
    const contratoRef = doc(db, 'contratos', idContrato);
    
    let montoTotalADevolverAlDeposito = 0;

    // 2. RECORRER LA LISTA DE IDS (Aquí es donde estaba el fallo)
    // Usamos un for...of para poder usar 'await' dentro si fuera necesario
    for (const idPago of idsPagos) {
      const pagoRef = doc(db, 'pagos', idPago);
      const pagoSnap = await getDoc(pagoRef);
      
      if (pagoSnap.exists()) {
        const datosPago = pagoSnap.data();
        
        // Sumamos si este abono específico usó dinero del depósito
        if (datosPago.servicios?.excedentes_cobrados_de === "deposito") {
          montoTotalADevolverAlDeposito += Number(datosPago.servicios?.excedentes_del_deposito || 0);
        }
        
        // Marcamos este pago para ser borrado en el batch
        batch.delete(pagoRef);
      }
    }

    // 3. Obtener contrato para resetear el periodo
    const contratoSnap = await getDoc(contratoRef);
    if (!contratoSnap.exists()) throw new Error("El contrato no existe");
    
    const datosContrato = contratoSnap.data();
    const rentaBase = Number(datosContrato.monto_renta || 0);
    const depositoActual = Number(datosContrato.monto_deposito || 0);

    // 4. Limpiar el periodo en el array del contrato
    const periodosActualizados = datosContrato.periodos_esperados.map((p) => {
      if (p.periodo === periodoNombre) {
        return {
          ...p,
          estatus: "pendiente",
          monto_pagado: 0,
          monto_esperado: rentaBase, 
          saldo_restante: rentaBase, 
          fecha_ultimo_pago: null,
          id_pagos: [] // Borramos todas las referencias a los pagos borrados
        };
      }
      return p;
    });

    // 5. Actualizar el contrato dentro del mismo batch
    batch.update(contratoRef, {
      monto_deposito: depositoActual + montoTotalADevolverAlDeposito,
      periodos_esperados: periodosActualizados,
      periodos_pagados: periodosActualizados.filter(p => p.estatus === "pagado").length
    });

    // 6. ¡EJECUTAR TODO! (Borra pagos y actualiza contrato al mismo tiempo)
    await batch.commit();

    console.log("✅ Proceso completado con éxito");
    return { exito: true };

  } catch (error) {
    console.error("❌ Error en eliminarPago:", error);
    return { exito: false, error: error.message };
  }
};