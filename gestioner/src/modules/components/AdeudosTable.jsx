import React from 'react';

const AdeudosTable = ({ adeudos = [], periodo, modoFiltro, rangoFechas }) => {
  const hoyReal = new Date();

 const listaFiltrada = adeudos.filter(item => {
    const monto = item.monto ?? item.saldo_restante_periodo ?? 0;
    return monto > 0;
  });

 /*console.log("🔍 AdeudosTable recibió:", {
    modoFiltro,
    cantidadAdeudos: adeudos.length,
    primerAdeudo: adeudos[0]
  });*/
  const obtenerEstadoAdeudo = (item, diaPago, periodoItem) => {
    // Prioridad: Pago Parcial
    if (item.estatus === 'parcial' || item.saldo_restante_periodo > 0) {
      return { texto: 'PAGO PARCIAL', clase: 'bg-orange-500 text-white shadow-sm' };
    }

    const [anioItem, mesItem] = periodoItem.split('-').map(Number);
    const fechaItem = new Date(anioItem, mesItem - 1);
    const fechaActual = new Date(hoyReal.getFullYear(), hoyReal.getMonth());

    // Prioridad: Moroso (Meses anteriores)
    if (fechaItem < fechaActual) {
      return { texto: 'MOROSO', clase: 'bg-red-600 text-white animate-pulse' };
    }

    // Estatus normal por día
    const diaActual = hoyReal.getDate();
    return diaActual > diaPago ? 
      { texto: 'VENCIDO', clase: 'bg-red-100 text-red-700 border border-red-200' } : 
      { texto: 'POR VENCER', clase: 'bg-amber-100 text-amber-700 border border-amber-200' };
  };

  return (
    <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
      <div className="bg-gray-900 p-5 flex justify-between items-center border-b-4 border-blue-600">
        <div>
          <h2 className="text-white font-black flex items-center gap-2 uppercase italic text-sm">
            <span className="text-xl">⚠️</span> {modoFiltro === 'rango' ? 'Auditoría de Saldos' : `Pendientes de ${periodo}`}
          </h2>
          <p className="text-blue-400 text-[9px] font-bold uppercase tracking-widest mt-1">
            Mostrando adeudos totales y saldos por liquidar
          </p>
        </div>
        <div className="text-right">
          <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase">
            {listaFiltrada.length} Cuentas Pendientes
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-400 uppercase text-[9px] tracking-widest font-black border-b">
              <th className="p-4">Unidad</th>
              {modoFiltro === 'rango' && <th className="p-4">Periodo</th>}
              <th className="p-4">Inquilino</th>
              <th className="p-4">Saldo Pendiente</th>
              <th className="p-4 text-center">Estatus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {listaFiltrada.length > 0 ? (
              listaFiltrada.map((item, index) => {
                const diaDePago = item.dia_pago || 5; 
                const periodoActual = item.periodo || periodo;
                const estado = obtenerEstadoAdeudo(item, diaDePago, periodoActual);
                
                // Si es parcial usamos saldo_restante, si no, el monto total esperado
                const montoAMostrar = item.saldo_restante_periodo !== undefined 
                  ? item.saldo_restante_periodo 
                  : (item.monto || 0);

                return (
                  <tr key={`${item.id}-${index}`} className="hover:bg-blue-50/30 transition-all group">
                    <td className="p-4">
                      <span className="bg-gray-100 text-gray-800 w-10 h-10 flex items-center justify-center rounded-lg font-black text-xs border border-gray-200 group-hover:bg-red-600 group-hover:text-white transition-colors">
                        {item.id_unidad || item.id}
                      </span>
                    </td>

                    {modoFiltro === 'rango' && (
                      <td className="p-4 text-[10px] font-black text-blue-700">
                        {periodoActual}
                      </td>
                    )}

                    <td className="p-4">
                      <p className="text-xs font-black text-gray-800 uppercase">{item.nombre || 'Sin nombre'}</p>
                      <p className="text-[9px] text-gray-400 font-bold uppercase italic">Contrato: {item.id_contrato?.slice(-6) || 'N/A'}</p>
                    </td>

                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-red-600">
                          ${montoAMostrar.toLocaleString()}
                        </span>
                        {item.monto_pagado > 0 && (
                          <span className="text-[8px] font-bold text-blue-500 uppercase">
                            Pagado: ${item.monto_pagado.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      <span className={`${estado.clase} px-3 py-1.5 rounded-lg text-[9px] font-black uppercase inline-block min-w-[110px]`}>
                        {estado.texto}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={modoFiltro === 'rango' ? "5" : "4"} className="p-20 text-center opacity-50">
                   <span className="text-4xl block mb-2">💎</span>
                   <p className="font-black text-xs uppercase tracking-widest">¡Felicidades! Todo cobrado.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdeudosTable;