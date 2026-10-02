import React, {
  useEffect,
  useState,
  useRef
} from 'react';

import ReCAPTCHA from 'react-google-recaptcha';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000/api';

export default function AuthContainer({
  alAutenticar
}) {
  const [
    isLogin,
    setIsLogin
  ] =
    useState(true);

  const [
    authFlow,
    setAuthFlow
  ] =
    useState('login');

  const [
    flowToken,
    setFlowToken
  ] =
    useState('');

  const [
    showPassword,
    setShowPassword
  ] =
    useState(false);

  const [
    showRegisterPassword,
    setShowRegisterPassword
  ] =
    useState(false);

  const [
    captchaToken,
    setCaptchaToken
  ] =
    useState(null);

  const recaptchaRef =
    useRef(null);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const resetToken = currentUrl.searchParams.get('reset-token');
    const verifyToken = currentUrl.searchParams.get('verify-token');
    const emailChangeToken = currentUrl.searchParams.get('email-change-token');
    const deletionToken = currentUrl.searchParams.get('delete-account-token');

    if (resetToken) {
      setFlowToken(resetToken);
      setAuthFlow('reset');
      currentUrl.searchParams.delete('reset-token');
    } else if (verifyToken) {
      setFlowToken(verifyToken);
      setAuthFlow('verify');
      currentUrl.searchParams.delete('verify-token');
    } else if (emailChangeToken) {
      setFlowToken(emailChangeToken);
      setAuthFlow('confirm-email-change');
      currentUrl.searchParams.delete('email-change-token');
    } else if (deletionToken) {
      setFlowToken(deletionToken);
      setAuthFlow('confirm-deletion');
      currentUrl.searchParams.delete('delete-account-token');
    }

    if (resetToken || verifyToken || emailChangeToken || deletionToken) {
      window.history.replaceState(
        {},
        document.title,
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
      );
    }
  }, []);

  // ==========================================================
  // ESTADOS DEL FORMULARIO
  // ==========================================================

  const [
    nombreCompleto,
    setNombreCompleto
  ] =
    useState('');

  const [
    rolRegistro,
    setRolRegistro
  ] =
    useState('Profesor');

  const [
    email,
    setEmail
  ] =
    useState('');

  const [
    password,
    setPassword
  ] =
    useState('');

  // ==========================================================
  // FEEDBACK
  // ==========================================================

  const [
    error,
    setError
  ] =
    useState('');

  const [
    mensajeExito,
    setMensajeExito
  ] =
    useState('');

  // ==========================================================
  // CAMBIAR VISTA
  // ==========================================================

  const alternarVista =
    (v) => {
      setIsLogin(v);

      if (
        recaptchaRef.current
      ) {
        recaptchaRef.current.reset();
      }

      setCaptchaToken(null);
      setError('');
      setMensajeExito('');
      setEmail('');
      setPassword('');
      setNombreCompleto('');
      setRolRegistro('Profesor');
      setShowPassword(false);
      setShowRegisterPassword(false);
      setAuthFlow('login');
      setFlowToken('');
    };

  const volverAlLogin = (mantenerMensaje = false) => {
    setAuthFlow('login');
    setFlowToken('');
    setIsLogin(true);
    setPassword('');
    setError('');
    if (!mantenerMensaje) {
      setMensajeExito('');
    }
  };

  // ==========================================================
  // LOGIN
  // ==========================================================

  const handleLoginSubmit =
    async (
      e
    ) => {
      e.preventDefault();

      setError('');
      setMensajeExito('');

      if (
        !email ||
        !password
      ) {
        setError(
          'Por favor, rellena todos los campos.'
        );

        return;
      }

      if (
        !captchaToken
      ) {
        setError(
          'Por favor, completa el reCAPTCHA de seguridad.'
        );

        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/auth/login`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  email,
                  password,
                  captchaToken
                })
            }
          );

        const data =
          await response.json();

          if (
            !response.ok
          ) {
          setError(
            data.error ||
              'Error al iniciar sesión.'
          );

          if (
            recaptchaRef.current
          ) {
            recaptchaRef.current.reset();
          }

            setCaptchaToken(null);

            if (data.code === 'EMAIL_NOT_VERIFIED') {
              setAuthFlow('resend-verification');
            }

          return;
        }

        // ====================================================
        // SESIÓN
        // ====================================================

        sessionStorage.setItem(
          'token',
          data.token
        );

        sessionStorage.setItem(
          'userId',
          data.user.id
        );

        localStorage.setItem(
          'token',
          data.token
        );

        localStorage.setItem(
          'userId',
          data.user.id
        );

        const usuarioFormateado = {
          id:
            data.user.id,

          nombre_completo:
            data.user.nombre_completo,

          email:
            data.user.email,

          rol:
            data.user.rol
        };

        alAutenticar(
          usuarioFormateado
        );
      } catch (err) {
        console.error(
          'Error conectando con el backend:',
          err
        );

        setError(
          'No se pudo conectar con el servidor. Verifica que esté encendido.'
        );

        if (
          recaptchaRef.current
        ) {
          recaptchaRef.current.reset();
        }

        setCaptchaToken(null);
      }
    };

  // ==========================================================
  // REGISTRO
  // ==========================================================

  const handleRegisterSubmit =
    async (
      e
    ) => {
      e.preventDefault();

      setError('');
      setMensajeExito('');

      if (
        !nombreCompleto ||
        !email ||
        !password
      ) {
        setError(
          'Todos los campos son obligatorios para el registro.'
        );

        return;
      }

      if (
        !captchaToken
      ) {
        setError(
          'Por favor, completa el reCAPTCHA de seguridad.'
        );

        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/auth/register`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  nombre_completo:
                    nombreCompleto,

                  email,

                  password,

                  rol: rolRegistro,

                  captchaToken
                })
            }
          );

        const data =
          await response.json();

        if (
          !response.ok
        ) {
          setError(
            data.error ||
              'Error al crear la cuenta.'
          );

          if (
            recaptchaRef.current
          ) {
            recaptchaRef.current.reset();
          }

          setCaptchaToken(null);

          return;
        }

        setMensajeExito(
          `Cuenta creada como ${rolRegistro}. Revisa tu correo y verifica la cuenta antes de iniciar sesión.`
        );

        setTimeout(
          () => {
            alternarVista(true);
          },
          2000
        );
      } catch (err) {
        console.error(
          'Error de registro:',
          err
        );

        setError(
          'Error de red. No se pudo guardar el usuario.'
        );

        if (
          recaptchaRef.current
        ) {
          recaptchaRef.current.reset();
        }

        setCaptchaToken(null);
      }
    };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMensajeExito('');

    try {
      const response = await fetch(
        `${API_URL}/auth/forgot-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo procesar la solicitud.');
      }

      setMensajeExito(
        data.message || 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.'
      );
    } catch (requestError) {
      setError(requestError.message || 'No se pudo conectar con el servidor.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMensajeExito('');

    try {
      const response = await fetch(
        `${API_URL}/auth/reset-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: flowToken, password })
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo restablecer la contraseña.');
      }

      setMensajeExito(
        data.message || 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.'
      );
      setAuthFlow('reset-success');
      setFlowToken('');
      setPassword('');
    } catch (requestError) {
      setError(requestError.message || 'No se pudo conectar con el servidor.');
    }
  };

  const handleVerifyEmail = async () => {
    setError('');
    setMensajeExito('');

    try {
      const response = await fetch(
        `${API_URL}/auth/verify-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: flowToken })
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo verificar el correo.');
      }

      setMensajeExito(
        data.message || 'Correo verificado correctamente. Ya puedes iniciar sesión.'
      );
      setAuthFlow('verify-success');
      setFlowToken('');
    } catch (requestError) {
      setError(requestError.message || 'No se pudo conectar con el servidor.');
    }
  };

  const handleConfirmAccountAction = async () => {
    setError('');
    setMensajeExito('');
    const isDeletion = authFlow === 'confirm-deletion';
    const endpoint = isDeletion
      ? 'http://localhost:5000/api/settings/account/deletion-confirm'
      : 'http://localhost:5000/api/settings/email/confirm';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: flowToken })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo confirmar la solicitud.');
      setMensajeExito(data.message);
      setFlowToken('');
      setAuthFlow(isDeletion ? 'deletion-success' : 'email-change-success');
    } catch (requestError) {
      setError(requestError.message || 'No se pudo conectar con el servidor.');
    }
  };

  const handleResendVerification = async (e) => {
    e.preventDefault();
    setError('');
    setMensajeExito('');

    try {
      const response = await fetch(
        `${API_URL}/auth/resend-verification`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo procesar la solicitud.');
      }

      setMensajeExito(data.message);
    } catch (requestError) {
      setError(requestError.message || 'No se pudo conectar con el servidor.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-6 sm:p-10 font-sans selection:bg-blue-500 selection:text-white">

      <div className="flex-1 flex items-center justify-center">

        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6 transition-all duration-300">

          <div
            className="flex items-center gap-3 group cursor-pointer"
            onClick={() =>
              alternarVista(true)
            }
          >

            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center shadow-md shadow-blue-500/20 transition-transform group-hover:scale-105">

              <span className="text-white font-black text-xl tracking-tighter">
                A
              </span>

            </div>

            <div>

              <h2 className="text-sm font-bold text-slate-800 leading-none tracking-tight">
                ARCHIVE
                <span className="text-emerald-500 font-extrabold">
                  X
                </span>
              </h2>

              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                Gestion de Archivos
              </span>

            </div>

          </div>

          {error && (
            <div className="p-3 text-xs font-semibold text-red-600 bg-red-50 rounded-xl border border-red-100 text-center whitespace-pre-wrap">
              ⚠️ {error}
            </div>
          )}

          {mensajeExito && (
            <div className="p-3 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
              🎉 {mensajeExito}
            </div>
          )}

          {authFlow !== 'login' && authFlow !== 'register' ? (
            <div className="space-y-6 animate-fade-in">
              {authFlow === 'forgot' && (
                <>
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Recuperar contraseña
                    </h1>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Introduce tu correo. Si está registrado, recibirás un enlace para restablecer la contraseña.
                    </p>
                  </div>
                  <form className="space-y-4" onSubmit={handleForgotPassword}>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Correo
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ejemplo@correo.com"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-200"
                      />
                    </div>
                    <button type="submit" className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all duration-150 shadow-sm">
                      Enviar enlace
                    </button>
                  </form>
                  <button type="button" onClick={() => volverAlLogin()} className="w-full text-xs font-semibold text-blue-600 hover:underline">
                    Volver al inicio de sesión
                  </button>
                </>
              )}

              {authFlow === 'resend-verification' && (
                <>
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Verifica tu correo
                    </h1>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Tu cuenta aún no está activa. Enviaremos otro enlace de verificación.
                    </p>
                  </div>
                  <form className="space-y-4" onSubmit={handleResendVerification}>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Correo
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ejemplo@correo.com"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-200"
                      />
                    </div>
                    <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-all duration-150 shadow-sm">
                      Reenviar enlace
                    </button>
                  </form>
                  <button type="button" onClick={() => volverAlLogin()} className="w-full text-xs font-semibold text-blue-600 hover:underline">
                    Volver al inicio de sesión
                  </button>
                </>
              )}

              {authFlow === 'reset' && (
                <>
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Nueva contraseña
                    </h1>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Elige una contraseña de entre 8 y 128 caracteres.
                    </p>
                  </div>
                  <form className="space-y-4" onSubmit={handleResetPassword}>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Nueva contraseña
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-200"
                      />
                    </div>
                    <button type="submit" className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all duration-150 shadow-sm">
                      Cambiar contraseña
                    </button>
                  </form>
                  <button type="button" onClick={() => volverAlLogin()} className="w-full text-xs font-semibold text-blue-600 hover:underline">
                    Volver al inicio de sesión
                  </button>
                </>
              )}

              {authFlow === 'verify' && (
                <>
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Verificar correo
                    </h1>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Confirma tu dirección de correo para activar la cuenta de ArchiveX.
                    </p>
                  </div>
                  <button type="button" onClick={handleVerifyEmail} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-all duration-150 shadow-sm">
                    Verificar correo
                  </button>
                  <button type="button" onClick={() => volverAlLogin()} className="w-full text-xs font-semibold text-blue-600 hover:underline">
                    Volver al inicio de sesión
                  </button>
                </>
              )}

              {(authFlow === 'confirm-email-change' || authFlow === 'confirm-deletion') && (
                <>
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                      {authFlow === 'confirm-deletion' ? 'Confirmar eliminación de cuenta' : 'Confirmar nuevo correo'}
                    </h1>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {authFlow === 'confirm-deletion'
                        ? 'Confirma para desactivar el acceso y programar la anonimización en 30 días. Tus expedientes se conservarán.'
                        : 'Confirma para actualizar el correo asociado a tu cuenta.'}
                    </p>
                  </div>
                  <button type="button" onClick={handleConfirmAccountAction} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-all duration-150 shadow-sm">
                    Confirmar
                  </button>
                </>
              )}

              {(authFlow === 'reset-success' || authFlow === 'verify-success' || authFlow === 'email-change-success' || authFlow === 'deletion-success') && (
                <>
                  <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                      {authFlow === 'reset-success' ? 'Contraseña actualizada'
                        : authFlow === 'verify-success' ? 'Correo verificado'
                          : authFlow === 'email-change-success' ? 'Correo actualizado' : 'Solicitud confirmada'}
                    </h1>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {authFlow === 'deletion-success' ? 'Se cerraron las sesiones de la cuenta; los expedientes institucionales se conservarán.' : 'Ya puedes volver al inicio de sesión.'}
                    </p>
                  </div>
                  {authFlow !== 'deletion-success' && <button type="button" onClick={() => volverAlLogin(true)} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all duration-150 shadow-sm">
                    Ir al inicio de sesión
                  </button>}
                </>
              )}
            </div>
          ) : isLogin ? (
            <div className="space-y-6 animate-fade-in">

              <div className="space-y-1.5">

                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Inicia Sesión
                </h1>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Introduce tu correo y contraseña para ingresar al sistema.
                </p>

              </div>

              <form
                className="space-y-4"
                onSubmit={
                  handleLoginSubmit
                }
              >

                <div className="space-y-1.5">

                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Correo
                  </label>

                  <input
                    type="email"
                    value={email}
                    onChange={(
                      e
                    ) =>
                      setEmail(
                        e.target.value
                      )
                    }
                    placeholder="ejemplo@correo.com"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-200"
                  />

                </div>

                <div className="space-y-1.5">

                  <div className="flex justify-between items-center">

                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Contraseña
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setMensajeExito('');
                        setAuthFlow('forgot');
                      }}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>

                  </div>

                  <div className="relative">

                    <input
                      type={
                        showPassword
                          ? 'text'
                          : 'password'
                      }
                      value={password}
                      onChange={(
                        e
                      ) =>
                        setPassword(
                          e.target.value
                        )
                      }
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-200 pr-16"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          !showPassword
                        )
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors duration-150"
                    >
                      {showPassword
                        ? 'Ocultar'
                        : 'Mostrar'}
                    </button>

                  </div>

                </div>

                <div className="flex justify-center my-2">

                  <ReCAPTCHA
                    ref={
                      recaptchaRef
                    }
                    sitekey="6LfwDj4tAAAAANDLp_sh7UeUC1e8sgZ1LUfMBglj"
                    onChange={(
                      token
                    ) =>
                      setCaptchaToken(
                        token
                      )
                    }
                  />

                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all duration-150 shadow-sm active:scale-[0.99] mt-2"
                >
                  Acceder al Sistema
                </button>

              </form>

              <div className="text-center pt-2">

                <p className="text-xs text-slate-500">

                  ¿No tienes credenciales asignadas?{' '}

                  <button
                    onClick={() =>
                      alternarVista(
                        false
                      )
                    }
                    className="font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Regístrate
                  </button>

                </p>

              </div>

            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">

              <div className="space-y-1.5">

                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Solicitud de Cuenta
                </h1>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Crea una cuenta personal para utilizar ArchiveX.
                </p>

              </div>

              <form
                className="space-y-4"
                onSubmit={
                  handleRegisterSubmit
                }
              >

                <div className="space-y-1.5">

                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Nombre Completo
                  </label>

                  <input
                    type="text"
                    value={
                      nombreCompleto
                    }
                    onChange={(
                      e
                    ) =>
                      setNombreCompleto(
                        e.target.value
                      )
                    }
                    placeholder="Juan Pérez"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-200"
                  />

                </div>

                <div className="space-y-1.5">

                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Correo
                  </label>

                  <input
                    type="email"
                    value={
                      email
                    }
                    onChange={(
                      e
                    ) =>
                      setEmail(
                        e.target.value
                      )
                    }
                    placeholder="ejemplo@correo.com"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-200"
                  />

                </div>

                <div className="space-y-1.5">

                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Contraseña
                  </label>

                  <div className="relative">

                    <input
                      type={
                        showRegisterPassword
                          ? 'text'
                          : 'password'
                      }
                      value={
                        password
                      }
                      onChange={(
                        e
                      ) =>
                        setPassword(
                          e.target.value
                        )
                      }
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-200 pr-16"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowRegisterPassword(
                          !showRegisterPassword
                        )
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors duration-150"
                    >
                      {showRegisterPassword
                        ? 'Ocultar'
                        : 'Mostrar'}
                    </button>

                  </div>

                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Rol
                  </label>
                  <select
                    value={rolRegistro}
                    onChange={(e) => setRolRegistro(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-200"
                  >
                    <option value="Profesor">Profesor</option>
                    <option value="Docente">Docente</option>
                  </select>
                </div>

                <div className="flex justify-center my-2">

                  <ReCAPTCHA
                    ref={
                      recaptchaRef
                    }
                    sitekey="6LfwDj4tAAAAANDLp_sh7UeUC1e8sgZ1LUfMBglj"
                    onChange={(
                      token
                    ) =>
                      setCaptchaToken(
                        token
                      )
                    }
                  />

                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-all duration-150 shadow-sm active:scale-[0.99] mt-2"
                >
                  Registrarse
                </button>

              </form>

              <div className="text-center pt-2">

                <p className="text-xs text-slate-500">

                  ¿Ya tienes una cuenta asignada?{' '}

                  <button
                    onClick={() =>
                      alternarVista(true)
                    }
                    className="font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Inicia sesión
                  </button>

                </p>

              </div>

            </div>
          )}

        </div>

      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-between items-center border-t border-slate-200/60 pt-4 text-[11px] font-medium text-slate-400">

        <span className="flex items-center gap-1.5">

          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>

          Infraestructura Segura (SSL)

        </span>

        <span>
          Versión 2026.1
        </span>

      </div>

    </div>
  );
}
