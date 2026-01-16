import React, { useState, useMemo } from 'react';
import { db } from '../../firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// ============================================
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

// ============================================
// UTILIDAD: Validar si inquilino tenía contrato activo en periodo
// ============================================
const inquilinoTeniaContratoEnPeriodo = (inquilino, periodo) => {
  if (!inquilino) return { activo: false, finalizado: false };
  
  const [anioP, mesP] = periodo.split('-').map(Number);
  // Normalizamos el periodo a evaluar: Año, Mes, Día 1
  const fechaAuditoria = new Date(anioP, mesP - 1, 1).getTime();
  
  const hoy = new Date();

  // Función interna para normalizar cualquier fecha al día 1
  const normalizarADiaPrimero = (fecha) => {
    if (!fecha) return null;
    const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  };

  const validarRango = (fInicio, fFin) => {
    const inicio = normalizarADiaPrimero(fInicio);
    const fin = normalizarADiaPrimero(fFin);
    
    // Ahora comparamos solo Mes y Año (porque todos son Día 1)
    if (fechaAuditoria >= inicio && fechaAuditoria <= fin) {
      const contratoFinalizado = (fFin.toDate ? fFin.toDate() : new Date(fFin)) < hoy;
      return { activo: true, finalizado: contratoFinalizado };
    }
    return null;
  };

  // 1. Validar Contrato Actual
  if (inquilino.fecha_inicio_contrato && inquilino.fecha_fin_contrato) {
    const resultado = validarRango(inquilino.fecha_inicio_contrato, inquilino.fecha_fin_contrato);
    if (resultado) return resultado;
  }
  
  // 2. Validar Historial
  if (inquilino.historial_contratos && Array.isArray(inquilino.historial_contratos)) {
    for (const contrato of inquilino.historial_contratos) {
      const resultado = validarRango(contrato.fecha_inicio, contrato.fecha_fin);
      if (resultado) return resultado;
    }
  }
  
  return { activo: false, finalizado: false };
};

const AdeudosTableConValidacion = ({ adeudos = [], periodo, modoFiltro, onCondonar }) => {
  const [adeudoACondonar, setAdeudoACondonar] = useState(null);
  const hoyReal = new Date();

  // ⭐ LÓGICA SIMPLIFICADA: 
  // getDatosDashboard ya nos manda los adeudos filtrados y sumados.
  // Aquí solo nos aseguramos de no mostrar duplicados si acaso llegaran.
  const listaFiltrada = useMemo(() => {
    const mapaUnico = {};
    
    adeudos.forEach(item => {
      const key = `${item.id_unidad}-${item.periodo}`;
      // Si hay duplicados por error de red/fetch, nos quedamos con el que tenga más info
      if (!mapaUnico[key] || (item.monto_pagado > mapaUnico[key].monto_pagado)) {
        mapaUnico[key] = item;
      }
    });

    return Object.values(mapaUnico)
      .filter(item => item.monto > 0) // Solo los que realmente deben
      .sort((a, b) => b.periodo.localeCompare(a.periodo)); // Ordenar por mes reciente
  }, [adeudos]);

  const obtenerEstadoAdeudo = (item, diaPago, periodoItem) => {
    if (item.contratoFinalizado) {
      return { texto: 'CONTRATO FINALIZADO', clase: 'bg-purple-600 text-white animate-pulse' };
    }

    // Si ya hay abonos, es parcial por definición
    if (item.monto_pagado > 0) {
      return { texto: 'PAGO PARCIAL', clase: 'bg-orange-500 text-white' };
    }

    const [anioItem, mesItem] = periodoItem.split('-').map(Number);
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
                listaFiltrada.map((item, index) => {
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

// Modal de Condonación (placeholder)
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
            <h3 className="text-lg font-black text-gray-800 uppercase">Condonar Deuda</h3>
            <p className="text-xs text-gray-500 mt-1">
              Esta acción marca la deuda como condonada en el sistema
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
            <span className="text-sm font-black text-gray-800">{adeudo.nombre_completo}</span>
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
            Se creará un registro de pago con estatus "condonado". La deuda dejará de aparecer en reportes activos.
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

export default AdeudosTableConValidacion;