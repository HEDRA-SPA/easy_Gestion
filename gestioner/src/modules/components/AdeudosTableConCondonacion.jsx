/*import React, { useState } from 'react';

// Modal de Condonación
const ModalCondonacion = ({ adeudo, onConfirmar, onCancelar }) => {
  const [motivo, setMotivo] = useState('');
  const [procesando, setProcesando] = useState(false);

  const handleCondonar = async () => {
    if (!motivo.trim()) {
      alert('Debes especificar un motivo para condonar');
      return;
    }

    setProcesando(true);
    await onConfirmar(motivo);
    setProcesando(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl">🤝</span>
          <div>
            <h3 className="text-lg font-black text-gray-800 uppercase">
              Condonar Deuda
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Esta acción oculta el adeudo pero mantiene el registro histórico
            </p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-gray-500 uppercase">Unidad</span>
            <span className="text-sm font-black text-gray-800">{adeudo.id_unidad}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-gray-500 uppercase">Inquilino</span>
            <span className="text-sm font-black text-gray-800">{adeudo.nombre}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold text-gray-500 uppercase">Periodo</span>
            <span className="text-sm font-black text-blue-600">{adeudo.periodo}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-red-300">
            <span className="text-[9px] font-bold text-gray-500 uppercase">Saldo a condonar</span>
            <span className="text-lg font-black text-red-600">
              ${Number(adeudo.saldo_restante_periodo || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-bold text-gray-500 uppercase block">
            Motivo de condonación *
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Contrato finalizado anticipadamente, acuerdo con inquilino..."
            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
            disabled={procesando}
          />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
          <span className="text-lg">⚠️</span>
          <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
            Esta deuda no aparecerá en estadísticas ni reportes activos, pero quedará registrada en el historial para auditorías.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancelar}
            disabled={procesando}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl text-xs font-black uppercase hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleCondonar}
            disabled={procesando || !motivo.trim()}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {procesando ? 'Procesando...' : 'Confirmar Condonación'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Tabla con botón de condonación
const AdeudosTableConCondonacion = ({ adeudos = [], periodo, modoFiltro, onCondonar }) => {
  const [adeudoACondonar, setAdeudoACondonar] = useState(null);
  const hoyReal = new Date();

  const listaFiltrada = adeudos.filter(item => {
    const monto = item.saldo_restante_periodo ?? item.monto ?? 0;
    return monto > 0;
  });

  const obtenerEstadoAdeudo = (item, diaPago, periodoItem) => {
    if (item.estatus === 'parcial' || item.saldo_restante_periodo > 0 && item.monto_pagado > 0) {
      return { texto: 'PAGO PARCIAL', clase: 'bg-orange-500 text-white shadow-sm' };
    }

    const [anioItem, mesItem] = periodoItem.split('-').map(Number);
    const fechaItem = new Date(anioItem, mesItem - 1);
    const fechaActual = new Date(hoyReal.getFullYear(), hoyReal.getMonth());

    if (fechaItem < fechaActual) {
      return { texto: 'MOROSO', clase: 'bg-red-600 text-white animate-pulse' };
    }

    const diaActual = hoyReal.getDate();
    return diaActual > diaPago ? 
      { texto: 'VENCIDO', clase: 'bg-red-100 text-red-700 border border-red-200' } : 
      { texto: 'POR VENCER', clase: 'bg-amber-100 text-amber-700 border border-amber-200' };
  };

  const handleConfirmarCondonacion = async (motivo) => {
    await onCondonar(adeudoACondonar, motivo);
    setAdeudoACondonar(null);
  };

  return (
    <>
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
        <div className="bg-gray-900 p-5 flex justify-between items-center border-b-4 border-blue-600">
          <div>
            <h2 className="text-white font-black flex items-center gap-2 uppercase italic text-sm">
              <span className="text-xl">⚠️</span> {modoFiltro === 'rango' ? 'Auditoría de Saldos' : `Pendientes de ${periodo}`}
            </h2>
            <p className="text-blue-400 text-[9px] font-bold uppercase tracking-widest mt-1">
              Mostrando saldos pendientes reales por liquidar
            </p>
          </div>
          <div className="text-right">
            <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase">
              {listaFiltrada.length} Pendientes
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
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listaFiltrada.length > 0 ? (
                listaFiltrada.map((item, index) => {
                  const diaDePago = item.dia_pago || 5; 
                  const periodoItem = item.periodo || periodo;
                  const estado = obtenerEstadoAdeudo(item, diaDePago, periodoItem);
                  const saldoActual = item.saldo_restante_periodo ?? item.monto ?? 0;

                  return (
                    <tr key={`${item.id}-${index}`} className="hover:bg-blue-50/30 transition-all group">
                      <td className="p-4">
                        <span className="bg-gray-100 text-gray-800 w-10 h-10 flex items-center justify-center rounded-lg font-black text-xs border border-gray-200 group-hover:bg-red-600 group-hover:text-white transition-colors">
                          {item.id_unidad || item.id}
                        </span>
                      </td>

                      {modoFiltro === 'rango' && (
                        <td className="p-4 text-[10px] font-black text-blue-700">
                          {periodoItem}
                        </td>
                      )}

                      <td className="p-4">
                        <p className="text-xs font-black text-gray-800 uppercase">{item.nombre || 'Sin nombre'}</p>
                        <p className="text-[9px] text-gray-400 font-bold uppercase italic tracking-tighter">
                          Contrato: {item.id_contrato?.slice(-6) || 'N/A'}
                        </p>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-red-600">
                            ${Number(saldoActual).toLocaleString()}
                          </span>
                          
                          {item.monto_pagado > 0 && (
                            <div className="flex flex-col leading-none mt-1">
                               <span className="text-[8px] font-bold text-blue-500 uppercase">
                                 Abonado: ${Number(item.monto_pagado).toLocaleString()}
                               </span>
                               <span className="text-[7px] text-gray-400 font-medium uppercase mt-0.5">
                                 de ${Number(item.total_esperado_periodo || 0).toLocaleString()}
                               </span>
                            </div>
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
                          className="bg-blue-100 hover:bg-blue-600 text-blue-700 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 mx-auto"
                          title="Condonar deuda"
                        >
                          🤝 Condonar
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={modoFiltro === 'rango' ? "6" : "5"} className="p-20 text-center opacity-50">
                     <span className="text-4xl block mb-2">💎</span>
                     <p className="font-black text-xs uppercase tracking-widest">¡Felicidades! Todo cobrado.</p>
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
          onConfirmar={handleConfirmarCondonacion}
          onCancelar={() => setAdeudoACondonar(null)}
        />
      )}
    </>
  );
};

export default AdeudosTableConCondonacion;*/