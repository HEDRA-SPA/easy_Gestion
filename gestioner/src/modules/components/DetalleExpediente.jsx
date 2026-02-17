import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';

const DetalleExpediente = ({ idInquilino }) => {
  const [datos, setDatos] = useState(null);
  const [contratoActual, setContratoActual] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarExpediente = async () => {
      if (!idInquilino) return;
      try {
        // Cargar datos del inquilino
        const inqSnap = await getDoc(doc(db, "inquilinos", idInquilino));
        if (inqSnap.exists()) {
          setDatos(inqSnap.data());
        }

        // Cargar contrato activo para validar pagos
        const contratosQuery = query(
          collection(db, 'contratos'),
          where('id_inquilino', '==', idInquilino),
          where('estatus', '==', 'activo')
        );
        const contratosSnap = await getDocs(contratosQuery);
        
        if (!contratosSnap.empty) {
          const contratoData = { id: contratosSnap.docs[0].id, ...contratosSnap.docs[0].data() };
          setContratoActual(contratoData);
        }
      } catch (error) {
        console.error("Error al cargar expediente:", error);
      } finally {
        setLoading(false);
      }
    };
    cargarExpediente();
  }, [idInquilino]);

  // Función para validar si un periodo está completamente pagado
  const esPeriodoPagado = (periodo) => {
    // Si el estatus es "pagado"
    if (periodo.estatus === 'pagado') return true;
    
    // Si el estatus es "condonado" Y el saldo restante es 0
    if (periodo.estatus === 'condonado' && periodo.saldo_restante === 0) return true;
    
    // Si el monto pagado es igual o mayor al esperado Y el saldo restante es 0
    if (periodo.monto_pagado >= periodo.monto_esperado && periodo.saldo_restante === 0) return true;
    
    return false;
  };

  // Función para verificar si hay periodos pendientes
  const tieneAdeudos = () => {
    if (!contratoActual || !contratoActual.periodos_esperados) return false;
    
    return contratoActual.periodos_esperados.some(periodo => {
      return !esPeriodoPagado(periodo) && periodo.saldo_restante > 0;
    });
  };

  const formatearFecha = (ts) => {
    if (!ts) return "No definida";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) return (
    <div className="p-8 text-center animate-pulse flex flex-col items-center gap-2">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Cargando expediente...</span>
    </div>
  );

  if (!datos) return <div className="p-8 text-center text-red-500 font-bold uppercase text-[10px]">No se encontró el expediente</div>;

  const hayAdeudos = tieneAdeudos();
  const periodosPagados = contratoActual?.periodos_esperados?.filter(p => esPeriodoPagado(p)).length || 0;
  const totalPeriodos = contratoActual?.periodos_esperados?.length || 0;

  return (
    <div className="bg-gray-50 p-5 space-y-6 animate-in fade-in duration-500">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* COLUMNA 1: DATOS GENERALES */}
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Titular del Contrato</p>
            <p className="text-sm font-bold text-gray-800 uppercase">{datos.nombre_completo}</p>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Contacto</p>
              <p className="text-xs font-medium text-gray-700">{datos.telefono_contacto || "N/A"}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Emergencia</p>
              <p className="text-xs font-medium text-gray-700">{datos.telefono_emergencia || "N/A"}</p>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-200">
             <p className="text-[10px] font-black text-red-500 uppercase">Detalles de Pago</p>
             <p className="text-xs font-bold text-gray-700">Día de pago: {datos.dia_pago} de cada mes</p>
             <p className="text-xs font-bold text-green-600">Depósito: ${datos.deposito_garantia?.toLocaleString()}</p>
          </div>
        </div>

        {/* COLUMNA 2: HABITANTES / ACOMPAÑANTES */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Habitantes ({datos.no_personas || 1})
            </p>
            {datos.activo && (
              <span className="bg-green-100 text-green-700 text-[8px] font-black px-2 py-0.5 rounded">ACTIVO</span>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200 shadow-sm">
              <span className="text-xs">🔑</span>
              <p className="text-[10px] font-bold text-gray-700 uppercase leading-none">{datos.nombre_completo} (Titular)</p>
            </div>

            {datos.acompanantes?.map((nombre, index) => (
              <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-100 shadow-sm ml-4 border-l-4 border-l-blue-400">
                <span className="text-xs">👤</span>
                <p className="text-[10px] font-medium text-gray-600 uppercase leading-none">{nombre}</p>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMNA 3: VIGENCIA Y DOCUMENTOS */}
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Vigencia de Contrato</p>
            <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
              <p className="text-[10px] text-blue-800 font-bold">
                Inicio: {formatearFecha(datos.fecha_inicio_contrato)}
              </p>
              <p className="text-[10px] text-blue-800 font-bold">
                Fin: {formatearFecha(datos.fecha_fin_contrato)}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Expediente Digital</p>
            <div className="grid grid-cols-1 gap-1.5">
              {['ine', 'carta', 'contrato'].map((docKey) => {
                const check = datos.docs?.[docKey] === "si";
                return (
                  <div key={docKey} className="flex items-center justify-between bg-white px-3 py-1.5 rounded border border-gray-200">
                    <span className="text-[9px] font-black text-gray-500 uppercase">{docKey}</span>
                    <span className={`text-[10px] font-black ${check ? "text-green-500" : "text-red-300"}`}>
                      {check ? "✓ CARGADO" : "✗ PENDIENTE"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ESTADO DE PAGOS */}
      {contratoActual && (
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Estado de Pagos
            </p>
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${
              hayAdeudos 
                ? 'bg-red-50 text-red-600 border border-red-100' 
                : 'bg-green-50 text-green-600 border border-green-100'
            }`}>
              {hayAdeudos ? '⚠️ Con Adeudos' : '✓ Al Corriente'}
            </div>
          </div>

          {/* Barra de Progreso */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Periodos Completados</span>
              <span className="font-bold text-gray-800">{periodosPagados} / {totalPeriodos}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  hayAdeudos ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${totalPeriodos > 0 ? (periodosPagados / totalPeriodos) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Lista de Periodos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {contratoActual.periodos_esperados?.map((periodo, index) => {
              const estaPagado = esPeriodoPagado(periodo);
              const esCondonado = periodo.estatus === 'condonado';
              
              return (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-2 rounded-lg border ${
                    estaPagado 
                      ? esCondonado 
                        ? 'bg-purple-50 border-purple-200' 
                        : 'bg-green-50 border-green-200'
                      : periodo.saldo_restante > 0
                        ? 'bg-red-50 border-red-200'
                        : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      estaPagado 
                        ? esCondonado 
                          ? 'bg-purple-500' 
                          : 'bg-green-500'
                        : periodo.saldo_restante > 0
                          ? 'bg-red-500'
                          : 'bg-gray-300'
                    }`}></div>
                    <p className="text-[10px] font-bold text-gray-800">{periodo.periodo}</p>
                  </div>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded ${
                    esCondonado 
                      ? 'bg-purple-100 text-purple-700' 
                      : estaPagado 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {esCondonado ? '🤝 COND' : estaPagado ? '✓ OK' : '✗ PEND'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DetalleExpediente;