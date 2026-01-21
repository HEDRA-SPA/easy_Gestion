import React, { useEffect, useState, useCallback } from 'react';
import Layout from './modules/Layout';
import Dashboard from './modules/Dashboard'; 
import SeccionPagosInquilino from './modules/SeccionPagosInquilino';
import { LoadingScreen, ErrorScreen } from './atomics/Feedback'; 
import { getDatosDashboard } from './firebase/consultas';
import { auth } from './firebase/config';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Login from './modules/components/Login';
import GestionPropiedades from './modules/components/GestionPropiedades';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [autenticando, setAutenticando] = useState(true);
  const [datos, setDatos] = useState({ 
    stats: {}, 
    listaAdeudos: [], 
    unidades: [],
    inquilinosMap: {} 
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [periodoFiltro, setPeriodoFiltro] = useState(new Date().toISOString().split('T')[0].slice(0, 7));
  const [seccionActiva, setSeccionActiva] = useState('dashboard');
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);

  // 🔥 Función simple para cargar datos
  const cargarTodo = useCallback(async (periodo) => {
    if (!auth.currentUser) return;
    
    try {
      setCargando(true);
      const respuesta = await getDatosDashboard(periodo);
      if (respuesta) {
        setDatos(respuesta);
        setPeriodoFiltro(periodo);
      }
    } catch (e) {
      console.error("Error al cargar dashboard:", e);
      setError(true);
    } finally {
      setCargando(false);
    }
  }, []);

  // Escuchar cambios de sesión
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setAutenticando(false);
      
      // 🔥 Cargar datos solo cuando el usuario inicia sesión
      if (user) {
        cargarTodo(new Date().toISOString().split('T')[0].slice(0, 7));
      }
    });
    return () => unsubscribe();
  }, [cargarTodo]);

  const cerrarSesion = () => signOut(auth);

  const renderContenido = () => {
    if (unidadSeleccionada) {
      return (
        <div className="space-y-4">
          <button 
            onClick={() => setUnidadSeleccionada(null)}
            className="text-[10px] font-black text-gray-400 hover:text-blue-600 uppercase flex items-center gap-1"
          >
            ← Volver
          </button>
          <SeccionPagosInquilino unidad={unidadSeleccionada} />
        </div>
      );
    }

    switch (seccionActiva) {
      case 'propiedades':
        return <GestionPropiedades />;
      default:
        return (
          <Dashboard 
            resumen={datos.stats} 
            adeudos={datos.listaAdeudos} 
            unidades={datos.unidades}
            inquilinosMap={datos.inquilinosMap}
            refrescarDatos={cargarTodo}
            onVerPagos={(u) => setUnidadSeleccionada(u)} 
            periodoActual={periodoFiltro}
          />
        );
    }
  };

  if (autenticando) return <LoadingScreen mensaje="Verificando sesión..." />;
  if (!usuario) return <Login />;
  if (error) return <ErrorScreen mensaje="Error de conexión con la base de datos" />;
  if (cargando) return <LoadingScreen mensaje="Actualizando información..." />;

  return (
    <Layout 
      setSeccion={setSeccionActiva} 
      seccionActiva={seccionActiva} 
      usuario={usuario}
      onLogout={cerrarSesion}
    >
      {renderContenido()}
    </Layout>
  );
}

export default App;