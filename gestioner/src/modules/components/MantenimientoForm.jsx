import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, getDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';
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

  const [loading, setLoading] = useState(false);
  const [inquilinoInfo, setInquilinoInfo] = useState(null);
  const [afectaInquilino, setAfectaInquilino] = useState(false);

  // Cargar información de la unidad cuando se selecciona
  useEffect(() => {
    if (formData.id_unidad) {
      cargarInfoUnidad(formData.id_unidad);
    }
  }, [formData.id_unidad]);

  // ⭐ VALIDAR SI AFECTA INQUILINO cuando cambia el periodo
  useEffect(() => {
    if (formData.periodo && inquilinoInfo) {
      validarSiAfectaInquilino();
    } else {
      setAfectaInquilino(false);
    }
  }, [formData.periodo, inquilinoInfo]);

  const cargarInfoUnidad = async (unidadId) => {
    try {
      const unidadRef = doc(db, 'unidades', unidadId);
      const unidadSnap = await getDoc(unidadRef);
      
      if (unidadSnap.exists()) {
        const unidadData = unidadSnap.data();
        
        // Actualizar propiedad
        setFormData(prev => ({
          ...prev,
          id_propiedad: unidadData.id_propiedad || ''
        }));

        // Verificar si tiene inquilino activo
        if (unidadData.id_inquilino && unidadData.estado === 'Ocupado') {
          // Cargar información del inquilino
          const inquilinoRef = doc(db, 'inquilinos', unidadData.id_inquilino);
          const inquilinoSnap = await getDoc(inquilinoRef);
          
          if (inquilinoSnap.exists()) {
            const inquilinoData = inquilinoSnap.data();
            
            setInquilinoInfo({
              id: unidadData.id_inquilino,
              nombre_completo: inquilinoData.nombre_completo || unidadData.nombre_inquilino,
              telefono_contacto: inquilinoData.telefono_contacto,
              fecha_inicio_contrato: inquilinoData.fecha_inicio_contrato,
              fecha_fin_contrato: inquilinoData.fecha_fin_contrato,
              id_contrato_actual: inquilinoData.id_contrato_actual
            });
          } else {
            setInquilinoInfo({
              id: unidadData.id_inquilino,
              nombre_completo: unidadData.nombre_inquilino || 'Inquilino sin nombre',
              telefono_contacto: 'N/A',
              fecha_inicio_contrato: null,
              fecha_fin_contrato: null
            });
          }
        } else {
          setInquilinoInfo(null);
        }
      }
    } catch (error) {
      console.error('Error al cargar info de unidad:', error);
    }
  };

  /**
   * ⭐ VALIDAR SI EL INQUILINO ESTARÁ PRESENTE EN EL PERIODO DEL MANTENIMIENTO
   */
  const validarSiAfectaInquilino = async () => {
    if (!inquilinoInfo || !formData.periodo) {
      setAfectaInquilino(false);
      return;
    }

    try {
      // Obtener año y mes del periodo del mantenimiento
      const [anioMantenimiento, mesMantenimiento] = formData.periodo.split('-').map(Number);
      
      // Consultar el contrato activo de la unidad para obtener fechas precisas
      if (inquilinoInfo.id_contrato_actual) {
        const contratoRef = doc(db, 'contratos', inquilinoInfo.id_contrato_actual);
        const contratoSnap = await getDoc(contratoRef);
        
        if (contratoSnap.exists()) {
          const contratoData = contratoSnap.data();
          
          const fechaInicio = contratoData.fecha_inicio?.toDate ? 
            contratoData.fecha_inicio.toDate() : new Date(contratoData.fecha_inicio);
          const fechaFin = contratoData.fecha_fin?.toDate ? 
            contratoData.fecha_fin.toDate() : new Date(contratoData.fecha_fin);
          
          const inicioAnio = fechaInicio.getFullYear();
          const inicioMes = fechaInicio.getMonth() + 1; // 0-11 -> 1-12
          const finAnio = fechaFin.getFullYear();
          const finMes = fechaFin.getMonth() + 1;
          
          // Verificar si el periodo del mantenimiento está dentro del contrato
          let periodoEnContrato = false;
          
          if (anioMantenimiento > inicioAnio && anioMantenimiento < finAnio) {
            periodoEnContrato = true;
          } else if (anioMantenimiento === inicioAnio && anioMantenimiento === finAnio) {
            periodoEnContrato = mesMantenimiento >= inicioMes && mesMantenimiento <= finMes;
          } else if (anioMantenimiento === inicioAnio) {
            periodoEnContrato = mesMantenimiento >= inicioMes;
          } else if (anioMantenimiento === finAnio) {
            periodoEnContrato = mesMantenimiento <= finMes;
          }
          
          setAfectaInquilino(periodoEnContrato);
          return;
        }
      }
      
      // Fallback: usar fechas del inquilino si no hay contrato
      if (inquilinoInfo.fecha_inicio_contrato && inquilinoInfo.fecha_fin_contrato) {
        const fechaInicio = inquilinoInfo.fecha_inicio_contrato?.toDate ? 
          inquilinoInfo.fecha_inicio_contrato.toDate() : new Date(inquilinoInfo.fecha_inicio_contrato);
        const fechaFin = inquilinoInfo.fecha_fin_contrato?.toDate ? 
          inquilinoInfo.fecha_fin_contrato.toDate() : new Date(inquilinoInfo.fecha_fin_contrato);
        
        const inicioAnio = fechaInicio.getFullYear();
        const inicioMes = fechaInicio.getMonth() + 1;
        const finAnio = fechaFin.getFullYear();
        const finMes = fechaFin.getMonth() + 1;
        
        let periodoEnContrato = false;
        
        if (anioMantenimiento > inicioAnio && anioMantenimiento < finAnio) {
          periodoEnContrato = true;
        } else if (anioMantenimiento === inicioAnio && anioMantenimiento === finAnio) {
          periodoEnContrato = mesMantenimiento >= inicioMes && mesMantenimiento <= finMes;
        } else if (anioMantenimiento === inicioAnio) {
          periodoEnContrato = mesMantenimiento >= inicioMes;
        } else if (anioMantenimiento === finAnio) {
          periodoEnContrato = mesMantenimiento <= finMes;
        }
        
        setAfectaInquilino(periodoEnContrato);
      } else {
        // Si no hay fechas de contrato, asumir que sí afecta
        setAfectaInquilino(true);
      }
      
    } catch (error) {
      console.error('Error validando periodo:', error);
      setAfectaInquilino(false);
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
      
      // Preparar datos del mantenimiento
      const mantenimientoData = {
        ...formData,
        estatus: 'pendiente',
        costo_real: 0,
        fecha_registro: Timestamp.fromDate(ahora),
        fecha_finalizacion: null,
        // ⭐ CAMBIO: Usar el estado calculado basado en el periodo
        afecta_inquilino: afectaInquilino,
        id_inquilino_afectado: afectaInquilino ? inquilinoInfo.id : null,
        notas: [],
        fotos_antes: [],
        fotos_despues: [],
        fecha_ultima_actualizacion: Timestamp.fromDate(ahora)
      };

      // Crear el documento de mantenimiento
      const docRef = await addDoc(collection(db, 'mantenimientos'), mantenimientoData);

      // Actualizar la unidad con referencia al mantenimiento activo
      const unidadRef = doc(db, 'unidades', formData.id_unidad);
      const unidadSnap = await getDoc(unidadRef);
      const totalMantenimientos = unidadSnap.exists() 
        ? (unidadSnap.data().total_mantenimientos || 0) + 1 
        : 1;

      await updateDoc(unidadRef, {
        mantenimiento_activo: docRef.id,
        ultimo_mantenimiento: Timestamp.fromDate(ahora),
        total_mantenimientos: totalMantenimientos
      });

      alert('✅ Mantenimiento registrado exitosamente');
      
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
        periodo: '',
        responsable: '',
        telefono_responsable: '',
        requiere_entrada_unidad: false,
      });

      setInquilinoInfo(null);
      setAfectaInquilino(false);

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error al registrar mantenimiento:', error);
      alert(' Error al registrar mantenimiento: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl sm:text-3xl"><i className="fa-solid fa-wrench"></i></span>
              Registro de un nuevo mantenimiento
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">
              Registros de mantenimientos preventivos y correctivos para unidades
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información de Unidad */}
        <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-100">
          <h3 className="font-semibold text-lg mb-3 text-blue-900"><i className="fa-solid fa-map-pin"></i> Información de Unidad</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                placeholder="Se cargará automáticamente"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                readOnly
              />
            </div>
          </div>

          {/* ⭐ Alerta DINÁMICA basada en el periodo */}
          {inquilinoInfo && formData.periodo && (
            afectaInquilino ? (
              <div className="mt-3 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg flex items-start gap-3">
                <span className="text-2xl"></span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-yellow-900">
                    Unidad Ocupada en el Periodo Seleccionado
                  </p>
                  <p className="text-sm text-yellow-800 mt-1">
                    Inquilino: <strong>{inquilinoInfo.nombre_completo}</strong>
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Este mantenimiento afectará al inquilino durante {formData.periodo}
                  </p>
                  {inquilinoInfo.telefono_contacto && inquilinoInfo.telefono_contacto !== 'N/A' && (
                    <p className="text-xs text-yellow-700 mt-1">
                      Tel: {inquilinoInfo.telefono_contacto}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 p-3 bg-green-50 border-2 border-green-300 rounded-lg flex items-start gap-3">
                <span className="text-2xl"></span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-green-900">
                    Unidad Disponible en el Periodo Seleccionado
                  </p>
                  <p className="text-sm text-green-800 mt-1">
                    Aunque la unidad está ocupada actualmente, el inquilino <strong>{inquilinoInfo.nombre_completo}</strong> ya no estará presente en {formData.periodo}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Este mantenimiento NO afectará al inquilino
                  </p>
                </div>
              </div>
            )
          )}

          {/* Alerta si NO hay inquilino */}
          {formData.id_unidad && !inquilinoInfo && (
            <div className="mt-3 p-3 bg-green-50 border-2 border-green-300 rounded-lg flex items-start gap-3">
              <span className="text-2xl"></span>
              <div className="flex-1">
                <p className="text-sm font-bold text-green-900">
                  Unidad Disponible
                </p>
                <p className="text-sm text-green-800 mt-1">
                  Esta unidad no tiene inquilino activo
                </p>
              </div>
            </div>
          )}

          {/* Alerta si falta seleccionar periodo */}
          {inquilinoInfo && !formData.periodo && (
            <div className="mt-3 p-3 bg-blue-50 border-2 border-blue-300 rounded-lg flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-900">
                  Selecciona el Periodo del Mantenimiento
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  Una vez que selecciones el periodo, se validará si afecta al inquilino <strong>{inquilinoInfo.nombre_completo}</strong>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Detalles del Mantenimiento */}
        <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
          <h3 className="font-semibold text-lg mb-3 text-gray-900"><i className="fa-solid fa-file"></i> Detalles del Mantenimiento</h3>
          
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
                Periodo de Mantenimiento * <span className="text-xs text-blue-600">(Se valida vs fechas del contrato)</span>
              </label>
              <input
                type="month"
                name="periodo"
                value={formData.periodo}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Información del Responsable */}
        <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
          <h3 className="font-semibold text-lg mb-3 text-green-900"><i className="fa-solid fa-user-check"></i> Responsable del Trabajo</h3>
          
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
        <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
          <div className="flex items-center">
            <input
              type="checkbox"
              name="requiere_entrada_unidad"
              id="requiere_entrada"
              checked={formData.requiere_entrada_unidad}
              onChange={handleChange}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="requiere_entrada" className="ml-2 block text-sm font-medium text-gray-700">
              <i className="fa-solid fa-key"></i> Requiere entrada a la unidad
            </label>
          </div>
        </div>

        {/* ⭐ Resumen dinámico antes de guardar */}
        {formData.periodo && (
          <div className={`border-2 rounded-lg p-4 ${
            afectaInquilino ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-300'
          }`}>
            <p className={`text-sm font-bold mb-2 ${
              afectaInquilino ? 'text-amber-900' : 'text-blue-900'
            }`}>
              📌 Resumen del Registro:
            </p>
            <ul className={`text-sm space-y-1 ${
              afectaInquilino ? 'text-amber-800' : 'text-blue-800'
            }`}>
              <li>• <strong>Periodo del mantenimiento:</strong> {formData.periodo}</li>
              <li>• <strong>Afecta a inquilino:</strong> {afectaInquilino ? 'SÍ' : 'NO'}</li>
              {afectaInquilino && inquilinoInfo && (
                <>
                  <li>• <strong>Inquilino afectado:</strong> {inquilinoInfo.nombre_completo}</li>
                  <li>• <strong>ID del inquilino:</strong> {inquilinoInfo.id}</li>
                </>
              )}
              {!afectaInquilino && inquilinoInfo && (
                <li>• <strong>Motivo:</strong> El inquilino {inquilinoInfo.nombre_completo} no estará presente en ese periodo</li>
              )}
            </ul>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-4 pt-4 border-t-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-4 sm:px-6 rounded-xl transition-all shadow-sm text-sm sm:text-base"
          >
            {loading ? ' Registrando...' : ' Registrar Mantenimiento'}
          </button>
          
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium"
          >
             Cancelar
          </button>
        </div>
      </form>
    </div>
    </>
  );
};

export default MantenimientoForm;