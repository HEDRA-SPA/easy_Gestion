import { db, FirebaseTimestamp } from './config';
import { 
 doc, 
  collection, 
  writeBatch, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  Timestamp,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
  arrayUnion,
  setDoc,
  orderBy
} from 'firebase/firestore';

// ============================================
// UTILIDAD: Generar periodos esperados
// ============================================
const generarPeriodosEsperados = (fechaInicio, fechaFin, montoRenta) => {
  const periodos = [];
  const inicio = fechaInicio.toDate ? fechaInicio.toDate() : new Date(fechaInicio);
  const fin = fechaFin.toDate ? fechaFin.toDate() : new Date(fechaFin);
  
  let actual = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const limite = new Date(fin.getFullYear(), fin.getMonth(), 1);
  
  while (actual <= limite) {
    const anio = actual.getFullYear();
    const mes = actual.getMonth() + 1;
    const periodo = `${anio}-${mes.toString().padStart(2, '0')}`;
    
    periodos.push({
      periodo,
      anio,
      mes,
      estatus: "pendiente",
      monto_esperado: Number(montoRenta),
      monto_pagado: 0,
      saldo_restante: Number(montoRenta),
      fecha_ultimo_pago: null,
      id_pagos: []
    });
    
    actual.setMonth(actual.getMonth() + 1);
  }
  
  return periodos;
};

// ============================================
// REGISTRAR NUEVO INQUILINO (CON PERIODOS)
// ============================================
export const registrarNuevoInquilino = async (idUnidad, datos) => {
  const batch = writeBatch(db);
  const nuevoInqId = `inq_${Date.now()}`;
  const nuevoContratoId = `con_${Date.now()}`;
  
  const inqRef = doc(db, "inquilinos", nuevoInqId);
  const contratoRef = doc(db, "contratos", nuevoContratoId);
  const unidadRef = doc(db, "unidades", idUnidad);

  // Generar periodos esperados
  const fechaInicio = new Date(datos.fecha_inicio_contrato + "T12:00:00");
  const fechaFin = new Date(datos.fecha_fin_contrato + "T12:00:00");
  const periodosEsperados = generarPeriodosEsperados(
    fechaInicio, 
    fechaFin, 
    datos.renta_actual
  );

  // 1. Datos completos del Inquilino
  const inqData = {
    id: nuevoInqId,
    nombre_completo: datos.nombre_completo,
    telefono_contacto: datos.telefono_contacto,
    telefono_emergencia: datos.telefono_emergencia || "",
    deposito_garantia_inicial: Number(datos.deposito_garantia_inicial),
    dia_pago: Number(datos.dia_pago),
    renta_actual: Number(datos.renta_actual),
    no_personas: Number(datos.no_personas) || 1,
    acompanantes: datos.acompanantes || [],
    docs: datos.docs || { ine: "no", carta: "no", contrato: "no" },
    fecha_inicio_contrato: Timestamp.fromDate(fechaInicio),
    fecha_fin_contrato: Timestamp.fromDate(fechaFin),
    activo: true,
    id_contrato_actual: nuevoContratoId,
    id_unidad_actual: idUnidad,
    fecha_registro: serverTimestamp()
  };

  // 2. Datos del Contrato (CON PERIODOS ESPERADOS)
  const contratoData = {
    id_inquilino: nuevoInqId,
    id_unidad: idUnidad,
    nombre_inquilino: datos.nombre_completo,
    monto_renta: Number(datos.renta_actual),
    monto_deposito: Number(datos.deposito_garantia_inicial),
    dia_pago: Number(datos.dia_pago),
    fecha_inicio: Timestamp.fromDate(fechaInicio),
    fecha_fin: Timestamp.fromDate(fechaFin),
    estatus: "activo",
    periodos_esperados: periodosEsperados, // ⭐ NUEVO
    total_periodos: periodosEsperados.length,
    periodos_pagados: 0,
    fecha_creacion: serverTimestamp()
  };

  // 3. Actualizar la Unidad
  const uniData = {
    id_inquilino: nuevoInqId,
    nombre_inquilino: datos.nombre_completo,
    renta_mensual: Number(datos.renta_actual),
    estado: "Ocupado",
    id_contrato_actual: nuevoContratoId
  };

  batch.set(inqRef, inqData);
  batch.set(contratoRef, contratoData);
  batch.update(unidadRef, uniData);

  await batch.commit();
  
  console.log(`✅ Contrato creado con ${periodosEsperados.length} periodos`);
  return { idInquilino: nuevoInqId, idContrato: nuevoContratoId };
};
export const registrarPagoFirebase = async (datosPago) => {
  try {
    // 1. Guardar pago en colección /pagos
    const docRef = await addDoc(collection(db, "pagos"), {
      ...datosPago,
      monto_pagado: Number(datosPago.monto_pagado), 
      // Usamos el total que incluye renta + servicios
      total_esperado_periodo: Number(datosPago.total_esperado_periodo),
      fecha_pago_realizado: datosPago.fecha_pago_realizado 
        ? new Date(datosPago.fecha_pago_realizado) 
        : new Date(),
      fecha_registro: serverTimestamp()
    });

    const idPago = docRef.id;

    // 2. Actualizar periodo en el contrato
    if (datosPago.id_contrato && datosPago.id_contrato !== "sin_contrato") {
      await actualizarPeriodoEnContrato(
        datosPago.id_contrato,
        datosPago.periodo,
        {
          // ⭐ CAMBIO CLAVE: Enviamos el nuevo monto_esperado al contrato
          monto_esperado: Number(datosPago.total_esperado_periodo), 
          monto_pagado: Number(datosPago.monto_pagado),
          saldo_restante: Number(datosPago.saldo_restante_periodo || 0),
          estatus: datosPago.estatus,
          id_pago: idPago
        }
      );
    }

    return idPago;
  } catch (error) {
    console.error("Error al guardar pago:", error);
    throw error;
  }
};

