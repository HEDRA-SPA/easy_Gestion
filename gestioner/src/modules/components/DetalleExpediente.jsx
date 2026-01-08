import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const DetalleExpediente = ({ idInquilino }) => {
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarExpediente = async () => {
      if (!idInquilino) return;
      try {
        const inqSnap = await getDoc(doc(db, "inquilinos", idInquilino));
        if (inqSnap.exists()) {
          setDatos(inqSnap.data());
        }
      } catch (error) {
        console.error("Error al cargar expediente:", error);
      } finally {
        setLoading(false);
      }
    };
    cargarExpediente();
  }, [idInquilino]);

  const formatearFecha = (ts) => {
    if (!ts) return "No definida";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) return (
    <div className="p-8 text-center animate-pulse flex flex-col items-center gap-2">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Cargando expediente...</span>
    </div>
  );

  if (!datos) return <div className="p-8 text-center text-red-500 font-bold uppercase text-[10px]">No se encontró el expediente</div>;

  return (
    <div className="bg-gray-50 p-5 grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-500">
      
      {/* COLUMNA 1: DATOS GENERALES */}
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Titular del Contrato</p>
          <p className="text-sm font-bold text-gray-800 uppercase">{datos.nombre_completo}</p>
        </div>
        <div className="flex gap-4">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Contacto</p>
            <p className="text-xs font-medium text-gray-700">{datos.telefono_contacto || "N/A"}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Emergencia</p>
            <p className="text-xs font-medium text-gray-700">{datos.telefono_emergencia || "N/A"}</p>
          </div>
        </div>
        <div className="pt-2 border-t border-gray-200">
           <p className="text-[10px] font-black text-red-500 uppercase">Detalles de Pago</p>
           <p className="text-xs font-bold text-gray-700">Día de pago: {datos.dia_pago} de cada mes</p>
           <p className="text-xs font-bold text-green-600">Depósito: ${datos.deposito_garantia?.toLocaleString()}</p>
        </div>
      </div>

      {/* COLUMNA 2: HABITANTES / ACOMPAÑANTES */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Habitantes ({datos.no_personas || 1})
          </p>
          {datos.activo && (
            <span className="bg-green-100 text-green-700 text-[8px] font-black px-2 py-0.5 rounded">ACTIVO</span>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200 shadow-sm">
            <span className="text-xs">🔑</span>
            <p className="text-[10px] font-bold text-gray-700 uppercase leading-none">{datos.nombre_completo} (Titular)</p>
          </div>

          {datos.acompanantes?.map((nombre, index) => (
            <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-100 shadow-sm ml-4 border-l-4 border-l-blue-400">
              <span className="text-xs">👤</span>
              <p className="text-[10px] font-medium text-gray-600 uppercase leading-none">{nombre}</p>
            </div>
          ))}
        </div>
      </div>

      {/* COLUMNA 3: VIGENCIA Y DOCUMENTOS */}
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Vigencia de Contrato</p>
          <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
            <p className="text-[10px] text-blue-800 font-bold">
              Inicio: {formatearFecha(datos.fecha_inicio_contrato)}
            </p>
            <p className="text-[10px] text-blue-800 font-bold">
              Fin: {formatearFecha(datos.fecha_fin_contrato)}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Expediente Digital</p>
          <div className="grid grid-cols-1 gap-1.5">
            {['ine', 'carta', 'contrato'].map((docKey) => {
              const check = datos.docs?.[docKey] === "si";
              return (
                <div key={docKey} className="flex items-center justify-between bg-white px-3 py-1.5 rounded border border-gray-200">
                  <span className="text-[9px] font-black text-gray-500 uppercase">{docKey}</span>
                  <span className={`text-[10px] font-black ${check ? "text-green-500" : "text-red-300"}`}>
                    {check ? "✓ CARGADO" : "✗ PENDIENTE"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetalleExpediente;