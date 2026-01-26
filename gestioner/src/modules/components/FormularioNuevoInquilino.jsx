import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { registrarNuevoInquilino, actualizarInquilino } from '../../firebase/acciones'; 

const FormularioNuevoInquilino = ({ unidad, esEdicion, onExito, onCancelar }) => {
  const [loading, setLoading] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState(null);
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

  useEffect(() => {
    const cargarDatosInquilino = async () => {
      if (esEdicion && unidad?.id_inquilino) {
        setLoading(true);
        try {
          const inqSnap = await getDoc(doc(db, "inquilinos", unidad.id_inquilino));
          if (inqSnap.exists()) {
            const d = inqSnap.data();
            const fmt = (f) => f?.seconds ? f.toDate().toISOString().split('T')[0] : f;

            setFormData({
              nombre_completo: d.nombre_completo || "",
              telefono_contacto: d.telefono_contacto || "",
              telefono_emergencia: d.telefono_emergencia || "",
              deposito_garantia_inicial: d.deposito_garantia_inicial || 0,
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

    try {
      let resultado;
      
      if (esEdicion) {
        resultado = await actualizarInquilino(unidad.id_inquilino, unidad.id, formData);
      } else {
        resultado = await registrarNuevoInquilino(unidad.id, formData);
      }

      if (resultado && !resultado.success) {
        if (resultado.error === "NO_SE_PUEDE_MODIFICAR_FECHAS" || resultado.error === "NO_SE_PUEDE_MODIFICAR_DEPOSITO") {
          setErrorValidacion(resultado);
          return;
        }
        throw new Error(resultado.message || "Error desconocido");
      }

      alert("✅ Guardado correctamente");
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

      {errorValidacion && (
        <div className="mb-6 bg-red-50 border-2 border-red-500 rounded-xl p-4 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🚨</span>
            <div className="flex-1">
              <h4 className="text-sm font-black text-red-700 uppercase mb-2">
                No se pueden modificar las fechas del contrato
              </h4>
              <p className="text-xs text-red-600 mb-3">
                {errorValidacion.message}
              </p>
              
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

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Nombre Completo</label>
            <input required name="nombre_completo" value={formData.nombre_completo} disabled={loading} className="w-full p-2 bg-gray-50 border rounded-lg font-bold outline-blue-500" onChange={handleChange} />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Tel. Contacto</label>
            <input required name="telefono_contacto" value={formData.telefono_contacto} disabled={loading} className="w-full p-2 bg-gray-50 border rounded-lg outline-blue-500" onChange={handleChange} />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Tel. Emergencia</label>
            <input name="telefono_emergencia" value={formData.telefono_emergencia} disabled={loading} className="w-full p-2 bg-gray-50 border rounded-lg outline-blue-500" onChange={handleChange} />
          </div>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg border ${esEdicion ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
          <div>
            <label className={`text-[10px] font-black uppercase ${esEdicion ? 'text-amber-600' : 'text-blue-500'}`}>Renta Acordada</label>
            <input type="number" name="renta_actual" disabled={loading} value={formData.renta_actual} className={`w-full p-2 border-0 rounded-lg font-bold shadow-sm ${esEdicion ? 'text-amber-700' : 'text-blue-600'}`} onChange={handleChange} />
          </div>
          <div>
            <label className={`text-[10px] font-black uppercase ${esEdicion ? 'text-amber-600' : 'text-blue-500'}`}>Depósito</label>
            <input 
              type="number" 
              name="deposito_garantia_inicial" 
              disabled={loading} 
              value={formData.deposito_garantia_inicial} 
              className={`w-full p-2 border-0 rounded-lg font-bold shadow-sm ${
                errorValidacion?.error === "NO_SE_PUEDE_MODIFICAR_DEPOSITO" 
                  ? 'bg-red-100 text-red-700 ring-2 ring-red-500' 
                  : esEdicion ? 'text-amber-700' : 'text-blue-600'
              }`} 
              onChange={handleChange} 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-red-500 uppercase italic">Día de Pago</label>
            <input type="number" name="dia_pago" disabled={loading} value={formData.dia_pago} className="w-full p-2 border-0 rounded-lg font-black text-red-600 shadow-sm" onChange={handleChange} />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase">Personas</label>
            <input type="number" name="no_personas" disabled={loading} value={formData.no_personas} className="w-full p-2 border-0 rounded-lg font-bold shadow-sm" onChange={handleChange} />
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
              className={`w-full p-2 border rounded-lg shadow-sm ${errorValidacion ? 'border-red-500 bg-red-50' : ''}`}
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
              className={`w-full p-2 border rounded-lg shadow-sm ${errorValidacion ? 'border-red-500 bg-red-50' : ''}`}
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
          <button type="button" onClick={onCancelar} disabled={loading} className="px-6 py-2 text-xs font-bold text-gray-400 hover:text-gray-600 uppercase">
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