// ============================================
// ACTUALIZAR PERIODO EN CONTRATO
// ============================================
export const actualizarPeriodoEnContrato = async (idContrato, periodo, datosPago) => {
  const contratoRef = doc(db, "contratos", idContrato);
  const contratoSnap = await getDoc(contratoRef);
  
  if (!contratoSnap.exists()) {
    console.error("Contrato no encontrado");
    return;
  }
  
  const contrato = contratoSnap.data();
  const periodosEsperados = contrato.periodos_esperados || [];
  const indicePeriodo = periodosEsperados.findIndex(p => p.periodo === periodo);
  
  if (indicePeriodo === -1) return;
  
  const periodoActual = periodosEsperados[indicePeriodo];

  // 1. DETERMINAR EL NUEVO MONTO ESPERADO
  // Si el pago trae un "monto_esperado" (Renta + Servicios), lo usamos.
  // Si no, mantenemos el que ya tenía el periodo.
  const nuevoMontoEsperado = datosPago.monto_esperado || periodoActual.monto_esperado;

  // 2. CALCULAR PAGADO Y SALDO
  const nuevoMontoPagado = (periodoActual.monto_pagado || 0) + datosPago.monto_pagado;
  
  // Usamos el nuevoMontoEsperado para que el saldo sea correcto (ej. 5600 - 5000 = 600)
  const nuevoSaldo = nuevoMontoEsperado - nuevoMontoPagado;
  
  let nuevoEstatus = "pendiente";
  if (nuevoSaldo <= 0) {
    nuevoEstatus = "pagado";
  } else if (nuevoMontoPagado > 0) {
    nuevoEstatus = "parcial";
  }
  
  // 3. ACTUALIZAR EL MAPA
  periodosEsperados[indicePeriodo] = {
    ...periodoActual,
    monto_esperado: nuevoMontoEsperado, // <--- CAMBIO CLAVE: Actualizamos el total real
    monto_pagado: nuevoMontoPagado,
    saldo_restante: Math.max(0, nuevoSaldo),
    estatus: nuevoEstatus,
    fecha_ultimo_pago: Timestamp.now(),
    id_pagos: [...(periodoActual.id_pagos || []), datosPago.id_pago]
  };
  
  const periodosPagados = periodosEsperados.filter(p => 
    p.estatus === "pagado" || p.estatus === "condonado"
  ).length;
  
  await updateDoc(contratoRef, {
    periodos_esperados: periodosEsperados,
    periodos_pagados: periodosPagados
  });
  
  console.log(`✅ Periodo ${periodo} actualizado: ${nuevoEstatus} con total de ${nuevoMontoEsperado}`);
};

