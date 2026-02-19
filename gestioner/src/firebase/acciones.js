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
  const rentaSegura = Number(montoRenta);
  if (isNaN(rentaSegura) || rentaSegura <= 0) {
    throw new Error("El monto de renta debe ser un número positivo válido.");
  }
  const periodos = [];
  const inicio = fechaInicio?.toDate ? fechaInicio.toDate() : new Date(fechaInicio);
  const fin = fechaFin?.toDate ? fechaFin.toDate() : new Date(fechaFin);
  if (inicio > fin) {
    throw new Error("La fecha de inicio no puede ser posterior a la de fin.");
  }
  let actual = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  let iteraciones = 0;
  const MAX_ITERACIONES = 120; // 10 años máximo por contrato

  while (actual <= fin && iteraciones < MAX_ITERACIONES) {
    iteraciones++;
    
    const anio = actual.getFullYear();
    const mes = actual.getMonth() + 1;
    const periodoId = `${anio}-${mes.toString().padStart(2, '0')}`;
    
    periodos.push({
      periodo: periodoId,
      anio,
      mes,
      estatus: "pendiente",
      monto_esperado: rentaSegura,
      monto_pagado: 0,
      saldo_restante: rentaSegura,
      fecha_ultimo_pago: null,
      id_pagos: [],
      metodo_condonacion: false // Agregado para consistencia con tu doc
    });
    actual.setMonth(actual.getMonth() + 1);
  }
  return periodos;
};
// ============================================
// REGISTRAR NUEVO INQUILINO (CON PERIODOS)
// ============================================
export const registrarNuevoInquilino = async (idUnidad, datos) => {
  // 1. FRENO DE SEGURIDAD: Validación de disponibilidad (Pre-flight)
  // Evitamos que dos usuarios ocupen la misma unidad al mismo tiempo.
  const unidadRef = doc(db, "unidades", idUnidad);
  const unidadSnap = await getDoc(unidadRef);

  if (!unidadSnap.exists()) {
    throw new Error("LA_UNIDAD_NO_EXISTE");
  }

  const unidadActual = unidadSnap.data();
  if (unidadActual.estado === "Ocupado") {
    throw new Error("LA_UNIDAD_YA_ESTA_OCUPADA");
  }

  const batch = writeBatch(db);
  
  // 2. IDs UNICOS (Freno de colisión)
  // Usar un sufijo aleatorio asegura que si dos personas registran en el mismo milisegundo, no choquen.
  const ts = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000);
  const nuevoInqId = `inq_${ts}_${randomSuffix}`;
  const nuevoContratoId = `con_${ts}_${randomSuffix}`;
  
  const inqRef = doc(db, "inquilinos", nuevoInqId);
  const contratoRef = doc(db, "contratos", nuevoContratoId);

  // 3. NORMALIZACIÓN DE FECHAS
  // El "T12:00:00" es excelente para evitar desfases por zona horaria.
  const fechaInicio = new Date(datos.fecha_inicio_contrato + "T12:00:00");
  const fechaFin = new Date(datos.fecha_fin_contrato + "T12:00:00");
  
  // Generar periodos usando la función blindada que ya revisamos
  const periodosEsperados = generarPeriodosEsperados(
    fechaInicio, 
    fechaFin, 
    datos.renta_actual
  );

  // 4. ESTRUCTURA DE DATOS BLINDADA
  const inqData = {
    id: nuevoInqId,
    nombre_completo: datos.nombre_completo?.trim(),
    telefono_contacto: datos.telefono_contacto || "",
    telefono_emergencia: datos.telefono_emergencia || "",
    deposito_garantia_inicial: Number(datos.deposito_garantia_inicial) || 0,
    dia_pago: Number(datos.dia_pago) || 1,
    renta_actual: Number(datos.renta_actual) || 0,
    no_personas: Number(datos.no_personas) || 1,
    acompanantes: datos.acompanantes || [],
    docs: {
      ine: datos.docs?.ine || "no",
      carta: datos.docs?.carta || "no",
      contrato: datos.docs?.contrato || "no"
    },
    fecha_inicio_contrato: Timestamp.fromDate(fechaInicio),
    fecha_fin_contrato: Timestamp.fromDate(fechaFin),
    activo: true,
    estado: "Activo", // Consistencia con tu doc de integridad
    id_contrato_actual: nuevoContratoId,
    id_unidad_actual: idUnidad,
    historial_contratos: [], // Inicializado para evitar errores de array null
    fecha_registro: serverTimestamp(),
    ultima_modificacion: serverTimestamp()
  };

  const contratoData = {
    id: nuevoContratoId,
    id_inquilino: nuevoInqId,
    id_unidad: idUnidad,
    nombre_inquilino: datos.nombre_completo?.trim(),
    monto_renta: Number(datos.renta_actual),
    monto_deposito: Number(datos.deposito_garantia_inicial),
    dia_pago: Number(datos.dia_pago),
    fecha_inicio: Timestamp.fromDate(fechaInicio),
    fecha_fin: Timestamp.fromDate(fechaFin),
    estatus: "activo",
    periodos_esperados: periodosEsperados,
    total_periodos: periodosEsperados.length,
    periodos_pagados: 0,
    fecha_creacion: serverTimestamp()
  };

  const uniData = {
    id_inquilino: nuevoInqId,
    nombre_inquilino: datos.nombre_completo?.trim(),
    renta_mensual: Number(datos.renta_actual),
    estado: "Ocupado",
    id_contrato_actual: nuevoContratoId,
    no_personas: Number(datos.no_personas) || 1
  };

  // 5. OPERACIÓN ATÓMICA
  batch.set(inqRef, inqData);
  batch.set(contratoRef, contratoData);
  batch.update(unidadRef, uniData);

  try {
    await batch.commit();
    console.log(`✅ Registro exitoso: Inquilino ${nuevoInqId} en Unidad ${idUnidad}`);
    return { idInquilino: nuevoInqId, idContrato: nuevoContratoId };
  } catch (error) {
    console.error("Error crítico en batch:", error);
    throw new Error("FALLO_OPERACION_ATÓMICA: No se guardó ningún dato.");
  }
};

export const registrarPagoFirebase = async (datosPago) => {
  const batch = writeBatch(db);

  // 1. FRENO DE SEGURIDAD: Obtener referencia del contrato para validar y leer depósito
  const contratoRef = doc(db, "contratos", datosPago.id_contrato);
  const contratoSnap = await getDoc(contratoRef);

  if (!contratoSnap.exists()) {
    throw new Error("EL_CONTRATO_NO_EXISTE");
  }

  const contratoActual = contratoSnap.data();
  const nuevoPagoRef = doc(collection(db, "pagos"));
  const idPago = nuevoPagoRef.id;

  // 3. CALCULAR SALDOS Y EXCEDENTES (Freno de Aritmética)
  const montoRecibido = Number(datosPago.monto_pagado) || 0;

  // 3.a --- Buscar pagos EXISTENTES del mismo periodo y misma unidad
  const pagosRef = collection(db, "pagos");
  const qExist = query(pagosRef, where("id_unidad", "==", datosPago.id_unidad), where("periodo", "==", datosPago.periodo));
  const snapExist = await getDocs(qExist);
  const pagosExistentes = snapExist.docs.map(d => ({ id: d.id, ...d.data() }));
  const sumaPagosPrevios = pagosExistentes.reduce((s, p) => s + Number(p.monto_pagado || 0), 0);
  const idsPagosPrevios = pagosExistentes.map(p => p.id);

  // 3.b --- Determinar monto esperado real desde el contrato (CON FIABILIDAD)
  const periodoDef = (contratoActual.periodos_esperados || []).find(p => p.periodo === datosPago.periodo);
  const totalEsperado = periodoDef ? Number(periodoDef.monto_esperado || 0) : Number(datosPago.total_esperado_periodo || 0);

  // 3.c --- Recalcular periodo usando los pagos existentes (más robusto que confiar en p.monto_pagado)
  const periodosActualizados = (contratoActual.periodos_esperados || []).map((p) => {
    if (p.periodo === datosPago.periodo) {
      const nuevoMontoPagadoAcumulado = sumaPagosPrevios + montoRecibido;
      const nuevoSaldo = Math.max(0, totalEsperado - nuevoMontoPagadoAcumulado);

      return {
        ...p,
        monto_esperado: totalEsperado, // Mantener consistente con el contrato
        monto_pagado: nuevoMontoPagadoAcumulado,
        saldo_restante: nuevoSaldo,
        estatus: nuevoSaldo <= 0 ? "pagado" : (nuevoMontoPagadoAcumulado > 0 ? "parcial" : "pendiente"),
        fecha_ultimo_pago: Timestamp.now(),
        id_pagos: [...new Set([...(p.id_pagos || []), ...idsPagosPrevios, idPago])]
      };
    }
    return p;
  });

  // 4. FRENO: Recalcular periodos_pagados global
  const totalPagados = periodosActualizados.filter(p => p.estatus === "pagado").length;

  // 5. MANEJO DE DEPÓSITO (Si los excedentes se cobraron de ahí)
  let nuevoMontoDeposito = contratoActual.monto_deposito;
  if (datosPago.servicios?.excedentes_cobrados_de === "deposito") {
    const descuento = Number(datosPago.servicios.excedentes_del_deposito) || 0;
    nuevoMontoDeposito = Math.max(0, nuevoMontoDeposito - descuento);
  }

  // 6. PREPARAR EL BATCH
  // Registro en /pagos
  // Sanitizar objeto servicios para evitar valores `undefined` en Firestore
  const serviciosSanitizados = {
    agua_lectura: Number(datosPago.servicios?.agua_lectura || 0),
    luz_lectura: Number(datosPago.servicios?.luz_lectura || 0),
    internet_lectura: Number(datosPago.servicios?.internet_lectura || 0),
    limite_agua_aplicado: Number(datosPago.servicios?.limite_agua_aplicado || 0),
    limite_luz_aplicado: Number(datosPago.servicios?.limite_luz_aplicado || 0),
    limite_internet_aplicado: Number(datosPago.servicios?.limite_internet_aplicado || 0),
    excedentes_cobrados_de: datosPago.servicios?.excedentes_cobrados_de || null,
    excedentes_del_deposito: Number(datosPago.servicios?.excedentes_del_deposito || 0)
  };

  batch.set(nuevoPagoRef, {
    ...datosPago,
    id: idPago,
    monto_pagado: montoRecibido,
    total_esperado_periodo: totalEsperado,
    fecha_pago_realizado: datosPago.fecha_pago_realizado 
      ? new Date(datosPago.fecha_pago_realizado) 
      : new Date(),
    servicios: serviciosSanitizados,
    fecha_registro: serverTimestamp()
  });

  // Actualización en /contratos
  batch.update(contratoRef, {
    periodos_esperados: periodosActualizados,
    periodos_pagados: totalPagados,
    monto_deposito: nuevoMontoDeposito
  });

  try {
    await batch.commit();
    return idPago;
  } catch (error) {
    console.error("Error crítico en el batch de pago:", error);
    throw new Error("FALLO_SINCRONIZACION_PAGO: No se registró el pago ni se afectó el contrato.");
  }
};

// ============================================
// ACTUALIZAR PERIODO EN CONTRATO
// ============================================
export const actualizarPeriodoEnContrato = async (idContrato, periodo, datosPago) => {
  const contratoRef = doc(db, "contratos", idContrato);
  
  // 1. FRENO DE SEGURIDAD: Obtener datos frescos
  const contratoSnap = await getDoc(contratoRef);
  if (!contratoSnap.exists()) {
    throw new Error("CONTRATO_NO_ENCONTRADO");
  }

  const contrato = contratoSnap.data();
  // Freno: Asegurar que periodos_esperados sea un array
  const periodosEsperados = Array.isArray(contrato.periodos_esperados) 
    ? [...contrato.periodos_esperados] 
    : [];

  const indicePeriodo = periodosEsperados.findIndex(p => p.periodo === periodo);
  if (indicePeriodo === -1) {
    throw new Error(`PERIODO_${periodo}_NO_EXISTE_EN_CONTRATO`);
  }

  const periodoActual = periodosEsperados[indicePeriodo];
  if (periodoActual.id_pagos?.includes(datosPago.id_pago)) {
    console.warn("Este pago ya fue procesado en el contrato.");
    return;
  }
  const montoRecibido = Number(datosPago.monto_pagado) || 0;
  const nuevoMontoEsperado = Number(datosPago.monto_esperado ?? periodoActual.monto_esperado);
  
  const montoPagadoPrevio = Number(periodoActual.monto_pagado) || 0;
  const nuevoMontoPagadoAcumulado = montoPagadoPrevio + montoRecibido;
  
  const nuevoSaldo = Math.max(0, nuevoMontoEsperado - nuevoMontoPagadoAcumulado);

  // 4. DETERMINACIÓN DE ESTATUS (Consistente con tu documento de integridad)
  let nuevoEstatus = "pendiente";
  if (nuevoSaldo <= 0) {
    nuevoEstatus = "pagado";
  } else if (nuevoMontoPagadoAcumulado > 0) {
    nuevoEstatus = "parcial";
  }

  // 5. ACTUALIZACIÓN DEL OBJETO
  periodosEsperados[indicePeriodo] = {
    ...periodoActual,
    monto_esperado: nuevoMontoEsperado,
    monto_pagado: nuevoMontoPagadoAcumulado,
    saldo_restante: nuevoSaldo,
    estatus: nuevoEstatus,
    fecha_ultimo_pago: Timestamp.now(),
    id_pagos: [...(periodoActual.id_pagos || []), datosPago.id_pago]
  };

  // 6. RECALCULAR CONTADOR GLOBAL
  const periodosPagadosContador = periodosEsperados.filter(p => 
    p.estatus === "pagado" || p.estatus === "condonado"
  ).length;

  // 7. EJECUCIÓN
  try {
    await updateDoc(contratoRef, {
      periodos_esperados: periodosEsperados,
      periodos_pagados: periodosPagadosContador,
      ultima_modificacion: Timestamp.now()
    });
    return true;
  } catch (error) {
    console.error("Error al actualizar contrato:", error);
    throw new Error("ERROR_ACTUALIZACION_CONTRATO");
  }
};

