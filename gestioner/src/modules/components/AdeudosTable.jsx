import React from 'react';

const AdeudosTable = ({ adeudos = [] }) => {
  const hoy = new Date();
  const diaActual = hoy.getDate();
  const mesActual = hoy.toLocaleString('es-MX', { month: 'long' });

  const obtenerEstadoAdeudo = (diaPago) => {
    return diaActual > diaPago ? 
      { texto: 'VENCIDO', clase: 'bg-red-100 text-red-700' } : 
      { texto: 'POR VENCER', clase: 'bg-yellow-100 text-yellow-700' };
  };

  const obtenerFechaLimite = (diaPago) => {
    return `${diaPago} de ${mesActual}`;
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
      {/* HEADER */}
      <div className="bg-gray-800 p-4 flex justify-between items-center">
        <h2 className="text-white font-bold flex items-center gap-2">
          <span>⚠️</span> Inquilinos con Pago Pendiente
        </h2>
        <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">
          {adeudos.length} pendientes
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 uppercase text-[10px] tracking-wider font-bold">
              <th className="p-4">Depto</th>
              <th className="p-4">Inquilino</th>
              <th className="p-4">Propiedad</th>
              <th className="p-4">Monto</th>
              <th className="p-4">Fecha Límite</th>
              <th className="p-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {adeudos.length > 0 ? (
              adeudos.map((item) => {
                // Definimos el día de pago aquí para usarlo en las funciones
                const diaDePago = item.dia_pago || 5; 
                const estado = obtenerEstadoAdeudo(diaDePago);

                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-4 font-bold text-gray-700">{item.id}</td>
                    <td className="p-4">
                      <p className="text-sm font-bold text-gray-600 uppercase">{item.nombre}</p>
                    </td>
                    <td className="p-4 text-[10px] font-bold text-gray-500 uppercase">{item.propiedad}</td>
                    <td className="p-4 font-semibold text-gray-900">
                      ${item.monto?.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className={`text-xs font-black ${diaActual > diaDePago ? 'text-red-600' : 'text-gray-700'}`}>
                          {obtenerFechaLimite(diaDePago)}
                        </span>
                        
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`${estado.clase} px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-sm inline-block w-24 text-center`}>
                        {estado.texto}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="p-12 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                  ✅ ¡Todo pagado en este periodo!
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