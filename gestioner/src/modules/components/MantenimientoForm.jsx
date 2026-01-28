import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

const MantenimientoForm = ({ unidadId, onSuccess }) => {
  const [formData, setFormData] = useState({
    id_unidad: unidadId || '',
    id_propiedad: '',
    tipo: 'preventivo',
    categoria: 'plomeria',
    concepto: '',
    descripcion: '',
    prioridad: 'media',
    costo_estimado: 0,
    periodo: '',
    responsable: '',
    telefono_responsable: '',
    requiere_entrada_unidad: false,
  });

  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inquilinoInfo, setInquilinoInfo] = useState(null);

  // Cargar información de la unidad cuando se selecciona
  useEffect(() => {
    if (formData.id_unidad) {
      cargarInfoUnidad(formData.id_unidad);
    }
  }, [formData.id_unidad]);

  const cargarInfoUnidad = async (unidadId) => {
    try {
      // Aquí deberías implementar la lógica para obtener la unidad
      // y verificar si tiene inquilino activo
      const unidadRef = doc(db, 'unidades', unidadId);
      const unidadSnap = await getDoc(unidadRef);
      
      if (unidadSnap.exists()) {
        const unidadData = unidadSnap.data();
        setFormData(prev => ({
          ...prev,
          id_propiedad: unidadData.id_propiedad || ''
        }));

        // Si tiene inquilino, cargar su info
        if (unidadData.id_inquilino_actual) {
          const inquilinoRef = doc(db, 'inquilinos', unidadData.id_inquilino_actual);
          const inquilinoSnap = await getDoc(inquilinoRef);
          if (inquilinoSnap.exists()) {
            setInquilinoInfo(inquilinoSnap.data());
          }
        } else {
          setInquilinoInfo(null);
        }
      }
    } catch (error) {
      console.error('Error al cargar info de unidad:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const ahora = new Date();
      const mantenimientoData = {
        ...formData,
        estatus: 'pendiente',
        costo_real: 0,
        fecha_registro: Timestamp.fromDate(ahora),
        fecha_finalizacion: null,
        afecta_inquilino: inquilinoInfo ? true : false,
        id_inquilino_afectado: inquilinoInfo ? inquilinoInfo.id : null,
        notas: [],
        fotos_antes: [],
        fotos_despues: [],
        fecha_ultima_actualizacion: Timestamp.fromDate(ahora)
      };

      // Crear el documento de mantenimiento
      const docRef = await addDoc(collection(db, 'mantenimientos'), mantenimientoData);

      // Actualizar la unidad con referencia al mantenimiento activo
      const unidadRef = doc(db, 'unidades', formData.id_unidad);
      await updateDoc(unidadRef, {
        mantenimiento_activo: docRef.id,
        ultimo_mantenimiento: Timestamp.fromDate(ahora),
        total_mantenimientos: (await getDoc(unidadRef)).data().total_mantenimientos + 1 || 1
      });

      alert('Mantenimiento registrado exitosamente');
      
      // Limpiar formulario
      setFormData({
        id_unidad: unidadId || '',
        id_propiedad: '',
        tipo: 'preventivo',
        categoria: 'plomeria',
        concepto: '',
        descripcion: '',
        prioridad: 'media',
        costo_estimado: 0,
        fecha_inicio: '',
        period: '',
        telefono_responsable: '',
        requiere_entrada_unidad: false,
      });

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error al registrar mantenimiento:', error);
      alert('Error al registrar mantenimiento: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Registrar Nuevo Mantenimiento
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información de Unidad */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-3 text-blue-900">Información de Unidad</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unidad *
              </label>
              <input
                type="text"
                name="id_unidad"
                value={formData.id_unidad}
                onChange={handleChange}
                required
                placeholder="Ej: CH-8"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Propiedad
              </label>
              <input
                type="text"
                name="id_propiedad"
                value={formData.id_propiedad}
                onChange={handleChange}
                placeholder="chilpancingo"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                readOnly
              />
            </div>
          </div>

          {inquilinoInfo && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                ⚠️ Esta unidad está ocupada por: <strong>{inquilinoInfo.nombre_completo}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Detalles del Mantenimiento */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-3 text-gray-900">Detalles del Mantenimiento</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo *
              </label>
              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="preventivo">Preventivo</option>
                <option value="correctivo">Correctivo</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoría *
              </label>
              <select
                name="categoria"
                value={formData.categoria}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prioridad *
              </label>
              <select
                name="prioridad"
                value={formData.prioridad}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Concepto *
            </label>
            <input
              type="text"
              name="concepto"
              value={formData.concepto}
              onChange={handleChange}
              required
              placeholder="Ej: Reparación de fuga en baño"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows="3"
              placeholder="Describe el problema o trabajo a realizar..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Costo Estimado (MXN)
              </label>
              <input
                type="number"
                name="costo_estimado"
                value={formData.costo_estimado}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Periodo de Mantenimiento
              </label>
              <input
                type="month"
                name="periodo"
                value={formData.periodo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Información del Responsable */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg mb-3 text-green-900">Responsable del Trabajo</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Responsable
              </label>
              <input
                type="text"
                name="responsable"
                value={formData.responsable}
                onChange={handleChange}
                placeholder="Ej: Juan Pérez - Plomero"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                name="telefono_responsable"
                value={formData.telefono_responsable}
                onChange={handleChange}
                placeholder="664-123-4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>

        {/* Opciones Adicionales */}
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center">
            <input
              type="checkbox"
              name="requiere_entrada_unidad"
              id="requiere_entrada"
              checked={formData.requiere_entrada_unidad}
              onChange={handleChange}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="requiere_entrada" className="ml-2 block text-sm text-gray-700">
              Requiere entrada a la unidad
            </label>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Registrando...' : 'Registrar Mantenimiento'}
          </button>
          
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default MantenimientoForm;