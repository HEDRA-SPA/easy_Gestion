import React from 'react';

const HistorialPagos = ({ pagos }) => {
  // Formateador de moneda
  const fCurrency = (monto) => `$${monto?.toLocaleString()}`;

  // Formateador de fecha Firebase Timestamp
  const fFecha = (ts) => {
    if (!ts) return "-";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
        <h3 className="text-sm font-black text-gray-700 uppercase italic">Historial de Transacciones</h3>
        <button className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-blue-700 transition-all">
          + Registrar Nuevo Pago
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
              <th className="p-4">Periodo</th>
              <th className="p-4">Renta/Pagado</th>
              <th className="p-4">Servicios (Excedente)</th>
              <th className="p-4">Fecha Pago</th>
              <th className="p-4">Medio</th>
              <th className="p-4">Estatus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {pagos.map((pago) => {
              const esAtiempo = pago.fecha_pago_realizado?.seconds <= pago.fecha_limite?.seconds;
              
              return (
                <tr key={pago.periodo} className="hover:bg-gray-50">
                  <td className="p-4 font-bold text-blue-600">{pago.periodo}</td>
                  <td className="p-4">
                    <p className="font-bold text-gray-800">{fCurrency(pago.monto_pagado)}</p>
                    <p className="text-[9px] text-gray-400 uppercase">Base: {fCurrency(pago.monto_renta)}</p>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-2">
                        <span className="text-[9px] bg-blue-50 text-blue-600 px-1 rounded font-bold">A: {pago.servicios?.agua_lectura}</span>
                        <span className="text-[9px] bg-amber-50 text-amber-600 px-1 rounded font-bold">L: {pago.servicios?.luz_lectura}</span>
                      </div>
                      {pago.servicios?.excedente_total > 0 && (
                        <span className="text-[10px] text-red-500 font-black">+{fCurrency(pago.servicios.excedente_total)} Exc.</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-gray-700">{fFecha(pago.fecha_pago_realizado)}</p>
                    <span className={`text-[8px] font-black ${esAtiempo ? 'text-green-500' : 'text-red-500'}`}>
                      {esAtiempo ? '✓ A TIEMPO' : '⚠ FUERA DE TIEMPO'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="uppercase text-[10px] font-bold text-gray-500">{pago.medio_pago}</span>
                  </td>
                  <td className="p-4">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">
                      {pago.estatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistorialPagos;