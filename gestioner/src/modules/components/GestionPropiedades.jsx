import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { 
  collection, onSnapshot, writeBatch, doc, 
  setDoc, updateDoc, query, where, getDocs, getDoc 
} from 'firebase/firestore';

const GestionPropiedades = () => {
  const [propiedades, setPropiedades] = useState([]);
  const [nuevaProp, setNuevaProp] = useState({
    id: '',
    nombre: '',
    prefijo: '',
    limite_agua: 250,
    limite_luz: 250,
    total_unidades: 0,
    renta_base: 0
  });
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'propiedades'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPropiedades(docs);
    });
    return () => unsub();
  }, []);

  const handleIdChange = (val) => {
    const cleanId = val.toLowerCase().replace(/\s/g, '');
    setNuevaProp({
      ...nuevaProp,
      id: cleanId,
      prefijo: cleanId.substring(0, 3).toUpperCase()
    });
  };

  const propsActivas = propiedades.filter(p => p.estado !== "Inactiva");
  const propsInactivas = propiedades.filter(p => p.estado === "Inactiva");

  const handleUpdateUnidades = async (prop, nuevoTotal) => {
    const totalActual = Number(prop.total_unidades);
    const metaTotal = Number(nuevoTotal);

    if (metaTotal <= totalActual) {
      alert("Para reducir unidades o eliminarlas, favor de hacerlo desde el inventario individual por seguridad.");
      return;
    }

    const confirmar = window.confirm(`Vas a agregar ${metaTotal - totalActual} unidades nuevas a "${prop.nombre}". ¿Continuar?`);
    if (!confirmar) return;

    setCargando(true);
    try {
      const batch = writeBatch(db);
      
      for (let i = totalActual + 1; i <= metaTotal; i++) {
        const idUnidad = `${prop.prefijo}-${i}`;
        const uRef = doc(db, 'unidades', idUnidad);
        batch.set(uRef, {
          id_unidad: idUnidad,
          id_propiedad: prop.id,
          no_depto: i.toString(),
          estado: "Disponible",
          id_inquilino: null,
          id_contrato_actual: null,
          nombre_inquilino: "",
          renta_mensual: 0
        });
      }

      const propRef = doc(db, 'propiedades', prop.id);
      batch.update(propRef, { total_unidades: metaTotal });

      await batch.commit();
      alert(`✅ Se agregaron las unidades correctamente.`);
    } catch (error) {
      console.error(error);
      alert("Error al actualizar unidades.");
    } finally {
      setCargando(false);
    }
  };

  const handleClausurarPropiedad = async (prop) => {
    const confirmar = window.confirm(`¿Deseas clausurar "${prop.nombre.toUpperCase()}"?`);
    if (!confirmar) return;

    setCargando(true);
    try {
      const prefijoDoc = prop.prefijo; 
      const contratosRef = collection(db, 'contratos');
      const qContratos = query(
        contratosRef, 
        where("id_unidad", ">=", prefijoDoc),
        where("id_unidad", "<=", prefijoDoc + '\uf8ff')
      );
      
      const snapshotContratos = await getDocs(qContratos);
      const activos = snapshotContratos.docs
        .map(doc => doc.data())
        .filter(c => c.estatus?.toLowerCase() === "activo");

      if (activos.length > 0) {
        alert(`❌ DENEGADO: Hay contratos activos en: ${activos.map(a => a.id_unidad).join(", ")}`);
        setCargando(false);
        return;
      }

      const batch = writeBatch(db);
      const unidadesRef = collection(db, 'unidades');
      const qUnidades = query(unidadesRef, where("id_propiedad", "==", prop.id));
      const snapshotUnidades = await getDocs(qUnidades);

      snapshotUnidades.forEach((u) => batch.update(u.ref, { estado: "Clausurada" }));
      batch.update(doc(db, 'propiedades', prop.id), { 
        estado: "Inactiva",
        fecha_clausura: new Date().toISOString()
      });

      await batch.commit();
      alert(" Propiedad clausurada.");
    } catch (e) { alert("Error al clausurar"); } finally { setCargando(false); }
  };

  const handleReactivarPropiedad = async (prop) => {
    if (window.confirm(`¿Deseas habilitar nuevamente la propiedad "${prop.nombre.toUpperCase()}"?\n\nEsto hará que el edificio y sus unidades vuelvan a aparecer en el sistema activo.`)) {
      setCargando(true);
      try {
        const batch = writeBatch(db);

        const unidadesRef = collection(db, 'unidades');
        const qUnidades = query(unidadesRef, where("id_propiedad", "==", prop.id));
        const snapshotUnidades = await getDocs(qUnidades);
        
        snapshotUnidades.forEach((unidadDoc) => {
          const data = unidadDoc.data();
          const nuevoEstado = (data.id_inquilino || data.nombre_inquilino) ? "Ocupado" : "Disponible";
          
          batch.update(unidadDoc.ref, { 
            estado: nuevoEstado,
            ultima_modificacion: new Date().toISOString()
          });
        });

        const propRef = doc(db, 'propiedades', prop.id);
        batch.update(propRef, { 
          estado: "Activa",
          fecha_reactivacion: new Date().toISOString()
        });

        await batch.commit();
        alert("🏢 Propiedad y unidades reactivadas con éxito.");
      } catch (error) {
        console.error("Error al reactivar:", error);
        alert("Hubo un error técnico al intentar reactivar la propiedad.");
      } finally {
        setCargando(false);
      }
    }
  };

  const handleAgregar = async (e) => {
    e.preventDefault();
    
    if (!nuevaProp.id || !nuevaProp.nombre || !nuevaProp.prefijo || nuevaProp.total_unidades <= 0) {
      alert("⚠️ Todos los campos son obligatorios.");
      return;
    }

    setCargando(true);
    try {
      const docRef = doc(db, 'propiedades', nuevaProp.id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        alert("❌ Error: Ya existe una propiedad con ese ID.");
        setCargando(false);
        return;
      }

      const prefijoExistente = propiedades.find(p => p.prefijo === nuevaProp.prefijo.toUpperCase());
      if (prefijoExistente) {
        alert(`❌ Error: El prefijo "${nuevaProp.prefijo}" ya está siendo usado por ${prefijoExistente.nombre}.`);
        setCargando(false);
        return;
      }

      const batch = writeBatch(db);

      batch.set(docRef, {
        id: nuevaProp.id,
        nombre: nuevaProp.nombre,
        prefijo: nuevaProp.prefijo.toUpperCase().trim(),
        limite_agua: Number(nuevaProp.limite_agua),
        limite_luz: Number(nuevaProp.limite_luz),
        total_unidades: Number(nuevaProp.total_unidades),
        estado: "Activa",
        fecha_creacion: new Date().toISOString()
      });

      for (let i = 1; i <= nuevaProp.total_unidades; i++) {
        const idUnidad = `${nuevaProp.prefijo.toUpperCase()}-${i}`;
        const uRef = doc(db, 'unidades', idUnidad);
        batch.set(uRef, {
          id_unidad: idUnidad,
          id_propiedad: nuevaProp.id,
          no_depto: i.toString(),
          estado: "Disponible",
          id_inquilino: null,
          id_contrato_actual: null,
          nombre_inquilino: "",
          renta_mensual: 0
        });
      }

      await batch.commit();
      setNuevaProp({ id: '', nombre: '', prefijo: '', limite_agua: 250, limite_luz: 250, total_unidades: 0 });
      alert("🚀 ¡Propiedad y unidades creadas!");

    } catch (error) {
      console.error(error);
      alert("Error al procesar la carga.");
    } finally {
      setCargando(false);
    }
  };

  const handleUpdateField = async (id, campo, valor) => {
    try {
      await updateDoc(doc(db, 'propiedades', id), { [campo]: Number(valor) });
    } catch (error) { console.error(error); }
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-2xl sm:text-3xl"><i class="fa-solid fa-building"></i></span>
              Gestión de Propiedades
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">
              Administra tus edificios, unidades y configuración de servicios
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* FORMULARIO */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-base sm:text-lg font-black uppercase mb-4 sm:mb-6 flex items-center gap-2 text-blue-900">
            <span className="bg-blue-600 text-white p-2 rounded-lg shadow-lg text-sm sm:text-base"><i class="fa-solid fa-plus"></i></span>
            Registrar Nueva Propiedad
          </h2>
          
          <form onSubmit={handleAgregar} className="space-y-4">
            {/* Fila 1: ID, Nombre, Prefijo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">ID (Slug)</label>
                <input 
                  placeholder="ej: dorado" 
                  type="text" 
                  className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={nuevaProp.id} 
                  onChange={(e) => handleIdChange(e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Nombre Real</label>
                <input 
                  placeholder="Dorado Residencial" 
                  type="text" 
                  className="w-full p-3 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={nuevaProp.nombre} 
                  onChange={(e) => setNuevaProp({...nuevaProp, nombre: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Prefijo</label>
                <input 
                  placeholder="DOR" 
                  type="text" 
                  maxLength={4} 
                  className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm font-black text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={nuevaProp.prefijo} 
                  onChange={(e) => setNuevaProp({...nuevaProp, prefijo: e.target.value.toUpperCase()})} 
                />
              </div>
            </div>

            {/* Fila 2: Unidades, Agua, Luz */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Unidades</label>
                <input 
                  type="number" 
                  className="w-full p-3 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={nuevaProp.total_unidades} 
                  onChange={(e) => setNuevaProp({...nuevaProp, total_unidades: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Límite Agua $</label>
                <input 
                  type="number" 
                  className="w-full p-3 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={nuevaProp.limite_agua} 
                  onChange={(e) => setNuevaProp({...nuevaProp, limite_agua: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Límite Luz $</label>
                <input 
                  type="number" 
                  className="w-full p-3 bg-gray-50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={nuevaProp.limite_luz} 
                  onChange={(e) => setNuevaProp({...nuevaProp, limite_luz: e.target.value})} 
                />
              </div>
            </div>

            {/* Botón */}
            <button 
              disabled={cargando} 
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-black py-3 px-8 rounded-xl uppercase text-xs transition-all shadow-lg active:scale-95"
            >
              {cargando ? ' Procesando...' : ' Agregar Propiedad'}
            </button>
          </form>
        </div>

        {/* TABLA ACTIVA - Desktop */}
        <div className="hidden md:block bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
          <div className="bg-gray-900 p-4">
            <h3 className="text-white font-bold uppercase text-xs tracking-widest">Propiedades en Operación</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase border-b">
                  <th className="p-4">Identificación</th>
                  <th className="p-4 text-center">Prefijo</th>
                  <th className="p-4 text-center">Cant. Unidades</th>
                  <th className="p-4 text-center">Límites (Agua/Luz)</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {propsActivas.map(prop => (
                  <tr key={prop.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-4">
                      <p className="font-black text-gray-800 uppercase text-sm">{prop.nombre}</p>
                      <p className="text-[10px] text-blue-500 font-mono italic">ID: {prop.id}</p>
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">{prop.prefijo}</span>
                    </td>
                    <td className="p-4 text-center">
                      <input 
                        type="number" 
                        className="w-16 p-1 bg-gray-50 border border-gray-200 rounded text-center font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        defaultValue={prop.total_unidades} 
                        onBlur={(e) => {
                          if (Number(e.target.value) !== prop.total_unidades) {
                            handleUpdateUnidades(prop, e.target.value);
                          }
                        }}
                      />
                    </td>
                    <td className="p-4 text-center space-x-2">
                      <input 
                        type="number" 
                        className="w-16 p-1 bg-blue-50 text-blue-700 rounded font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none" 
                        defaultValue={prop.limite_agua} 
                        onBlur={(e) => handleUpdateField(prop.id, 'limite_agua', e.target.value)} 
                      />
                      <input 
                        type="number" 
                        className="w-16 p-1 bg-amber-50 text-amber-700 rounded font-bold text-xs focus:ring-2 focus:ring-amber-500 outline-none" 
                        defaultValue={prop.limite_luz} 
                        onBlur={(e) => handleUpdateField(prop.id, 'limite_luz', e.target.value)} 
                      />
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleClausurarPropiedad(prop)} 
                        className="p-2 text-gray-300 hover:text-red-600 transition-colors text-lg" 
                        title="Clausurar"
                      >
                        🚫
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* VISTA MOBILE - Cards Mejoradas */}
        <div className="md:hidden space-y-4">
          <div className="bg-gray-900 rounded-2xl p-4">
            <h3 className="text-white font-bold uppercase text-xs tracking-widest">
              Propiedades en Operación ({propsActivas.length})
            </h3>
          </div>
          
          {propsActivas.map(prop => (
            <div key={prop.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Header de la Card */}
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-white uppercase text-base truncate mb-1">
                      {prop.nombre}
                    </p>
                    <p className="text-[10px] text-blue-300 font-mono">ID: {prop.id}</p>
                  </div>
                  <span className="bg-white text-gray-800 px-3 py-1.5 rounded-lg text-sm font-black">
                    {prop.prefijo}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Cantidad de Unidades */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                  <label className="text-[9px] font-black text-blue-600 uppercase block mb-2 tracking-wider">
                    <i class="fa-solid fa-map-pin"></i> Cantidad de Unidades
                  </label>
                  <input 
                    type="number" 
                    className="w-full p-3 bg-white border-2 border-blue-200 rounded-lg text-center font-black text-xl text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    defaultValue={prop.total_unidades} 
                    onBlur={(e) => {
                      if (Number(e.target.value) !== prop.total_unidades) {
                        handleUpdateUnidades(prop, e.target.value);
                      }
                    }}
                  />
                  <p className="text-[8px] text-blue-600 text-center mt-2 font-medium">
                    Toca para modificar el total
                  </p>
                </div>

                {/* Límites de Servicios */}
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                    ⚙️ Límites de Servicios
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Agua */}
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg"></span>
                        <span className="text-[8px] font-black text-blue-600 uppercase">Agua</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 font-black text-sm">$</span>
                        <input 
                          type="number" 
                          className="w-full pl-7 pr-3 py-2 bg-white border-2 border-blue-200 rounded-lg font-bold text-blue-700 text-center focus:ring-2 focus:ring-blue-500 outline-none" 
                          defaultValue={prop.limite_agua} 
                          onBlur={(e) => handleUpdateField(prop.id, 'limite_agua', e.target.value)} 
                        />
                      </div>
                    </div>

                    {/* Luz */}
                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-3 border border-amber-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg"></span>
                        <span className="text-[8px] font-black text-amber-600 uppercase">Luz</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 font-black text-sm">$</span>
                        <input 
                          type="number" 
                          className="w-full pl-7 pr-3 py-2 bg-white border-2 border-amber-200 rounded-lg font-bold text-amber-700 text-center focus:ring-2 focus:ring-amber-500 outline-none" 
                          defaultValue={prop.limite_luz} 
                          onBlur={(e) => handleUpdateField(prop.id, 'limite_luz', e.target.value)} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botón Clausurar */}
                <button 
                  onClick={() => handleClausurarPropiedad(prop)} 
                  className="w-full bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 text-red-600 font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 border-2 border-red-200 active:scale-95 shadow-sm"
                >
                  <span className="text-sm">🚫</span>
                  <span className="text-sm uppercase tracking-wide">Propiedad inactiva</span>
                </button>
              </div>
            </div>
          ))}

          {propsActivas.length === 0 && (
            <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
              <p className="text-gray-400 text-sm italic">No hay propiedades activas</p>
            </div>
          )}
        </div>

        {/* HISTÓRICO */}
        {propsInactivas.length > 0 && (
          <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-4 sm:p-6">
            <h3 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest flex items-center gap-2">
              📁 Archivo de Propiedades Clausuradas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {propsInactivas.map(prop => (
                <div key={prop.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <div className="mb-3">
                    <p className="text-sm font-black text-gray-400 uppercase truncate">{prop.nombre}</p>
                    <p className="text-[9px] text-gray-300 italic mt-1">ID: {prop.id} | Prefijo: {prop.prefijo}</p>
                  </div>
                  <button 
                    onClick={() => handleReactivarPropiedad(prop)} 
                    className="w-full text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-all uppercase active:scale-95"
                  >
                    🔄 Reactivar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GestionPropiedades;