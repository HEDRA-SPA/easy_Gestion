import React, { useEffect, useState, useCallback } from 'react';
import Layout from './modules/Layout';
import Dashboard from './modules/Dashboard'; 
import SeccionPagosInquilino from './modules/SeccionPagosInquilino';
import { LoadingScreen, ErrorScreen } from './atomics/Feedback'; 
import { getDatosDashboard } from './firebase/consultas';

function App() {
  const [datos, setDatos] = useState({ stats: {}, listaAdeudos: [], unidades: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [periodoFiltro, setPeriodoFiltro] = useState(new Date().toISOString().split('T')[0].slice(0, 7));
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
// 2. Envolver la función en useCallback
  const cargarTodo = useCallback(async (periodo) => {
    // Ponemos un guardia para no cargar si ya estamos cargando
    // (pero no el setCargando inicial)
    
    try {
      console.log("🔍 Cargando datos para:", periodo);
      const respuesta = await getDatosDashboard(periodo);
      
      if (respuesta) {
        setDatos(respuesta);
        if (typeof periodo === 'string') {
          setPeriodoFiltro(periodo);
        }
      }
    } catch (e) {
      console.error("Error:", e);
      setError(true);
    } finally {
      setCargando(false);
    }
  }, []); // El array vacío significa: "Crea esta función solo una vez"

  // 3. Efecto inicial limpio
  useEffect(() => {
    cargarTodo(periodoFiltro);
  }, [cargarTodo]); // Ahora es seguro ponerla aquí

  if (cargando) return <LoadingScreen mensaje="Cargando Dashboard..." />;
  if (error) return <ErrorScreen mensaje="No pudimos conectar con la base de datos" />;

  return (
    <Layout>
      {unidadSeleccionada ? (
        <div className="space-y-4">
          <button 
            onClick={() => setUnidadSeleccionada(null)}
            className="text-[10px] font-black text-gray-400 hover:text-blue-600 uppercase flex items-center gap-1 transition-colors"
          >
            ← Volver al Dashboard
          </button>
          
          <SeccionPagosInquilino unidad={unidadSeleccionada} />
        </div>
      ) : (
        <Dashboard 
          resumen={datos.stats} 
          adeudos={datos.listaAdeudos} 
          unidades={datos.unidades} 
          refrescarDatos={cargarTodo}
          onVerPagos={(u) => setUnidadSeleccionada(u)} 
          periodoActual={periodoFiltro}
        />
      )}
    </Layout>
  );
}

export default App;