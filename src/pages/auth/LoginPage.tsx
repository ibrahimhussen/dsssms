import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MdVisibility,
  MdVisibilityOff,
  MdErrorOutline,
  MdSchool,
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { loginFormSchema } from '../../lib/validation/auth';
import type { LoginFormValues } from '../../lib/validation/auth';
import { getPostLoginRedirect } from '../../lib/role-redirect';
import { Button } from '../../components/ui/Button';

// ── Inline field component — matches the existing TextField API but gives
//    us full control over the password-field eye-icon placement ─────────────

interface FieldProps {
  id: string;
  label: string;
  type?: 'text' | 'password' | 'email';
  autoComplete?: string;
  autoFocus?: boolean;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<LoginFormValues>>['register']>;
  rightElement?: React.ReactNode;
}

function Field({ id, label, type = 'text', autoComplete, autoFocus, error, registration, rightElement }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.8125rem] font-semibold text-ink-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={[
            'w-full rounded-lg border bg-white px-3 py-2.5 font-body text-[0.9375rem] text-ink-900',
            'transition-colors placeholder:text-slate-300',
            'focus:outline-none focus:ring-2 focus:ring-pine-700/40 focus:border-pine-700',
            rightElement ? 'pr-10' : '',
            error ? 'border-danger-600 focus:ring-danger-600/30 focus:border-danger-600' : 'border-slate-200',
          ].join(' ')}
          {...registration}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {rightElement}
          </div>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1 text-[0.8125rem] text-danger-600" role="alert">
          <MdErrorOutline className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginFormSchema) });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const user = await login(values.username.trim(), values.password);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? null;
      navigate(getPostLoginRedirect(user.role, from), { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-paper-100 flex flex-col lg:flex-row">

      {/* ── LEFT — Brand panel ───────────────────────────────────────────────── */}
      <div
        className="relative lg:w-[42%] lg:min-h-screen flex-shrink-0 overflow-hidden bg-pine-900
                   flex flex-col justify-between
                   px-8 py-8 lg:px-14 lg:py-16
                   max-lg:min-h-[200px]"
        aria-hidden="true"
      >
        {/* Subtle ruled-ledger texture */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-100"
          viewBox="0 0 480 800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          {/* Horizontal ruled lines — evoking a school exercise book */}
          {[80, 140, 200, 260, 320, 380, 440, 500, 560, 620, 680, 740].map((y) => (
            <line key={y} x1="0" y1={y} x2="480" y2={y} stroke="white" strokeWidth="0.5" strokeOpacity="0.06" />
          ))}
          {/* Left margin rule — the red line of a lined notebook */}
          <line x1="68" y1="0" x2="68" y2="800" stroke="#c08a28" strokeWidth="1" strokeOpacity="0.18" />
          {/* Subtle radial glow from bottom left */}
          <radialGradient id="glow" cx="0%" cy="100%" r="70%">
            <stop offset="0%" stopColor="#2f6152" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#16302a" stopOpacity="0" />
          </radialGradient>
          <rect x="0" y="0" width="480" height="800" fill="url(#glow)" />
        </svg>

        {/* Top — school crest / icon mark */}
        <div className="relative z-10 flex items-center gap-3 max-lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/20 border border-gold-500/30">
            <MdSchool className="h-5 w-5 text-gold-500" />
          </div>
          <span className="text-sm font-semibold tracking-widest text-paper-100/70 uppercase">
            DSSSMS
          </span>
        </div>

        {/* Mobile top strip */}
        <div className="relative z-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/20 border border-gold-500/30">
            <MdSchool className="h-4 w-4 text-gold-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-paper-50 leading-tight">DSSSMS</p>
            <p className="text-xs text-paper-100/70 leading-tight">Dinsho Secondary School</p>
          </div>
        </div>

        {/* Bottom — school identity */}
        <div className="relative z-10 max-lg:hidden flex flex-col gap-6">
          {/* Decorative accent */}
          <div className="h-px w-12 bg-gold-500/50" />

          <div className="flex flex-col gap-2">
            <h2 className="font-display text-[2.25rem] font-semibold leading-tight text-paper-50">
              Dinsho
              <br />
              Secondary School
            </h2>
            <p className="text-[0.9375rem] leading-relaxed text-paper-100/70 max-w-[28ch]">
              Student Management System
            </p>
          </div>

          {/* Tagline divider */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[0.75rem] font-medium tracking-widest text-paper-100/40 uppercase">
                Secure Access
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <p className="text-[0.8125rem] text-paper-100/40 leading-relaxed">
              Authorized personnel only.
              <br />
              Credentials issued by the System Administrator.
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT — Login form ───────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 lg:px-12">
        <div className="w-full max-w-[400px]">

          {/* Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white px-8 py-9 shadow-sm shadow-slate-200/60">

            {/* Heading */}
            <div className="mb-7">
              <p className="mb-1 text-[0.8125rem] font-semibold uppercase tracking-widest text-pine-600">
                Welcome back
              </p>
              <h1 className="font-display text-[1.625rem] font-semibold leading-tight text-pine-900">
                Sign in to your account
              </h1>
              <p className="mt-1.5 text-[0.875rem] text-slate-500">
                Use the credentials issued by your administrator.
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
              noValidate
              className="flex flex-col gap-4"
            >
              <Field
                id="username"
                label="Username"
                autoComplete="username"
                autoFocus
                error={errors.username?.message}
                registration={register('username')}
              />

              <Field
                id="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                error={errors.password?.message}
                registration={register('password')}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-pine-700/40"
                  >
                    {showPassword
                      ? <MdVisibilityOff className="h-5 w-5" />
                      : <MdVisibility    className="h-5 w-5" />}
                  </button>
                }
              />

              {/* Server error */}
              {serverError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-2.5 rounded-lg border border-danger-600/20 bg-danger-100 px-3 py-2.5"
                >
                  <MdErrorOutline className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" aria-hidden="true" />
                  <p className="text-[0.875rem] text-danger-600">{serverError}</p>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                className="mt-1 w-full py-3 text-base"
              >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </div>

          {/* Footer */}
          <p className="mt-5 text-center text-[0.75rem] text-slate-400">
            Dinsho Secondary School &mdash; Authorized access only
          </p>
        </div>
      </div>
    </div>
  );
}
