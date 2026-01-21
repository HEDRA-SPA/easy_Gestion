import React, { useState } from 'react';
import ModalEditarPago from './components/ModalEditarPago';
import { eliminarPago } from '../firebase/paymentsService';

const HistorialPagos = ({ contrato, onActualizar }) => {
  const [pagoAEditar, setPagoAEditar] = useState(null);
  const [procesando, setProcesando] = useState(false);

  // 1. Extraer los datos con seguridad
  const periodos = contrato?.periodos_esperados || [];

  const fCurrency = (monto) => `$${Number(monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  
  const fFecha = (ts) => {
    if (!ts) return "---";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  // --- ESTA ES LA FUNCIÓN QUE CORREGIMOS ---
  const handleEliminar = async (periodoData) => {
    // Extraemos todos los IDs (pueden ser uno o varios abonos)
    const idsPagos = periodoData.id_pagos || []; 
    const idContrato = contrato.id;
    const nombrePeriodo = periodoData.periodo;

    if (idsPagos.length === 0) {
      alert("No hay pagos registrados para este periodo.");
      return;
    }

    // Mensaje dinámico si hay más de un pago (abonos parciales)
    const mensaje = idsPagos.length > 1 
      ? `Este periodo tiene ${idsPagos.length} abonos detectados. ¿Deseas eliminar TODO el historial de ${nombrePeriodo}?`
      : `¿Estás seguro de eliminar el pago de ${nombrePeriodo}?`;

    if (window.confirm(mensaje)) {
      setProcesando(true);
      try {
        // Enviamos el ARRAY de IDs al servicio de Firebase
        const resultado = await eliminarPago(idsPagos, idContrato, nombrePeriodo);
        
        if (resultado.exito) {
          if (onActualizar) await onActualizar();
        } else {
          alert("Error: " + resultado.error);
        }
      } catch (error) {
        alert("Ocurrió un error inesperado");
      } finally {
        setProcesando(false);
      }
    }
  };

  // 2. Ordenar para que aparezca primero lo más nuevo
  const periodosOrdenados = [...periodos].sort((a, b) => {
    if (b.anio !== a.anio) return b.anio - a.anio;
    return b.mes - a.mes;
  });

  return (
    <>
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${procesando ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black text-gray-700 uppercase italic">Historial de Mensualidades</h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
              Inquilino: {contrato?.nombre_inquilino || 'No especificado'}
            </p>
          </div>
          <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-[10px] font-black">
            {periodos.length} PERIODOS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b bg-white">
                <th className="p-4">Periodo</th>
                <th className="p-4">Estatus</th>
                <th className="p-4">Monto Pagado</th>
                <th className="p-4">Saldo Pendiente</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {periodosOrdenados.map((item, index) => {
                const tieneDeuda = item.saldo_restante > 0;
                const esPagado = item.estatus === 'pagado';
                const hasPagos = item.id_pagos && item.id_pagos.length > 0;

                return (
                  <tr key={`${item.periodo}-${index}`} className="hover:bg-blue-50/50 transition-colors">
                    <td className="p-4 font-black text-gray-700">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${esPagado ? 'bg-green-500' : tieneDeuda ? 'bg-red-500' : 'bg-gray-300'}`}></span>
                        {item.periodo}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        esPagado ? 'bg-green-100 text-green-700' : 
                        tieneDeuda ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {item.estatus}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-gray-600">{fCurrency(item.monto_pagado)}</td>
                    <td className="p-4 font-black text-red-600">{fCurrency(item.saldo_restante)}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        {hasPagos ? (
                          <>
                            <button 
                              onClick={() => setPagoAEditar({ ...item, id: item.id_pagos[0], id_contrato: contrato.id })}
                              className="bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                            >✏️</button>
                            <button 
                              onClick={() => handleEliminar(item)}
                              className="bg-red-50 text-red-600 p-1.5 rounded-lg border border-red-100 hover:bg-red-600 hover:text-white transition-all"
                            >🗑️</button>
                          </>
                        ) : (
                          <span className="text-[9px] font-bold text-gray-300 italic">Sin registros</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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