// ============================================
// VERIFICAR SI CONTRATO ESTÁ COMPLETAMENTE PAGADO
// ============================================
export const verificarContratoPagado = async (idContrato) => {
  if (!idContrato) {
    return { completado: false, mensaje: "ID de contrato no proporcionado" };
  }

  const contratoRef = doc(db, "contratos", idContrato);
  const contratoSnap = await getDoc(contratoRef);
  
  if (!contratoSnap.exists()) {
    return { completado: false, mensaje: "Contrato no encontrado en la base de datos" };
  }
  
  const contrato = contratoSnap.data();
  const periodosEsperados = Array.isArray(contrato.periodos_esperados) 
    ? contrato.periodos_esperados 
    : [];
  const TOLERANCIA = 0.01; 

  const pendientes = periodosEsperados.filter(p => {
    const esEstadoPendiente = p.estatus === "pendiente" || p.estatus === "parcial";
    const tieneSaldoReal = (Number(p.saldo_restante) || 0) > TOLERANCIA;
    const noEstaCondonado = p.estatus !== "condonado";
    return (esEstadoPendiente || tieneSaldoReal) && noEstaCondonado;
  });

  const todosPagados = pendientes.length === 0;
  const contadorRealPagados = periodosEsperados.filter(
    p => p.estatus === "pagado" || p.estatus === "condonado"
  ).length;

  const hayDivergencia = (contrato.periodos_pagados || 0) !== contadorRealPagados;

  return {
    completado: todosPagados,
    total_periodos: periodosEsperados.length,
    periodos_pagados: contadorRealPagados, // Devolvemos el real calculado, no solo el guardado
    periodos_pendientes: pendientes.length,
    detalle_pendientes: pendientes.map(p => ({
      periodo: p.periodo,
      saldo: Number(p.saldo_restante) || 0,
      estatus: p.estatus
    })),
    // Alerta de seguridad si los datos internos del contrato están descuadrados
    alerta_integridad: hayDivergencia,
    mensaje: todosPagados 
      ? "Contrato liquidado correctamente" 
      : `Existen ${pendientes.length} periodos con saldo pendiente`
  };
};

/**
 * Valida si un periodo está completamente pagado o condonado
 * @param {Object} periodo - Objeto del periodo a validar
 * @returns {boolean} - true si está pagado o condonado correctamente
 */
const esPeriodoPagado = (periodo) => {
  // Si el estatus es "pagado"
  if (periodo.estatus === 'pagado') return true;
  
  // Si el estatus es "condonado" Y el saldo restante es 0
  if (periodo.estatus === 'condonado' && periodo.saldo_restante === 0) return true;
  
  // Si el monto pagado es igual o mayor al esperado Y el saldo restante es 0
  if (periodo.monto_pagado >= periodo.monto_esperado && periodo.saldo_restante === 0) return true;
  
  return false;
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
      
      // --- VALIDACIÓN DE PAGOS MEJORADA ---
      const datosContrato = contratoSnap.data();
      const periodos = datosContrato.periodos_esperados || [];
      
      // Filtramos los periodos que NO están pagados ni condonados correctamente
      const pendientes = periodos.filter(p => !esPeriodoPagado(p));

      if (pendientes.length > 0) {
        // Generar mensaje detallado con los periodos pendientes
        const detallesPendientes = pendientes.map(p => 
          `${p.periodo} (Saldo: $${p.saldo_restante || 0})`
        ).join(', ');
        
        throw new Error(
          `No se puede finalizar el contrato. Tiene ${pendientes.length} periodo(s) pendiente(s): ${detallesPendientes}`
        );
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
// RENOVAR INQUILINO DESDE ARCHIVO (CON ID ÚNICO POR RENOVACIÓN)
// ============================================
export const renovarInquilinoDesdeArchivo = async (idInquilino, idUnidad, datosNuevos) => {
  const batch = writeBatch(db);

  console.log("========================================");
  console.log("🚀 INICIANDO RENOVACIÓN DE INQUILINO");
  console.log("Inquilino:", idInquilino);
  console.log("Unidad:", idUnidad);
  console.log("========================================");

  // 1. FRENO DE SEGURIDAD: Verificar disponibilidad de la unidad
  const unidadRef = doc(db, "unidades", idUnidad);
  const unidadSnap = await getDoc(unidadRef);
  
  if (!unidadSnap.exists()) {
    console.log("❌ ERROR: La unidad no existe");
    throw new Error("LA_UNIDAD_NO_EXISTE");
  }
  
  if (unidadSnap.data().estado === "Ocupado") {
    console.log("❌ ERROR: La unidad está ocupada");
    throw new Error("LA_UNIDAD_ESTA_OCUPADA: No se puede renovar en una unidad con inquilino activo.");
  }

  console.log("✅ Unidad disponible");

  // 2. NORMALIZACIÓN DE FECHAS (Freno de zona horaria)
  const fechaInicio = new Date(datosNuevos.fecha_inicio_contrato + "T12:00:00");
  const fechaFin = new Date(datosNuevos.fecha_fin_contrato + "T12:00:00");

  console.log("Fechas normalizadas:");
  console.log("  Inicio:", fechaInicio);
  console.log("  Fin:", fechaFin);

  // ⭐⭐⭐ 3. VALIDACIÓN CRÍTICA: VERIFICAR SOLAPAMIENTO CONTRA **TODOS** LOS CONTRATOS DE LA UNIDAD
  const validacion = await validarSolapamientoContratos(
    idUnidad,
    fechaInicio,
    fechaFin,
    null // No excluir ningún contrato
  );

  if (!validacion.valido) {
    console.error("❌❌❌ VALIDACIÓN FALLÓ - OPERACIÓN ABORTADA");
    console.error("Detalles:", validacion);
    return validacion; // Retornar el objeto con error y detalles
  }

  console.log("✅✅✅ VALIDACIÓN EXITOSA - Continuando con la renovación");

  // ⭐ 4. GENERAR ID ÚNICO DEL NUEVO CONTRATO (CON TIMESTAMP Y RANDOM)
  const ts = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000);
  const nuevoContratoId = `con_R_${ts}_${randomSuffix}`;

  console.log("ID del nuevo contrato (ÚNICO):", nuevoContratoId);

  const inqRef = doc(db, "inquilinos", idInquilino);
  const nuevoContratoRef = doc(db, "contratos", nuevoContratoId);

  // 5. GENERAR PERÍODOS ESPERADOS
  const periodosEsperados = generarPeriodosEsperados(
    fechaInicio,
    fechaFin,
    datosNuevos.renta_actual
  );

  console.log(`Períodos generados: ${periodosEsperados.length} meses`);

  // 6. OBTENER DATOS ACTUALES DEL INQUILINO
  const inqSnap = await getDoc(inqRef);
  const inqDataActual = inqSnap.data();
  
  // 7. ACTUALIZAR HISTORIAL DE CONTRATOS
  const historialPrevio = inqDataActual?.historial_contratos || [];
  const contratoAnterior = inqDataActual?.id_contrato_actual;
  
  const nuevoHistorial = [...historialPrevio];
  if (contratoAnterior && !nuevoHistorial.includes(contratoAnterior)) {
    nuevoHistorial.push(contratoAnterior);
    console.log(`Agregando contrato anterior al historial: ${contratoAnterior}`);
  }

  console.log(`Historial de contratos: ${nuevoHistorial.length} contratos previos`);

  // 8. ACTUALIZAR INQUILINO
  batch.update(inqRef, {
    activo: true,
    estado: "Activo",
    id_unidad_actual: idUnidad,
    id_contrato_actual: nuevoContratoId,
    renta_actual: Number(datosNuevos.renta_actual),
    dia_pago: Number(datosNuevos.dia_pago),
    no_personas: Number(datosNuevos.no_personas || 1),
    fecha_inicio_contrato: Timestamp.fromDate(fechaInicio),
    fecha_fin_contrato: Timestamp.fromDate(fechaFin),
    historial_contratos: nuevoHistorial,
    ultima_modificacion: Timestamp.now()
  });

  console.log("✅ Inquilino actualizado en batch");

  // 9. ACTUALIZAR UNIDAD
  batch.update(unidadRef, {
    estado: "Ocupado",
    id_inquilino: idInquilino,
    nombre_inquilino: datosNuevos.nombre_completo?.trim(),
    id_contrato_actual: nuevoContratoId,
    renta_mensual: Number(datosNuevos.renta_actual),
    no_personas: Number(datosNuevos.no_personas || 1)
  });

  console.log("✅ Unidad actualizada en batch");

  // 10. CREAR NUEVO CONTRATO (CON ID ÚNICO)
  batch.set(nuevoContratoRef, {
    id: nuevoContratoId,
    id_inquilino: idInquilino,
    nombre_inquilino: datosNuevos.nombre_completo?.trim(),
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
    periodos_pagados: 0,
    es_renovacion: true,
    contrato_previo: contratoAnterior || null, // ⭐ Referencia al contrato anterior
    validado_sin_solapamiento: true,
    fecha_validacion: Timestamp.now()
  });

  console.log("✅ Nuevo contrato agregado al batch");

  // 11. EJECUTAR BATCH
  try {
    console.log("🔄 Ejecutando batch transaction...");
    await batch.commit();
    console.log("========================================");
    console.log("✅✅✅ RENOVACIÓN COMPLETADA EXITOSAMENTE");
    console.log("Nuevo contrato:", nuevoContratoId);
    console.log("========================================");
    return { success: true, exito: true, contratoId: nuevoContratoId };
  } catch (error) {
    console.error("========================================");
    console.error("❌❌❌ ERROR EN BATCH TRANSACTION");
    console.error(error);
    console.error("========================================");
    throw new Error("FALLO_BATCH_RENOVACION: " + error.message);
  }
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

  // 1. FRENO DE SEGURIDAD: Obtener datos actuales del Inquilino para verificar unidad
  const inqSnap = await getDoc(inqRef);
  if (!inqSnap.exists()) throw new Error("INQUILINO_NOT_FOUND");
  const inqActual = inqSnap.data();

  // 2. PREPARAR DATOS DEL INQUILINO
  const inqData = {
    nombre_completo: datos.nombre_completo?.trim(),
    telefono_contacto: datos.telefono_contacto || "",
    telefono_emergencia: datos.telefono_emergencia || "",
    deposito_garantia_inicial: nuevoDeposito,
    dia_pago: nuevoDiaPago,
    renta_actual: nuevaRenta,
    no_personas: Number(datos.no_personas) || 1,
    acompanantes: datos.acompanantes || [],
    docs: datos.docs || inqActual.docs, // Mantiene docs previos si no vienen nuevos
    fecha_inicio_contrato: Timestamp.fromDate(new Date(datos.fecha_inicio_contrato + "T12:00:00")),
    fecha_fin_contrato: Timestamp.fromDate(new Date(datos.fecha_fin_contrato + "T12:00:00")),
    ultima_modificacion: serverTimestamp()
  };

  // 3. PREPARAR DATOS DE LA UNIDAD
  const uniData = {
    nombre_inquilino: datos.nombre_completo?.trim(),
    renta_mensual: nuevaRenta
  };

  // 4. LÓGICA DE CONTRATO (EL CEREBRO DE LA FUNCIÓN)
  if (idContratoActivo) {
    const contratoRef = doc(db, "contratos", idContratoActivo);
    const contratoSnap = await getDoc(contratoRef);
    
    if (contratoSnap.exists()) {
      const contratoActual = contratoSnap.data();
      const fechaInicioReq = new Date(datos.fecha_inicio_contrato + "T12:00:00");
      const fechaFinReq = new Date(datos.fecha_fin_contrato + "T12:00:00");
      
      const fechaInicioActual = contratoActual.fecha_inicio.toDate();
      const fechaFinActual = contratoActual.fecha_fin.toDate();
      const rentaAnterior = contratoActual.monto_renta;
      
      let nuevosPeriodos = [...(contratoActual.periodos_esperados || [])];

      // 🚨 DETECTAR PAGOS (Auditando no solo estatus, sino saldos reales)
      const periodosConPagos = nuevosPeriodos.filter(p => 
        p.estatus === "pagado" || p.estatus === "parcial" || (Number(p.monto_pagado) || 0) > 0
      );
      const hayPagosRegistrados = periodosConPagos.length > 0;

      // VALIDACIÓN 1: Fechas (Bloqueo estricto)
      const cambiaronFechas = 
        fechaInicioReq.getTime() !== fechaInicioActual.getTime() || 
        fechaFinReq.getTime() !== fechaFinActual.getTime();

      if (cambiaronFechas && hayPagosRegistrados) {
        return {
          success: false,
          error: "FECHAS_BLOQUEADAS",
          message: `No se pueden cambiar fechas. Hay ${periodosConPagos.length} periodos con pagos.`
        };
      }

      // VALIDACIÓN 2: Depósito (Protección de historial)
      if (nuevoDeposito !== contratoActual.monto_deposito && hayPagosRegistrados) {
        return {
          success: false,
          error: "DEPOSITO_BLOQUEADO",
          message: "No se puede modificar el depósito si ya hay pagos registrados."
        };
      }

      // ACCIÓN A: Regenerar por cambio de fecha (Solo si está limpio de pagos)
      if (cambiaronFechas && !hayPagosRegistrados) {
        nuevosPeriodos = generarPeriodosEsperados(fechaInicioReq, fechaFinReq, nuevaRenta);
      } 
      // ACCIÓN B: Actualizar renta en periodos futuros (Sin tocar los que ya tienen abonos)
      else if (nuevaRenta !== rentaAnterior) {
        nuevosPeriodos = nuevosPeriodos.map(p => {
          // Solo actualizamos los que están 100% pendientes (sin un solo centavo pagado)
          if (p.estatus === "pendiente" && (Number(p.monto_pagado) || 0) === 0) {
            return {
              ...p,
              monto_esperado: nuevaRenta,
              saldo_restante: nuevaRenta
            };
          }
          return p;
        });
      }
      
      batch.update(contratoRef, {
        monto_renta: nuevaRenta,
        monto_deposito: nuevoDeposito,
        dia_pago: nuevoDiaPago,
        fecha_inicio: Timestamp.fromDate(fechaInicioReq),
        fecha_fin: Timestamp.fromDate(fechaFinReq),
        nombre_inquilino: datos.nombre_completo?.trim(),
        periodos_esperados: nuevosPeriodos,
        total_periodos: nuevosPeriodos.length,
        ultima_edicion: serverTimestamp() // Audit trail
      });
    }
  }

  // 5. EJECUCIÓN ATÓMICA
  batch.update(inqRef, inqData);
  batch.update(uniRef, uniData);

  try {
    await batch.commit();
    return { success: true };
  } catch (error) {
    console.error("Error crítico en actualización:", error);
    return { success: false, error: "DATABASE_ERROR", message: error.message };
  }
};
/**
 * Obtiene el historial de pagos de un inquilino.
 */
export const getPagosPorInquilino = async (idInquilino, idContrato = null) => {
  // 1. FRENO DE SEGURIDAD: Validación de entrada
  if (!idInquilino) {
    console.warn("getPagosPorInquilino: No se proporcionó idInquilino");
    return [];
  }

  try {
    const pagosRef = collection(db, "pagos");
    let q;

    // 2. CONSTRUCCIÓN DE CONSULTA (Optimizada)
    // Agregamos orderBy("fecha_registro", "desc") como segundo criterio 
    // por si hay múltiples pagos en un mismo periodo.
    if (idContrato && idContrato !== "sin_contrato") {
      q = query(
        pagosRef,
        where("id_inquilino", "==", idInquilino),
        where("id_contrato", "==", idContrato),
        orderBy("periodo", "desc"),
        orderBy("fecha_registro", "desc") 
      );
    } else {
      q = query(
        pagosRef,
        where("id_inquilino", "==", idInquilino),
        orderBy("periodo", "desc"),
        orderBy("fecha_registro", "desc")
      );
    }

    const querySnapshot = await getDocs(q);

    // 3. MAPEO CON BLINDAJE DE TIPOS (Freno contra crashes en la UI)
    const historial = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      
      return {
        id: docSnap.id,
        ...data,
        // Normalización de montos (asegurar que siempre sean números para cálculos en UI)
        monto_pagado: Number(data.monto_pagado) || 0,
        total_esperado_periodo: Number(data.total_esperado_periodo) || 0,
        
        // Freno para fechas: Evita errores si el campo no existe o es nulo
        fecha_pago_realizado: data.fecha_pago_realizado?.toDate 
          ? data.fecha_pago_realizado.toDate() 
          : (data.fecha_pago_realizado instanceof Date ? data.fecha_pago_realizado : new Date()),
          
        fecha_registro: data.fecha_registro?.toDate 
          ? data.fecha_registro.toDate() 
          : null
      };
    });

    return historial;

  } catch (error) {
    // 4. IDENTIFICACIÓN DE ERRORES DE ÍNDICE
    // Firebase requiere índices compuestos para múltiples 'where' y 'orderBy'
    if (error.code === 'failed-precondition') {
      console.error("❌ ERROR DE ÍNDICE: Necesitas crear un índice compuesto en Firebase para esta consulta.");
      // Aquí podrías incluso poner el link que Firebase devuelve en la consola
    } else {
      console.error("Error al obtener pagos:", error);
    }
    
    return []; // Retorno seguro
  }
};
// Nueva función para buscar pagos por unidad (en lugar de por inquilino)
/**
 * Obtiene todos los pagos asociados a una unidad específica (Historial de la propiedad).
 */
export const getPagosPorUnidad = async (idUnidad) => {
  if (!idUnidad) {
    console.warn("getPagosPorUnidad: No se proporcionó idUnidad");
    return [];
  }

  try {
    const pagosRef = collection(db, "pagos");
    const q = query(
      pagosRef,
      where("id_unidad", "==", idUnidad),
      orderBy("periodo", "desc"),
      orderBy("fecha_registro", "desc")
    );

    const querySnapshot = await getDocs(q);

    // 3. MAPEO CON LIMPIEZA DE DATOS (Freno contra inconsistencias)
    const historial = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      
      return {
        id: docSnap.id,
        ...data,
        // Forzamos que los montos sean numéricos para evitar errores en sumatorias de la UI
        monto_pagado: Number(data.monto_pagado) || 0,
        
        // Manejo seguro de fechas
        fecha_pago_realizado: data.fecha_pago_realizado?.toDate 
          ? data.fecha_pago_realizado.toDate() 
          : (data.fecha_pago_realizado instanceof Date ? data.fecha_pago_realizado : new Date()),
          
        // Identificar quién era el inquilino en ese momento (muy útil para este reporte)
        nombre_inquilino: data.nombre_inquilino || "Inquilino desconocido"
      };
    });

    console.log(`✅ Reporte Unidad ${idUnidad}: ${historial.length} registros recuperados.`);
    return historial;

  } catch (error) {
    // 4. MANEJO DE ERRORES ESPECÍFICOS
    if (error.code === 'failed-precondition') {
      console.error("❌ ERROR DE ÍNDICE: Se requiere índice compuesto para (id_unidad + periodo + fecha_registro).");
    } else {
      console.error("Error al obtener pagos por unidad:", error);
    }
    
    return []; // Retorno seguro para que el .map() de la tabla no falle
  }
};
export const renovarContratoInquilino = async (idInquilino, idUnidad, nuevosDatos) => {
  const batch = writeBatch(db);
  const ts = Date.now();
  const nuevoContratoId = `con_REN_${ts}`; // Prefijo REN para identificar renovaciones rápido
  
  const inqRef = doc(db, "inquilinos", idInquilino);
  const unidadRef = doc(db, "unidades", idUnidad);
  const nuevoContratoRef = doc(db, "contratos", nuevoContratoId);

  try {
    // 1. FRENO DE SEGURIDAD: Cerrar contratos activos previos
    // Evitamos que el inquilino tenga 2 contratos "Activos" al mismo tiempo.
    const q = query(
      collection(db, "contratos"), 
      where("id_inquilino", "==", idInquilino), 
      where("estatus", "==", "activo")
    );
    
    const snap = await getDocs(q);
    snap.forEach(d => {
      batch.update(d.ref, { 
        estatus: "finalizado", 
        fecha_finalizacion: serverTimestamp(),
        motivo_cierre: "renovacion" 
      });
    });

    // 2. NORMALIZACIÓN DE FECHAS
    const fechaInicio = new Date(nuevosDatos.fecha_inicio + "T12:00:00");
    const fechaFin = new Date(nuevosDatos.fecha_fin + "T12:00:00");

    // 3. GENERACIÓN DE PERIODOS (Crucial para que aparezcan cobros)
    // Usamos la función que blindamos al inicio del chat
    const periodosEsperados = generarPeriodosEsperados(
      fechaInicio,
      fechaFin,
      nuevosDatos.renta_actual
    );

    // 4. CREAR EL NUEVO CONTRATO
    batch.set(nuevoContratoRef, {
      id: nuevoContratoId,
      id_inquilino: idInquilino,
      id_unidad: idUnidad,
      nombre_inquilino: nuevosDatos.nombre_completo || "Inquilino",
      fecha_inicio: Timestamp.fromDate(fechaInicio),
      fecha_fin: Timestamp.fromDate(fechaFin),
      monto_renta: Number(nuevosDatos.renta_actual),
      monto_deposito: Number(nuevosDatos.monto_deposito || 0),
      dia_pago: Number(nuevosDatos.dia_pago || 1),
      estatus: "activo",
      periodos_esperados: periodosEsperados,
      total_periodos: periodosEsperados.length,
      periodos_pagados: 0,
      es_renovacion: true,
      fecha_creacion: serverTimestamp()
    });

    // 5. ACTUALIZAR INQUILINO
    batch.update(inqRef, {
      id_contrato_actual: nuevoContratoId,
      renta_actual: Number(nuevosDatos.renta_actual),
      id_unidad_actual: idUnidad,
      estado: "Activo",
      fecha_inicio_contrato: Timestamp.fromDate(fechaInicio),
      fecha_fin_contrato: Timestamp.fromDate(fechaFin),
      historial_contratos: arrayUnion(nuevoContratoId),
      ultima_modificacion: serverTimestamp()
    });

    // 6. ACTUALIZAR UNIDAD (Asegurar que la renta y contrato estén al día)
    batch.update(unidadRef, {
      id_contrato_actual: nuevoContratoId,
      renta_mensual: Number(nuevosDatos.renta_actual),
      estado: "Ocupado" // Por si acaso estaba en otro estado
    });

    await batch.commit();
    console.log(`✅ Renovación exitosa: ${nuevoContratoId}`);
    return { success: true, idContrato: nuevoContratoId };

  } catch (e) { 
    console.error("Error crítico en renovarContrato:", e); 
    throw new Error("ERROR_RENOVACION_CONTRATO"); 
  }
};
// ============================================
// FUNCIÓN AUXILIAR: VALIDAR SOLAPAMIENTO DE FECHAS
// ⭐ VERSIÓN MEJORADA - VALIDA CONTRA TODOS LOS CONTRATOS DE LA UNIDAD
// ============================================
export const validarSolapamientoContratos = async (idUnidad, fechaInicio, fechaFin, contratoExcluir = null) => {
  try {
    console.log("========================================");
    console.log("🔍 VALIDANDO SOLAPAMIENTO DE FECHAS");
    console.log("Unidad:", idUnidad);
    console.log("Nuevo contrato:");
    console.log("  Inicio:", fechaInicio);
    console.log("  Fin:", fechaFin);
    if (contratoExcluir) {
      console.log("Excluyendo contrato actual:", contratoExcluir);
    }
    console.log("========================================");

    // ⭐ OBTENER **TODOS** LOS CONTRATOS DE LA UNIDAD
    const contratosRef = collection(db, "contratos");
    const q = query(contratosRef, where("id_unidad", "==", idUnidad));
    const snapshot = await getDocs(q);
    
    console.log(`Total de contratos en la unidad: ${snapshot.docs.length}`);
    
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    
    // Validación básica
    if (fin <= inicio) {
      console.log("❌ ERROR: Fecha de fin no es posterior a fecha de inicio");
      return {
        valido: false,
        error: "FECHAS_INVALIDAS",
        message: "La fecha de fin debe ser posterior a la fecha de inicio"
      };
    }
    
    // Array para almacenar conflictos
    const contratosConflicto = [];
    
    // ⭐ REVISAR CADA CONTRATO DE LA UNIDAD
    snapshot.docs.forEach((docSnap, index) => {
      const contrato = docSnap.data();
      const contratoId = docSnap.id;
      
      // Saltar el contrato que estamos editando (si aplica)
      if (contratoExcluir && contratoId === contratoExcluir) {
        console.log(`\nSaltando contrato actual en edición: ${contratoId}`);
        return;
      }
      
      const contratoInicio = contrato.fecha_inicio.toDate();
      const contratoFin = contrato.fecha_fin.toDate();
      
      console.log(`\nValidando contrato ${index + 1}/${snapshot.docs.length}:`);
      console.log(`  ID: ${contratoId}`);
      console.log(`  Inquilino: ${contrato.nombre_inquilino || 'N/A'}`);
      console.log(`  Rango: ${contratoInicio.toLocaleDateString('es-MX')} → ${contratoFin.toLocaleDateString('es-MX')}`);
      console.log(`  Estado: ${contrato.estatus}`);
      
      // Detectar solapamiento
      const iniciaEntreMedio = inicio >= contratoInicio && inicio <= contratoFin;
      const terminaEntreMedio = fin >= contratoInicio && fin <= contratoFin;
      const envuelveContrato = inicio <= contratoInicio && fin >= contratoFin;
      
      const haySolapamiento = iniciaEntreMedio || terminaEntreMedio || envuelveContrato;
      
      if (haySolapamiento) {
        console.log(`  ⚠️  CONFLICTO DETECTADO`);
        
        contratosConflicto.push({
          id: contratoId,
          inquilino: contrato.nombre_inquilino || 'Desconocido',
          inicio: contratoInicio,
          fin: contratoFin,
          estatus: contrato.estatus || 'desconocido'
        });
      } else {
        console.log(`  ✅ Sin conflicto`);
      }
    });
    
    console.log("========================================");
    console.log(`RESULTADO: ${contratosConflicto.length} conflicto(s) detectado(s)`);
    console.log("========================================");
    
    // Si hay conflictos, retornar error con detalles
    if (contratosConflicto.length > 0) {
      return {
        valido: false,
        error: "SOLAPAMIENTO_CONTRATOS",
        message: `Las fechas se solapan con ${contratosConflicto.length} contrato(s) existente(s) en la unidad ${idUnidad}`,
        contratosConflicto: contratosConflicto
      };
    }
    
    console.log("✅ VALIDACIÓN EXITOSA - Sin solapamientos detectados");
    return { valido: true };
    
  } catch (error) {
    console.error("❌ Error validando solapamiento:", error);
    return {
      valido: false,
      error: "ERROR_VALIDACION",
      message: "Error al validar solapamiento: " + error.message
    };
  }
};

// ============================================
// OBTENER CONTRATOS PRÓXIMOS A VENCER
// ============================================
export const obtenerContratosPorVencer = async (diasAnticipacion = 30) => {
  try {
    const contratoRef = collection(db, 'contratos');
    const qContratos = query(
      contratoRef,
      where('estatus', '==', 'activo')
    );
    
    const snapshot = await getDocs(qContratos);
    const hoy = new Date();
    const contratosPorVencer = [];

    snapshot.forEach((doc) => {
      const contrato = doc.data();
      
      // Convertir fecha_fin a Date
      const fechaFin = contrato.fecha_fin?.toDate 
        ? contrato.fecha_fin.toDate() 
        : new Date(contrato.fecha_fin);
      
      // Calcular días restantes
      const diasRestantes = Math.ceil((fechaFin - hoy) / (1000 * 60 * 60 * 24));
      
      // Filtrar solo los que vencen en los próximos X días y no estén vencidos
      if (diasRestantes > 0 && diasRestantes <= diasAnticipacion) {
        contratosPorVencer.push({
          id: doc.id,
          id_unidad: contrato.id_unidad,
          nombre_inquilino: contrato.nombre_inquilino,
          monto_renta: contrato.monto_renta,
          fecha_inicio: contrato.fecha_inicio?.toDate 
            ? contrato.fecha_inicio.toDate() 
            : new Date(contrato.fecha_inicio),
          fecha_fin: fechaFin,
          diasRestantes,
          id_inquilino: contrato.id_inquilino,
          dia_pago: contrato.dia_pago,
          urgencia: diasRestantes <= 7 ? 'alta' : diasRestantes <= 15 ? 'media' : 'baja'
        });
      }
    });

    // Ordenar por días restantes (más urgentes primero)
    contratosPorVencer.sort((a, b) => a.diasRestantes - b.diasRestantes);

    return {
      exito: true,
      cantidad: contratosPorVencer.length,
      datos: contratosPorVencer
    };
  } catch (error) {
    console.error('Error obteniendo contratos por vencer:', error);
    return {
      exito: false,
      error: error.message,
      datos: []
    };
  }
};

