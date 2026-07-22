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
    <div className="grid min-h-screen grid-cols-[1fr_1.1fr] max-[860px]:grid-cols-1">
      <section
        className="relative flex items-end overflow-hidden bg-pine-900 p-12 max-[860px]:min-h-[220px] max-[860px]:p-8"
        aria-hidden="true"
      >
        <svg
          className="absolute inset-0 h-full w-full [&>path]:fill-none [&>path]:stroke-[1.5] [&>path:nth-child(odd)]:stroke-gold-500/25 [&>path:nth-child(even)]:stroke-paper-50/15"
          viewBox="0 0 600 800"
          preserveAspectRatio="xMidYMid slice"
        >
          <path d="M-50,120 C120,60 220,180 380,110 C500,60 600,140 650,90" />
          <path d="M-50,220 C100,160 240,280 380,210 C520,140 600,240 650,190" />
          <path d="M-50,320 C130,260 230,380 400,300 C520,240 600,340 650,290" />
          <path d="M-50,420 C110,370 250,470 390,400 C510,340 600,430 650,390" />
          <path d="M-50,520 C140,470 220,560 400,500 C520,460 600,540 650,500" />
          <path d="M-50,620 C120,580 240,660 400,600 C520,560 600,640 650,610" />
          <path d="M-50,720 C130,690 230,750 400,700 C520,670 600,740 650,720" />
        </svg>

        <div className="relative z-10 flex flex-col gap-3">
          <span className="font-display text-4xl font-semibold text-paper-50 max-[860px]:text-3xl">DSSSMS</span>
          <p className="max-w-[26ch] font-body text-base leading-relaxed text-paper-100">
            Dinsho Secondary School
            <br />
            Student Management System
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-[380px]">
          <h1 className="text-[1.75rem]">Sign in</h1>
          <LedgerRule />
          <p className="mb-6 text-[0.9375rem] text-slate-500">
            Use the username and password issued by your administrator.
          </p>

          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col">
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
              <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
                {serverError}
              </p>
            )}

            <Button type="submit" isLoading={isSubmitting} className="mt-1 w-full">
              Sign in
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
