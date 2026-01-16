import React, { useState, useMemo } from 'react';
import { db } from '../../firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import ModalCondonacion from './ModalCondonacion';

/* ============================================
// FUNCIÓN FIREBASE: Condonar deuda con estructura uniforme
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
      
      // Servicios (si existen)
      servicios: adeudo.servicios || {
        agua_lectura: 250,
        luz_lectura: 250
      },
      
      // ⭐ CAMPOS DE CONDONACIÓN
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

    console.log("✅ Deuda condonada con estructura uniforme:", idPago);
    return { exito: true };

  } catch (error) {
    console.error("❌ Error al condonar deuda:", error);
    return { exito: false, error: error.message };
  }
};
*/
const AdeudosTableConValidacion = ({ adeudos = [], periodo, modoFiltro, onCondonar }) => {
  const [adeudoACondonar, setAdeudoACondonar] = useState(null);
  const hoyReal = new Date();

  // Memoria para evitar duplicados y filtrar montos en 0
  const listaFiltrada = useMemo(() => {
    const mapaUnico = {};
    
    adeudos.forEach(item => {
      const key = `${item.id_unidad}-${item.periodo}`;
      if (!mapaUnico[key] || (item.monto_pagado > mapaUnico[key].monto_pagado)) {
        mapaUnico[key] = item;
      }
    });

    return Object.values(mapaUnico)
      .filter(item => item.monto > 0)
      .sort((a, b) => b.periodo.localeCompare(a.periodo));
  }, [adeudos]);

  // Función corregida (Sin el error de anioAnio)
  const obtenerEstadoAdeudo = (item, diaPago, periodoItem) => {
    if (item.contratoFinalizado) {
      return { texto: 'CONTRATO FINALIZADO', clase: 'bg-purple-600 text-white animate-pulse' };
    }

    if (item.monto_pagado > 0) {
      return { texto: 'PAGO PARCIAL', clase: 'bg-orange-500 text-white' };
    }

    const [anioItem, mesItem] = periodoItem.split('-').map(Number);
    // Usamos anioItem correctamente aquí:
    const fechaItem = new Date(anioItem, mesItem - 1);
    const fechaActual = new Date(hoyReal.getFullYear(), hoyReal.getMonth());

    if (fechaItem < fechaActual) {
      return { texto: 'MOROSO', clase: 'bg-red-600 text-white animate-pulse' };
    }

    const diaActual = hoyReal.getDate();
    return diaActual > diaPago ? 
      { texto: 'VENCIDO', clase: 'bg-red-100 text-red-700 border-red-200' } : 
      { texto: 'POR VENCER', clase: 'bg-amber-100 text-amber-700 border-amber-200' };
  };

  return (
    <>
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
        <div className="bg-gray-900 p-5 flex justify-between items-center border-b-4 border-blue-600">
          <div>
            <h2 className="text-white font-black flex items-center gap-2 uppercase italic text-sm">
              <span className="text-xl">⚠️</span> 
              {modoFiltro === 'rango' ? 'Auditoría Global de Saldos' : `Pendientes de ${periodo}`}
            </h2>
            <p className="text-blue-400 text-[9px] font-bold uppercase tracking-widest mt-1">
              Mostrando saldos acumulados por unidad y periodo
            </p>
          </div>
          <div className="text-right">
            <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase">
              {listaFiltrada.length} Registros
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-400 uppercase text-[9px] tracking-widest font-black border-b">
                <th className="p-4">Unidad</th>
                <th className="p-4">Periodo</th>
                <th className="p-4">Inquilino</th>
                <th className="p-4">Saldo Pendiente</th>
                <th className="p-4 text-center">Estatus</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listaFiltrada.length > 0 ? (
                listaFiltrada.map((item) => {
                  const estado = obtenerEstadoAdeudo(item, item.dia_pago || 5, item.periodo);
                  
                  return (
                    <tr key={`${item.id_unidad}-${item.periodo}`} className="hover:bg-blue-50/30 transition-all group">
                      <td className="p-4">
                        <span className="w-10 h-10 flex items-center justify-center rounded-lg font-black text-xs border bg-gray-100 text-gray-800">
                          {item.id_unidad}
                        </span>
                      </td>

                      <td className="p-4 text-[10px] font-black text-blue-700 uppercase">
                        {item.periodo}
                      </td>

                      <td className="p-4">
                        <p className="text-xs font-black text-gray-800 uppercase">{item.nombre || item.nombre_completo}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase italic tracking-tighter">
                          Contrato: {item.id_contrato?.slice(-6) || 'N/A'}
                        </p>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-red-600">
                            ${Number(item.monto).toLocaleString()}
                          </span>
                          {item.monto_pagado > 0 && (
                            <span className="text-[8px] font-bold text-blue-500 uppercase leading-none mt-1">
                              Abonado: ${Number(item.monto_pagado).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <span className={`${estado.clase} px-3 py-1.5 rounded-lg text-[9px] font-black uppercase inline-block min-w-[110px]`}>
                          {estado.texto}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <button
                          onClick={() => setAdeudoACondonar(item)}
                          className="bg-blue-100 hover:bg-blue-600 text-blue-700 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all mx-auto"
                        >
                          🤝 Condonar
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="p-20 text-center opacity-50">
                     <span className="text-4xl block mb-2">💎</span>
                     <p className="font-black text-xs uppercase tracking-widest">¡Cero adeudos en este rango!</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {adeudoACondonar && (
        <ModalCondonacion
          adeudo={adeudoACondonar}
          onConfirmar={async (motivo) => {
            await onCondonar(adeudoACondonar, motivo);
            setAdeudoACondonar(null);
          }}
          onCancelar={() => setAdeudoACondonar(null)}
        />
      )}
    </>
  );
};

export default AdeudosTableConValidacion;