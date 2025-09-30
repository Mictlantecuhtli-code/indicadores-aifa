import { useForm } from 'react-hook-form';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = handleSubmit(async values => {
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await signIn(values.email, values.password);
      if (signInError) {
        throw signInError;
      }
      navigate('/panel-directivos', { replace: true });
    } catch (err) {
      setError(err.message ?? 'No fue posible iniciar sesión');
    } finally {
      setLoading(false);
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-aifa-blue via-aifa-light to-aifa-blue/80 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/95 p-8 shadow-xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-aifa-blue">AIFA</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-800">Sistema de Indicadores</h1>
          <p className="mt-1 text-sm text-slate-500">Acceda con sus credenciales institucionales</p>
        </div>
        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Correo institucional
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              placeholder="usuario@aifa.gob.mx"
              {...register('email', { required: 'El correo es obligatorio' })}
            />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-aifa-blue focus:outline-none focus:ring-2 focus:ring-aifa-blue/30"
              placeholder="********"
              {...register('password', { required: 'La contraseña es obligatoria' })}
            />
            {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-aifa-blue px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-aifa-blue/20 transition hover:bg-aifa-light focus:outline-none focus:ring-2 focus:ring-aifa-blue/30 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <LogIn className="h-4 w-4" />
            {loading ? 'Validando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
