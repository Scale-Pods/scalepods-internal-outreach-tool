'use client';

import { useActionState, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { resetPassword } from '@/app/actions/auth';
import Image from 'next/image';

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [state, action, isPending] = useActionState(resetPassword, null as any);
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        if (state?.success) {
            const timer = setInterval(() => {
                setCountdown((prev) => prev - 1);
            }, 1000);

            const redirect = setTimeout(() => {
                router.push('/');
            }, 5000);

            return () => {
                clearInterval(timer);
                clearTimeout(redirect);
            };
        }
    }, [state?.success, router]);

    if (!token) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="inline-flex p-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mb-4">
                        <AlertCircle className="h-10 w-10" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Invalid Request</h1>
                    <p className="text-zinc-400">The password reset link is missing its security token.</p>
                    <Button onClick={() => router.push('/')} className="bg-white text-black hover:bg-zinc-200">
                        Return Home
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black selection:bg-emerald-500/30 font-sans flex items-center justify-center p-6">
            {/* Background effects */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[120px] pointer-events-none"></div>

            <div className="max-w-md w-full bg-zinc-950/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10">
                <div className="flex flex-col items-center mb-10 gap-2">
                    <div className="relative w-16 h-16">
                        <Image
                            src="/SP_logo.png"
                            alt="ScalePods Logo"
                            fill
                            className="object-contain drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                            priority
                        />
                    </div>
                    <span className="text-xl font-black tracking-tight text-white uppercase">
                        ScalePods
                    </span>
                </div>

                {state?.success ? (
                    <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                        <div className="inline-flex p-4 rounded-full bg-emerald-500/10 border border-bordermerald-500/20 text-emerald-500">
                            <CheckCircle2 className="h-10 w-10" />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-white">Password Updated</h1>
                            <p className="text-zinc-400 text-sm">Your password has been securely reset. You can now use your new credentials to sign in.</p>
                        </div>
                        <div className="pt-4">
                            <p className="text-xs text-zinc-500 mb-4 tracking-wider uppercase font-bold">Redirecting to login in {countdown}s...</p>
                            <Button onClick={() => router.push('/')} className="w-full h-11 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl transition-all">
                                Sign In Now
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="space-y-2 text-center">
                            <h1 className="text-2xl font-bold tracking-tight text-white">Create New Password</h1>
                            <p className="text-zinc-400 text-sm">Your new password must be at least 8 characters long.</p>
                        </div>

                        {state?.error && (
                            <div className="p-3 text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-center">
                                {state.error}
                            </div>
                        )}

                        <form action={action} className="space-y-4">
                            <input type="hidden" name="token" value={token} />

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-zinc-300 text-xs font-bold uppercase tracking-wider">New Password</Label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder="••••••••"
                                        required
                                        className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-bordermerald-500/50 focus:ring-emerald-500/20 rounded-xl transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-zinc-300 text-xs font-bold uppercase tracking-wider">Confirm Password</Label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
                                    <Input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        placeholder="••••••••"
                                        required
                                        className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-bordermerald-500/50 focus:ring-emerald-500/20 rounded-xl transition-all"
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isPending}
                                className="w-full h-11 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-slate-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all gap-2 group mt-2"
                            >
                                {isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        Update Password
                                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </Button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white font-bold">
                Loading...
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
