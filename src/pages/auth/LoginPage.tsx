import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { loginFormSchema } from '../../lib/validation/auth';
import type { LoginFormValues } from '../../lib/validation/auth';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginFormSchema) });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      await login(values.username, values.password);
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    }
  }

  return (
    <div className="login-screen">
      <section className="login-brand-panel" aria-hidden="true">
        <svg className="contour-pattern" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
          <path d="M-50,120 C120,60 220,180 380,110 C500,60 600,140 650,90" />
          <path d="M-50,220 C100,160 240,280 380,210 C520,140 600,240 650,190" />
          <path d="M-50,320 C130,260 230,380 400,300 C520,240 600,340 650,290" />
          <path d="M-50,420 C110,370 250,470 390,400 C510,340 600,430 650,390" />
          <path d="M-50,520 C140,470 220,560 400,500 C520,460 600,540 650,500" />
          <path d="M-50,620 C120,580 240,660 400,600 C520,560 600,640 650,610" />
          <path d="M-50,720 C130,690 230,750 400,700 C520,670 600,740 650,720" />
        </svg>

        <div className="login-brand-content">
          <span className="wordmark wordmark-lg">DSSSMS</span>
          <p className="login-brand-tagline">
            Dinsho Secondary School
            <br />
            Student Management System
          </p>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-wrap">
          <h1 className="login-heading">Sign in</h1>
          <LedgerRule />
          <p className="login-subheading">Use the username and password issued by your administrator.</p>

          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="login-form">
            <TextField
              label="Username"
              autoComplete="username"
              autoFocus
              error={errors.username?.message}
              {...register('username')}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />

            {serverError && (
              <p className="form-error-banner" role="alert">
                {serverError}
              </p>
            )}

            <Button type="submit" isLoading={isSubmitting} className="login-submit">
              Sign in
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
