import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

const MantenimientoLista = () => {
  const [mantenimientos, setMantenimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMantenimiento, setSelectedMantenimiento] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  // Filtros
  const [filtros, setFiltros] = useState({
    estatus: 'todos',
    prioridad: 'todos',
    categoria: 'todos',
    id_unidad: '',
    id_propiedad: '',
  });

  useEffect(() => {
    cargarMantenimientos();
  }, [filtros]);

  const cargarMantenimientos = async () => {
    setLoading(true);
    try {
      let q = collection(db, 'mantenimientos');
      const conditions = [];

      // Aplicar filtros
      if (filtros.estatus !== 'todos') {
        conditions.push(where('estatus', '==', filtros.estatus));
      }
      if (filtros.prioridad !== 'todos') {
        conditions.push(where('prioridad', '==', filtros.prioridad));
      }
      if (filtros.categoria !== 'todos') {
        conditions.push(where('categoria', '==', filtros.categoria));
      }
      if (filtros.id_unidad) {
        conditions.push(where('id_unidad', '==', filtros.id_unidad));
      }
      if (filtros.id_propiedad) {
        conditions.push(where('id_propiedad', '==', filtros.id_propiedad));
      }

      if (conditions.length > 0) {
        q = query(q, ...conditions, orderBy('fecha_registro', 'desc'));
      } else {
        q = query(q, orderBy('fecha_registro', 'desc'));
      }

      const querySnapshot = await getDocs(q);
      const mantData = [];
      querySnapshot.forEach((doc) => {
        mantData.push({ id: doc.id, ...doc.data() });
      });

      setMantenimientos(mantData);
    } catch (error) {
      console.error('Error al cargar mantenimientos:', error);
      alert('Error al cargar mantenimientos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const limpiarFiltros = () => {
    setFiltros({
      estatus: 'todos',
      prioridad: 'todos',
      categoria: 'todos',
      id_unidad: '',
      id_propiedad: '',
    });
  };

  const abrirModal = (mantenimiento) => {
    setSelectedMantenimiento(mantenimiento);
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setSelectedMantenimiento(null);
  };

  const getPrioridadColor = (prioridad) => {
    const colores = {
      baja: 'bg-green-100 text-green-800',
      media: 'bg-yellow-100 text-yellow-800',
      alta: 'bg-orange-100 text-orange-800',
      urgente: 'bg-red-100 text-red-800'
    };
    return colores[prioridad] || 'bg-gray-100 text-gray-800';
  };

  const getEstatusColor = (estatus) => {
    const colores = {
      pendiente: 'bg-gray-100 text-gray-800',
      en_curso: 'bg-blue-100 text-blue-800',
      finalizado: 'bg-green-100 text-green-800',
      cancelado: 'bg-red-100 text-red-800'
    };
    return colores[estatus] || 'bg-gray-100 text-gray-800';
  };

  const formatearFecha = (timestamp) => {
    if (!timestamp) return 'N/A';
    const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Gestión de Mantenimientos
        </h1>
        <p className="text-gray-600">
          Total de registros: {mantenimientos.length}
        </p>
      </div>

      {/* Panel de Filtros */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Filtros</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estatus
            </label>
            <select
              name="estatus"
              value={filtros.estatus}
              onChange={handleFiltroChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_curso">En Curso</option>
              <option value="finalizado">Finalizado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prioridad
            </label>
            <select
              name="prioridad"
              value={filtros.prioridad}
              onChange={handleFiltroChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todas</option>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              name="categoria"
              value={filtros.categoria}
              onChange={handleFiltroChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todas</option>
              <option value="plomeria">Plomería</option>
              <option value="electrico">Eléctrico</option>
              <option value="pintura">Pintura</option>
              <option value="limpieza">Limpieza</option>
              <option value="carpinteria">Carpintería</option>
              <option value="jardineria">Jardinería</option>
              <option value="otros">Otros</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unidad
            </label>
            <input
              type="text"
              name="id_unidad"
              value={filtros.id_unidad}
              onChange={handleFiltroChange}
              placeholder="Ej: CH-8"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Propiedad
            </label>
            <input
              type="text"
              name="id_propiedad"
              value={filtros.id_propiedad}
              onChange={handleFiltroChange}
              placeholder="chilpancingo"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={cargarMantenimientos}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Aplicar Filtros
          </button>
          <button
            onClick={limpiarFiltros}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Lista de Mantenimientos */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Cargando mantenimientos...</p>
        </div>
      ) : mantenimientos.length === 0 ? (
        <div className="bg-white p-12 rounded-lg shadow-md text-center">
          <p className="text-gray-600 text-lg">No se encontraron mantenimientos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mantenimientos.map((mant) => (
            <div
              key={mant.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => abrirModal(mant)}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 mb-1">
                      {mant.concepto}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Unidad: <span className="font-semibold">{mant.id_unidad}</span>
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPrioridadColor(mant.prioridad)}`}>
                    {mant.prioridad.toUpperCase()}
                  </span>
                </div>

                {/* Badges */}
                <div className="flex gap-2 mb-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getEstatusColor(mant.estatus)}`}>
                    {mant.estatus.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="px-2 py-1 rounded bg-purple-100 text-purple-800 text-xs font-medium">
                    {mant.categoria}
                  </span>
                </div>

                {/* Descripción */}
                {mant.descripcion && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {mant.descripcion}
                  </p>
                )}

                {/* Info adicional */}
                <div className="space-y-2 text-sm text-gray-600">
                  {mant.responsable && (
                    <p>
                      <span className="font-medium">Responsable:</span> {mant.responsable}
                    </p>
                  )}
                  
                  {mant.costo_estimado > 0 && (
                    <p>
                      <span className="font-medium">Costo estimado:</span> ${mant.costo_estimado.toLocaleString('es-MX')}
                    </p>
                  )}
                  
                  <p>
                    <span className="font-medium">Registrado:</span> {formatearFecha(mant.fecha_registro)}
                  </p>

                  {mant.afecta_inquilino && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                      ⚠️ Afecta a inquilino
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                  Ver detalles →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Detalles */}
      {showModal && selectedMantenimiento && (
        <MantenimientoModal
          mantenimiento={selectedMantenimiento}
          onClose={cerrarModal}
          onUpdate={cargarMantenimientos}
        />
      )}
    </div>
  );
};

// Componente Modal (lo separaremos en el siguiente archivo)
const MantenimientoModal = ({ mantenimiento, onClose, onUpdate }) => {
  const [editando, setEditando] = useState(false);
  const [nuevoEstatus, setNuevoEstatus] = useState(mantenimiento.estatus);
  const [costoReal, setCostoReal] = useState(mantenimiento.costo_real || 0);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const formatearFecha = (timestamp) => {
    if (!timestamp) return 'N/A';
    const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const actualizarMantenimiento = async () => {
    setGuardando(true);
    try {
      const mantRef = doc(db, 'mantenimientos', mantenimiento.id);
      const ahora = new Date();
      
      const updateData = {
        estatus: nuevoEstatus,
        costo_real: parseFloat(costoReal),
        fecha_ultima_actualizacion: Timestamp.fromDate(ahora)
      };

      // Si se está finalizando, agregar fecha de finalización
      if (nuevoEstatus === 'finalizado' && mantenimiento.estatus !== 'finalizado') {
        updateData.fecha_finalizacion = Timestamp.fromDate(ahora);
        
        // Actualizar la unidad
        const unidadRef = doc(db, 'unidades', mantenimiento.id_unidad);
        await updateDoc(unidadRef, {
          mantenimiento_activo: null
        });
      }

      // Si se está iniciando, agregar fecha de inicio real
      if (nuevoEstatus === 'en_curso' && mantenimiento.estatus === 'pendiente') {
        if (!mantenimiento.fecha_inicio) {
          updateData.fecha_inicio = Timestamp.fromDate(ahora);
        }
      }

      // Agregar nota si existe
      if (nota.trim()) {
        const nuevaNota = {
          texto: nota,
          fecha: Timestamp.fromDate(ahora),
          estatus_en_momento: nuevoEstatus
        };
        updateData.notas = [...(mantenimiento.notas || []), nuevaNota];
      }

      await updateDoc(mantRef, updateData);

      alert('Mantenimiento actualizado correctamente');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error al actualizar mantenimiento:', error);
      alert('Error al actualizar: ' + error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Detalles del Mantenimiento
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-6">
          {/* Información Principal */}
          <div>
            <h3 className="text-xl font-semibold mb-2">{mantenimiento.concepto}</h3>
            <p className="text-gray-600">{mantenimiento.descripcion}</p>
          </div>

          {/* Grid de Información */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 mb-1">Unidad</p>
              <p className="font-semibold">{mantenimiento.id_unidad}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Propiedad</p>
              <p className="font-semibold">{mantenimiento.id_propiedad}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Tipo</p>
              <p className="font-semibold capitalize">{mantenimiento.tipo}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Categoría</p>
              <p className="font-semibold capitalize">{mantenimiento.categoria}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Prioridad</p>
              <p className="font-semibold capitalize">{mantenimiento.prioridad}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Estatus Actual</p>
              <p className="font-semibold capitalize">{mantenimiento.estatus.replace('_', ' ')}</p>
            </div>
          </div>

          {/* Responsable */}
          {mantenimiento.responsable && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Responsable</h4>
              <p>{mantenimiento.responsable}</p>
              {mantenimiento.telefono_responsable && (
                <p className="text-sm text-gray-600 mt-1">
                  Tel: {mantenimiento.telefono_responsable}
                </p>
              )}
            </div>
          )}

          {/* Fechas */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-3">Fechas</h4>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Registro:</span> {formatearFecha(mantenimiento.fecha_registro)}
              </p>
              {mantenimiento.fecha_inicio && (
                <p>
                  <span className="font-medium">Inicio:</span> {formatearFecha(mantenimiento.fecha_inicio)}
                </p>
              )}
              {mantenimiento.fecha_finalizacion && (
                <p>
                  <span className="font-medium">Finalización:</span> {formatearFecha(mantenimiento.fecha_finalizacion)}
                </p>
              )}
            </div>
          </div>

          {/* Costos */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-3">Costos</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Estimado</p>
                <p className="text-lg font-bold text-purple-900">
                  ${mantenimiento.costo_estimado.toLocaleString('es-MX')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Real</p>
                <p className="text-lg font-bold text-purple-900">
                  ${(mantenimiento.costo_real || 0).toLocaleString('es-MX')}
                </p>
              </div>
            </div>
          </div>

          {/* Notas */}
          {mantenimiento.notas && mantenimiento.notas.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3">Historial de Notas</h4>
              <div className="space-y-2">
                {mantenimiento.notas.map((nota, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded border-l-4 border-blue-500">
                    <p className="text-sm">{nota.texto}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatearFecha(nota.fecha)} - Estatus: {nota.estatus_en_momento}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sección de Actualización */}
          {editando ? (
            <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-300">
              <h4 className="font-semibold mb-4">Actualizar Mantenimiento</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Cambiar Estatus
                  </label>
                  <select
                    value={nuevoEstatus}
                    onChange={(e) => setNuevoEstatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_curso">En Curso</option>
                    <option value="finalizado">Finalizado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Costo Real (MXN)
                  </label>
                  <input
                    type="number"
                    value={costoReal}
                    onChange={(e) => setCostoReal(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Agregar Nota
                  </label>
                  <textarea
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    rows="3"
                    placeholder="Escribe una nota sobre el progreso..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={actualizarMantenimiento}
                    disabled={guardando}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {guardando ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  <button
                    onClick={() => setEditando(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditando(true)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-medium"
            >
              Actualizar Mantenimiento
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MantenimientoLista;