import { db } from './config'; 
import { collection, 
        getDocs, 
        query, 
        where, 
        doc, 
        addDoc, 
        getDoc, 
        updateDoc,
        Timestamp, 
        setDoc, 
        serverTimestamp } from 'firebase/firestore';
// ============================================
// FUNCIÓN: Condonar deuda con estructura uniforme
// ============================================

const limpiarDatos = (obj) => {
  const nuevoObj = {};
  Object.keys(obj).forEach((key) => {
    if (obj[key] === undefined) {
      nuevoObj[key] = null; // O puedes usar delete para no enviarlo
    } else if (obj[key] !== null && typeof obj[key] === 'object' && !(obj[key] instanceof Date) && key !== 'createdAt' && key !== 'fecha_condonacion' && key !== 'fecha_registro') {
      // Si es un objeto (y no es una fecha o un serverTimestamp), lo limpiamos también
      nuevoObj[key] = limpiarDatos(obj[key]);
    } else {
      nuevoObj[key] = obj[key];
    }
  });
  return nuevoObj;
};

export const condonarDeuda = async (adeudo, motivo) => {
  try {
    const resultado = await runTransaction(db, async (transaction) => {
      // 1. REFERENCIAS Y LECTURAS (Check de seguridad previo)
      const contratoRef = doc(db, "contratos", adeudo.id_contracto || adeudo.id_contrato);
      const contratoSnap = await transaction.get(contratoRef);

      if (!contratoSnap.exists()) {
        throw new Error("EL_CONTRATO_NO_EXISTE");
      }

      const contrato = contratoSnap.data();
      const periodosEsperados = [...(contrato.periodos_esperados || [])];
      const indicePeriodo = periodosEsperados.findIndex(p => p.periodo === adeudo.periodo);

      if (indicePeriodo === -1) {
        throw new Error("PERIODO_NO_ENCONTRADO_EN_CONTRATO");
      }
      const nuevoPagoRef = doc(collection(db, "pagos"));
      const nuevoIdPago = nuevoPagoRef.id;

      const saldoACondonar = Number(adeudo.saldo_restante_periodo || 0);
      const pagadoHastaAhora = Number(adeudo.monto_pagado || 0);
      const totalEsperado = Number(adeudo.total_esperado_periodo || (saldoACondonar + pagadoHastaAhora));
      const [anio, mes] = adeudo.periodo.split('-').map(Number);

      const dataCondonacion = {
        id: nuevoIdPago,
        anio,
        mes,
        periodo: adeudo.periodo,
        id_unidad: adeudo.id_unidad,
        id_inquilino: adeudo.id_inquilino || '',
        id_contrato: adeudo.id_contrato || '',
        monto_pagado: pagadoHastaAhora,
        saldo_restante_periodo: 0,
        total_esperado_periodo: totalEsperado,
        estatus: 'condonado',
        medio_pago: 'condonacion',
        fecha_registro: serverTimestamp(),
        servicios: adeudo.servicios || { 
          agua_lectura: 0, 
          luz_lectura: 0, 
          internet_lectura: 0,
          limite_agua_aplicado: 250,
          limite_luz_aplicado: 250,
          limite_internet_aplicado: 250
        },
        condonado: true,
        fecha_condonacion: serverTimestamp(),
        motivo_condonacion: motivo || "Sin motivo especificado",
        monto_condonado: saldoACondonar,
        estado_previo: {
          saldo_antes: saldoACondonar,
          pagado_antes: pagadoHastaAhora,
          estatus_antes: adeudo.estatus || 'pendiente'
        }
      };

      // 3. ACTUALIZAR LÓGICA DEL ARRAY DEL CONTRATO
      const periodoActual = periodosEsperados[indicePeriodo];
      const idsPrevios = periodoActual.id_pagos || [];
      
      periodosEsperados[indicePeriodo] = {
        ...periodoActual,
        estatus: "condonado", // ⭐ Cambiado de "pagado" a "condonado" para analítica clara
        monto_pagado: totalEsperado, 
        saldo_restante: 0,
        fecha_ultimo_pago: Timestamp.now(),
        id_pagos: idsPrevios.includes(nuevoIdPago) ? idsPrevios : [...idsPrevios, nuevoIdPago],
        metodo_condonacion: true
      };

      const periodosPagadosCount = periodosEsperados.filter(
        p => p.estatus === "pagado" || p.estatus === "condonado"
      ).length;

      // 4. ESCRITURAS SIMULTÁNEAS (Atomicidad)
      transaction.set(nuevoPagoRef, dataCondonacion);
      transaction.update(contratoRef, {
        periodos_esperados: periodosEsperados,
        periodos_pagados: periodosPagadosCount,
        ultima_modificacion: serverTimestamp()
      });

      return { exito: true, id: nuevoIdPago };
    });

    console.log("✅ Condonación exitosa y atómica:", resultado.id);
    return resultado;

  } catch (error) {
    console.error("❌ Error crítico en condonación:", error);
    return { exito: false, mensaje: error.message };
  }
};
// ============================================
// UTILIDAD: Validar si inquilino tenía contrato en periodo
// ============================================
const inquilinoTeniaContratoEnPeriodo = (inquilino, periodo) => {
  if (!inquilino) return { activo: false, finalizado: false };
  
  const [anioPeriodo, mesPeriodo] = periodo.split('-').map(Number);
  const hoy = new Date();
  
  // Función auxiliar para verificar si un mes/año está dentro de un rango de fechas
  const periodoEnRango = (inicio, fin) => {
    const inicioAnio = inicio.getFullYear();
    const inicioMes = inicio.getMonth() + 1; // getMonth() retorna 0-11
    const finAnio = fin.getFullYear();
    const finMes = fin.getMonth() + 1;
    if (anioPeriodo > inicioAnio && anioPeriodo < finAnio) {
      return true; // Año completo dentro del rango
    }
    
    if (anioPeriodo === inicioAnio && anioPeriodo === finAnio) {
      return mesPeriodo >= inicioMes && mesPeriodo <= finMes; // Mismo año
    }
    
    if (anioPeriodo === inicioAnio) {
      return mesPeriodo >= inicioMes; // Año de inicio
    }
    
    if (anioPeriodo === finAnio) {
      return mesPeriodo <= finMes; // Año de fin
    }
    
    return false;
  };
  
  // Verificar contrato actual
  if (inquilino.fecha_inicio_contrato && inquilino.fecha_fin_contrato) {
    const inicio = inquilino.fecha_inicio_contrato.toDate ? 
      inquilino.fecha_inicio_contrato.toDate() : new Date(inquilino.fecha_inicio_contrato);
    const fin = inquilino.fecha_fin_contrato.toDate ? 
      inquilino.fecha_fin_contrato.toDate() : new Date(inquilino.fecha_fin_contrato);
    
    if (periodoEnRango(inicio, fin)) {
      const contratoFinalizado = fin < hoy;
      return { activo: true, finalizado: contratoFinalizado };
    }
  }
  
  // Verificar historial de contratos
  if (inquilino.historial_contratos && Array.isArray(inquilino.historial_contratos)) {
    for (const contrato of inquilino.historial_contratos) {
      if (contrato.fecha_inicio && contrato.fecha_fin) {
        const inicio = contrato.fecha_inicio.toDate ? 
          contrato.fecha_inicio.toDate() : new Date(contrato.fecha_inicio);
        const fin = contrato.fecha_fin.toDate ? 
          contrato.fecha_fin.toDate() : new Date(contrato.fecha_fin);
        
        if (periodoEnRango(inicio, fin)) {
          const contratoFinalizado = fin < hoy;
          return { activo: true, finalizado: contratoFinalizado };
        }
      }
    }
  }
  
  return { activo: false, finalizado: false };
};
// ============================================
// FUNCIÓN PRINCIPAL: getDatosDashboard con validación de pagos múltiples
// ============================================
export const getDatosDashboard = async (periodoActual) => {
  try {
    // 1. Normalizar el rango de búsqueda
    const esRango = typeof periodoActual === 'object' && periodoActual.inicio && periodoActual.fin;
    const inicioStr = esRango ? periodoActual.inicio.slice(0, 7) : (typeof periodoActual === 'string' ? periodoActual : new Date().toISOString().slice(0, 7));
    const finStr = esRango ? periodoActual.fin.slice(0, 7) : inicioStr;

    console.log("🔍 DEBUG - Periodo solicitado:", { inicioStr, finStr, esRango });

    // Consultar CONTRATOS ACTIVOS
    const [uSnap, contratosSnap, pSnap] = await Promise.all([
      getDocs(collection(db, "unidades")),
      getDocs(query(collection(db, "contratos"), where("estatus", "==", "activo"))),
      getDocs(collection(db, "pagos"))
    ]);

    console.log("🔍 DEBUG - Contratos activos encontrados:", contratosSnap.size);
    
    // Crear mapa de contratos activos
    const contratosMap = {};
    contratosSnap.forEach(doc => {
      const contrato = { id: doc.id, ...doc.data() };
      contratosMap[contrato.id_unidad] = contrato;
      console.log("📄 Contrato:", {
        id: contrato.id,
        unidad: contrato.id_unidad,
        inquilino: contrato.nombre_inquilino,
        renta: contrato.monto_renta,
        inicio: contrato.fecha_inicio?.toDate ? contrato.fecha_inicio.toDate() : contrato.fecha_inicio,
        fin: contrato.fecha_fin?.toDate ? contrato.fecha_fin.toDate() : contrato.fecha_fin
      });
    });

    // Crear meses a evaluar
    const mesesAEvaluar = [];
    let [startAnio, startMes] = inicioStr.split('-').map(Number);
    let [endAnio, endMes] = finStr.split('-').map(Number);
    
    let fechaInicio = new Date(startAnio, startMes - 1, 1);
    let fechaFin = new Date(endAnio, endMes - 1, 1);

    while (fechaInicio <= fechaFin) {
      mesesAEvaluar.push(fechaInicio.toISOString().slice(0, 7));
      fechaInicio.setMonth(fechaInicio.getMonth() + 1);
    }

    console.log("📅 Meses a evaluar:", mesesAEvaluar);

    // Mapa de pagos
    const pagosLookup = {};
    const condonadosSet = new Set();
    
    pSnap.docs.forEach(doc => {
      const p = doc.data();
      
      if (p.condonado === true) {
        condonadosSet.add(`${p.id_unidad}_${p.periodo}`);
        return;
      }

      const key = `${p.id_unidad}_${p.periodo}`;
      if (!pagosLookup[key]) {
        pagosLookup[key] = { 
          monto_acumulado: 0, 
          total_esperado: Number(p.total_esperado_periodo || 0) 
        };
      }
      pagosLookup[key].monto_acumulado += Number(p.monto_pagado || 0);
      if (Number(p.total_esperado_periodo) > pagosLookup[key].total_esperado) {
        pagosLookup[key].total_esperado = Number(p.total_esperado_periodo);
      }
    });

    console.log("💰 Pagos registrados:", pagosLookup);
    console.log("✅ Condonados:", Array.from(condonadosSet));

    const listaAdeudosDesglosada = [];
    let totalEsperadoGlobal = 0;
    let totalPagadoGlobal = 0;

    // PROCESAMIENTO MES POR MES
    mesesAEvaluar.forEach(mes => {
      console.log(`\n🗓️ Procesando mes: ${mes}`);
      
      Object.values(contratosMap).forEach(contrato => {
        // Validar si el periodo está dentro del rango del contrato
        const [anioPeriodo, mesPeriodo] = mes.split('-').map(Number);
        const fechaInicio = contrato.fecha_inicio?.toDate ? 
          contrato.fecha_inicio.toDate() : new Date(contrato.fecha_inicio);
        const fechaFin = contrato.fecha_fin?.toDate ? 
          contrato.fecha_fin.toDate() : new Date(contrato.fecha_fin);
        
        const inicioAnio = fechaInicio.getFullYear();
        const inicioMes = fechaInicio.getMonth() + 1;
        const finAnio = fechaFin.getFullYear();
        const finMes = fechaFin.getMonth() + 1;

        console.log(`  📋 Evaluando ${contrato.id_unidad} - ${contrato.nombre_inquilino}`);
        console.log(`     Contrato: ${inicioAnio}-${inicioMes} hasta ${finAnio}-${finMes}`);
        console.log(`     Periodo evaluado: ${anioPeriodo}-${mesPeriodo}`);

        // Verificar si el periodo está dentro del contrato
        let periodoEnContrato = false;
        
        if (anioPeriodo > inicioAnio && anioPeriodo < finAnio) {
          periodoEnContrato = true;
        } else if (anioPeriodo === inicioAnio && anioPeriodo === finAnio) {
          periodoEnContrato = mesPeriodo >= inicioMes && mesPeriodo <= finMes;
        } else if (anioPeriodo === inicioAnio) {
          periodoEnContrato = mesPeriodo >= inicioMes;
        } else if (anioPeriodo === finAnio) {
          periodoEnContrato = mesPeriodo <= finMes;
        }

        console.log(`     ¿En contrato? ${periodoEnContrato}`);

        if (!periodoEnContrato) {
          console.log(`     ❌ FUERA DE CONTRATO`);
          return;
        }
        
        const key = `${contrato.id_unidad}_${mes}`;
        if (condonadosSet.has(key)) {
          console.log(`     ✅ CONDONADO`);
          return;
        }

        const registroMes = pagosLookup[key];
        const rentaOriginal = Number(contrato.monto_renta || 0);
        
        const pagado = registroMes ? registroMes.monto_acumulado : 0;
        const esperado = (registroMes && registroMes.total_esperado > 0) 
                         ? registroMes.total_esperado 
                         : rentaOriginal;
        
        const pendiente = Math.max(0, esperado - pagado);

        console.log(`     💵 Esperado: $${esperado}, Pagado: $${pagado}, Pendiente: $${pendiente}`);

        // Sumatoria para stats
        totalEsperadoGlobal += esperado;
        totalPagadoGlobal += pagado;

        // Agregar a la lista si hay deuda
        if (pendiente > 0) {
          const hoy = new Date();
          const contratoFinalizado = fechaFin < hoy;
          
          console.log(`     ⚠️ ADEUDO AGREGADO A LA LISTA`);
          
          listaAdeudosDesglosada.push({
            id: `${contrato.id_unidad}_${mes}`,
            id_unidad: contrato.id_unidad,
            id_inquilino: contrato.id_inquilino,
            periodo: mes,
            nombre: contrato.nombre_inquilino,
            nombre_completo: contrato.nombre_inquilino,
            monto: pendiente,
            monto_pagado: pagado,
            saldo_restante_periodo: pendiente,
            total_esperado_periodo: esperado,
            estatus: pagado > 0 ? 'parcial' : 'pendiente',
            id_contrato: contrato.id,
            dia_pago: contrato.dia_pago || 5,
            contratoFinalizado: contratoFinalizado
          });
        } else {
          console.log(`     ✓ Sin adeudo`);
        }
      });
    });

    console.log("\n📊 RESUMEN FINAL:");
    console.log("Total esperado:", totalEsperadoGlobal);
    console.log("Total pagado:", totalPagadoGlobal);
    console.log("Total adeudo:", totalEsperadoGlobal - totalPagadoGlobal);
    console.log("Adeudos en lista:", listaAdeudosDesglosada.length);
    console.log("Detalle de adeudos:", listaAdeudosDesglosada);

    // Crear mapa de inquilinos
    const inquilinosMap = {};
    contratosSnap.forEach(doc => {
      const c = doc.data();
      if (c.id_inquilino) {
        inquilinosMap[c.id_inquilino] = {
          id: c.id_inquilino,
          nombre_completo: c.nombre_inquilino,
          renta_actual: c.monto_renta,
          dia_pago: c.dia_pago
        };
      }
    });

    return {
      stats: {
        esperado: totalEsperadoGlobal,
        pagado: totalPagadoGlobal,
        adeudo: totalEsperadoGlobal - totalPagadoGlobal
      },
      listaAdeudos: listaAdeudosDesglosada,
      unidades: uSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        nombre_inquilino: contratosMap[doc.id]?.nombre_inquilino || "Libre"
      })),
      inquilinosMap: inquilinosMap
    };
  } catch (error) {
    console.error("❌ Error Dashboard:", error);
    return { 
      stats: { esperado: 0, pagado: 0, adeudo: 0 }, 
      listaAdeudos: [], 
      unidades: [], 
      inquilinosMap: {} 
    };
  }
};