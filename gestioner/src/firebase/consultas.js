/*import { db } from './config'; 
import { collection, getDocs, query, where } from 'firebase/firestore';

export const getDatosDashboard = async (periodoActual) => {
  try {
    const inquilinosQuery = query(collection(db, "inquilinos"), where("activo", "==", true));
    
    // 1. Traer datos de Firebase
    const [uSnap, iSnap, pSnap] = await Promise.all([
      getDocs(collection(db, "unidades")),
      getDocs(inquilinosQuery),
      getDocs(query(collection(db, "pagos"), where("periodo", "==", periodoActual)))
    ]);

    const inqsMap = {};
    iSnap.forEach(doc => {
      inqsMap[doc.id] = doc.data();
    });

    // 3. Agrupar pagos por unidad y calcular estado
    const estadoPagosPorUnidad = {};
    
    pSnap.docs.forEach(doc => {
      const pago = doc.data();
      const idUnidad = pago.id_unidad;
      
      if (!estadoPagosPorUnidad[idUnidad]) {
        estadoPagosPorUnidad[idUnidad] = {
          totalEsperado: 0,
          totalAbonado: 0,
          saldoPendiente: 0,
          estatus: 'pendiente'
        };
      }
      
      // Acumular abonos
      estadoPagosPorUnidad[idUnidad].totalAbonado += Number(pago.monto_pagado || 0);
      
      // El total esperado viene del primer registro (el que tiene total_esperado_periodo)
      if (Number(pago.total_esperado_periodo) > 0) {
        estadoPagosPorUnidad[idUnidad].totalEsperado = Number(pago.total_esperado_periodo);
      }
    });

    // Calcular saldo pendiente y estatus
    Object.keys(estadoPagosPorUnidad).forEach(idUnidad => {
      const estado = estadoPagosPorUnidad[idUnidad];
      estado.saldoPendiente = Math.max(0, estado.totalEsperado - estado.totalAbonado);
      estado.estatus = estado.saldoPendiente <= 0 ? 'pagado' : 'parcial';
    });

    const formatearFecha = (timestamp) => {
      if (!timestamp || !timestamp.toDate) return "N/A";
      return timestamp.toDate().toLocaleDateString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    };

    // 4. Procesar Unidades
    const unidadesFinales = uSnap.docs.map(doc => {
      const uData = doc.data();
      const uId = doc.id;
      const infoInq = uData.id_inquilino ? inqsMap[uData.id_inquilino] : null;
      const elInquilinoExiste = !!infoInq;
      
      const estadoPago = estadoPagosPorUnidad[uId];
      const pagadoCompleto = estadoPago && estadoPago.estatus === 'pagado';

      return {
        id: uId,
        id_propiedad: uData.id_propiedad,
        id_inquilino: uData.id_inquilino || null,
        estado: elInquilinoExiste ? uData.estado : "Disponible",
        nombre_inquilino: elInquilinoExiste ? infoInq.nombre_completo : "Unidad Libre",
        renta_mensual: elInquilinoExiste ? (infoInq.renta_actual || uData.renta_mensual) : uData.renta_mensual,
        telefono_emergencia: infoInq?.telefono_emergencia || "",
        telefono_contacto: infoInq?.telefono_contacto || "",
        deposito_garantia: infoInq?.deposito_garantia || 0,
        dia_pago: infoInq?.dia_pago || 5,
        fecha_inicio: formatearFecha(infoInq?.fecha_inicio_contrato),
        fecha_fin: formatearFecha(infoInq?.fecha_fin_contrato),
        docs: infoInq?.docs || { ine: "no", contrato: "no", carta: "no" },
        
        // Información de pago mejorada
        pagado: pagadoCompleto,
        estadoPago: estadoPago ? {
          totalEsperado: estadoPago.totalEsperado,
          totalAbonado: estadoPago.totalAbonado,
          saldoPendiente: estadoPago.saldoPendiente,
          estatus: estadoPago.estatus
        } : null
      };
    });

    // 5. Cálculos para los StatCards
    const ocupadas = unidadesFinales.filter(u => u.estado === "Ocupado");
    
    // Total esperado considerando el total_esperado_periodo si existe
    const esperado = ocupadas.reduce((acc, u) => {
      if (u.estadoPago?.totalEsperado > 0) {
        return acc + u.estadoPago.totalEsperado;
      }
      return acc + (u.renta_mensual || 0);
    }, 0);
    
    // Total abonado (puede ser suma de múltiples pagos parciales)
    const pagado = ocupadas.reduce((acc, u) => {
      return acc + (u.estadoPago?.totalAbonado || 0);
    }, 0);

    return {
      stats: {
        esperado: esperado,
        pagado: pagado,
        adeudo: esperado - pagado
      },
      listaAdeudos: ocupadas
        .filter(u => !u.pagado) // Incluye unidades con abonos parciales
        .map(u => ({
          id: u.id,
          nombre: u.nombre_inquilino,
          monto: u.estadoPago?.saldoPendiente || u.renta_mensual,
          totalEsperado: u.estadoPago?.totalEsperado || u.renta_mensual,
          abonado: u.estadoPago?.totalAbonado || 0,
          propiedad: u.id_propiedad,
          dia_pago: u.dia_pago,
          estatus: u.estadoPago?.estatus || 'pendiente'
        })),
      unidades: unidadesFinales
    };

  } catch (error) {
    console.error("Error al obtener datos:", error);
    return { stats: { esperado: 0, pagado: 0, adeudo: 0 }, listaAdeudos: [], unidades: [] };
  }
};*/
import { db } from './config'; 
import { collection, getDocs, query, where } from 'firebase/firestore';
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

    const inqsMap = {};
    iSnap.forEach(doc => { inqsMap[doc.id] = doc.data(); });

    // 1. Generar lista de meses del rango
    const mesesAEvaluar = [];
    let curr = new Date(inicioStr + "-02");
    const finDate = new Date(finStr + "-02");
    while (curr <= finDate) {
      mesesAEvaluar.push(curr.toISOString().slice(0, 7));
      curr.setMonth(curr.getMonth() + 1);
    }

    // 2. Mapear pagos existentes por "IDUNIDAD_PERIODO"
    const pagosLookup = {};
    pSnap.docs.forEach(doc => {
      const p = doc.data();
      pagosLookup[`${p.id_unidad}_${p.periodo}`] = p;
    });

    const ocupadas = uSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(u => u.id_inquilino && inqsMap[u.id_inquilino]);

    const listaAdeudosDesglosada = [];
    let totalEsperadoGlobal = 0;
    let totalPagadoGlobal = 0;

    // 3. LA LÓGICA CORRECTA: Recorrer meses e inquilinos
    mesesAEvaluar.forEach(mes => {
      ocupadas.forEach(u => {
        const inq = inqsMap[u.id_inquilino];
        const pagoExistente = pagosLookup[`${u.id}_${mes}`];
        
        const renta = Number(inq.renta_actual || u.renta_mensual || 0);
        
        // Si existe pago, tomamos sus valores. Si NO existe, el esperado es la renta y pagado es 0.
        const pagado = pagoExistente ? Number(pagoExistente.monto_pagado || 0) : 0;
        const esperado = pagoExistente ? Number(pagoExistente.total_esperado_periodo || renta) : renta;
        const pendiente = esperado - pagado;

        totalEsperadoGlobal += esperado;
        totalPagadoGlobal += pagado;

        // Si debe aunque sea un peso, o si no hay registro de pago (pendiente total)
        if (pendiente > 0) {
          listaAdeudosDesglosada.push({
            id: u.id,
            id_unidad: u.id,
            nombre: inq.nombre_completo,
            monto: pendiente, // Saldo restante
            totalEsperado: esperado,
            monto_pagado: pagado,
            periodo: mes,
            estatus: pagado > 0 ? 'parcial' : 'pendiente',
            dia_pago: inq.dia_pago || 5,
            id_contrato: inq.id_contrato || u.id_contrato
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
      }))
    };
  } catch (error) {
    console.error("Error:", error);
    return { stats: { esperado: 0, pagado: 0, adeudo: 0 }, listaAdeudos: [], unidades: [] };
  }
};