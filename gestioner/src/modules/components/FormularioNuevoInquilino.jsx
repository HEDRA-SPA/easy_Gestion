import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { registrarNuevoInquilino, actualizarInquilino, validarSolapamientoContratos } from '../../firebase/acciones';
import { supabase } from '../../supabase/config';

const FormularioNuevoInquilino = ({ unidad, esEdicion, onExito, onCancelar }) => {
  const [loading, setLoading] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState(null);
  
  // ⭐ NUEVO: Estado para archivos
  const [archivos, setArchivos] = useState({
    ine: null,
    contrato: null,
    carta: null
  });
  
  const [uploadProgress, setUploadProgress] = useState({
    ine: false,
    contrato: false,
    carta: false
  });

  const [formData, setFormData] = useState({
    nombre_completo: "",
    telefono_contacto: "",
    telefono_emergencia: "",
    deposito_garantia_inicial: unidad?.renta_mensual || 0,
    dia_pago: 5,
    renta_actual: unidad?.renta_mensual || 0,
    fecha_inicio_contrato: "",
    fecha_fin_contrato: "",
    no_personas: 1,
    docs: { ine: "no", contrato: "no", carta: "no" },
    activo: true,
    acompanantes: [] 
  });

  const handleToggleDoc = (docKey) => {
    setFormData(prev => ({
      ...prev,
      docs: {
        ...prev.docs,
        [docKey]: prev.docs[docKey] === 'si' ? 'no' : 'si'
      }
    }));
  };

  // ⭐ NUEVA FUNCIÓN: Manejar selección de archivos
  const handleFileChange = (e, tipo) => {
    const file = e.target.files[0];
    
    if (!file) return;
    
    // Validar que sea PDF
    if (file.type !== 'application/pdf') {
      alert('❌ Solo se permiten archivos PDF');
      e.target.value = ''; // Resetear input
      return;
    }
    
    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('❌ El archivo no debe superar 5MB');
      e.target.value = '';
      return;
    }
    
    // Guardar archivo en estado
    setArchivos(prev => ({ ...prev, [tipo]: file }));
    
    // Marcar automáticamente el checkbox como "sí"
    setFormData(prev => ({
      ...prev,
      docs: {
        ...prev.docs,
        [tipo]: 'si'
      }
    }));
  };

  // ⭐ NUEVA FUNCIÓN: Subir archivo a Supabase
  const subirArchivo = async (file, tipo, inquilinoId) => {
    try {
      setUploadProgress(prev => ({ ...prev, [tipo]: true }));
      
      // Crear nombre único: unidad_inquilinoId_tipo_timestamp.pdf
      const timestamp = Date.now();
      const fileName = `${unidad.id}_${inquilinoId}_${tipo}_${timestamp}.pdf`;
      const filePath = `${unidad.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('documentos-inquilinos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error(`Error subiendo ${tipo}:`, error);
        throw error;
      }

      console.log(`✅ ${tipo} subido exitosamente:`, filePath);
      return filePath;
      
    } catch (error) {
      console.error(`❌ Error al subir ${tipo}:`, error);
      throw error;
    } finally {
      setUploadProgress(prev => ({ ...prev, [tipo]: false }));
    }
  };

  // ⭐ NUEVA FUNCIÓN: Actualizar URLs en Firestore
  const actualizarDocumentosInquilino = async (inquilinoId, urlsDocumentos) => {
    try {
      await updateDoc(doc(db, "inquilinos", inquilinoId), {
        urls_documentos: urlsDocumentos,
        fecha_actualizacion_docs: new Date()
      });
      console.log("✅ URLs de documentos actualizadas en Firestore");
    } catch (error) {
      console.error("❌ Error actualizando URLs:", error);
      throw error;
    }
  };

  useEffect(() => {
    const cargarDatosInquilino = async () => {
      if (esEdicion && unidad?.id_inquilino) {
        setLoading(true);
        try {
          const inqSnap = await getDoc(doc(db, "inquilinos", unidad.id_inquilino));
          
          if (inqSnap.exists()) {
            const d = inqSnap.data();
            let depositoVivo = d.deposito_garantia_inicial;

            if (d.id_contrato_actual) {
              const contratoSnap = await getDoc(doc(db, "contratos", d.id_contrato_actual));
              if (contratoSnap.exists()) {
                depositoVivo = contratoSnap.data().monto_deposito;
              }
            }

            const fmt = (f) => f?.seconds ? f.toDate().toISOString().split('T')[0] : f;

            setFormData({
              nombre_completo: d.nombre_completo || "",
              telefono_contacto: d.telefono_contacto || "",
              telefono_emergencia: d.telefono_emergencia || "",
              deposito_garantia_inicial: depositoVivo || 0, 
              dia_pago: d.dia_pago || 5,
              renta_actual: d.renta_actual || 0,
              fecha_inicio_contrato: fmt(d.fecha_inicio_contrato),
              fecha_fin_contrato: fmt(d.fecha_fin_contrato),
              no_personas: d.no_personas || 1,
              docs: d.docs || { ine: "no", carta: "no", contrato: "no" },
              acompanantes: d.acompanantes || [],
              id_contrato_actual: d.id_contrato_actual || "",
              activo: true
            });
          }
        } catch (error) {
          console.error("Error cargando inquilino:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    cargarDatosInquilino();
  }, [esEdicion, unidad]);

  const handleAddAcompanante = () => {
    setFormData(prev => ({
      ...prev,
      acompanantes: [...prev.acompanantes, ""],
      no_personas: prev.acompanantes.length + 2
    }));
  };

  const handleRemoveAcompanante = (index) => {
    const nuevos = formData.acompanantes.filter((_, i) => i !== index);
    setFormData(prev => ({ 
      ...prev, 
      acompanantes: nuevos,
      no_personas: nuevos.length + 1
    }));
  };

  const handleAcompananteChange = (index, value) => {
    const nuevos = [...formData.acompanantes];
    nuevos[index] = value;
    setFormData(prev => ({ ...prev, acompanantes: nuevos }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorValidacion) setErrorValidacion(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorValidacion(null);

    // ⭐ VALIDACIÓN 1: Renta debe ser mayor a 0
    if (parseFloat(formData.renta_actual) <= 0) {
      setErrorValidacion({
        error: "RENTA_INVALIDA",
        message: "La renta mensual debe ser mayor a $0",
        detalles: {
          sugerencia: "Ingresa el monto de renta acordado con el inquilino"
        }
      });
      setLoading(false);
      return;
    }

    // ⭐ VALIDACIÓN 2: Depósito debe ser mayor a 0
    if (parseFloat(formData.deposito_garantia_inicial) <= 0) {
      setErrorValidacion({
        error: "DEPOSITO_INVALIDO",
        message: "El depósito de garantía debe ser mayor a $0",
        detalles: {
          sugerencia: "Ingresa el monto del depósito de garantía acordado"
        }
      });
      setLoading(false);
      return;
    }

    // ⭐ VALIDACIÓN 3: Verificar fechas completas
    if (!formData.fecha_inicio_contrato || !formData.fecha_fin_contrato) {
      setErrorValidacion({
        error: "FECHAS_INCOMPLETAS",
        message: "Debes ingresar tanto la fecha de inicio como la fecha de fin del contrato",
        detalles: {
          sugerencia: "Completa ambas fechas antes de continuar"
        }
      });
      setLoading(false);
      return;
    }

    // ⭐ VALIDACIÓN 4: Verificar solapamiento de fechas
    try {
      const validacion = await validarSolapamientoContratos(
        unidad.id,
        formData.fecha_inicio_contrato,
        formData.fecha_fin_contrato,
        formData.id_contrato_actual
      );

      if (!validacion.valido) {
        setErrorValidacion({
          error: validacion.error,
          message: validacion.message || validacion.error,
          detalles: {
            contratosConflicto: validacion.contratosConflicto,
            sugerencia: "Ajusta las fechas para que no se solapen con contratos existentes en esta unidad"
          }
        });
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error("Error en validación de fechas:", error);
      alert("❌ Error al validar fechas: " + error.message);
      setLoading(false);
      return;
    }

    // ⭐ PROCEDER CON EL GUARDADO
    try {
      let resultado;
      
      if (esEdicion) {
        resultado = await actualizarInquilino(unidad.id_inquilino, unidad.id, formData);
      } else {
        resultado = await registrarNuevoInquilino(unidad.id, formData);
      }

      // Validaciones de respuesta del backend
      if (resultado && resultado.error === "NO_SE_PUEDE_MODIFICAR_FECHAS") {
        setErrorValidacion(resultado);
        setLoading(false);
        return;
      }
      
      if (resultado && resultado.error === "NO_SE_PUEDE_MODIFICAR_DEPOSITO") {
        setErrorValidacion(resultado);
        setLoading(false);
        return;
      }

      if (resultado && resultado.success === false && resultado.message) {
        throw new Error(resultado.message);
      }

      // ⭐ SUBIR ARCHIVOS A SUPABASE (después de guardar el inquilino)
      const inquilinoId = esEdicion ? unidad.id_inquilino : resultado.id_inquilino;
      const urlsDocumentos = {};
      let erroresSubida = [];

      for (const [tipo, file] of Object.entries(archivos)) {
        if (file) {
          try {
            const filePath = await subirArchivo(file, tipo, inquilinoId);
            urlsDocumentos[tipo] = filePath;
          } catch (error) {
            console.error(`Error subiendo ${tipo}:`, error);
            erroresSubida.push(tipo);
          }
        }
      }

      // Actualizar Firestore con las URLs de los documentos
      if (Object.keys(urlsDocumentos).length > 0) {
        try {
          await actualizarDocumentosInquilino(inquilinoId, urlsDocumentos);
        } catch (error) {
          console.error("Error guardando URLs en Firestore:", error);
        }
      }

      // Mensaje de éxito
      if (erroresSubida.length > 0) {
        alert(`✅ Inquilino guardado correctamente\n⚠️ Algunos documentos no se pudieron subir: ${erroresSubida.join(', ')}`);
      } else if (Object.keys(urlsDocumentos).length > 0) {
        alert(`✅ Guardado correctamente con ${Object.keys(urlsDocumentos).length} documento(s)`);
      } else {
        alert("✅ Guardado correctamente");
      }

      onExito();
      
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("❌ Error al guardar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-white p-6 rounded-xl border-2 shadow-xl animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto ${esEdicion ? 'border-amber-500' : 'border-blue-500'}`}>
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-black text-gray-800 uppercase italic">
            {esEdicion ? "Editar Datos de:" : "Asignar Inquilino a:"} <span className={esEdicion ? "text-amber-600" : "text-blue-600"}>{unidad.id}</span>
          </h3>
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${esEdicion ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
            {esEdicion ? "Modo Edición de Perfil" : "Nuevo Registro Activo"}
          </span>
        </div>
        <button onClick={onCancelar} disabled={loading} className="text-gray-400 hover:text-red-500 font-bold">✖</button>
      </div>

      {/* PANEL DE ERRORES DE VALIDACIÓN */}
      {errorValidacion && (
        <div className="mb-6 bg-red-50 border-2 border-red-500 rounded-xl p-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🚨</span>
            <div className="flex-1">
              <h4 className="text-sm font-black text-red-700 uppercase mb-2">
                {errorValidacion.error === "RENTA_INVALIDA" && "Renta inválida"}
                {errorValidacion.error === "DEPOSITO_INVALIDO" && "Depósito inválido"}
                {errorValidacion.error === "FECHAS_INCOMPLETAS" && "Fechas incompletas"}
                {errorValidacion.error === "SOLAPAMIENTO_CONTRATOS" && "⚠️ Conflicto de fechas detectado"}
                {errorValidacion.error === "NO_SE_PUEDE_MODIFICAR_FECHAS" && "No se pueden modificar las fechas del contrato"}
                {errorValidacion.error === "NO_SE_PUEDE_MODIFICAR_DEPOSITO" && "No se puede modificar el depósito"}
                {!errorValidacion.error && "Error de validación"}
              </h4>
              <p className="text-xs text-red-600 mb-3">
                {errorValidacion.message}
              </p>
              
              {errorValidacion.detalles?.contratosConflicto && (
                <div className="bg-white rounded-lg p-3 border border-red-200 mb-3">
                  <p className="text-[10px] font-black text-gray-500 uppercase mb-2">
                    📋 Contratos que se solapan en la unidad {unidad.id}:
                  </p>
                  <div className="space-y-2">
                    {errorValidacion.detalles.contratosConflicto.map((c, idx) => (
                      <div key={idx} className="bg-red-50 p-3 rounded border border-red-200">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-red-700">
                            👤 {c.inquilino}
                          </span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                            c.estatus === 'activo' ? 'bg-green-100 text-green-700' : 
                            c.estatus === 'finalizado' ? 'bg-gray-100 text-gray-600' : 
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {c.estatus.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-600 font-medium">
                          📅 {c.inicio.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} 
                          {' → '}
                          {c.fin.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-[9px] text-gray-400 italic mt-1">
                          ID: {c.id.slice(-8)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {errorValidacion.detalles?.deposito_actual !== undefined && (
                <div className="bg-white rounded-lg p-3 border border-red-200 mb-3">
                  <p className="text-[10px] font-black text-gray-500 uppercase mb-2">
                    Valores del depósito:
                  </p>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Depósito actual:</span>
                    <span className="font-black text-red-700">${errorValidacion.detalles.deposito_actual.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Depósito intentado:</span>
                    <span className="font-black text-orange-600">${errorValidacion.detalles.deposito_intentado.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {errorValidacion.detalles?.periodos_afectados && (
                <div className="bg-white rounded-lg p-3 border border-red-200">
                  <p className="text-[10px] font-black text-gray-500 uppercase mb-2">
                    Periodos con pagos registrados:
                  </p>
                  <div className="space-y-1">
                    {errorValidacion.detalles.periodos_afectados.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[10px] bg-red-50 p-2 rounded">
                        <span className="font-bold text-red-700">{p.periodo}</span>
                        <span className="text-gray-600">
                          Pagado: ${p.monto_pagado.toLocaleString()} • {p.estatus.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2">
                <p className="text-[10px] font-bold text-amber-700">
                  💡 {errorValidacion.detalles?.sugerencia}
                </p>
              </div>

              <button
                onClick={() => setErrorValidacion(null)}
                className="mt-3 w-full bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-black uppercase hover:bg-red-700 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORMULARIO */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Nombre Completo</label>
            <input 
              required 
              name="nombre_completo" 
              value={formData.nombre_completo} 
              disabled={loading} 
              className="w-full p-2 bg-gray-50 border rounded-lg font-bold outline-blue-500" 
              onChange={handleChange} 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Tel. Contacto</label>
            <input 
              required 
              name="telefono_contacto" 
              value={formData.telefono_contacto} 
              disabled={loading} 
              className="w-full p-2 bg-gray-50 border rounded-lg outline-blue-500" 
              onChange={handleChange} 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Tel. Emergencia</label>
            <input 
              name="telefono_emergencia" 
              value={formData.telefono_emergencia} 
              disabled={loading} 
              className="w-full p-2 bg-gray-50 border rounded-lg outline-blue-500" 
              onChange={handleChange} 
            />
          </div>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg border ${esEdicion ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
          <div>
            <label className={`text-[10px] font-black uppercase ${esEdicion ? 'text-amber-600' : 'text-blue-500'}`}>Renta Acordada</label>
            <input 
              type="number" 
              name="renta_actual" 
              disabled={loading} 
              value={formData.renta_actual} 
              className={`w-full p-2 border-0 rounded-lg font-bold shadow-sm ${
                errorValidacion?.error === "RENTA_INVALIDA" 
                  ? 'bg-red-100 text-red-700 ring-2 ring-red-500' 
                  : esEdicion ? 'text-amber-700' : 'text-blue-600'
              }`} 
              onChange={handleChange} 
            />
          </div>
          <div>
            <label className={`text-[10px] font-black uppercase ${esEdicion ? 'text-amber-600' : 'text-blue-500'}`}>Depósito</label>
            <input 
              type="number" 
              name="deposito_garantia_inicial" 
              disabled={loading} 
              value={formData.deposito_garantia_inicial} 
              className={`w-full p-2 border-0 rounded-lg font-bold shadow-sm ${
                errorValidacion?.error === "NO_SE_PUEDE_MODIFICAR_DEPOSITO" || errorValidacion?.error === "DEPOSITO_INVALIDO"
                  ? 'bg-red-100 text-red-700 ring-2 ring-red-500' 
                  : esEdicion ? 'text-amber-700' : 'text-blue-600'
              }`} 
              onChange={handleChange} 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-red-500 uppercase italic">Día de Pago</label>
            <input 
              type="number" 
              name="dia_pago" 
              disabled={loading} 
              value={formData.dia_pago} 
              className="w-full p-2 border-0 rounded-lg font-black text-red-600 shadow-sm" 
              onChange={handleChange} 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase">Personas</label>
            <input 
              type="number" 
              name="no_personas" 
              disabled={loading} 
              value={formData.no_personas} 
              className="w-full p-2 border-0 rounded-lg font-bold shadow-sm" 
              onChange={handleChange} 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Inicio Contrato</label>
            <input 
              required 
              type="date" 
              name="fecha_inicio_contrato" 
              value={formData.fecha_inicio_contrato} 
              disabled={loading} 
              className={`w-full p-2 border rounded-lg shadow-sm ${
                errorValidacion?.error === "SOLAPAMIENTO_CONTRATOS" || errorValidacion?.error === "FECHAS_INCOMPLETAS" || errorValidacion?.error === "NO_SE_PUEDE_MODIFICAR_FECHAS"
                  ? 'border-red-500 bg-red-50 ring-2 ring-red-500' 
                  : ''
              }`}
              onChange={handleChange} 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Fin Contrato</label>
            <input 
              required 
              type="date" 
              name="fecha_fin_contrato" 
              value={formData.fecha_fin_contrato} 
              disabled={loading} 
              className={`w-full p-2 border rounded-lg shadow-sm ${
                errorValidacion?.error === "SOLAPAMIENTO_CONTRATOS" || errorValidacion?.error === "FECHAS_INCOMPLETAS" || errorValidacion?.error === "NO_SE_PUEDE_MODIFICAR_FECHAS"
                  ? 'border-red-500 bg-red-50 ring-2 ring-red-500' 
                  : ''
              }`}
              onChange={handleChange} 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Documentos Listos</label>
            <div className="flex gap-4 mt-2">
              {['ine', 'carta', 'contrato'].map(doc => (
                <label key={doc} className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={formData.docs[doc] === 'si'}
                    onChange={() => handleToggleDoc(doc)}
                  />
                  <span className="text-[10px] font-black text-gray-500 uppercase group-hover:text-blue-600 transition-colors">
                    {doc}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ⭐ NUEVA SECCIÓN: Upload de documentos PDF */}
        <div className="space-y-3 bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
            <span>📎 Subir Documentos Digitales (PDF)</span>
            {(uploadProgress.ine || uploadProgress.contrato || uploadProgress.carta) && (
              <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                Subiendo...
              </span>
            )}
          </label>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['ine', 'contrato', 'carta'].map(doc => (
              <div key={doc} className="bg-white p-3 rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all">
                <label className="flex flex-col gap-2 cursor-pointer group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-gray-700 uppercase">
                      {doc === 'ine' && '🪪 INE / Identificación'}
                      {doc === 'contrato' && '📄 Contrato Firmado'}
                      {doc === 'carta' && '✉️ Carta Responsiva'}
                    </span>
                    {archivos[doc] && !uploadProgress[doc] && (
                      <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                        ✓ LISTO
                      </span>
                    )}
                  </div>
                  
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFileChange(e, doc)}
                    className="hidden"
                    disabled={loading || uploadProgress[doc]}
                  />
                  
                  <div className={`border-2 border-dashed rounded-lg p-3 text-center transition-all ${
                    uploadProgress[doc] 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 group-hover:border-blue-500 group-hover:bg-blue-50'
                  }`}>
                    {uploadProgress[doc] ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] text-blue-600 font-bold">Subiendo...</span>
                      </div>
                    ) : archivos[doc] ? (
                      <div>
                        <p className="text-[10px] font-bold text-gray-700 truncate">
                          {archivos[doc].name}
                        </p>
                        <p className="text-[9px] text-gray-400">
                          {(archivos[doc].size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl">📤</span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          Click para subir PDF
                        </span>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            ))}
          </div>
          
          <p className="text-[9px] text-gray-500 italic flex items-center gap-1">
            <span>ℹ️</span>
            <span>Máximo 5MB por archivo • Solo formato PDF • Los archivos se suben después de guardar</span>
          </p>
        </div>

        <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Acompañantes / Habitantes adicionales
            </label>
            <button 
              type="button" 
              onClick={handleAddAcompanante}
              className="text-[10px] bg-gray-800 text-white px-3 py-1 rounded-full font-bold hover:bg-black transition-colors"
            >
              + AGREGAR PERSONA
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {formData.acompanantes.map((nombre, index) => (
              <div key={index} className="flex gap-2 animate-in slide-in-from-left-2 duration-200">
                <input
                  placeholder="Nombre del acompañante"
                  className="flex-1 p-2 text-sm border rounded-lg outline-blue-500 font-medium"
                  value={nombre}
                  onChange={(e) => handleAcompananteChange(index, e.target.value)}
                />
                <button 
                  type="button" 
                  onClick={() => handleRemoveAcompanante(index)}
                  className="text-red-400 hover:text-red-600 px-2"
                >
                  ✖
                </button>
              </div>
            ))}
          </div>
          {formData.acompanantes.length === 0 && (
            <p className="text-[10px] text-gray-400 italic text-center">No hay acompañantes registrados</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button 
            type="button" 
            onClick={onCancelar} 
            disabled={loading} 
            className="px-6 py-2 text-xs font-bold text-gray-400 hover:text-gray-600 uppercase"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className={`px-10 py-2 rounded-xl text-xs font-black uppercase shadow-lg transition-all ${
              loading 
                ? "bg-gray-400 cursor-not-allowed" 
                : esEdicion 
                  ? "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200" 
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
            }`}
          >
            {loading ? "Procesando..." : esEdicion ? "Guardar Cambios" : "Guardar e Imprimir Contrato"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormularioNuevoInquilino;