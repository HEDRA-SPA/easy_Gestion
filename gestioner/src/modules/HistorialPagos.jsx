import React, { useState } from 'react';
import ModalEditarPago from './components/ModalEditarPago';
import { eliminarPago } from '../firebase/paymentsService';

const HistorialPagos = ({ pagos = [], onActualizar }) => {
  const [pagoAEditar, setPagoAEditar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  // Estado para feedback visual inmediato (ocultar fila antes de recargar)
  const [eliminandoId, setEliminandoId] = useState(null);

  const fCurrency = (monto) => `$${Number(monto || 0).toLocaleString()}`;
  
  const fFecha = (ts) => {
    if (!ts) return "-";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const handleEliminar = async (pago) => {
    const idPago = pago.id;
    if (!idPago) return;

    const confirmar = window.confirm(
      `⚠️ ¿BORRAR REGISTRO?\n\nSe eliminará el registro de ${pago.periodo}. El saldo volverá a aparecer como pendiente en el Dashboard.`
    );

    if (confirmar) {
      setProcesando(true);
      setEliminandoId(idPago); // Feedback visual inmediato

      const resultado = await eliminarPago(idPago);
      
      if (resultado.exito) {
        // No lanzamos alert aquí para que la experiencia sea fluida
        if (onActualizar) await onActualizar(); 
      } else {
        alert("❌ Error: " + resultado.error);
        setEliminandoId(null); // Si falla, mostramos la fila de nuevo
      }
      setProcesando(false);
    }
  };

  const pagosOrdenados = [...pagos].sort((a, b) => {
    const dateA = a.fecha_registro?.seconds || 0;
    const dateB = b.fecha_registro?.seconds || 0;
    return dateB - dateA;
  });

  return (
    <>
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-500 ${procesando ? 'opacity-70' : ''}`}>
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h3 className="text-sm font-black text-gray-700 uppercase italic">Historial de Transacciones</h3>
          <span className="text-[10px] font-bold text-gray-400">{pagos.length} Movimientos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b bg-white">
                <th className="p-4">Periodo</th>
                <th className="p-4">Monto Pagado</th>
                <th className="p-4">Detalle del Mes</th>
                <th className="p-4">Fecha Transacción</th>
                <th className="p-4">Estatus</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {pagosOrdenados.map((pago) => {
                // Si el ID está en proceso de eliminación, lo ocultamos visualmente
                if (eliminandoId === pago.id) return null;

                const rowKey = pago.id || (pago.fecha_registro?.seconds + Math.random());
                const excedente = (pago.total_esperado_periodo || 0) - (pago.monto_renta || 0);
                const saldoRestante = pago.saldo_restante_periodo || 0;

                return (
                  <tr key={rowKey} className="hover:bg-blue-50/30 transition-colors animate-in fade-in duration-300">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${pago.estatus === 'pagado' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                        <span className="font-black text-gray-700 uppercase">{pago.periodo}</span>
                      </div>
                    </td>
                    
                    <td className="p-4">
                      <p className="font-black text-green-700 text-sm">{fCurrency(pago.monto_pagado)}</p>
                      <p className="text-[9px] text-gray-400 uppercase font-bold">{pago.medio_pago}</p>
                      
                      {/* ⭐ SALDO RESTANTE PARA PAGOS PARCIALES */}
                      {pago.estatus === 'parcial' && saldoRestante > 0 && (
                        <span className="mt-1 block text-[9px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 w-fit">
                          DEBE: {fCurrency(saldoRestante)}
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col gap-1 text-[10px]">
                        <div className="flex gap-2 font-bold text-gray-500">
                          <span>💧 {pago.servicios?.agua_lectura || 0}</span>
                          <span>⚡ {pago.servicios?.luz_lectura || 0}</span>
                        </div>
                        {excedente > 0 && (
                          <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded w-fit font-black">
                            + {fCurrency(excedente)} EXCEDENTES
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      <p className="font-bold text-gray-700">{fFecha(pago.fecha_pago_realizado)}</p>
                      <p className="text-[9px] text-gray-400 italic">Reg: {fFecha(pago.fecha_registro)}</p>
                    </td>

                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow-sm ${
                        pago.estatus === 'pagado' ? 'bg-green-500 text-white' : 'bg-amber-400 text-white'
                      }`}>
                        {pago.estatus}
                      </span>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setPagoAEditar(pago)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm active:scale-95"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleEliminar(pago)}
                          disabled={procesando}
                          className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white p-1.5 rounded-lg transition-all border border-red-100"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pagos.length === 0 && (
            <div className="p-10 text-center text-gray-400 italic text-sm">
              No hay pagos registrados para esta unidad.
            </div>
          )}
        </div>
      </div>

      {pagoAEditar && (
        <ModalEditarPago 
          pago={pagoAEditar}
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