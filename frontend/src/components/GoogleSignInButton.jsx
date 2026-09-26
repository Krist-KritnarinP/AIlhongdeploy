import { useEffect, useRef } from 'react';

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

function GoogleSignInButton({ onCredential, disabled = false, locale = 'en' }) {
  const mountRef = useRef(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !mountRef.current) return undefined;
    let cancelled = false;
    const render = () => {
      if (cancelled || !mountRef.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: response => {
          if (response.credential) callbackRef.current(response.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_button: true,
      });
      window.google.accounts.id.renderButton(mountRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        logo_alignment: 'left',
        width: Math.min(360, mountRef.current.clientWidth || 320),
        locale,
      });
    };

    let script = document.querySelector(`script[src="${GOOGLE_SCRIPT}"]`);
    if (window.google?.accounts?.id) render();
    else if (script) script.addEventListener('load', render, { once: true });
    else {
      script = document.createElement('script');
      script.src = GOOGLE_SCRIPT;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', render, { once: true });
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      script?.removeEventListener('load', render);
    };
  }, [clientId, locale]);

  if (!clientId) {
    return <button type="button" className="btn btn-outline w-full" disabled title="Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in">Continue with Google</button>;
  }

  return (
    <div className={`btn btn-outline h-12 min-h-12 w-full overflow-hidden p-0 ${disabled ? 'pointer-events-none opacity-60' : ''}`} aria-label="Continue with Google">
      <div ref={mountRef} className="flex h-full w-full items-center justify-center" />
    </div>
  );
}

export default GoogleSignInButton;
