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
    prefijo: '', // Nuevo campo
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

  // Manejador para autogenerar prefijo al escribir el ID
  const handleIdChange = (val) => {
    const cleanId = val.toLowerCase().replace(/\s/g, '');
    setNuevaProp({
      ...nuevaProp,
      id: cleanId,
      prefijo: cleanId.substring(0, 3).toUpperCase() // Sugiere las primeras 3 letras
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
      
      // 1. Crear las unidades faltantes
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

      // 2. Actualizar el conteo en el documento de la propiedad
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
  // --- LÓGICA DE CLAUSURA (VALIDACIÓN POR PREFIJO) ---
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
      alert("✅ Propiedad clausurada.");
    } catch (e) { alert("Error al clausurar"); } finally { setCargando(false); }
  };
const handleReactivarPropiedad = async (prop) => {
    if (window.confirm(`¿Deseas habilitar nuevamente la propiedad "${prop.nombre.toUpperCase()}"?\n\nEsto hará que el edificio y sus unidades vuelvan a aparecer en el sistema activo.`)) {
      setCargando(true);
      try {
        const batch = writeBatch(db);

        // 1. OBTENER TODAS LAS UNIDADES DE ESTA PROPIEDAD
        const unidadesRef = collection(db, 'unidades');
        const qUnidades = query(unidadesRef, where("id_propiedad", "==", prop.id));
        const snapshotUnidades = await getDocs(qUnidades);
        
        // 2. ACTUALIZAR CADA UNIDAD
        snapshotUnidades.forEach((unidadDoc) => {
          const data = unidadDoc.data();
          // Si la unidad tiene un inquilino (id_inquilino no es null), 
          // debería quedar como "Ocupado", de lo contrario "Disponible"
          const nuevoEstado = (data.id_inquilino || data.nombre_inquilino) ? "Ocupado" : "Disponible";
          
          batch.update(unidadDoc.ref, { 
            estado: nuevoEstado,
            ultima_modificacion: new Date().toISOString()
          });
        });

        // 3. ACTUALIZAR LA PROPIEDAD A "ACTIVA"
        const propRef = doc(db, 'propiedades', prop.id);
        batch.update(propRef, { 
          estado: "Activa",
          fecha_reactivacion: new Date().toISOString() // Opcional: para registro histórico
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
    
    // Validaciones básicas
    if (!nuevaProp.id || !nuevaProp.nombre || !nuevaProp.prefijo || nuevaProp.total_unidades <= 0) {
      alert("⚠️ Todos los campos son obligatorios.");
      return;
    }

    setCargando(true);
    try {
      // 1. Verificar si el ID ya existe
      const docRef = doc(db, 'propiedades', nuevaProp.id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        alert("❌ Error: Ya existe una propiedad con ese ID.");
        setCargando(false);
        return;
      }

      // 2. Verificar si el PREFIJO ya existe en otras propiedades
      const prefijoExistente = propiedades.find(p => p.prefijo === nuevaProp.prefijo.toUpperCase());
      if (prefijoExistente) {
        alert(`❌ Error: El prefijo "${nuevaProp.prefijo}" ya está siendo usado por ${prefijoExistente.nombre}.`);
        setCargando(false);
        return;
      }

      const batch = writeBatch(db);

      // 3. Crear Documento de Propiedad
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

      // 4. Crear Unidades Individuales
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
    <div className="p-6 max-w-6xl mx-auto space-y-8 text-gray-800">
      {/* FORMULARIO */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        <h2 className="text-xl font-black uppercase italic mb-6 flex items-center gap-2 text-blue-900">
          <span className="bg-blue-600 text-white p-2 rounded-lg shadow-lg text-lg">🏢</span>
          Registrar Nueva Propiedad
        </h2>
        
        <form onSubmit={handleAgregar} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">ID (Slug)</label>
            <input placeholder="ej: dorado" type="text" className="w-full p-3 bg-gray-50 border rounded-xl text-sm font-mono" value={nuevaProp.id} onChange={(e) => handleIdChange(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Nombre Real</label>
            <input placeholder="Dorado Residencial" type="text" className="w-full p-3 bg-gray-50 border rounded-xl text-sm" value={nuevaProp.nombre} onChange={(e) => setNuevaProp({...nuevaProp, nombre: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Prefijo</label>
            <input placeholder="DOR" type="text" maxLength={4} className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm font-black text-blue-700" value={nuevaProp.prefijo} onChange={(e) => setNuevaProp({...nuevaProp, prefijo: e.target.value.toUpperCase()})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Unidades</label>
            <input type="number" className="w-full p-3 bg-gray-50 border rounded-xl text-sm" value={nuevaProp.total_unidades} onChange={(e) => setNuevaProp({...nuevaProp, total_unidades: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Agua $</label>
            <input type="number" className="w-full p-3 bg-gray-50 border rounded-xl text-sm" value={nuevaProp.limite_agua} onChange={(e) => setNuevaProp({...nuevaProp, limite_agua: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Luz $</label>
            <input type="number" className="w-full p-3 bg-gray-50 border rounded-xl text-sm" value={nuevaProp.limite_luz} onChange={(e) => setNuevaProp({...nuevaProp, limite_luz: e.target.value})} />
          </div>
          <button disabled={cargando} className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl uppercase text-xs transition-all shadow-lg active:scale-95">
            {cargando ? '...' : 'Agregar'}
          </button>
        </form>
      </div>

      {/* TABLA ACTIVA */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
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
                    <input type="number" className="w-16 p-1 bg-blue-50 text-blue-700 rounded font-bold text-xs" defaultValue={prop.limite_agua} onBlur={(e) => handleUpdateField(prop.id, 'limite_agua', e.target.value)} />
                    <input type="number" className="w-16 p-1 bg-amber-50 text-amber-700 rounded font-bold text-xs" defaultValue={prop.limite_luz} onBlur={(e) => handleUpdateField(prop.id, 'limite_luz', e.target.value)} />
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => handleClausurarPropiedad(prop)} className="p-2 text-gray-300 hover:text-red-600 transition-colors" title="Clausurar">🚫</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* HISTÓRICO */}
      {propsInactivas.length > 0 && (
        <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-6">
          <h3 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest flex items-center gap-2">
            📁 Archivo de Propiedades Clausuradas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {propsInactivas.map(prop => (
              <div key={prop.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-gray-400 uppercase">{prop.nombre}</p>
                  <p className="text-[9px] text-gray-300 italic">ID: {prop.id} | Prefijo: {prop.prefijo}</p>
                </div>
                <button onClick={() => handleReactivarPropiedad(prop)} className="text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-all uppercase">
                   Reactivar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionPropiedades;