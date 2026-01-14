import { db } from './config'; 
import { collection, getDocs, query, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// ============================================
// FUNCIÓN: Condonar deuda con estructura uniforme
// ============================================
export const condonarDeuda = async (adeudo, motivo) => {
  try {
    const idPago = `${adeudo.id_unidad}_${adeudo.periodo}`;
    const pagoRef = doc(db, 'pagos', idPago);
    
    const [anio, mes] = adeudo.periodo.split('-').map(Number);

    // Estructura IDÉNTICA a un pago normal + campos de condonación
    const dataCondonacion = {
      anio: anio,
      mes: mes,
      periodo: adeudo.periodo,
      id_unidad: adeudo.id_unidad,
      id_inquilino: adeudo.id_inquilino || '',
      id_contrato: adeudo.id_contrato || '',
      
      // Montos
      monto_pagado: adeudo.monto_pagado || 0,
      saldo_restante_periodo: 0, // Al condonar, el saldo queda en 0
      total_esperado_periodo: adeudo.total_esperado_periodo || adeudo.saldo_restante_periodo,
      
      // Estado
      estatus: 'condonado',
      medio_pago: 'condonacion',
      
      // Fechas
      createdAt: serverTimestamp(),
      fecha_registro: serverTimestamp(),
      fecha_pago_realizado: null,
      
      // Servicios (mantener estructura)
      servicios: adeudo.servicios || {
        agua_lectura: 250,
        luz_lectura: 250
      },
      
      // ⭐ CAMPOS DE CONDONACIÓN (para filtrado)
      condonado: true,
      fecha_condonacion: serverTimestamp(),
      motivo_condonacion: motivo,
      monto_condonado: adeudo.saldo_restante_periodo,
      
      // Auditoría
      estado_previo: {
        saldo_antes: adeudo.saldo_restante_periodo,
        pagado_antes: adeudo.monto_pagado,
        estatus_antes: adeudo.estatus
      }
    };

    await setDoc(pagoRef, dataCondonacion, { merge: true });

    console.log("✅ Deuda condonada:", idPago);
    return { exito: true };

  } catch (error) {
    console.error("❌ Error al condonar deuda:", error);
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
// FUNCIÓN PRINCIPAL: getDatosDashboard con validación
// ============================================
export const getDatosDashboard = async (periodoActual) => {
  try {
    const esRango = typeof periodoActual === 'object';
    const inicioStr = esRango ? periodoActual.inicio.slice(0, 7) : periodoActual;
    const finStr = esRango ? periodoActual.fin.slice(0, 7) : periodoActual;

    const [uSnap, iSnap, pSnap] = await Promise.all([
      getDocs(collection(db, "unidades")),
      getDocs(query(collection(db, "inquilinos"), where("activo", "==", true))),
      getDocs(collection(db, "pagos"))
    ]);

    // Mapear inquilinos con TODA su información
    const inqsMap = {};
    iSnap.forEach(doc => { 
      inqsMap[doc.id] = { id: doc.id, ...doc.data() }; 
    });

    const mesesAEvaluar = [];
    let curr = new Date(inicioStr + "-02");
    const finDate = new Date(finStr + "-02");
    while (curr <= finDate) {
      mesesAEvaluar.push(curr.toISOString().slice(0, 7));
      curr.setMonth(curr.getMonth() + 1);
    }

    // Filtrar pagos condonados
    const pagosLookup = {};
    pSnap.docs.forEach(doc => {
      const p = doc.data();
      if (p.condonado !== true) {
        pagosLookup[`${p.id_unidad}_${p.periodo}`] = p;
      }
    });

    const ocupadas = uSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(u => u.id_inquilino && inqsMap[u.id_inquilino]);

    const listaAdeudosDesglosada = [];
    let totalEsperadoGlobal = 0;
    let totalPagadoGlobal = 0;

    mesesAEvaluar.forEach(mes => {
      ocupadas.forEach(u => {
        const inq = inqsMap[u.id_inquilino];
        
        // ⭐ VALIDAR SI EL INQUILINO TENÍA CONTRATO EN ESE MES
        const validacionContrato = inquilinoTeniaContratoEnPeriodo(inq, mes);
        
        // Si no tenía contrato válido, saltar
        if (!validacionContrato.activo) {
          return;
        }
        
        const pagoExistente = pagosLookup[`${u.id}_${mes}`];
        const rentaOriginal = Number(inq.renta_actual || u.renta_mensual || 0);
        
        let pagado, pendiente, esperado, estatus;

        if (pagoExistente) {
          pagado = Number(pagoExistente.monto_pagado || 0);
          esperado = Number(pagoExistente.total_esperado_periodo || rentaOriginal);
          
          pendiente = pagoExistente.saldo_restante_periodo !== undefined 
            ? Number(pagoExistente.saldo_restante_periodo) 
            : (esperado - pagado);
          
          estatus = pagoExistente.estatus || 'parcial';
        } else {
          // Verificar si existe pago condonado
          const todosLosPagos = pSnap.docs.map(d => d.data());
          const pagoCondonado = todosLosPagos.find(
            p => p.id_unidad === u.id && p.periodo === mes && p.condonado === true
          );
          
          if (pagoCondonado) {
            return;
          }
          
          pagado = 0;
          esperado = rentaOriginal;
          pendiente = rentaOriginal;
          estatus = 'pendiente';
        }

        totalEsperadoGlobal += esperado;
        totalPagadoGlobal += pagado;

        if (pendiente > 0) {
          listaAdeudosDesglosada.push({
            id: u.id,
            id_unidad: u.id,
            id_inquilino: inq.id,
            nombre: inq.nombre_completo,
            monto: pendiente,
            saldo_restante_periodo: pendiente,
            total_esperado_periodo: esperado,
            monto_pagado: pagado,
            periodo: mes,
            estatus: estatus,
            dia_pago: inq.dia_pago || 5,
            id_contrato: inq.id_contrato_actual || u.id_contrato_actual,
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
        nombre_inquilino: inqsMap[doc.data().id_inquilino]?.nombre_completo || "Unidad Libre"
      })),
      inquilinosMap: inqsMap // ⭐ Pasar el mapa completo al Dashboard
    };
  } catch (error) {
    console.error("Error en getDatosDashboard:", error);
    return { 
      stats: { esperado: 0, pagado: 0, adeudo: 0 }, 
      listaAdeudos: [], 
      unidades: [],
      inquilinosMap: {}
    };
  }
};