// ============================================
// OBTENER CONTRATOS VENCIDOS
// ============================================
export const obtenerContratosVencidos = async () => {
  try {
    const contratoRef = collection(db, 'contratos');
    const qContratos = query(
      contratoRef,
      where('estatus', '==', 'activo')
    );
    
    const snapshot = await getDocs(qContratos);
    const hoy = new Date();
    const contratosVencidos = [];

    snapshot.forEach((doc) => {
      const contrato = doc.data();
      
      // Convertir fecha_fin a Date
      const fechaFin = contrato.fecha_fin?.toDate 
        ? contrato.fecha_fin.toDate() 
        : new Date(contrato.fecha_fin);
      
      // Calcular días vencidos
      const diasVencidos = Math.ceil((hoy - fechaFin) / (1000 * 60 * 60 * 24));
      
      // Filtrar solo los que ya vencieron
      if (diasVencidos > 0) {
        contratosVencidos.push({
          id: doc.id,
          id_unidad: contrato.id_unidad,
          nombre_inquilino: contrato.nombre_inquilino,
          monto_renta: contrato.monto_renta,
          fecha_inicio: contrato.fecha_inicio?.toDate 
            ? contrato.fecha_inicio.toDate() 
            : new Date(contrato.fecha_inicio),
          fecha_fin: fechaFin,
          diasVencidos,
          id_inquilino: contrato.id_inquilino,
          dia_pago: contrato.dia_pago
        });
      }
    });

    // Ordenar por días vencidos (más tiempo vencido primero)
    contratosVencidos.sort((a, b) => b.diasVencidos - a.diasVencidos);

    return {
      exito: true,
      cantidad: contratosVencidos.length,
      datos: contratosVencidos
    };
  } catch (error) {
    console.error('Error obteniendo contratos vencidos:', error);
    return {
      exito: false,
      error: error.message,
      datos: []
    };
  }
};

// ============================================
// OBTENER DATOS DE SEGUIMIENTO DE SERVICIOS Y MANTENIMIENTOS
// ============================================
export const obtenerDatosSeguimientoPeriodo = async (periodo) => {
  try {
    // 1. OBTENER LÍMITES DE SERVICIOS DE LA PROPIEDAD
    const propRef = doc(db, 'propiedades', 'chilpancingo');
    const propSnap = await getDoc(propRef);
    let LIMITE_AGUA_CONFIG = 250;
    let LIMITE_LUZ_CONFIG = 250;
    let LIMITE_INTERNET_CONFIG = 250;
    
    if (propSnap.exists()) {
      const configData = propSnap.data();
      LIMITE_AGUA_CONFIG = Number(configData.limite_agua || 250);
      LIMITE_LUZ_CONFIG = Number(configData.limite_luz || 250);
      LIMITE_INTERNET_CONFIG = Number(configData.limite_internet || 250);
    }

    // 2. OBTENER SERVICIOS CONDONADOS DEL PERIODO
    const pagosRef = collection(db, 'pagos');
    const qPagos = query(
      pagosRef,
      where('periodo', '==', periodo)
    );
    const pagosSnapshot = await getDocs(qPagos);

    let agua_condonada_total = 0;
    let luz_condonada_total = 0;
    let internet_condonada_total = 0;
    const detalleServicios = [];

    // Deduplicar por id_inquilino + id_unidad antes de procesar.
    // Si hay varios documentos (abonos parciales) para la misma unidad/inquilino/periodo,
    // todos comparten los mismos valores de servicios, así que solo procesamos UNO por clave.
    const pagosVistos = new Map(); // clave: "id_inquilino_id_unidad" → pago

    pagosSnapshot.forEach((docSnap) => {
      const pago = docSnap.data();
      if (!pago.servicios) return;

      const clave = `${pago.id_inquilino}_${pago.id_unidad}`;

      if (!pagosVistos.has(clave)) {
        // Primera vez que vemos esta unidad/inquilino en el periodo → lo guardamos
        pagosVistos.set(clave, pago);
      }
      // Si ya existe la clave, es un abono del mismo periodo → se ignora
    });

    // Procesamos solo UNO por unidad/inquilino
    pagosVistos.forEach((pago) => {
      const {
        agua_lectura = 0,
        luz_lectura = 0,
        internet_lectura = 0,
        limite_agua_aplicado = LIMITE_AGUA_CONFIG,
        limite_luz_aplicado = LIMITE_LUZ_CONFIG,
        limite_internet_aplicado = LIMITE_INTERNET_CONFIG
      } = pago.servicios;

      const agua_cond = Math.min(agua_lectura, limite_agua_aplicado);
      const luz_cond = Math.min(luz_lectura, limite_luz_aplicado);
      const internet_cond = Math.min(internet_lectura, limite_internet_aplicado);

      agua_condonada_total += agua_cond;
      luz_condonada_total += luz_cond;
      internet_condonada_total += internet_cond;

      if (agua_cond > 0 || luz_cond > 0 || internet_cond > 0) {
        detalleServicios.push({
          id_unidad: pago.id_unidad,
          agua: agua_cond,
          luz: luz_cond,
          internet: internet_cond,
          total: agua_cond + luz_cond + internet_cond
        });
      }
    });

    // 3. OBTENER MANTENIMIENTOS DEL PERIODO
    const mantRef = collection(db, 'mantenimientos');
    const qMant = query(
      mantRef,
      where('periodo', '==', periodo),
      where('estatus', '!=', 'cancelado')
    );
    const mantSnapshot = await getDocs(qMant);

    const detalleMantenimientos = [];
    let total_mantenimiento = 0;

    mantSnapshot.forEach((docSnap) => {
      const mant = docSnap.data();
      const costo = Number(mant.costo_real || mant.costo_estimado || 0);
      
      total_mantenimiento += costo;
      detalleMantenimientos.push({
        id: docSnap.id,
        id_unidad: mant.id_unidad,
        concepto: mant.concepto,
        categoria: mant.categoria,
        costo: costo,
        estatus: mant.estatus
      });
    });

    // 4. CALCULAR TOTALES
    const servicios_condonados_total = agua_condonada_total + luz_condonada_total + internet_condonada_total;
    const total_egresos = total_mantenimiento + servicios_condonados_total;

    return {
      exito: true,
      periodo,
      servicios: {
        agua: agua_condonada_total,
        luz: luz_condonada_total,
        internet: internet_condonada_total,
        total: servicios_condonados_total,
        detalle: detalleServicios
      },
      mantenimientos: {
        total: total_mantenimiento,
        cantidad: detalleMantenimientos.length,
        detalle: detalleMantenimientos
      },
      total_egresos,
      cantidad_unidades_afectadas: detalleServicios.length
    };

  } catch (error) {
    console.error('Error obteniendo datos de seguimiento:', error);
    return {
      exito: false,
      error: error.message
    };
  }
};

// ============================================
// CREAR O ACTUALIZAR DOCUMENTO DE SEGUIMIENTO
// ============================================
export const crearSeguimientoPeriodo = async (periodo, datos) => {
  try {
    const seguimientoRef = doc(db, 'seguimiento', periodo);
    
    const documentoSeguimiento = {
      id: periodo,
      periodo,
      anio: parseInt(periodo.split('-')[0]),
      mes: parseInt(periodo.split('-')[1]),
      
      // Servicios condonados
      servicios_agua: datos.servicios.agua,
      servicios_luz: datos.servicios.luz,
      servicios_internet: datos.servicios.internet,
      servicios_total: datos.servicios.total,
      servicios_detalle: datos.servicios.detalle,
      
      // Mantenimientos
      mantenimientos_total: datos.mantenimientos.total,
      mantenimientos_cantidad: datos.mantenimientos.cantidad,
      mantenimientos_detalle: datos.mantenimientos.detalle,
      
      // Totales
      total_egresos: datos.total_egresos,
      cantidad_unidades_afectadas: datos.cantidad_unidades_afectadas,
      
      // Estado de pago
      estado_pago: "pendiente",
      fecha_pago: null,
      
      // Trazabilidad
      fecha_creacion: serverTimestamp(),
      fecha_ultima_actualizacion: serverTimestamp()
    };

    await setDoc(seguimientoRef, documentoSeguimiento);
    
    return {
      exito: true,
      mensaje: `Seguimiento registrado para ${periodo}`,
      id: periodo
    };
  } catch (error) {
    console.error('Error creando seguimiento:', error);
    return {
      exito: false,
      error: error.message
    };
  }
};