// ============================================
// VERIFICAR SI CONTRATO ESTÁ COMPLETAMENTE PAGADO
// ============================================
export const verificarContratoPagado = async (idContrato) => {
  const contratoRef = doc(db, "contratos", idContrato);
  const contratoSnap = await getDoc(contratoRef);
  
  if (!contratoSnap.exists()) {
    return { completado: false, mensaje: "Contrato no encontrado" };
  }
  
  const contrato = contratoSnap.data();
  const periodosEsperados = contrato.periodos_esperados || [];
  
  const todosPagados = periodosEsperados.every(
    p => p.estatus === "pagado" || p.estatus === "condonado"
  );
  
  const pendientes = periodosEsperados.filter(
    p => p.estatus === "pendiente" || p.estatus === "parcial"
  );
  
  return {
    completado: todosPagados,
    total_periodos: periodosEsperados.length,
    periodos_pagados: contrato.periodos_pagados || 0,
    periodos_pendientes: pendientes.length,
    detalle_pendientes: pendientes.map(p => ({
      periodo: p.periodo,
      saldo: p.saldo_restante,
      estatus: p.estatus
    }))
  };
};
// ============================================
// FINALIZAR CONTRATO
// ============================================
export const finalizarContrato = async (idUnidad, idInquilino, idContrato) => {
  if (!idUnidad || !idInquilino || !idContrato) {
    return { exito: false, mensaje: "Faltan IDs necesarios para finalizar." };
  }

  try {
    const resultado = await runTransaction(db, async (transaction) => {
      // 1. Referencias
      const unidadRef = doc(db, "unidades", idUnidad);
      const inquilinoRef = doc(db, "inquilinos", idInquilino);
      const contratoRef = doc(db, "contratos", idContrato);

      // 2. LECTURAS PRIMERO
      const inqSnap = await transaction.get(inquilinoRef);
      const contratoSnap = await transaction.get(contratoRef);

      if (!contratoSnap.exists()) throw new Error("El contrato no existe.");
      
      // --- VALIDACIÓN DE PAGOS ---
      const datosContrato = contratoSnap.data();
      const periodos = datosContrato.periodos_esperados || [];
      
      // Filtramos los periodos que no están pagados
      const pendientes = periodos.filter(p => p.estatus !== "pagado");

      if (pendientes.length > 0) {
        // Si hay pendientes, lanzamos un error descriptivo
        throw new Error(`No se puede finalizar: Tiene ${pendientes.length} periodos pendientes de pago.`);
      }
      // ----------------------------

      // 3. PREPARAR DATOS PARA INQUILINO
      const historialPrevio = inqSnap.data()?.historial_contratos || [];
      const nuevoHistorial = historialPrevio.includes(idContrato) 
        ? historialPrevio 
        : [...historialPrevio, idContrato];

      // 4. ESCRITURAS AL FINAL
      transaction.update(contratoRef, {
        estatus: "finalizado",
        fecha_finalizacion: serverTimestamp()
      });

      transaction.update(unidadRef, {
        estado: "Disponible",
        id_contrato_actual: null,
        id_inquilino: null,
        nombre_inquilino: "",
        renta_mensual: 0
      });

      transaction.update(inquilinoRef, {
        id_contrato_actual: null,
        id_unidad_actual: null,
        estado: "Inactivo",
        activo: false,
        historial_contratos: nuevoHistorial
      });

      return { exito: true };
    });

    return resultado;
  } catch (error) {
    console.error("Error al finalizar:", error.message);
    // Retornamos el mensaje de error para que el alert lo muestre
    return { exito: false, mensaje: error.message };
  }
};

