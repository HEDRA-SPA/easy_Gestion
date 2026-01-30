import React, { useState, useMemo } from 'react';
import { db } from '../../firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import ModalCondonacion from './ModalCondonacion';

const AdeudosTableConValidacion = ({ adeudos = [], periodo, modoFiltro, onCondonar }) => {
  const [adeudoACondonar, setAdeudoACondonar] = useState(null);
  const hoyReal = new Date();

  const listaFiltrada = useMemo(() => {
    const mapaUnico = {};
    adeudos.forEach(item => {
      const key = `${item.id_unidad}-${item.periodo}`;
      const saldo = item.saldo_restante_periodo ?? item.monto ?? 0;
      if (!mapaUnico[key] || (item.monto_pagado > mapaUnico[key].monto_pagado)) {
        mapaUnico[key] = { ...item, saldo_restante_periodo: saldo };
      }
    });
    return Object.values(mapaUnico)
      .filter(item => (item.saldo_restante_periodo > 0))
      .sort((a, b) => b.periodo.localeCompare(a.periodo));
  }, [adeudos]);

  const obtenerEstadoAdeudo = (item, diaPago, periodoItem) => {
    if (item.contratoFinalizado) {
      return { texto: 'Finalizado', clase: 'bg-gray-100 text-gray-600' };
    }
    const [anioItem, mesItem] = periodoItem.split('-').map(Number);
    const fechaLimitePago = new Date(anioItem, mesItem - 1, diaPago);
    
    if (hoyReal > fechaLimitePago) {
      return { texto: 'Vencido', clase: 'bg-red-500 text-white font-semibold' };
    }
    return { texto: 'Pendiente', clase: 'bg-amber-400 text-white font-semibold' };
  };

  return (
    <>
      <div className="bg-white rounded-3xl p-2">
        {/* Encabezado Estilizado */}
        <div className="px-6 py-8 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              {modoFiltro === 'rango' ? 'Auditoría de Saldos' : `Pendientes de ${periodo}`}
            </h2>
            <p className="text-slate-400 text-sm font-medium mt-1">
              {listaFiltrada.length} registros encontrados en el sistema
            </p>
          </div>
          <div className="hidden sm:block">
             <span className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-full uppercase tracking-wider">
               Vista Detallada
             </span>
          </div>
        </div>

        {/* Contenedor de "Filas" tipo Lista */}
        <div className="space-y-3 px-2 pb-6">
          {listaFiltrada.length > 0 ? (
            listaFiltrada.map((item) => {
              const estado = obtenerEstadoAdeudo(item, item.dia_pago || 5, item.periodo);
              
              return (
                <div 
                  key={`${item.id_unidad}-${item.periodo}`} 
                  className="group bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-xl hover:shadow-gray-100/50 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Info Principal: Inquilino y Unidad */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-500 group-hover:border-blue-100 transition-colors">
                      <i className="fa-solid fa-house-user text-lg"></i>
                    </div>
                    <div>
                      <h3 className="text-[17px] font-bold text-slate-800 leading-tight">
                        {item.nombre || item.nombre_completo}
                      </h3>
                      <p className="text-slate-400 text-sm font-medium mt-0.5">
                        Unidad {item.id_unidad} • <span className="italic">Ref: {item.id_contrato?.slice(-6) || 'N/A'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Periodo y Fecha */}
                  <div className="flex flex-col md:items-center min-w-[120px]">
                    <span className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-1">Periodo</span>
                    <span className="text-slate-700 font-bold text-sm bg-slate-50 px-3 py-1 rounded-lg">
                      {item.periodo}
                    </span>
                  </div>

                  {/* Monto (Estilo grande como en la imagen) */}
                  <div className="flex flex-col md:items-end min-w-[140px]">
                    <span className="text-xl font-bold text-slate-900">
                      ${Number(item.monto).toLocaleString()}
                    </span>
                    {item.monto_pagado > 0 && (
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded mt-1">
                        Abonado: ${Number(item.monto_pagado).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Estatus y Botón */}
                  <div className="flex items-center gap-3 justify-between md:justify-end">
                    <span className={`${estado.clase} px-5 py-1.5 rounded-full text-xs font-bold min-w-[90px] text-center shadow-sm`}>
                      {estado.texto}
                    </span>
                    
                    <button
                      onClick={() => setAdeudoACondonar(item)}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white transition-all duration-300 shadow-sm"
                      title="Condonar Deuda"
                    >
                      <i className="fa-solid fa-handshake-simple"></i>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center">
               <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fa-solid fa-check text-3xl text-green-500"></i>
               </div>
               <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">¡Todo al día! No hay saldos pendientes</p>
            </div>
          )}
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