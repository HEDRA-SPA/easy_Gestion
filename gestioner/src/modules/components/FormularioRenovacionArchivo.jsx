import React, { useState, useEffect } from 'react';
import { renovarInquilinoDesdeArchivo } from '../../firebase/acciones';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const FormularioRenovacionArchivo = ({ inquilino, unidadesDisponibles, onExito, onCancelar }) => {
  const [loading, setLoading] = useState(false);
  const [validandoFechas, setValidandoFechas] = useState(false);
  const [contratosPrevios, setContratosPrevios] = useState([]);
  const [errorSolapamiento, setErrorSolapamiento] = useState(null);
  const [conflictosDetectados, setConflictosDetectados] = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  
  const [formData, setFormData] = useState({
    id_unidad_nueva: "",
    renta_actual: inquilino.renta_actual || 0,
    fecha_inicio_contrato: "",
    fecha_fin_contrato: "",
    dia_pago: inquilino.dia_pago || 5,
    deposito_garantia_inicial: inquilino.deposito_garantia_inicial || 0,
    no_personas: inquilino.no_personas || 1,
  });

  // ============================================
  // CARGAR TODOS LOS CONTRATOS - VERSIÓN DEBUG
  // ============================================
  useEffect(() => {
    const cargarContratosHistoricos = async () => {
      try {
        console.log("========================================");
        console.log("🔍 DEBUG: Cargando contratos para inquilino:", inquilino.id);
        console.log("========================================");

        // ⭐ MÉTODO 1: Buscar por id_inquilino
        const contratosRef = collection(db, "contratos");
        const q = query(contratosRef, where("id_inquilino", "==", inquilino.id));
        const snapshot = await getDocs(q);
        
        console.log(`📊 Query por id_inquilino encontró: ${snapshot.docs.length} contratos`);
        
        const contratos = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log(`  - ${doc.id}:`, {
            id_inquilino: data.id_inquilino,
            fecha_inicio: data.fecha_inicio?.toDate(),
            fecha_fin: data.fecha_fin?.toDate(),
            estatus: data.estatus
          });
          
          return {
            id: doc.id,
            ...data,
            fecha_inicio: data.fecha_inicio?.toDate(),
            fecha_fin: data.fecha_fin?.toDate()
          };
        });

        // ⭐ MÉTODO 2: Verificar historial_contratos del inquilino
        console.log("\n🔍 Verificando historial_contratos del inquilino...");
        const inqRef = doc(db, "inquilinos", inquilino.id);
        const inqSnap = await getDoc(inqRef);
        const historial = inqSnap.data()?.historial_contratos || [];
        const contratoActual = inqSnap.data()?.id_contrato_actual;
        
        console.log("Historial de contratos:", historial);
        console.log("Contrato actual:", contratoActual);

        // ⭐ MÉTODO 3: Buscar contratos por IDs del historial
        const todosLosIds = [...new Set([...historial, contratoActual].filter(Boolean))];
        console.log(`\n🔍 Total de IDs únicos en historial: ${todosLosIds.length}`);
        
        const contratosDelHistorial = [];
        for (const contratoId of todosLosIds) {
          try {
            const contratoRef = doc(db, "contratos", contratoId);
            const contratoSnap = await getDoc(contratoRef);
            
            if (contratoSnap.exists()) {
              const data = contratoSnap.data();
              console.log(`  ✅ Encontrado: ${contratoId}`);
              console.log(`     Fechas: ${data.fecha_inicio?.toDate().toLocaleDateString('es-MX')} - ${data.fecha_fin?.toDate().toLocaleDateString('es-MX')}`);
              console.log(`     Estado: ${data.estatus}`);
              
              contratosDelHistorial.push({
                id: contratoSnap.id,
                ...data,
                fecha_inicio: data.fecha_inicio?.toDate(),
                fecha_fin: data.fecha_fin?.toDate(),
                encontrado_en: 'historial'
              });
            } else {
              console.log(`  ❌ No existe: ${contratoId}`);
            }
          } catch (err) {
            console.error(`  ❌ Error leyendo ${contratoId}:`, err);
          }
        }

        // ⭐ COMBINAR AMBOS MÉTODOS (sin duplicados)
        const idsEncontrados = new Set(contratos.map(c => c.id));
        const contratosAdicionales = contratosDelHistorial.filter(c => !idsEncontrados.has(c.id));
        
        const todosTodosLosContratos = [...contratos, ...contratosAdicionales];
        
        console.log("\n========================================");
        console.log(`📊 RESUMEN:`);
        console.log(`  - Por query (id_inquilino): ${contratos.length}`);
        console.log(`  - Del historial (adicionales): ${contratosAdicionales.length}`);
        console.log(`  - TOTAL: ${todosTodosLosContratos.length}`);
        console.log("========================================\n");

        // Ordenar por fecha de inicio (más antiguo primero)
        todosTodosLosContratos.sort((a, b) => a.fecha_inicio - b.fecha_inicio);
        
        setContratosPrevios(todosTodosLosContratos);
        setDebugInfo({
          totalContratos: todosTodosLosContratos.length,
          porQuery: contratos.length,
          delHistorial: contratosAdicionales.length,
          idsHistorial: todosLosIds
        });

        // Mostrar tabla en consola
        console.log("📋 TABLA DE CONTRATOS:");
        console.table(todosTodosLosContratos.map((c, i) => ({
          '#': i + 1,
          ID: c.id,
          Inicio: c.fecha_inicio?.toLocaleDateString('es-MX'),
          Fin: c.fecha_fin?.toLocaleDateString('es-MX'),
          Estado: c.estatus,
          Fuente: c.encontrado_en || 'query'
        })));

      } catch (error) {
        console.error("❌ Error cargando contratos históricos:", error);
      }
    };

    if (inquilino.id) {
      cargarContratosHistoricos();
    }
  }, [inquilino.id]);

  // ============================================
  // VALIDAR SOLAPAMIENTO DE FECHAS
  // ============================================
  const validarSolapamiento = (fechaInicio, fechaFin) => {
    if (!fechaInicio || !fechaFin) return null;

    const inicio = new Date(fechaInicio + "T00:00:00");
    const fin = new Date(fechaFin + "T23:59:59");

    console.log("========================================");
    console.log("🔍 VALIDANDO FECHAS");
    console.log(`Nuevo: ${inicio.toLocaleDateString('es-MX')} - ${fin.toLocaleDateString('es-MX')}`);
    console.log(`Validando contra ${contratosPrevios.length} contratos`);
    console.log("========================================");

    if (fin <= inicio) {
      return {
        tipo: 'invalido',
        mensaje: 'La fecha de fin debe ser posterior a la fecha de inicio'
      };
    }

    const todosLosConflictos = [];
    
    contratosPrevios.forEach((contrato, index) => {
      const contratoInicio = new Date(contrato.fecha_inicio);
      const contratoFin = new Date(contrato.fecha_fin);

      console.log(`\n${index + 1}/${contratosPrevios.length}: ${contrato.id}`);
      console.log(`  ${contratoInicio.toLocaleDateString('es-MX')} - ${contratoFin.toLocaleDateString('es-MX')}`);

      const iniciaEntreMedio = inicio >= contratoInicio && inicio <= contratoFin;
      const terminaEntreMedio = fin >= contratoInicio && fin <= contratoFin;
      const envuelveContrato = inicio <= contratoInicio && fin >= contratoFin;
      const esEnvuelto = contratoInicio <= inicio && contratoFin >= fin;

      const haySolapamiento = iniciaEntreMedio || terminaEntreMedio || envuelveContrato || esEnvuelto;

      if (haySolapamiento) {
        const tipoConflicto = 
          envuelveContrato ? "El nuevo contrato envuelve este" :
          esEnvuelto ? "Este contrato envuelve el nuevo" :
          iniciaEntreMedio && terminaEntreMedio ? "El nuevo está completamente dentro de este" :
          iniciaEntreMedio ? "El nuevo inicia durante este" :
          "El nuevo termina durante este";

        console.log(`  ⚠️  CONFLICTO: ${tipoConflicto}`);
        
        todosLosConflictos.push({
          contrato: contrato,
          tipoConflicto: tipoConflicto
        });
      } else {
        console.log(`  ✅ OK`);
      }
    });

    console.log(`\n========================================`);
    console.log(`RESULTADO: ${todosLosConflictos.length} conflicto(s)`);
    console.log(`========================================\n`);

    setConflictosDetectados(todosLosConflictos);

    if (todosLosConflictos.length > 0) {
      return {
        tipo: 'solapamiento',
        contratoConflicto: todosLosConflictos[0].contrato,
        tipoConflicto: todosLosConflictos[0].tipoConflicto,
        totalConflictos: todosLosConflictos.length,
        mensaje: `⚠️ CONFLICTO con ${todosLosConflictos.length} contrato(s)`,
        detalles: todosLosConflictos.map(c => c.contrato.id).join(', ')
      };
    }

    return null;
  };

  const handleFechaChange = (campo, valor) => {
    const nuevaData = { ...formData, [campo]: valor };
    setFormData(nuevaData);

    if (nuevaData.fecha_inicio_contrato && nuevaData.fecha_fin_contrato) {
      setValidandoFechas(true);
      setTimeout(() => {
        const error = validarSolapamiento(
          nuevaData.fecha_inicio_contrato,
          nuevaData.fecha_fin_contrato
        );
        setErrorSolapamiento(error);
        setValidandoFechas(false);
      }, 300);
    } else {
      setErrorSolapamiento(null);
      setConflictosDetectados([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.id_unidad_nueva) {
      return alert("Por favor, selecciona una unidad.");
    }

    const errorFinal = validarSolapamiento(
      formData.fecha_inicio_contrato,
      formData.fecha_fin_contrato
    );

    if (errorFinal) {
      let mensajeDetallado = `❌ NO SE PUEDE CONTINUAR\n\n`;
      mensajeDetallado += `${errorFinal.mensaje}\n\n`;
      mensajeDetallado += `CONFLICTOS:\n`;
      
      conflictosDetectados.forEach((conflicto, i) => {
        mensajeDetallado += `\n${i + 1}. ${conflicto.contrato.id}\n`;
        mensajeDetallado += `   ${conflicto.contrato.fecha_inicio?.toLocaleDateString('es-MX')} - ${conflicto.contrato.fecha_fin?.toLocaleDateString('es-MX')}\n`;
        mensajeDetallado += `   ${conflicto.tipoConflicto}\n`;
      });
      
      alert(mensajeDetallado);
      return;
    }

    const confirmar = window.confirm(
      `¿Confirmar re-activación?\n\n` +
      `Inquilino: ${inquilino.nombre_completo}\n` +
      `Unidad: ${formData.id_unidad_nueva}\n` +
      `Período: ${formData.fecha_inicio_contrato} - ${formData.fecha_fin_contrato}\n` +
      `\n✅ Validado contra ${contratosPrevios.length} contratos`
    );

    if (!confirmar) return;

    setLoading(true);
    try {
      await renovarInquilinoDesdeArchivo(
        inquilino.id,
        formData.id_unidad_nueva,
        {
          ...formData,
          nombre_completo: inquilino.nombre_completo,
          deposito_garantia_inicial: inquilino.deposito_garantia_inicial
        }
      );

      alert("✅ ¡Inquilino re-activado!");
      onExito();
    } catch (error) {
      console.error(error);
      alert("❌ Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-3xl border-2 border-blue-600 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
      {/* HEADER */}
      <div className="mb-6 text-center sticky top-0 bg-white pb-4 z-10 border-b-2 border-gray-100">
        <h3 className="text-xl font-black uppercase italic text-gray-800">Re-activar Contrato</h3>
        <p className="text-blue-600 font-bold text-xs uppercase">{inquilino.nombre_completo}</p>
        
        {debugInfo && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-300 rounded-lg">
            <p className="text-[9px] font-bold text-yellow-800">
              🐛 DEBUG: {debugInfo.totalContratos} contratos cargados 
              ({debugInfo.porQuery} por query + {debugInfo.delHistorial} del historial)
            </p>
          </div>
        )}

        {contratosPrevios.length > 0 && (
          <div className="mt-3 flex items-center justify-center gap-4">
            <div>
              <p className="text-2xl font-black text-blue-600">{contratosPrevios.length}</p>
              <p className="text-[8px] text-gray-500 uppercase font-bold">Total</p>
            </div>
            <div className="w-px h-10 bg-gray-300"></div>
            <div>
              <p className="text-2xl font-black text-green-600">
                {contratosPrevios.filter(c => c.estatus === 'activo').length}
              </p>
              <p className="text-[8px] text-gray-500 uppercase font-bold">Activos</p>
            </div>
            <div className="w-px h-10 bg-gray-300"></div>
            <div>
              <p className="text-2xl font-black text-gray-600">
                {contratosPrevios.filter(c => c.estatus === 'finalizado').length}
              </p>
              <p className="text-[8px] text-gray-500 uppercase font-bold">Finalizados</p>
            </div>
          </div>
        )}
      </div>

      {/* HISTORIAL DE CONTRATOS */}
      {contratosPrevios.length > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-black text-gray-700 uppercase">
              📋 Todos los Contratos ({contratosPrevios.length})
            </p>
          </div>
          
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#94a3b8 #f1f5f9'
          }}>
            {contratosPrevios.map((contrato, index) => {
              const estaEnConflicto = conflictosDetectados.some(c => c.contrato.id === contrato.id);
              
              return (
                <div 
                  key={contrato.id} 
                  className={`relative p-3 rounded-lg border-l-4 transition-all ${
                    estaEnConflicto
                      ? 'bg-red-100 border-red-500 border-2 border-red-400 shadow-lg'
                      : contrato.estatus === 'activo' 
                      ? 'bg-green-50 border-green-500 border border-green-200' 
                      : contrato.estatus === 'finalizado'
                      ? 'bg-gray-100 border-gray-400 border border-gray-200'
                      : 'bg-blue-50 border-blue-400 border border-blue-200'
                  }`}
                >
                  {/* Número */}
                  <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white border-2 border-gray-400 flex items-center justify-center shadow">
                    <span className="text-[11px] font-black text-gray-700">#{index + 1}</span>
                  </div>

                  {estaEnConflicto && (
                    <div className="absolute top-2 left-2 text-lg">⚠️</div>
                  )}

                  {/* ID */}
                  <p className="text-[10px] font-black text-gray-600 mb-2 pr-10">
                    {contrato.id}
                    {contrato.encontrado_en === 'historial' && (
                      <span className="ml-2 text-[8px] bg-yellow-200 px-2 py-0.5 rounded">Del historial</span>
                    )}
                  </p>

                  {/* Fechas */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-800">
                      {contrato.fecha_inicio?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-gray-500 font-bold">→</span>
                    <span className="text-sm font-bold text-gray-800">
                      {contrato.fecha_fin?.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Estado y info */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-md text-white text-[10px] font-black ${
                      contrato.estatus === 'activo' ? 'bg-green-600' : 
                      contrato.estatus === 'finalizado' ? 'bg-gray-600' : 'bg-blue-600'
                    }`}>
                      {contrato.estatus?.toUpperCase()}
                    </span>

                    {contrato.monto_renta && (
                      <span className="text-[10px] text-gray-700 bg-white px-2 py-1 rounded border">
                        ${contrato.monto_renta.toLocaleString()}
                      </span>
                    )}

                    {contrato.total_periodos && (
                      <span className="text-[10px] text-gray-700 bg-white px-2 py-1 rounded border">
                        {contrato.periodos_pagados || 0}/{contrato.total_periodos} meses
                      </span>
                    )}
                  </div>

                  {estaEnConflicto && (
                    <div className="mt-2 p-2 bg-red-200 border border-red-400 rounded">
                      <p className="text-[9px] text-red-800 font-bold">
                        ⚠️ CONFLICTO CON LAS FECHAS PROPUESTAS
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Unidad */}
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase">Asignar a Unidad:</label>
          <select
            required
            className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-sm"
            value={formData.id_unidad_nueva}
            onChange={(e) => setFormData({ ...formData, id_unidad_nueva: e.target.value })}
          >
            <option value="">Seleccionar...</option>
            {unidadesDisponibles.filter(u => !u.id_inquilino).map(u => (
              <option key={u.id} value={u.id}>{u.id}</option>
            ))}
          </select>
        </div>

        {/* Renta y Día */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Renta</label>
            <input
              type="number"
              required
              className="w-full p-3 bg-gray-50 border-2 rounded-xl font-bold"
              value={formData.renta_actual}
              onChange={(e) => setFormData({ ...formData, renta_actual: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Día Pago</label>
            <input
              type="number"
              min="1"
              max="31"
              required
              className="w-full p-3 bg-gray-50 border-2 rounded-xl font-bold"
              value={formData.dia_pago}
              onChange={(e) => setFormData({ ...formData, dia_pago: e.target.value })}
            />
          </div>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Inicio</label>
            <input
              required
              type="date"
              className={`w-full p-3 border-2 rounded-xl font-bold ${
                errorSolapamiento ? 'bg-red-50 border-red-400' : 'bg-gray-50'
              }`}
              value={formData.fecha_inicio_contrato}
              onChange={(e) => handleFechaChange('fecha_inicio_contrato', e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Fin</label>
            <input
              required
              type="date"
              className={`w-full p-3 border-2 rounded-xl font-bold ${
                errorSolapamiento ? 'bg-red-50 border-red-400' : 'bg-gray-50'
              }`}
              value={formData.fecha_fin_contrato}
              onChange={(e) => handleFechaChange('fecha_fin_contrato', e.target.value)}
            />
          </div>
        </div>

        {/* Mensajes */}
        {validandoFechas && (
          <div className="p-3 bg-blue-50 border-2 border-blue-300 rounded-xl">
            <p className="text-xs text-blue-700 font-bold">🔍 Validando contra {contratosPrevios.length} contratos...</p>
          </div>
        )}

        {errorSolapamiento && (
          <div className="p-4 rounded-xl border-2 bg-red-50 border-red-400">
            <p className="text-sm font-black mb-2 text-red-700">{errorSolapamiento.mensaje}</p>
            
            {conflictosDetectados.length > 0 && (
              <div className="mt-3 space-y-2">
                {conflictosDetectados.map((conflicto, i) => (
                  <div key={i} className="text-[10px] text-red-700 bg-white p-2 rounded border border-red-300">
                    <p className="font-bold">{i + 1}. {conflicto.contrato.id}</p>
                    <p>{conflicto.tipoConflicto}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!errorSolapamiento && formData.fecha_inicio_contrato && formData.fecha_fin_contrato && !validandoFechas && (
          <div className="p-4 bg-green-50 border-2 border-green-300 rounded-xl">
            <p className="text-sm text-green-700 font-black">
              ✅ Validado contra {contratosPrevios.length} contratos
            </p>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 pt-4">
          <button 
            type="button" 
            onClick={onCancelar} 
            className="flex-1 py-3 text-xs font-black uppercase text-gray-400 hover:bg-gray-100 rounded-xl border-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || validandoFechas || errorSolapamiento}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase ${
              loading || validandoFechas || errorSolapamiento
                ? 'bg-gray-300 text-gray-500'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? "Procesando..." : "Confirmar"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FormularioRenovacionArchivo;