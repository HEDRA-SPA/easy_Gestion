import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

const HistorialContratos = ({ idInquilino }) => {
  const [contratos, setContratos] = useState([]);

  useEffect(() => {
    const obtenerHistorico = async () => {
      const q = query(collection(db, "contratos"), where("id_inquilino", "==", idInquilino));
      const snap = await getDocs(q);
      setContratos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    obtenerHistorico();
  }, [idInquilino]);

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-black text-gray-400 uppercase italic">Línea del Tiempo de Contratos</h4>
      {contratos.map((c) => (
        <div key={c.id} className={`p-4 rounded-lg border-l-4 ${c.estatus === 'activo' ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-black text-gray-700">Contrato: {c.id}</p>
              <p className="text-[10px] text-gray-500">
                {c.fecha_inicio.toDate().toLocaleDateString()} - {c.fecha_fin.toDate().toLocaleDateString()}
              </p>
            </div>
            <span className={`text-[9px] font-bold px-2 py-1 rounded ${c.estatus === 'activo' ? 'bg-green-200 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
              {c.estatus.toUpperCase()}
            </span>
          </div>
          <p className="mt-2 font-bold text-gray-600">$ {c.monto_renta.toLocaleString()} / mes</p>
        </div>
      ))}
    </div>
  );
};
export default  HistorialContratos;