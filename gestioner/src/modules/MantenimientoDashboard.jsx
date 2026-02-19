import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

const MantenimientoDashboard = () => {
  const [stats, setStats] = useState({
    total: 0,
    pendientes: 0,
    en_curso: 0,
    finalizados: 0,
    cancelados: 0,
    urgentes: 0,
    costo_total_estimado: 0,
    costo_total_real: 0,
    por_categoria: {},
    por_propiedad: {}
  });
  const [loading, setLoading] = useState(true);
  const [mantenimientosRecientes, setMantenimientosRecientes] = useState([]);

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    setLoading(true);
    try {
      const mantQuery = query(collection(db, 'mantenimientos'));
      const querySnapshot = await getDocs(mantQuery);
      
      const statsTemp = {
        total: 0,
        pendientes: 0,
        en_curso: 0,
        finalizados: 0,
        cancelados: 0,
        urgentes: 0,
        costo_total_estimado: 0,
        costo_total_real: 0,
        por_categoria: {},
        por_propiedad: {}
      };

      const recientes = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        statsTemp.total++;

        // Contar por estatus
        if (data.estatus === 'pendiente') statsTemp.pendientes++;
        if (data.estatus === 'en_curso') statsTemp.en_curso++;
        if (data.estatus === 'finalizado') statsTemp.finalizados++;
        if (data.estatus === 'cancelado') statsTemp.cancelados++;
        
        // Contar urgentes
        if (data.prioridad === 'urgente') statsTemp.urgentes++;

        // Sumar costos
        statsTemp.costo_total_estimado += data.costo_estimado || 0;
        statsTemp.costo_total_real += data.costo_real || 0;

        // Agrupar por categoría
        if (!statsTemp.por_categoria[data.categoria]) {
          statsTemp.por_categoria[data.categoria] = 0;
        }
        statsTemp.por_categoria[data.categoria]++;

        // Agrupar por propiedad
        if (data.id_propiedad) {
          if (!statsTemp.por_propiedad[data.id_propiedad]) {
            statsTemp.por_propiedad[data.id_propiedad] = 0;
          }
          statsTemp.por_propiedad[data.id_propiedad]++;
        }

        // Agregar a recientes (limitado a 5)
        if (recientes.length < 5) {
          recientes.push({ id: doc.id, ...data });
        }
      });

      setStats(statsTemp);
      setMantenimientosRecientes(recientes);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (timestamp) => {
    if (!timestamp) return 'N/A';
    const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">Cargando estadísticas...</p>
        </div>
      </div>
    );
  }
 const eliminarMantenimiento = async (id) => {
    const confirmar = window.confirm('¿Seguro que deseas eliminar este mantenimiento? Esta acción no se puede deshacer.');
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, 'mantenimientos', id));
      // Recargar estadísticas después de eliminar
      await cargarEstadisticas();
    } catch (error) {
      console.error('Error al eliminar:', error);
      alert('Error al eliminar el mantenimiento: ' + error.message);
    }
  };
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Dashboard de Mantenimientos
        </h1>
        <p className="text-gray-600">
          Resumen general de todas las propiedades
        </p>
      </div>

      {/* Tarjetas de Estadísticas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total</p>
              <p className="text-4xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="bg-blue-400 bg-opacity-30 rounded-lg p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <p className="text-blue-100 text-sm">Mantenimientos registrados</p>
        </div>

        {/* Pendientes */}
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-yellow-100 text-sm font-medium">Pendientes</p>
              <p className="text-4xl font-bold mt-1">{stats.pendientes}</p>
            </div>
            <div className="bg-yellow-400 bg-opacity-30 rounded-lg p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-yellow-100 text-sm">Por iniciar</p>
        </div>

        {/* En Curso */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-purple-100 text-sm font-medium">En Curso</p>
              <p className="text-4xl font-bold mt-1">{stats.en_curso}</p>
            </div>
            <div className="bg-purple-400 bg-opacity-30 rounded-lg p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <p className="text-purple-100 text-sm">En progreso</p>
        </div>

        {/* Urgentes */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-red-100 text-sm font-medium">Urgentes</p>
              <p className="text-4xl font-bold mt-1">{stats.urgentes}</p>
            </div>
            <div className="bg-red-400 bg-opacity-30 rounded-lg p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <p className="text-red-100 text-sm">Requieren atención</p>
        </div>
      </div>

      {/* Fila de Estadísticas Secundarias */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Finalizados */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Finalizados</p>
              <p className="text-3xl font-bold text-green-600">{stats.finalizados}</p>
            </div>
            <div className="bg-green-100 rounded-full p-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {stats.total > 0 ? Math.round((stats.finalizados / stats.total) * 100) : 0}% del total
          </p>
        </div>

        {/* Cancelados */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Cancelados</p>
              <p className="text-3xl font-bold text-gray-600">{stats.cancelados}</p>
            </div>
            <div className="bg-gray-100 rounded-full p-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {stats.total > 0 ? Math.round((stats.cancelados / stats.total) * 100) : 0}% del total
          </p>
        </div>

        {/* Tasa de Completado */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">Tasa de Completado</p>
              <p className="text-3xl font-bold text-blue-600">
                {stats.total > 0 ? Math.round((stats.finalizados / stats.total) * 100) : 0}%
              </p>
            </div>
            <div className="bg-blue-100 rounded-full p-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            De {stats.total} mantenimientos
          </p>
        </div>
      </div>

      {/* Costos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Costos Totales</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Estimado</span>
                <span className="text-2xl font-bold text-gray-900">
                  ${stats.costo_total_estimado.toLocaleString('es-MX')}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: '100%' }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Real</span>
                <span className="text-2xl font-bold text-green-600">
                  ${stats.costo_total_real.toLocaleString('es-MX')}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full"
                  style={{ 
                    width: stats.costo_total_estimado > 0 
                      ? `${Math.min((stats.costo_total_real / stats.costo_total_estimado) * 100, 100)}%`
                      : '0%'
                  }}
                ></div>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-600">Diferencia</span>
                <span className={`text-lg font-semibold ${
                  stats.costo_total_real > stats.costo_total_estimado 
                    ? 'text-red-600' 
                    : 'text-green-600'
                }`}>
                  {stats.costo_total_real > stats.costo_total_estimado ? '+' : ''}
                  ${(stats.costo_total_real - stats.costo_total_estimado).toLocaleString('es-MX')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Por Categoría</h3>
          <div className="space-y-3">
            {Object.entries(stats.por_categoria)
              .sort(([, a], [, b]) => b - a)
              .map(([categoria, count]) => (
                <div key={categoria}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {categoria}
                    </span>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ 
                        width: `${(count / stats.total) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Mantenimientos Recientes */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">
          Mantenimientos Recientes
        </h3>
        <div className="space-y-3">
          {mantenimientosRecientes.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay mantenimientos registrados</p>
          ) : (
            mantenimientosRecientes.map((mant) => (
              <div 
                key={mant.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      mant.prioridad === 'urgente' ? 'bg-red-100 text-red-800' :
                      mant.prioridad === 'alta' ? 'bg-orange-100 text-orange-800' :
                      mant.prioridad === 'media' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {mant.prioridad}
                    </span>
                    <span className="font-semibold text-gray-900">{mant.concepto}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span>Unidad: {mant.id_unidad}</span>
                    <span>•</span>
                    <span className="capitalize">{mant.categoria}</span>
                    <span>•</span>
                    <span>{formatearFecha(mant.fecha_registro)}</span>
                  </div>
                </div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    mant.estatus === 'finalizado' ? 'bg-green-100 text-green-800' :
                    mant.estatus === 'en_curso' ? 'bg-blue-100 text-blue-800' :
                    mant.estatus === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {mant.estatus.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Por Propiedad */}
      {Object.keys(stats.por_propiedad).length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Por Propiedad</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(stats.por_propiedad).map(([propiedad, count]) => (
              <div key={propiedad} className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 capitalize">{propiedad}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {Math.round((count / stats.total) * 100)}% del total
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MantenimientoDashboard;