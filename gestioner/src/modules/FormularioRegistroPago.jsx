import React, { useState, useEffect } from 'react';
import { registrarPagoFirebase } from '../firebase/acciones';

const FormularioRegistroPago = ({ unidad, onExito, onCancelar }) => {
  const LIMITE_SERVICIO = 250;
  const [loading, setLoading] = useState(false);
  
  // 1. Función para generar los periodos del contrato (YYYY-MM)
  const generarOpcionesPeriodo = () => {
    if (!unidad?.fecha_inicio) return []; // O usar fechas por defecto si no hay contrato
    
    const opciones = [];
    const inicio = new Date(unidad.fecha_inicio);
    const fin = new Date(unidad.fecha_fin || new Date().setFullYear(inicio.getFullYear() + 1));
    
    let actual = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    const limite = new Date(fin.getFullYear(), fin.getMonth(), 1);

    while (actual <= limite) {
      const valor = `${actual.getFullYear()}-${String(actual.getMonth() + 1).padStart(2, '0')}`;
      const etiqueta = actual.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
      opciones.push({ valor, etiqueta });
      actual.setMonth(actual.getMonth() + 1);
    }
    return opciones;
  };

  const periodosDisponibles = generarOpcionesPeriodo();

  const [formData, setFormData] = useState({
    monto_renta: unidad?.renta_mensual || 0,
    agua_lectura: 0,
    luz_lectura: 0,
    medio_pago: "transferencia",
    fecha_pago_realizado: new Date().toISOString().split('T')[0],
    monto_recibido: totalAPagar,
    periodo_seleccionado: periodosDisponibles[0]?.valor || "", // Default al primer mes del contrato
    notas: ""
  });

  const excedenteAgua = Math.max(0, formData.agua_lectura - LIMITE_SERVICIO);
  const excedenteLuz = Math.max(0, formData.luz_lectura - LIMITE_SERVICIO);
  const excedenteTotal = excedenteAgua + excedenteLuz;
  const totalAPagar = formData.monto_renta + excedenteTotal;
  const saldoPendiente = totalAPagar - formData.monto_recibido;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Extraemos año y mes del periodo seleccionado (ej: "2025-06")
      const [anio, mes] = formData.periodo_seleccionado.split('-').map(Number);

      const objetoPago = {
        anio,
        mes,
        periodo: formData.periodo_seleccionado, // Ej: "2025-06"
        id_unidad: unidad.id,
        id_inquilino: unidad.id_inquilino,
        id_contrato: unidad.id_contrato_activo || "sin_contrato_vinculado", 
        monto_renta: formData.monto_renta,
        monto_pagado: totalAPagar,
        medio_pago: formData.medio_pago,
        saldo_pendiente: saldoPendiente,
        estatus: saldoPendiente <= 0 ? "pagado" : "parcial",
        fecha_pago_realizado: formData.fecha_pago_realizado, 
        servicios: {
          agua_lectura: formData.agua_lectura,
          luz_lectura: formData.luz_lectura,
          excedente_total: excedenteTotal
        },
        notas: formData.notas
      };
      
      await registrarPagoFirebase(objetoPago);
      alert("✅ Pago registrado con éxito");
      onExito();
    } catch (error) {
      alert("❌ Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="bg-white p-6 rounded-xl border-2 border-green-500 shadow-2xl max-w-lg mx-auto">
      <h3 className="text-lg font-black text-gray-800 uppercase mb-4 flex items-center gap-2">
        <span className="bg-green-100 p-1 rounded">💵</span> Registrar Pago: {unidad.id}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* SELECCIÓN DE PERIODO (NUEVO) */}
        <div className="bg-blue-600 p-3 rounded-lg text-white shadow-inner">
          <label className="text-[10px] font-black uppercase opacity-80">Mes que está pagando (Periodo):</label>
          <select 
            className="w-full bg-transparent border-b-2 border-white/30 font-bold text-lg focus:outline-none py-1 cursor-pointer"
            value={formData.periodo_seleccionado}
            onChange={(e) => setFormData({...formData, periodo_seleccionado: e.target.value})}
          >
            {periodosDisponibles.map(p => (
              <option key={p.valor} value={p.valor} className="text-black">
                {p.etiqueta.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        {/* INFO DE FECHA ESPERADA (NUEVO BLOQUE) */}
        <div className="bg-blue-50 border-x border-b border-blue-100 p-2 rounded-b-lg flex justify-between items-center px-4">
          <span className="text-[10px] font-bold text-blue-400 uppercase">Fecha esperada de cobro:</span>
          <span className="text-xs font-black text-blue-700 bg-white px-2 py-0.5 rounded shadow-sm">
             {/* Mostramos el día de pago pactado en el mes seleccionado */}
            {unidad.dia_pago || 1} de {periodosDisponibles.find(p => p.valor === formData.periodo_seleccionado)?.etiqueta.split(' ')[0]}
          </span>
        </div>
        {/* RENTA BASE */}
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase">Renta Mensual Base</label>
          <input 
            type="number" 
            className="w-full p-2 bg-gray-50 border rounded font-bold text-lg"
            value={formData.monto_renta}
            onChange={(e) => setFormData({...formData, monto_renta: Number(e.target.value)})}
          />
        </div>

        {/* SERVICIOS */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div>
            <label className="text-[10px] font-black text-blue-600 uppercase italic">Gasto Agua ($)</label>
            <input 
              type="number" 
              className="w-full p-2 border rounded font-bold"
              placeholder="Ej. 280"
              onChange={(e) => setFormData({...formData, agua_lectura: Number(e.target.value)})}
            />
            {excedenteAgua > 0 && <p className="text-[9px] text-red-500 font-bold mt-1">Excedente: +${excedenteAgua}</p>}
          </div>
          <div>
            <label className="text-[10px] font-black text-amber-600 uppercase italic">Gasto Luz ($)</label>
            <input 
              type="number" 
              className="w-full p-2 border rounded font-bold"
              placeholder="Ej. 300"
              onChange={(e) => setFormData({...formData, luz_lectura: Number(e.target.value)})}
            />
            {excedenteLuz > 0 && <p className="text-[9px] text-red-500 font-bold mt-1">Excedente: +${excedenteLuz}</p>}
          </div>
        </div>
<div className="grid grid-cols-2 gap-4">
  <div>
    <label className="text-[10px] font-black text-gray-400 uppercase">Fecha de Pago</label>
    <input 
      type="date" 
      className="w-full p-2 bg-gray-50 border rounded font-bold text-sm"
      value={formData.fecha_pago_realizado}
      onChange={(e) => setFormData({...formData, fecha_pago_realizado: e.target.value})}
    />
  </div>
  <div>
    <label className="text-[10px] font-black text-gray-400 uppercase">Medio de Pago</label>
    <select 
      className="w-full p-2 bg-gray-50 border rounded font-bold text-sm"
      value={formData.medio_pago}
      onChange={(e) => setFormData({...formData, medio_pago: e.target.value})}
    >
      <option value="transferencia">Transferencia</option>
      <option value="efectivo">Efectivo</option>
      <option value="deposito">Depósito Bancario</option>
    </select>
  </div>
</div>
        {/* TOTAL Y CONFIRMACIÓN */}
        <div className="bg-gray-900 p-4 rounded-xl text-white">
          <div className="flex justify-between items-center mb-1 text-gray-400 text-xs font-bold uppercase">
            <span>Total a Recibir:</span>
          </div>
          <div className="text-3xl font-black text-green-400 flex items-center justify-between">
            <span>${totalAPagar.toLocaleString()}</span>
            <span className="text-[10px] text-gray-500 uppercase">MXN</span>
          </div>
          <p className="text-[9px] text-gray-500 mt-2 italic">* Incluye excedente de servicios sobre $250</p>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onCancelar} className="flex-1 py-2 text-xs font-bold text-gray-400 uppercase">Cancelar</button>
          <button type="submit" className="flex-[2] bg-green-600 text-white py-2 rounded-lg font-black uppercase text-xs hover:bg-green-700 shadow-lg">Registrar Pago</button>
        </div>
      </form>
    </div>
  );
};

export default FormularioRegistroPago;