// ============================================
// RENOVAR INQUILINO DESDE ARCHIVO (CON PERIODOS)
// ============================================
export const renovarInquilinoDesdeArchivo = async (idInquilino, idUnidad, datosNuevos) => {
  const batch = writeBatch(db);

  // Generamos un ID único para el contrato de renovación
  // Usamos un timestamp para evitar colisiones si se renueva varias veces
  const timestampId = Date.now().toString().slice(-4);
  const customContratoId = `con_R${timestampId}_${idInquilino.replace('inq_', '')}`;

  const inqRef = doc(db, "inquilinos", idInquilino);
  const unidadRef = doc(db, "unidades", idUnidad);
  const nuevoContratoRef = doc(db, "contratos", customContratoId);

  const fechaInicio = new Date(datosNuevos.fecha_inicio_contrato + "T12:00:00");
  const fechaFin = new Date(datosNuevos.fecha_fin_contrato + "T12:00:00");

  const periodosEsperados = generarPeriodosEsperados(
    fechaInicio,
    fechaFin,
    datosNuevos.renta_actual
  );

  // 1. ACTUALIZAR INQUILINO (Reversión total de "Inactivo")
  batch.update(inqRef, {
    activo: true,          // Vuelve a estar activo
    estado: "Activo",      // ⭐ CAMBIO: Antes se quedaba como "Inactivo"
    id_unidad_actual: idUnidad,
    id_contrato_actual: customContratoId,
    renta_actual: Number(datosNuevos.renta_actual),
    dia_pago: Number(datosNuevos.dia_pago),
    no_personas: Number(datosNuevos.no_personas || 1),
    fecha_inicio_contrato: Timestamp.fromDate(fechaInicio),
    fecha_fin_contrato: Timestamp.fromDate(fechaFin),
    ultima_modificacion: Timestamp.now()
  });

  // 2. ACTUALIZAR UNIDAD (Vuelve a estar Ocupada)
  batch.update(unidadRef, {
    estado: "Ocupado",
    id_inquilino: idInquilino,
    nombre_inquilino: datosNuevos.nombre_completo,
    id_contrato_actual: customContratoId,
    renta_mensual: Number(datosNuevos.renta_actual), // ⭐ AGREGADO: Para que aparezca en el Dashboard
    no_personas: Number(datosNuevos.no_personas || 1)
  });

  // 3. CREAR NUEVO CONTRATO
  batch.set(nuevoContratoRef, {
    id: customContratoId,
    id_inquilino: idInquilino,
    nombre_inquilino: datosNuevos.nombre_completo,
    id_unidad: idUnidad,
    monto_renta: Number(datosNuevos.renta_actual),
    monto_deposito: Number(datosNuevos.deposito_garantia_inicial),
    fecha_inicio: Timestamp.fromDate(fechaInicio),
    fecha_fin: Timestamp.fromDate(fechaFin),
    fecha_creacion: Timestamp.now(),
    estatus: "activo",
    dia_pago: Number(datosNuevos.dia_pago),
    periodos_esperados: periodosEsperados,
    total_periodos: periodosEsperados.length,
    periodos_pagados: 0
  });

  await batch.commit();
};
// ============================================
// ACTUALIZAR INQUILINO (CON VALIDACIONES ESTRICTAS)
// ============================================
export const actualizarInquilino = async (idInquilino, idUnidad, datos) => {
  const batch = writeBatch(db);
  const inqRef = doc(db, "inquilinos", idInquilino);
  const uniRef = doc(db, "unidades", idUnidad);

  const idContratoActivo = datos.id_contrato_actual;
  const nuevaRenta = Number(datos.renta_actual);
  const nuevoDiaPago = Number(datos.dia_pago);
  const nuevoDeposito = Number(datos.deposito_garantia_inicial);

  // 1. Datos del Inquilino
  const inqData = {
    nombre_completo: datos.nombre_completo,
    telefono_contacto: datos.telefono_contacto,
    telefono_emergencia: datos.telefono_emergencia || "",
    deposito_garantia_inicial: nuevoDeposito,
    dia_pago: nuevoDiaPago,
    renta_actual: nuevaRenta,
    no_personas: Number(datos.no_personas) || 1,
    acompanantes: datos.acompanantes || [],
    docs: datos.docs || {},
    fecha_inicio_contrato: Timestamp.fromDate(new Date(datos.fecha_inicio_contrato + "T12:00:00")),
    fecha_fin_contrato: Timestamp.fromDate(new Date(datos.fecha_fin_contrato + "T12:00:00")),
    ultima_modificacion: serverTimestamp()
  };

  // 2. Datos de la Unidad
  const uniData = {
    nombre_inquilino: datos.nombre_completo,
    renta_mensual: nuevaRenta
  };

  batch.update(inqRef, inqData);
  batch.update(uniRef, uniData);

  // 3. Actualización de Contrato y Periodos (CON VALIDACIONES ESTRICTAS)
  if (idContratoActivo) {
    const contratoRef = doc(db, "contratos", idContratoActivo);
    const contratoSnap = await getDoc(contratoRef);
    
    if (contratoSnap.exists()) {
      const contratoActual = contratoSnap.data();
      const fechaInicio = new Date(datos.fecha_inicio_contrato + "T12:00:00");
      const fechaFin = new Date(datos.fecha_fin_contrato + "T12:00:00");
      
      const fechaInicioActual = contratoActual.fecha_inicio.toDate();
      const fechaFinActual = contratoActual.fecha_fin.toDate();
      const rentaAnterior = contratoActual.monto_renta;
      const depositoAnterior = contratoActual.monto_deposito;
      
      let nuevosPeriodos = contratoActual.periodos_esperados || [];

      // 🚨 VERIFICAR SI HAY PAGOS REGISTRADOS (para validaciones críticas)
      const periodosConPagos = contratoActual.periodos_esperados.filter(p => 
        p.estatus === "pagado" || p.estatus === "parcial" || p.monto_pagado > 0
      );
      const hayPagosRegistrados = periodosConPagos.length > 0;

      // ⚠️ VALIDACIÓN 1: Detectar si cambiaron las fechas
      const cambiaronFechas = 
        fechaInicio.getTime() !== fechaInicioActual.getTime() || 
        fechaFin.getTime() !== fechaFinActual.getTime();

      if (cambiaronFechas && hayPagosRegistrados) {
        return {
          success: false,
          error: "NO_SE_PUEDE_MODIFICAR_FECHAS",
          message: `No se pueden modificar las fechas del contrato porque ya existen ${periodosConPagos.length} periodo(s) con pagos registrados.`,
          detalles: {
            periodos_afectados: periodosConPagos.map(p => ({
              periodo: p.periodo,
              estatus: p.estatus,
              monto_pagado: p.monto_pagado,
              id_pagos: p.id_pagos
            })),
            sugerencia: "Elimina primero todos los pagos registrados si realmente necesitas cambiar las fechas del contrato."
          }
        };
      }

      // ⚠️ VALIDACIÓN 2: Detectar si cambiaron el DEPÓSITO
      const cambioDeposito = nuevoDeposito !== depositoAnterior;

      if (cambioDeposito && hayPagosRegistrados) {
        return {
          success: false,
          error: "NO_SE_PUEDE_MODIFICAR_DEPOSITO",
          message: `No se puede modificar el depósito porque ya existen ${periodosConPagos.length} periodo(s) con pagos registrados.`,
          detalles: {
            deposito_actual: depositoAnterior,
            deposito_intentado: nuevoDeposito,
            periodos_afectados: periodosConPagos.map(p => ({
              periodo: p.periodo,
              estatus: p.estatus,
              monto_pagado: p.monto_pagado
            })),
            sugerencia: "El depósito puede haber sido afectado por cobros de excedentes de servicios. Elimina todos los pagos antes de modificarlo."
          }
        };
      }

      // ✅ NO HAY PAGOS - PERMITIR CAMBIOS DE FECHAS Y REGENERAR
      if (cambiaronFechas && !hayPagosRegistrados) {
        nuevosPeriodos = generarPeriodosEsperados(fechaInicio, fechaFin, nuevaRenta);
        console.log("✅ Fechas modificadas y periodos regenerados (sin pagos previos)");
      }

      // ACTUALIZACIÓN DE MONTOS EN PERIODOS PENDIENTES: Solo si NO cambiaron fechas
      if (!cambiaronFechas && nuevaRenta !== rentaAnterior) {
        nuevosPeriodos = nuevosPeriodos.map(p => {
          if (p.estatus === "pendiente") {
            return {
              ...p,
              monto_esperado: nuevaRenta,
              saldo_restante: nuevaRenta
            };
          }
          return p; // Respeta periodos pagados o parciales
        });
      }
      
      batch.update(contratoRef, {
        monto_renta: nuevaRenta,
        monto_deposito: nuevoDeposito, // Solo se actualiza si NO hay pagos
        dia_pago: nuevoDiaPago,
        fecha_inicio: Timestamp.fromDate(fechaInicio),
        fecha_fin: Timestamp.fromDate(fechaFin),
        nombre_inquilino: datos.nombre_completo,
        periodos_esperados: nuevosPeriodos,
        total_periodos: nuevosPeriodos.length
      });
    }
  }

  await batch.commit();
  return { success: true };
};
/**
 * Obtiene el historial de pagos de un inquilino.
 * @param {string} idInquilino - El ID único del inquilino.
 * @param {string} idContrato - (Opcional) Si se provee, filtra solo los pagos de ese contrato.
 */
export const getPagosPorInquilino = async (idInquilino, idContrato = null) => {
  try {
    // 1. Referencia a la colección
    const pagosRef = collection(db, "pagos");

    // 2. Construcción de la consulta base
    let q;
    
    if (idContrato) {
      // Si queremos ver los pagos de un contrato específico (Histórico)
      q = query(
        pagosRef,
        where("id_inquilino", "==", idInquilino),
        where("id_contrato", "==", idContrato),
        orderBy("periodo", "desc")
      );
    } else {
      // Si queremos ver TODO el historial del inquilino (General)
      q = query(
        pagosRef,
        where("id_inquilino", "==", idInquilino),
        orderBy("periodo", "desc")
      );
    }

    // 3. Ejecución
    const querySnapshot = await getDocs(q);
    
    // 4. Mapeo de resultados
    const historial = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convertimos el Timestamp de Firebase a objeto Date de JS para la UI
      fecha_pago_realizado: doc.data().fecha_pago_realizado?.toDate?.() || doc.data().fecha_pago_realizado
    }));

    return historial;

  } catch (error) {
    console.error("Error al obtener pagos en getPagosPorInquilino:", error);
    // Es importante devolver un array vacío para que el .map() en la UI no truene
    return [];
  }
};

// Nueva función para buscar pagos por unidad (en lugar de por inquilino)
export const getPagosPorUnidad = async (idUnidad) => {
  try {
    const pagosRef = collection(db, "pagos");
    
    const q = query(
      pagosRef,
      where("id_unidad", "==", idUnidad),
      orderBy("periodo", "desc")
    );

    const querySnapshot = await getDocs(q);
    
    const historial = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      fecha_pago_realizado: doc.data().fecha_pago_realizado?.toDate?.() || doc.data().fecha_pago_realizado
    }));

    console.log(`✅ Se encontraron ${historial.length} pagos para la unidad ${idUnidad}`);
    return historial;

  } catch (error) {
    console.error("Error al obtener pagos por unidad:", error);
    return [];
  }
};
export const renovarContratoInquilino = async (idInquilino, idUnidad, nuevosDatos) => {
  const batch = writeBatch(db);
  const nuevoContratoId = `con_${Date.now()}`;
  
  const inqRef = doc(db, "inquilinos", idInquilino);
  const unidadRef = doc(db, "unidades", idUnidad);
  const nuevoContratoRef = doc(db, "contratos", nuevoContratoId);

  try {
    // 1. Buscamos y cerramos el contrato anterior
    const q = query(collection(db, "contratos"), 
              where("id_inquilino", "==", idInquilino), 
              where("estatus", "==", "activo"));
    const snap = await getDocs(q);
    snap.forEach(d => batch.update(d.ref, { estatus: "finalizado", fecha_cierre: serverTimestamp() }));

    // 2. Creamos el NUEVO contrato (con nueva renta o fechas)
    batch.set(nuevoContratoRef, {
      id_inquilino: idInquilino,
      id_unidad: idUnidad,
      fecha_inicio: FirebaseTimestamp.fromDate(new Date(nuevosDatos.fecha_inicio)),
      fecha_fin: FirebaseTimestamp.fromDate(new Date(nuevosDatos.fecha_fin)),
      monto_renta: Number(nuevosDatos.renta_actual),
      estatus: "activo",
      createdAt: serverTimestamp()
    });

    // 3. Actualizamos al Inquilino con su nuevo ID de contrato actual
    batch.update(inqRef, {
      id_contrato_actual: nuevoContratoId,
      renta_actual: Number(nuevosDatos.renta_actual),
      // Guardamos el historial de IDs para rastreo rápido
      historial_contratos: arrayUnion(nuevoContratoId) 
    });

    await batch.commit();
    return { success: true };
  } catch (e) { console.error(e); throw e; }
};
/**
 * Valida que no haya solapamiento de fechas con otros contratos EN LA MISMA UNIDAD
 * @param {string} idUnidad - ID de la unidad
 * @param {Date|string} fechaInicio - Fecha de inicio del nuevo contrato
 * @param {Date|string} fechaFin - Fecha de fin del nuevo contrato
 * @param {string} idContratoActual - ID del contrato que se está editando (opcional)
 * @returns {Promise<{valido: boolean, error?: string, message?: string, contratosConflicto?: Array}>}
 */
export const validarSolapamientoContratos = async (idUnidad, fechaInicio, fechaFin, idContratoActual = null) => {
  try {
    // Convertir a objetos Date si vienen como strings
    const inicio = typeof fechaInicio === 'string' ? new Date(fechaInicio + 'T00:00:00') : fechaInicio;
    const fin = typeof fechaFin === 'string' ? new Date(fechaFin + 'T23:59:59') : fechaFin;

    // Validación básica: fecha de inicio debe ser anterior a fecha de fin
    if (inicio >= fin) {
      return {
        valido: false,
        error: "FECHAS_INVALIDAS",
        message: "La fecha de inicio debe ser anterior a la fecha de fin"
      };
    }

    // 🔍 Consultar TODOS los contratos de ESTA UNIDAD específica
    const contratosRef = collection(db, "contratos");
    const q = query(contratosRef, where("id_unidad", "==", idUnidad));
    const snapshot = await getDocs(q);

    const contratosConflicto = [];

    snapshot.forEach(doc => {
      const contrato = doc.data();
      const contratoId = doc.id;

      // Si estamos editando, excluir el contrato actual de la validación
      if (idContratoActual && contratoId === idContratoActual) {
        return;
      }

      // Obtener fechas del contrato existente
      const contratoInicio = contrato.fecha_inicio?.toDate ? 
        contrato.fecha_inicio.toDate() : new Date(contrato.fecha_inicio);
      const contratoFin = contrato.fecha_fin?.toDate ? 
        contrato.fecha_fin.toDate() : new Date(contrato.fecha_fin);

      // Verificar solapamiento
      // Dos rangos se solapan si:
      // - El inicio del nuevo está entre el inicio y fin del existente, O
      // - El fin del nuevo está entre el inicio y fin del existente, O
      // - El nuevo contiene completamente al existente
      const haySolapamiento = (
        (inicio >= contratoInicio && inicio <= contratoFin) || // Inicio dentro del rango
        (fin >= contratoInicio && fin <= contratoFin) ||       // Fin dentro del rango
        (inicio <= contratoInicio && fin >= contratoFin)       // Contiene al existente
      );

      if (haySolapamiento) {
        contratosConflicto.push({
          id: contratoId,
          inquilino: contrato.nombre_inquilino,
          inicio: contratoInicio,
          fin: contratoFin,
          estatus: contrato.estatus
        });
      }
    });

    if (contratosConflicto.length > 0) {
      return {
        valido: false,
        error: "SOLAPAMIENTO_CONTRATOS",
        message: `Las fechas se solapan con ${contratosConflicto.length} contrato(s) existente(s) en la unidad ${idUnidad}`,
        contratosConflicto: contratosConflicto
      };
    }

    return { valido: true };

  } catch (error) {
    console.error("Error validando solapamiento:", error);
    return {
      valido: false,
      error: "ERROR_VALIDACION",
      message: "Error al validar fechas: " + error.message
    };
  }
};