// ============================================
// MARCAR SEGUIMIENTO COMO PAGADO
// ============================================
export const marcarSeguimientoPagado = async (periodo) => {
  try {
    const seguimientoRef = doc(db, 'seguimiento', periodo);
    
    await updateDoc(seguimientoRef, {
      estado_pago: "pagado",
      fecha_pago: serverTimestamp(),
      fecha_ultima_actualizacion: serverTimestamp()
    });

    return {
      exito: true,
      mensaje: `Seguimiento marcado como pagado: ${periodo}`
    };
  } catch (error) {
    console.error('Error marcando seguimiento pagado:', error);
    return {
      exito: false,
      error: error.message
    };
  }
};

// ============================================
// OBTENER TODOS LOS SEGUIMIENTOS
// ============================================
export const obtenerSeguimientos = async (filtroEstado = null) => {
  try {
    const seguimientoRef = collection(db, 'seguimiento');
    let q = query(seguimientoRef, orderBy('periodo', 'desc'));
    
    if (filtroEstado) {
      q = query(
        seguimientoRef,
        where('estado_pago', '==', filtroEstado),
        orderBy('periodo', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    const seguimientos = [];

    snapshot.forEach((doc) => {
      seguimientos.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return {
      exito: true,
      cantidad: seguimientos.length,
      datos: seguimientos
    };
  } catch (error) {
    console.error('Error obteniendo seguimientos:', error);
    return {
      exito: false,
      error: error.message,
      datos: []
    };
  }
};

// ============================================
// ELIMINAR INQUILINO COMPLETO (CON TODOS SUS DATOS)
// ⭐ FUNCIÓN DESTRUCTIVA - SOLO PARA INQUILINOS SIN CONTRATO ACTIVO
// ============================================
export const eliminarInquilinoCompleto = async (idInquilino) => {
  if (!idInquilino) {
    return { exito: false, mensaje: "ID de inquilino inválido" };
  }

  try {
    return await runTransaction(db, async (transaction) => {
      // 1. FRENO DE SEGURIDAD: Obtener inquilino y verificar que no tenga contrato activo
      const inqRef = doc(db, "inquilinos", idInquilino);
      const inqSnap = await transaction.get(inqRef);

      if (!inqSnap.exists()) {
        throw new Error("INQUILINO_NO_EXISTE");
      }

      const inquilino = inqSnap.data();

      // Verificar que NO tenga contrato activo
      if (inquilino.activo === true) {
        throw new Error("INQUILINO_ACTIVO_NO_PUEDE_ELIMINARSE");
      }

      console.log("🗑️ Iniciando eliminación completa de inquilino:", idInquilino);

      // 2. OBTENER TODOS LOS CONTRATOS DEL INQUILINO
      const contratosSnap = await getDocs(
        query(
          collection(db, "contratos"),
          where("id_inquilino", "==", idInquilino)
        )
      );

      const contratosIds = [];
      contratosSnap.forEach(doc => {
        contratosIds.push(doc.id);
      });

      console.log(`  📄 ${contratosIds.length} contratos encontrados`);

      // 3. OBTENER TODOS LOS PAGOS DEL INQUILINO
      const pagosSnap = await getDocs(
        query(
          collection(db, "pagos"),
          where("id_inquilino", "==", idInquilino)
        )
      );

      const pagosIds = [];
      pagosSnap.forEach(doc => {
        pagosIds.push(doc.id);
      });

      console.log(`  💰 ${pagosIds.length} pagos encontrados`);

      // 4. OBTENER TODAS LAS UNIDADES ASOCIADAS
      const unidadesSnap = await getDocs(collection(db, "unidades"));
      const unidadesAActualizar = [];

      unidadesSnap.forEach(doc => {
        const unidad = doc.data();
        if (unidad.id_inquilino === idInquilino) {
          unidadesAActualizar.push(doc.id);
        }
      });

      console.log(`  🏠 ${unidadesAActualizar.length} unidades a limpiar`);

      // 5. OBTENER MANTENIMIENTOS ASOCIADOS AL INQUILINO
      const mantenimientosSnap = await getDocs(collection(db, "mantenimientos"));
      const mantenimientosAActualizar = [];

      mantenimientosSnap.forEach(doc => {
        const mant = doc.data();
        // Buscar si el inquilino está en el array de inquilinos_afectados o como id_inquilino_afectado
        const tieneInquilino = 
          mant.id_inquilino_afectado === idInquilino || 
          (Array.isArray(mant.inquilinos_afectados) && mant.inquilinos_afectados.includes(idInquilino));
        
        if (tieneInquilino) {
          mantenimientosAActualizar.push({
            id: doc.id,
            data: mant
          });
        }
      });

      console.log(`  🔧 ${mantenimientosAActualizar.length} mantenimientos a limpiar`);

      // 6. PREPARAR BATCH PARA ELIMINAR TODO
      // Eliminar inquilino
      transaction.delete(inqRef);

      // Eliminar todos los contratos
      contratosIds.forEach(contratoId => {
        const contratoRef = doc(db, "contratos", contratoId);
        transaction.delete(contratoRef);
      });

      // Eliminar todos los pagos
      pagosIds.forEach(pagoId => {
        const pagoRef = doc(db, "pagos", pagoId);
        transaction.delete(pagoRef);
      });

      // Actualizar unidades: limpiar referencia al inquilino
      unidadesAActualizar.forEach(unidadId => {
        const unidadRef = doc(db, "unidades", unidadId);
        transaction.update(unidadRef, {
          id_inquilino: null,
          nombre_inquilino: null,
          renta_mensual: null,
          estado: "Libre",
          id_contrato_actual: null,
          no_personas: null
        });
      });

      // Actualizar mantenimientos: limpiar referencias al inquilino
      mantenimientosAActualizar.forEach(mant => {
        const mantRef = doc(db, "mantenimientos", mant.id);
        const mantData = mant.data;
        
        // Limpiar id_inquilino_afectado si coincide
        if (mantData.id_inquilino_afectado === idInquilino) {
          mantData.id_inquilino_afectado = null;
        }
        
        // Limpiar del array inquilinos_afectados si existe
        if (Array.isArray(mantData.inquilinos_afectados)) {
          mantData.inquilinos_afectados = mantData.inquilinos_afectados.filter(id => id !== idInquilino);
        }
        
        transaction.update(mantRef, mantData);
      });

      console.log("✅ Eliminación completada (transacción confirmada)");

      return {
        exito: true,
        mensaje: "Inquilino eliminado completamente",
        datosEliminados: {
          inquilino: idInquilino,
          contratos: contratosIds.length,
          pagos: pagosIds.length,
          unidades_limpiadas: unidadesAActualizar.length,
          mantenimientos_limpiados: mantenimientosAActualizar.length
        }
      };
    });
  } catch (error) {
    console.error("❌ Error eliminando inquilino:", error);

    // Mapear errores específicos
    let mensaje = "Error al eliminar el inquilino";
    if (error.message === "INQUILINO_NO_EXISTE") {
      mensaje = "El inquilino no existe en la base de datos";
    } else if (error.message === "INQUILINO_ACTIVO_NO_PUEDE_ELIMINARSE") {
      mensaje = "No se puede eliminar un inquilino con contrato activo";
    }

    return {
      exito: false,
      mensaje: mensaje,
      error: error.message
    };
  }
};