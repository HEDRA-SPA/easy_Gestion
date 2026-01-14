import React, { useState } from 'react';
import { renovarInquilinoDesdeArchivo } from '../../firebase/acciones'; 

const FormularioRenovacionArchivo = ({ inquilino, unidadesDisponibles, onExito, onCancelar }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id_unidad_nueva: "",
    renta_actual: inquilino.renta_actual || 0,
    fecha_inicio_contrato: "",
    fecha_fin_contrato: "",
    dia_pago: inquilino.dia_pago || 5,
    deposito_garantia: inquilino.deposito_garantia || 0,
    no_personas: inquilino.no_personas || 1,
  });
const handleSubmit = async (e) => {
  e.preventDefault();
  if (!formData.id_unidad_nueva) return alert("Por favor, selecciona una unidad.");
  
  setLoading(true);
  try {
    await renovarInquilinoDesdeArchivo(
      inquilino.id, 
      formData.id_unidad_nueva, 
      {
        ...formData,
        nombre_completo: inquilino.nombre_completo,
        deposito_garantia: inquilino.deposito_garantia
      }
    );
    
    alert("¡Inquilino re-activado con éxito!");
    onExito(); // Esto cerrará el modal
  } catch (error) {
    console.error(error);
    alert("Error al escribir en la base de datos.");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="bg-white p-8 rounded-3xl border-2 border-blue-600 shadow-2xl max-w-lg w-full">
      <div className="mb-6 text-center">
        <h3 className="text-xl font-black uppercase italic text-gray-800">Re-activar Contrato</h3>
        <p className="text-blue-600 font-bold text-xs uppercase">{inquilino.nombre_completo}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* SELECCIÓN DE UNIDAD */}
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase">Asignar a Unidad:</label>
          <select 
            required
            className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-sm outline-blue-500"
            value={formData.id_unidad_nueva}
            onChange={(e) => setFormData({...formData, id_unidad_nueva: e.target.value})}
          >
            <option value="">Seleccionar unidad vacía...</option>
            {unidadesDisponibles.filter(u => !u.id_inquilino).map(u => (
              <option key={u.id} value={u.id}>{u.id} - ({u.tipo || 'Habitación'})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Nueva Renta</label>
            <input 
              type="number" 
              className="w-full p-3 bg-gray-50 border rounded-xl font-bold"
              value={formData.renta_actual}
              onChange={(e) => setFormData({...formData, renta_actual: e.target.value})}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Día de Pago</label>
            <input 
              type="number" 
              className="w-full p-3 bg-gray-50 border rounded-xl font-bold"
              value={formData.dia_pago}
              onChange={(e) => setFormData({...formData, dia_pago: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Inicio</label>
            <input 
              required
              type="date" 
              className="w-full p-3 bg-gray-50 border rounded-xl text-xs font-bold"
              onChange={(e) => setFormData({...formData, fecha_inicio_contrato: e.target.value})}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Fin</label>
            <input 
              required
              type="date" 
              className="w-full p-3 bg-gray-50 border rounded-xl text-xs font-bold"
              onChange={(e) => setFormData({...formData, fecha_fin_contrato: e.target.value})}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onCancelar} className="flex-1 py-3 text-[10px] font-black uppercase text-gray-400">Cancelar</button>
          <button 
            type="submit" 
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-200"
          >
            {loading ? "Procesando..." : "Confirmar Re-ingreso"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormularioRenovacionArchivo;