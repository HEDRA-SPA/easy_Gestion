import React, { useState } from 'react';
import { registrarNuevoInquilino } from '../../firebase/acciones'; 

const FormularioNuevoInquilino = ({ unidad, onExito, onCancelar }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre_completo: "",
    telefono_contacto: "",
    telefono_emergencia: "",
    deposito_garantia: unidad.renta_mensual || 0,
    dia_pago: 5,
    renta_actual: unidad.renta_mensual || 0,
    fecha_inicio_contrato: "",
    fecha_fin_contrato: "",
    no_personas: 1,
    docs: { ine: "no", contrato: "no", carta: "no" },
    activo: true, // <--- Nuevo campo: El inquilino nace activo
    acompanantes: [] // <--- Estructura completa para evitar errores en consultas
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleDoc = (doc) => {
    setFormData(prev => ({
      ...prev,
      docs: { ...prev.docs, [doc]: prev.docs[doc] === "si" ? "no" : "si" }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Pasamos el objeto completo con activo: true
      const resultado = await registrarNuevoInquilino(unidad.id, formData);
      if (resultado.success) {
        onExito(); 
      }
    } catch (error) {
      alert("Error al guardar en Firebase.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border-2 border-blue-500 shadow-xl animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
      {/* CABECERA */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-black text-gray-800 uppercase italic">
            Asignar Inquilino a: <span className="text-blue-600">{unidad.id}</span>
          </h3>
          <span className="text-[9px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-black uppercase">
            Nuevo Registro Activo
          </span>
        </div>
        <button 
          onClick={onCancelar} 
          disabled={loading}
          className="text-gray-400 hover:text-red-500 font-bold"
        >
          ✖
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECCIÓN 1: DATOS PERSONALES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Nombre Completo</label>
            <input required name="nombre_completo" disabled={loading} className="w-full p-2 bg-gray-50 border rounded-lg font-bold outline-blue-500" onChange={handleChange} />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Tel. Contacto</label>
            <input required name="telefono_contacto" disabled={loading} className="w-full p-2 bg-gray-50 border rounded-lg outline-blue-500" onChange={handleChange} />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Tel. Emergencia</label>
            <input name="telefono_emergencia" disabled={loading} className="w-full p-2 bg-gray-50 border rounded-lg outline-blue-500" onChange={handleChange} />
          </div>
        </div>

        {/* SECCIÓN 2: FINANZAS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div>
            <label className="text-[10px] font-black text-blue-500 uppercase">Renta Acordada</label>
            <input type="number" name="renta_actual" disabled={loading} value={formData.renta_actual} className="w-full p-2 border-0 rounded-lg font-bold text-blue-600 shadow-sm" onChange={handleChange} />
          </div>
          <div>
            <label className="text-[10px] font-black text-blue-500 uppercase">Depósito</label>
            <input type="number" name="deposito_garantia" disabled={loading} value={formData.deposito_garantia} className="w-full p-2 border-0 rounded-lg font-bold text-blue-600 shadow-sm" onChange={handleChange} />
          </div>
          <div>
            <label className="text-[10px] font-black text-red-500 uppercase italic">Día de Pago</label>
            <input type="number" name="dia_pago" disabled={loading} value={formData.dia_pago} className="w-full p-2 border-0 rounded-lg font-black text-red-600 shadow-sm" onChange={handleChange} />
          </div>
          <div>
            <label className="text-[10px] font-black text-blue-500 uppercase">Personas</label>
            <input type="number" name="no_personas" disabled={loading} value={formData.no_personas} className="w-full p-2 border-0 rounded-lg font-bold shadow-sm" onChange={handleChange} />
          </div>
        </div>

        {/* SECCIÓN 3: CONTRATO Y DOCS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Inicio Contrato</label>
            <input required type="date" name="fecha_inicio_contrato" disabled={loading} className="w-full p-2 border rounded-lg shadow-sm" onChange={handleChange} />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Fin Contrato</label>
            <input required type="date" name="fecha_fin_contrato" disabled={loading} className="w-full p-2 border rounded-lg shadow-sm" onChange={handleChange} />
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

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onCancelar} disabled={loading} className="px-6 py-2 text-xs font-bold text-gray-400 hover:text-gray-600 uppercase">
            Cancelar
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className={`px-10 py-2 rounded-xl text-xs font-black uppercase shadow-lg transition-all ${
              loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
            }`}
          >
            {loading ? "Registrando..." : "Guardar e Imprimir Contrato"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormularioNuevoInquilino;