import React, { useState, useEffect } from 'react';
import HistorialPagos from './HistorialPagos';
import FormularioRegistroPago from './FormularioRegistroPago';
import { getPagosPorInquilino } from '../firebase/acciones';

const SeccionPagosInquilino = ({ unidad }) => {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Función para cargar los pagos
  const cargarPagos = async () => {
    setCargando(true);
    const data = await getPagosPorInquilino(unidad.id_inquilino);
    setPagos(data);
    setCargando(false);
  };

  useEffect(() => {
    if (unidad?.id_inquilino) {
      cargarPagos();
    }
  }, [unidad]);

  return (
    <div className="space-y-6 p-4">
      {/* Resumen Superior */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Gestión de Pagos</h2>
          <p className="text-xs text-gray-500 font-medium italic">
            Unidad: {unidad.id} | <span className="text-blue-600">{unidad.nombre_inquilino}</span>
          </p>
        </div>
        
        {!mostrarFormulario && (
          <button 
            onClick={() => setMostrarFormulario(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase hover:bg-blue-700 shadow-lg transition-all"
          >
            + Registrar Pago del Mes
          </button>
        )}
      </div>

      {/* Switch entre Formulario e Historial */}
      {mostrarFormulario ? (
        <FormularioRegistroPago 
          unidad={unidad}
          pagosExistentes={pagos} // ✅ Ahora sí pasa los pagos
          onExito={() => {
            setMostrarFormulario(false);
            cargarPagos();
          }}
          onCancelar={() => setMostrarFormulario(false)}
        />
      ) : (
        <>
          {cargando ? (
            <div className="p-10 text-center text-xs font-bold text-gray-400 uppercase animate-pulse">
              Consultando historial en Firebase...
            </div>
          ) : (
            <HistorialPagos pagos={pagos} />
          )}
        </>
      )}
    </div>
  );
};

export default SeccionPagosInquilino;