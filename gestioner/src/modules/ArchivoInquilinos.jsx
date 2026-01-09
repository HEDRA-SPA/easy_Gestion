import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import HistorialContratos from './HistorialContratos';

const ArchivoInquilinos = () => {
  const [exInquilinos, setExInquilinos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [inquilinoSeleccionado, setInquilinoSeleccionado] = useState(null);
  const [pagosHistoricos, setPagosHistoricos] = useState([]); // <--- Estado para pagos

  // 1. Cargar lista de ex-inquilinos
  useEffect(() => {
    const cargarArchivo = async () => {
      const q = query(collection(db, "inquilinos"), where("activo", "==", false));
      const snap = await getDocs(q);
      setExInquilinos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    cargarArchivo();
  }, []);

  // 2. Cargar pagos del inquilino seleccionado
  useEffect(() => {
    const cargarPagos = async () => {
      if (!inquilinoSeleccionado) return;
      
      const q = query(
        collection(db, "pagos"), 
        where("id_inquilino", "==", inquilinoSeleccionado.id),
        orderBy("periodo", "desc")
      );
      const snap = await getDocs(q);
      setPagosHistoricos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    cargarPagos();
  }, [inquilinoSeleccionado]);

  const filtrados = exInquilinos.filter(inq => 
    inq.nombre_completo.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">
            📁 Archivo Histórico <span className="text-gray-400">/ Ex-Inquilinos</span>
          </h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LISTADO LATERAL (Igual que antes) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-[700px] flex flex-col">
            <div className="p-4 border-b">
              <input 
                type="text"
                placeholder="Buscar por nombre..."
                className="w-full p-2 bg-gray-50 border rounded-lg text-xs"
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filtrados.map(inq => (
                <button
                  key={inq.id}
                  onClick={() => setInquilinoSeleccionado(inq)}
                  className={`w-full text-left p-4 border-b hover:bg-blue-50 transition-colors ${inquilinoSeleccionado?.id === inq.id ? 'bg-blue-50 border-r-4 border-r-blue-500' : ''}`}
                >
                  <p className="font-bold text-gray-700 uppercase text-xs">{inq.nombre_completo}</p>
                  <p className="text-[10px] text-gray-400 uppercase italic">{inq.id_unidad_anterior || 'Sin Unidad'}</p>
                </button>
              ))}
            </div>
          </div>

          {/* DETALLE DEL EXPEDIENTE */}
          <div className="md:col-span-2 space-y-6">
            {inquilinoSeleccionado ? (
              <>
                <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-800 p-6 text-white flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-black uppercase">{inquilinoSeleccionado.nombre_completo}</h2>
                      <p className="opacity-60 text-[10px] tracking-widest uppercase">Expediente Finalizado</p>
                    </div>
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-b pb-1">Contacto Histórico</h3>
                      <p className="text-sm font-bold text-gray-600">Tel: <span className="text-gray-900 font-normal">{inquilinoSeleccionado.telefono_contacto}</span></p>
                      
                      <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-100">
                         <p className="text-[10px] font-black text-red-400 uppercase">Estado de Salida</p>
                         <p className="text-xs text-red-700 italic">"Este inquilino ya no tiene contratos vigentes en el sistema."</p>
                      </div>
                    </div>

                    <div>
                      <HistorialContratos idInquilino={inquilinoSeleccionado.id} />
                    </div>
                  </div>
                </div>

                {/* TABLA DE PAGOS HISTÓRICOS (NUEVA) */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-100 px-6 py-3 border-b">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Historial Completo de Pagos</h3>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-white border-b">
                        <tr className="text-[9px] font-black text-gray-400 uppercase">
                          <th className="p-4">Periodo</th>
                          <th className="p-4">Monto Renta</th>
                          <th className="p-4">Excedentes</th>
                          <th className="p-4">Total Pagado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {pagosHistoricos.map(pago => (
                          <tr key={pago.id} className="text-xs hover:bg-gray-50">
                            <td className="p-4 font-bold text-gray-700">{pago.periodo}</td>
                            <td className="p-4 text-gray-500">${pago.monto_renta?.toLocaleString()}</td>
                            <td className="p-4 text-amber-600 font-bold">+${pago.servicios?.excedente_total || 0}</td>
                            <td className="p-4 font-black text-green-600">${pago.monto_pagado?.toLocaleString()}</td>
                          </tr>
                        ))}
                        {pagosHistoricos.length === 0 && (
                          <tr>
                            <td colSpan="4" className="p-10 text-center text-gray-400 italic text-xs">No se encontraron registros de pagos.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-200 rounded-xl bg-white">
                <span className="text-5xl mb-4">📂</span>
                <p className="font-black uppercase text-[10px] tracking-widest">Selecciona un registro</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchivoInquilinos;