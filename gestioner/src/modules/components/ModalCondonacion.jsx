import React, { useState } from 'react';

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

  if (!adeudo) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-gray-100">
        <div className="flex items-start gap-3">
          <span className="text-3xl">🤝</span>
          <div>
            <h3 className="text-lg font-black text-gray-800 uppercase italic">Condonar Deuda</h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
              Esta acción es irreversible y afectará los reportes financieros.
            </p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-black uppercase">
            <span className="text-gray-500">Unidad / Periodo</span>
            <span className="text-gray-800">{adeudo.id_unidad} — <span className="text-blue-600">{adeudo.periodo}</span></span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-black uppercase">
            <span className="text-gray-500">Inquilino</span>
            <span className="text-gray-800">{adeudo.nombre || adeudo.nombre_completo}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-red-200">
            <span className="text-[10px] font-black text-gray-500 uppercase">Saldo a condonar</span>
            <span className="text-xl font-black text-red-600">
              ${Number(adeudo.monto || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-black text-gray-400 uppercase block ml-1">
            Motivo de condonación oficial
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Acuerdo por terminación anticipada..."
            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50 font-medium"
            rows={3}
            disabled={procesando}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancelar}
            disabled={procesando}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase hover:bg-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCondonar}
            disabled={procesando || !motivo.trim()}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-shadow shadow-lg shadow-blue-200 disabled:opacity-50"
          >
            {procesando ? 'Procesando...' : 'Confirmar Condonación'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalCondonacion;