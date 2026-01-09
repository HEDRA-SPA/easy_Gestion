import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { registrarPagoFirebase } from '../firebase/acciones';

const FormularioRegistroPago = ({ unidad, pagosExistentes = [], onExito, onCancelar }) => {
  const LIMITE_SERVICIO = 250;
  const [loading, setLoading] = useState(false);
  const [contratoActivo, setContratoActivo] = useState(null);

  const [formData, setFormData] = useState({
    periodo: "",
    monto_recibido: 0,
    agua_lectura: 0,
    luz_lectura: 0,
    medio_pago: "transferencia",
    fecha_pago: new Date().toISOString().split('T')[0] // Fecha en la que el inquilino pagó
  });

  // Obtener contrato activo
  useEffect(() => {
    const obtenerContrato = async () => {
      const q = query(
        collection(db, "contratos"), 
        where("id_unidad", "==", unidad.id), 
        where("estatus", "==", "activo")
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setContratoActivo({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    };
    obtenerContrato();
  }, [unidad.id]);

  // Calcular estado financiero del mes seleccionado
  const estadoFinancieroMes = useMemo(() => {
    if (!formData.periodo) {
      return { totalEsperado: 0, abonado: 0, pendiente: 0, existeRegistro: false };
    }

    const pSel = formData.periodo.trim();
    const pagosDeEsteMes = (pagosExistentes || []).filter(p => String(p.periodo || "").trim() === pSel);
    const totalYaAbonado = pagosDeEsteMes.reduce((acc, curr) => acc + Number(curr.monto_pagado || 0), 0);
    const registroOriginal = pagosDeEsteMes.find(p => Number(p.total_esperado_periodo) > 0);

    if (registroOriginal) {
      const esperado = Number(registroOriginal.total_esperado_periodo);
      return {
        totalEsperado: esperado,
        abonado: totalYaAbonado,
        pendiente: Math.max(0, esperado - totalYaAbonado),
        existeRegistro: true,
        aguaOriginal: registroOriginal.servicios?.agua_lectura || 0,
        luzOriginal: registroOriginal.servicios?.luz_lectura || 0
      };
    } else {
      const rentaBase = Number(contratoActivo?.monto_renta || unidad?.renta_mensual || 0);
      const excAgua = Math.max(0, Number(formData.agua_lectura) - LIMITE_SERVICIO);
      const excLuz = Math.max(0, Number(formData.luz_lectura) - LIMITE_SERVICIO);
      const totalCalculado = rentaBase + excAgua + excLuz;

      return {
        totalEsperado: totalCalculado,
        abonado: 0,
        pendiente: totalCalculado,
        existeRegistro: false
      };
    }
  }, [formData.periodo, formData.agua_lectura, formData.luz_lectura, pagosExistentes, contratoActivo, unidad]);

  useEffect(() => {
    if (formData.periodo && estadoFinancieroMes.pendiente > 0) {
      setFormData(prev => ({ ...prev, monto_recibido: estadoFinancieroMes.pendiente }));
    }
  }, [estadoFinancieroMes.pendiente, formData.periodo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.monto_recibido <= 0) return alert("Ingrese un monto válido");
    setLoading(true);

    try {
      const [anio, mes] = formData.periodo.split('-').map(Number);
      
      const pData = {
        periodo: formData.periodo,
        anio, mes,
        id_unidad: unidad.id,
        id_inquilino: unidad.id_inquilino,
        id_contrato: contratoActivo?.id || "sin_contrato",
        monto_pagado: Number(formData.monto_recibido),
        total_esperado_periodo: estadoFinancieroMes.totalEsperado,
        saldo_restante_periodo: Math.max(0, estadoFinancieroMes.pendiente - Number(formData.monto_recibido)),
        estatus: (estadoFinancieroMes.pendiente - Number(formData.monto_recibido)) <= 0 ? "pagado" : "parcial",
        medio_pago: formData.medio_pago,
        // Usamos la fecha capturada manualmente para el registro histórico
        fecha_pago_realizado: new Date(formData.fecha_pago + "T12:00:00"),
        fecha_registro: new Date(), // Fecha de auditoría (cuando se pica el botón)
        servicios: {
          agua_lectura: estadoFinancieroMes.existeRegistro ? estadoFinancieroMes.aguaOriginal : formData.agua_lectura,
          luz_lectura: estadoFinancieroMes.existeRegistro ? estadoFinancieroMes.luzOriginal : formData.luz_lectura
        }
      };

      await registrarPagoFirebase(pData);
      onExito();
    } catch (error) {
      alert("Error al registrar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border-2 border-green-600 shadow-xl max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* FILA SUPERIOR: Periodo y Fecha de Pago */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-900 p-2 rounded text-white text-center">
            <label className="text-[9px] font-black uppercase block opacity-70">Periodo</label>
            <select 
              className="w-full bg-transparent font-bold text-sm outline-none cursor-pointer"
              value={formData.periodo}
              onChange={(e) => setFormData({...formData, periodo: e.target.value})}
              required
            >
              <option value="" className="text-black">-- MES --</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={`2025-${m < 10 ? '0'+m : m}`} className="text-black">
                  {new Date(2025, m-1).toLocaleDateString('es-MX', {month: 'short'}).toUpperCase()} 2025
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gray-100 p-2 rounded border border-gray-300 text-center">
            <label className="text-[9px] font-black text-gray-500 uppercase block">¿Cuándo pagó?</label>
            <input 
              type="date"
              className="w-full bg-transparent font-bold text-xs outline-none text-center"
              value={formData.fecha_pago}
              onChange={(e) => setFormData({...formData, fecha_pago: e.target.value})}
              required
            />
          </div>
        </div>

        {/* Sección de Lecturas */}
        <div className={`p-3 rounded-lg border-2 ${estadoFinancieroMes.existeRegistro ? 'bg-gray-100 border-gray-300' : 'bg-blue-50 border-blue-200'}`}>
          <p className="text-[10px] font-black text-blue-700 mb-2 uppercase italic text-center">
            {estadoFinancieroMes.existeRegistro ? "⚡ Lecturas fijadas" : "📝 Lecturas del Mes"}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <span className="text-[8px] font-bold text-gray-400 block uppercase">Agua</span>
              <input 
                type="number" className="w-full p-1 border rounded font-black text-center text-sm"
                value={estadoFinancieroMes.existeRegistro ? estadoFinancieroMes.aguaOriginal : formData.agua_lectura}
                onChange={(e) => setFormData({...formData, agua_lectura: Number(e.target.value)})}
                disabled={estadoFinancieroMes.existeRegistro}
              />
            </div>
            <div className="text-center">
              <span className="text-[8px] font-bold text-gray-400 block uppercase">Luz</span>
              <input 
                type="number" className="w-full p-1 border rounded font-black text-center text-sm"
                value={estadoFinancieroMes.existeRegistro ? estadoFinancieroMes.luzOriginal : formData.luz_lectura}
                onChange={(e) => setFormData({...formData, luz_lectura: Number(e.target.value)})}
                disabled={estadoFinancieroMes.existeRegistro}
              />
            </div>
          </div>
        </div>

        {/* Resumen Financiero */}
        <div className="bg-gray-900 p-4 rounded-xl text-white">
          <div className="flex justify-between text-[10px] opacity-70">
            <span>TOTAL ESPERADO:</span>
            <span>${estadoFinancieroMes.totalEsperado.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[10px] text-blue-400 mt-1">
            <span>YA ABONADO:</span>
            <span>-${estadoFinancieroMes.abonado.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center mt-2 border-t border-gray-700 pt-2">
            <span className="text-xs font-bold uppercase">Saldo Pendiente:</span>
            <span className="text-2xl font-black text-green-400">${estadoFinancieroMes.pendiente.toLocaleString()}</span>
          </div>
        </div>

        {/* Monto y Medio de Pago */}
        <div className="bg-amber-50 p-4 rounded-xl border-2 border-amber-200 relative">
          <label className="text-center block text-[10px] font-black text-amber-700 uppercase mb-1">Monto a recibir hoy</label>
          <input 
            type="number" 
            className="w-full text-center text-4xl font-black bg-transparent text-amber-900 outline-none"
            value={formData.monto_recibido || ""}
            onChange={(e) => setFormData({...formData, monto_recibido: Number(e.target.value)})}
          />
          <div className="mt-2 pt-2 border-t border-amber-200 flex justify-center">
             <select 
              className="bg-transparent text-[10px] font-bold uppercase text-amber-800 outline-none"
              value={formData.medio_pago}
              onChange={(e) => setFormData({...formData, medio_pago: e.target.value})}
             >
               <option value="transferencia">Transferencia</option>
               <option value="efectivo">Efectivo</option>
               <option value="deposito">Depósito</option>
             </select>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading || !formData.periodo}
          className="w-full bg-green-600 py-4 rounded-xl text-white font-black uppercase hover:bg-green-700 transition-all shadow-lg disabled:bg-gray-400"
        >
          {loading ? "PROCESANDO..." : "CONFIRMAR REGISTRO"}
        </button>
      </form>
    </div>
  );
};

export default FormularioRegistroPago;