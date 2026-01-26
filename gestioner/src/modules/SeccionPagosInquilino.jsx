import React, { useState, useEffect } from 'react';
import HistorialPagos from './HistorialPagos';
import FormularioRegistroPago from './FormularioRegistroPago';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const SeccionPagosInquilino = ({ unidad }) => {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [contrato, setContrato] = useState(null);
  const [pagosReales, setPagosReales] = useState([]); // ← NUEVO: Para guardar los pagos reales
  const [cargando, setCargando] = useState(true);

  // Cargar el contrato desde la colección /contratos/
  const cargarDatosContrato = async () => {
    if (!unidad?.id_contrato_actual && !unidad?.id_contrato) {
       console.error("No hay ID de contrato en la unidad");
       setCargando(false);
       return;
    }

    setCargando(true);
    try {
      // Usamos el ID del contrato que viene en la unidad
      const idContrato = unidad.id_contrato_actual || unidad.id_contrato;
      const docRef = doc(db, "contratos", idContrato);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setContrato({ id: docSnap.id, ...docSnap.data() });
      } else {
        console.log("No se encontró el documento del contrato");
      }
    } catch (error) {
      console.error("Error al obtener contrato:", error);
    }
    setCargando(false);
  };

  // ← NUEVA FUNCIÓN: Cargar pagos reales de la colección "pagos"
  const cargarPagosReales = async () => {
    if (!unidad?.id) return;

    try {
      const pagosRef = collection(db, "pagos");
      const q = query(pagosRef, where("id_unidad", "==", unidad.id));
      const querySnapshot = await getDocs(q);
      
      const pagosData = [];
      querySnapshot.forEach((doc) => {
        pagosData.push({ id: doc.id, ...doc.data() });
      });
      
      setPagosReales(pagosData);
      console.log("✅ Pagos reales cargados:", pagosData);
    } catch (error) {
      console.error("Error al cargar pagos:", error);
    }
  };

  useEffect(() => {
    if (unidad) {
      cargarDatosContrato();
      cargarPagosReales(); // ← Cargar pagos reales también
    }
  }, [unidad]);

  // Función para recargar todo después de registrar un pago
  const handleExitoPago = async () => {
    setMostrarFormulario(false);
    await cargarDatosContrato();
    await cargarPagosReales(); // ← Recargar los pagos reales
  };

  return (
    <div className="space-y-6 p-4">
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

      {mostrarFormulario ? (
        <FormularioRegistroPago 
          unidad={unidad}
          pagosExistentes={pagosReales} // ← ✅ AHORA PASA LOS PAGOS REALES
          onExito={handleExitoPago}
          onCancelar={() => setMostrarFormulario(false)}
        />
      ) : (
        <>
          {cargando ? (
            <div className="p-10 text-center text-xs font-bold text-gray-400 uppercase animate-pulse">
              Consultando contrato en Firebase...
            </div>
          ) : (
            <HistorialPagos 
              contrato={contrato} 
              onActualizar={cargarDatosContrato} 
            />
          )}
        </>
      )}
    </div>
  );
};

export default SeccionPagosInquilino;