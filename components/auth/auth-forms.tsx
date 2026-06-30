'use client';

import { useState, useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { login, forgotPassword } from '@/app/actions/auth';

type AuthMode = 'login' | 'forgot';

import Image from 'next/image';

export function AuthForms({ defaultMode = 'login', onSuccess }: { defaultMode?: AuthMode, onSuccess?: () => void }) {
    const [mode, setMode] = useState<AuthMode>(defaultMode);
    const [email, setEmail] = useState('');
    const router = useRouter();

    const [loginState, loginAction, isLoginPending] = useActionState(login, null as any);
    const [forgotState, forgotAction, isForgotPending] = useActionState(forgotPassword, null as any);

    useEffect(() => {
        if (loginState?.success) {
            router.push('/dashboard');
            onSuccess?.();
            router.refresh();
        }
    }, [loginState, router, onSuccess]);

    const error = loginState?.error || forgotState?.error;
    const isPending = isLoginPending || isForgotPending;
    const successMessage = forgotState?.message;

    return (
        <div className="w-full max-w-sm mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
                <div className="relative w-28 h-28 flex-shrink-0">
                    <Image
                        src="/SP_logo.png"
                        alt="ScalePods Logo"
                        fill
                        sizes="112px"
                        className="object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        priority
                    />
                </div>
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight text-white">
                        {mode === 'login' && 'Welcome Back'}
                        {mode === 'forgot' && 'Reset Password'}
                    </h1>
                    <p className="text-zinc-500 text-xs font-medium">
                        {mode === 'login' && 'Enter your credentials to access your dashboard'}
                        {mode === 'forgot' && 'Enter your email to receive a password reset link'}
                    </p>
                </div>
            </div>

            {error && (
                <div className="p-3 text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-center">
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="p-3 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg text-center">
                    {successMessage}
                </div>
            )}

            <form action={mode === 'login' ? loginAction : forgotAction} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email" className="text-zinc-300 text-xs font-bold uppercase tracking-wider">Email Address</Label>
                    <div className="relative group">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="hello@example.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl transition-all"
                        />
                    </div>
                </div>

                {mode === 'login' && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password" className="text-zinc-300 text-xs font-bold uppercase tracking-wider">Password</Label>

                            <button
                                type="button"
                                onClick={() => setMode('forgot')}
                                className="text-emerald-400 text-xs font-bold hover:underline"
                            >
                                Forgot password?
                            </button>
                        </div>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                required
                                className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl transition-all"
                            />
                        </div>
                    </div>
                )}

                <Button
                    type="submit"
                    disabled={isPending}
                    className="w-full h-11 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-slate-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all gap-2 group"
                >
                    {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            {mode === 'login' && 'Sign In'}
                            {mode === 'forgot' && 'Send Reset Link'}
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </Button>
            </form>

            {mode === 'forgot' && (
                <div className="text-center">
                    <button
                        onClick={() => setMode('login')}
                        className="text-emerald-400 text-xs font-bold hover:underline"
                    >
                        Back to Login
                    </button>
                </div>
            )}
        </div>
    );
}
