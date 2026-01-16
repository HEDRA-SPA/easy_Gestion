import { db } from './config'; 
import { collection, getDocs, query, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';

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
    const idPago = `${adeudo.id_unidad}_${adeudo.periodo}`;
    const pagoRef = doc(db, 'pagos', idPago);
    
    const [anio, mes] = adeudo.periodo.split('-').map(Number);

    const dataRaw = {
      anio: anio,
      mes: mes,
      periodo: adeudo.periodo,
      id_unidad: adeudo.id_unidad,
      id_inquilino: adeudo.id_inquilino || '', // Ahora sí vendrá lleno
      id_contrato: adeudo.id_contrato || '',
      
      monto_pagado: Number(adeudo.monto_pagado || 0),
      saldo_restante_periodo: 0,
      total_esperado_periodo: Number(adeudo.total_esperado_periodo || (adeudo.monto + (adeudo.monto_pagado || 0))),
      
      estatus: 'condonado',
      medio_pago: 'condonacion',
      
      createdAt: serverTimestamp(),
      fecha_registro: serverTimestamp(),
     
      condonado: true,
      fecha_condonacion: serverTimestamp(),
      motivo_condonacion: motivo || "Sin motivo",
      monto_condonado: Number(adeudo.monto || 0),
      
      estado_previo: {
        saldo_antes: Number(adeudo.monto || 0),
        pagado_antes: Number(adeudo.monto_pagado || 0),
        estatus_antes: adeudo.estatus || 'pendiente'
      }
    };

    // Al limpiar, eliminamos undefined y nulos innecesarios
    const dataFinal = limpiarDatos(dataRaw);

    await setDoc(pagoRef, dataFinal, { merge: true });

    console.log("✅ Condonación exitosa con ID de Inquilino:", adeudo.id_inquilino);
    return { exito: true };

  } catch (error) {
    console.error("❌ Error Crítico en condonarDeuda:", error);
    return { exito: false, error: error.message };
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
    
    // El periodo está dentro del contrato si:
    // - El año del periodo está entre el año de inicio y fin, O
    // - El año del periodo es igual al de inicio y el mes >= mes de inicio, O
    // - El año del periodo es igual al de fin y el mes <= mes de fin
    
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

    const [uSnap, iSnap, pSnap] = await Promise.all([
      getDocs(collection(db, "unidades")),
      getDocs(query(collection(db, "inquilinos"), where("activo", "==", true))),
      getDocs(collection(db, "pagos"))
    ]);

    const inqsMap = {};
    iSnap.forEach(doc => { inqsMap[doc.id] = { id: doc.id, ...doc.data() }; });

    // 2. Crear meses a evaluar sin errores de zona horaria
    const mesesAEvaluar = [];
    let [startAnio, startMes] = inicioStr.split('-').map(Number);
    let [endAnio, endMes] = finStr.split('-').map(Number);
    
    let fechaInicio = new Date(startAnio, startMes - 1, 1);
    let fechaFin = new Date(endAnio, endMes - 1, 1);

    while (fechaInicio <= fechaFin) {
      mesesAEvaluar.push(fechaInicio.toISOString().slice(0, 7));
      fechaInicio.setMonth(fechaInicio.getMonth() + 1);
    }

    // 3. ⭐ EL MAPA DE PAGOS: Solo sumar si NO está condonado
    const pagosLookup = {};
    pSnap.docs.forEach(doc => {
      const p = doc.data();
      if (p.condonado === true) return;

      const key = `${p.id_unidad}_${p.periodo}`;
      if (!pagosLookup[key]) {
        pagosLookup[key] = { 
          monto_acumulado: 0, 
          total_esperado: Number(p.total_esperado_periodo || 0) 
        };
      }
      pagosLookup[key].monto_acumulado += Number(p.monto_pagado || 0);
      // Mantener siempre el total esperado más alto (por si hubo servicios)
      if (Number(p.total_esperado_periodo) > pagosLookup[key].total_esperado) {
        pagosLookup[key].total_esperado = Number(p.total_esperado_periodo);
      }
    });

    // 4. EL MAPA DE CONDONACIONES (Para excluir rápido)
    const condonadosSet = new Set();
    pSnap.docs.forEach(doc => {
      if (doc.data().condonado === true) {
        condonadosSet.add(`${doc.data().id_unidad}_${doc.data().periodo}`);
      }
    });

    const ocupadas = uSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(u => u.id_inquilino && inqsMap[u.id_inquilino]);

    const listaAdeudosDesglosada = [];
    let totalEsperadoGlobal = 0;
    let totalPagadoGlobal = 0;

    // 5. PROCESAMIENTO MES POR MES
    mesesAEvaluar.forEach(mes => {
      ocupadas.forEach(u => {
        const inq = inqsMap[u.id_inquilino];
        const validacionContrato = inquilinoTeniaContratoEnPeriodo(inq, mes);
        
        if (!validacionContrato.activo) return;
        if (condonadosSet.has(`${u.id}_${mes}`)) return; // Ignorar si está condonado

        const registroMes = pagosLookup[`${u.id}_${mes}`];
        const rentaOriginal = Number(inq.renta_actual || u.renta_mensual || 0);
        
        const pagado = registroMes ? registroMes.monto_acumulado : 0;
        const esperado = (registroMes && registroMes.total_esperado > 0) 
                         ? registroMes.total_esperado 
                         : rentaOriginal;
        
        const pendiente = Math.max(0, esperado - pagado);

        // Sumatoria para los cuadros de resumen
        totalEsperadoGlobal += esperado;
        totalPagadoGlobal += pagado;

        // ⭐ SOLO agregar a la tabla si hay deuda real en ESTE mes específico
        if (pendiente > 0) {
          listaAdeudosDesglosada.push({
            id: `${u.id}_${mes}`,
            id_unidad: u.id,
            id_inquilino: u.id_inquilino,
            periodo: mes, 
            nombre: inq.nombre_completo,
            monto: pendiente,
            monto_pagado: pagado,
            total_esperado_periodo: esperado,
            estatus: pagado > 0 ? 'parcial' : 'pendiente',
            id_contrato: inq.id_contrato_actual || u.id_contrato_actual,
            dia_pago: inq.dia_pago || 5,
            contratoFinalizado: validacionContrato.finalizado
          });
        }
      });
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
        nombre_inquilino: inqsMap[doc.data().id_inquilino]?.nombre_completo || "Libre"
      })),
      inquilinosMap: inqsMap
    };
  } catch (error) {
    console.error("Error Dashboard:", error);
    return { stats: { esperado: 0, pagado: 0, adeudo: 0 }, listaAdeudos: [], unidades: [], inquilinosMap: {} };
  }
};