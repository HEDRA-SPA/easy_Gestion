// src/App.jsx
import React, { useEffect, useState } from 'react';
import Layout from './modules/Layout';
import Dashboard from './modules/Dashboard'; // Ruta actualizada
import { LoadingScreen, ErrorScreen } from './atomics/Feedback'; // Subcomponentes externos
import { getDatosDashboard } from './firebase/consultas';
import { obtenerPeriodoActual } from './utils/dateUtils';

function App() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const cargarInformacion = async () => {
      try {
        const respuesta = await getDatosDashboard(obtenerPeriodoActual());
        if (respuesta) setDatos(respuesta);
        else setError(true);
      } catch (e) {
        setError(true);
      } finally {
        setCargando(false);
      }
    };
    cargarInformacion();
  }, []);

  if (cargando) return <LoadingScreen mensaje="Cargando Dashboard..." />;
  if (error) return <ErrorScreen mensaje="No pudimos conectar con la base de datos" />;

  return (
    <Layout>
      <Dashboard 
  resumen={datos.stats} 
  adeudos={datos.listaAdeudos} 
  unidades={datos.todasLasUnidades} 
/>
    </Layout>
  );
}

export default App;