import React, { useState, useEffect } from 'react';
import ModalEditarPago from './components/ModalEditarPago';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { eliminarPago } from '../firebase/paymentsService';

const HistorialPagos = ({ contrato, onActualizar }) => {
  const [pagoAEditar, setPagoAEditar] = useState(null);
  const [pagosDetallados, setPagosDetallados] = useState({});
  const [loading, setLoading] = useState(false);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const cargarPagosIndividuales = async () => {
      if (!contrato?.id) return;
      setLoading(true);
      try {
        const pagosRef = collection(db, "pagos");
        const q = query(pagosRef, where("id_contrato", "==", contrato.id));
        const snapshot = await getDocs(q);
        const pagosPorPeriodo = {};
        snapshot.docs.forEach(doc => {
          const datos = doc.data();
          const periodo = datos.periodo;
          if (!pagosPorPeriodo[periodo]) pagosPorPeriodo[periodo] = [];
          pagosPorPeriodo[periodo].push({ id: doc.id, ...datos });
        });
        // IMPORTANTE: Ordenar los abonos por fecha de registro para saber cuál es el primero
        Object.keys(pagosPorPeriodo).forEach(per => {
          pagosPorPeriodo[per].sort((a, b) => a.fecha_registro?.seconds - b.fecha_registro?.seconds);
        });
        setPagosDetallados(pagosPorPeriodo);
      } catch (error) {
        console.error("Error cargando pagos:", error);
      } finally {
        setLoading(false);
      }
    };
    cargarPagosIndividuales();
  }, [contrato?.id, contrato?.periodos_esperados]);

  const handleEliminarIndividual = async (pago, esPrimerPago, todosLosPagosDelPeriodo) => {
    // Si es el primer pago y hay más abonos, advertir sobre eliminación en cascada
    if (esPrimerPago && todosLosPagosDelPeriodo.length > 1) {
      const abonosPosteriores = todosLosPagosDelPeriodo.slice(1); // Todos excepto el primero
      const totalAbonos = abonosPosteriores.reduce((sum, p) => sum + Number(p.monto_pagado || 0), 0);
      
      const msj = `⚠️ ADVERTENCIA: Este es el PRIMER PAGO del periodo ${pago.periodo}.

Al eliminarlo, también se borrarán ${abonosPosteriores.length} abono(s) posterior(es) por un total de ${fCurrency(totalAbonos)}.

Esto es necesario para mantener la coherencia de las lecturas de servicios y del depósito.

¿Deseas continuar y eliminar TODOS los pagos de este periodo?`;
      
      if (!window.confirm(msj)) return;
      
      setProcesando(true);
      
      // Eliminar TODOS los pagos del periodo
      const idsAEliminar = todosLosPagosDelPeriodo.map(p => p.id);
      const resultado = await eliminarPago(idsAEliminar, contrato.id, pago.periodo);
      
      if (resultado.exito) {
        if (onActualizar) await onActualizar();
      } else {
        alert("Error: " + resultado.error);
      }
      
      setProcesando(false);
    } 
    // Si es un abono posterior, se puede eliminar solo
    else {
      const msj = `¿Estás seguro de eliminar este abono de ${fCurrency(pago.monto_pagado)}? 
Esto afectará el saldo del periodo ${pago.periodo}.`;
      
      if (!window.confirm(msj)) return;
      
      setProcesando(true);
      const resultado = await eliminarPago([pago.id], contrato.id, pago.periodo);
      
      if (resultado.exito) {
        if (onActualizar) await onActualizar();
      } else {
        alert("Error: " + resultado.error);
      }
      
      setProcesando(false);
    }
  };

  const fCurrency = (monto) => `$${Number(monto || 0).toLocaleString('es-MX')}`;
  const fFecha = (ts) => {
    if (!ts) return "---";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  };

  const periodosOrdenados = [...(contrato?.periodos_esperados || [])].sort((a, b) => {
    if (b.anio !== a.anio) return b.anio - a.anio;
    return b.mes - a.mes;
  });

  return (
    <>
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${procesando ? 'opacity-50 pointer-events-none' : ''}`}>
        {procesando && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10">
            <div className="bg-white px-6 py-3 rounded-lg shadow-xl font-bold text-gray-700">
              ⏳ Procesando...
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
          <h3 className="text-white font-black text-lg uppercase tracking-tight">
            📊 Historial de Pagos
          </h3>
          <p className="text-blue-100 text-xs font-medium">
            Contrato: {contrato?.id || "---"}
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-gray-400 uppercase border-b bg-white">
                <th className="p-4">Periodo</th>
                <th className="p-4">Detalle del Abono</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">Extras</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {periodosOrdenados.map((periodo, idx) => {
                const pagosDelPeriodo = pagosDetallados[periodo.periodo] || [];
                const tienePagos = pagosDelPeriodo.length > 0;
                
                return (
                  <React.Fragment key={`${periodo.periodo}-${idx}`}>
                    {/* Fila Resumen del Mes */}
                    <tr className="bg-gray-50/80 border-l-4 border-l-blue-500">
                      <td className="p-4 font-black text-gray-700">
                        {periodo.periodo} 
                        <span className="ml-2 text-[9px] text-gray-400 font-normal italic">
                          (Renta: {fCurrency(periodo.monto_esperado)})
                        </span>
                      </td>
                      <td className="p-4 font-bold text-blue-600">
                        Pagado: {fCurrency(periodo.monto_pagado)}
                      </td>
                      <td colSpan="2" className="p-4 font-black text-red-600">
                        Debe: {fCurrency(periodo.saldo_restante)}
                      </td>
                      <td className="p-4 text-center italic text-gray-400 text-[9px]">
                        {periodo.estatus.toUpperCase()}
                      </td>
                    </tr>
                    
                    {/* Abonos Individuales */}
                    {tienePagos && pagosDelPeriodo.map((pago, pagoIdx) => {
                      const esPrimerPago = pagoIdx === 0;
                      
                      return (
                        <tr key={pago.id} className="bg-white hover:bg-gray-50 transition border-b border-gray-50">
                          <td className="pl-8 py-2 text-[10px] text-gray-400">
                            {esPrimerPago ? (
                              <span className="font-bold text-amber-600">⭐ Primer Pago</span>
                            ) : (
                              <span>└ Abono #{pagoIdx + 1}</span>
                            )}
                          </td>
                          <td className="py-2">
                            <span className="font-bold text-gray-700">{fCurrency(pago.monto_pagado)}</span>
                            <span className="ml-2 text-[9px] text-gray-400 uppercase">({pago.medio_pago})</span>
                          </td>
                          <td className="py-2 text-gray-500">{fFecha(pago.fecha_pago_realizado)}</td>
                          <td className="py-2">
                            {pago.servicios?.excedentes_del_deposito > 0 && (
                              <span className="text-purple-600 font-bold text-[9px]">
                                -{fCurrency(pago.servicios.excedentes_del_deposito)} dep.
                              </span>
                            )}
                            {esPrimerPago && (
                              <div className="text-[8px] text-gray-400 mt-1">
                                💧 Agua: {pago.servicios?.agua_lectura || 0} | 
                                ⚡ Luz: {pago.servicios?.luz_lectura || 0}
                              </div>
                            )}
                          </td>
                          <td className="py-2">
                            <div className="flex justify-center gap-2">
                              <button 
                                onClick={() => setPagoAEditar({
                                  ...pago,
                                  esPrimerPago: esPrimerPago,
                                  id_contrato: contrato.id
                                })}
                                className="text-blue-600 hover:bg-blue-50 p-1 rounded transition"
                                title="Editar Abono"
                              >
                                ✏️
                              </button>
                              <button 
                                onClick={() => handleEliminarIndividual(pago, esPrimerPago, pagosDelPeriodo)}
                                className={`${esPrimerPago ? 'text-red-700' : 'text-red-500'} hover:bg-red-50 p-1 rounded transition`}
                                title={esPrimerPago ? "⚠️ Eliminar TODOS los pagos del periodo" : "Eliminar Abono"}
                              >
                                {esPrimerPago ? '🗑️⚠️' : '🗑️'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pagoAEditar && (
        <ModalEditarPago 
          pago={pagoAEditar}
          esPrimerPago={pagoAEditar.esPrimerPago}
          onCerrar={() => setPagoAEditar(null)}
          onExito={() => {
            setPagoAEditar(null);
            if (onActualizar) onActualizar();
          }}
        />
      )}
    </>
  );
};

export default HistorialPagos;