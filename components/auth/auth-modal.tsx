'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AuthForms } from "./auth-forms";
import Image from "next/image";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultMode?: 'login' | 'forgot';
}

export function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md p-0 overflow-hidden bg-zinc-950 border-white/10 shadow-2xl rounded-3xl">
                <DialogHeader className="sr-only">
                    <DialogTitle>Authentication</DialogTitle>
                </DialogHeader>
                <div className="relative p-8 pt-12">
                    {/* Background effects */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/20 blur-[80px] -z-10 rounded-full"></div>

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

                    <AuthForms defaultMode={defaultMode} onSuccess={onClose} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
