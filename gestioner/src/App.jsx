
import React, { useEffect, useState } from 'react';
import Layout from './modules/Layout';
import Dashboard from './modules/Dashboard'; 
import SeccionPagosInquilino from './modules/SeccionPagosInquilino'; // Nuevo
import { LoadingScreen, ErrorScreen } from './atomics/Feedback'; 
import { getDatosDashboard } from './firebase/consultas';
import { obtenerPeriodoActual } from './utils/dateUtils';

function App() {
  const [datos, setDatos] = useState({ stats: {}, listaAdeudos: [], unidades: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [periodoFiltro, setPeriodoFiltro] = useState(new Date().toISOString().split('T')[0].slice(0, 7));
  
  // ESTADO PARA NAVEGACIÓN DE PAGOS
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);

  const cargarTodo = async (periodoParaConsultar = periodoFiltro) => {
    try {
      const respuesta = await getDatosDashboard(periodoParaConsultar);
      
      if (respuesta) {
        setDatos(respuesta);
        setPeriodoFiltro(periodoParaConsultar); // Actualizamos el estado global
      } else {
        setError(true);
      }
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  if (cargando) return <LoadingScreen mensaje="Cargando Dashboard..." />;
  if (error) return <ErrorScreen mensaje="No pudimos conectar con la base de datos" />;

  return (
    <Layout>
      {/* Si hay una unidad seleccionada, mostramos pagos, si no, el dashboard */}
      {unidadSeleccionada ? (
        <div className="space-y-4">
          <button 
            onClick={() => setUnidadSeleccionada(null)}
            className="text-[10px] font-black text-gray-400 hover:text-blue-600 uppercase flex items-center gap-1 transition-colors"
          >
            ← Volver al Dashboard
          </button>
          
          <SeccionPagosInquilino 
            unidad={unidadSeleccionada} 
            pagosDelInquilino={[]} // Aquí deberías cargar los pagos desde Firebase usando el id_inquilino
          />
        </div>
      ) : (
        <Dashboard 
          resumen={datos.stats} 
          adeudos={datos.listaAdeudos} 
          unidades={datos.unidades} 
          refrescarDatos={(nuevoPeriodo) => cargarTodo(nuevoPeriodo)} 
          onVerPagos={(u) => setUnidadSeleccionada(u)} 
          periodoActual={periodoFiltro} // Le pasamos el valor actual al Dashboard
        />
      )}
    </Layout>
  );
}

export default App;