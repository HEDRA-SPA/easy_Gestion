import React, { useState } from 'react';
import { auth } from '../../firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Credenciales incorrectas o usuario no autorizado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white p-10 rounded-3xl shadow-2xl border-2 border-blue-600 max-w-sm w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black uppercase italic text-gray-800">Panel Admin</h2>
          <p className="text-blue-600 font-bold text-[10px] uppercase tracking-widest">Gestión de Rentas</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Email de acceso</label>
            <input 
              required type="email" 
              className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-sm outline-blue-500"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase">Contraseña</label>
            <input 
              required type="password" 
              className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-sm outline-blue-500"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-red-500 text-[10px] font-black uppercase text-center">{error}</p>}
          <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-200 transition-all hover:bg-blue-700"
          >
            {loading ? "Verificando..." : "Entrar al Sistema"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;