"use client";

import React from "react";
import Image from "next/image";

interface SPLoaderProps {
    fullScreen?: boolean;
}

export const SPLoader = ({ fullScreen = false }: SPLoaderProps) => {
    return (
        <div className={`${fullScreen ? 'fixed inset-0' : 'absolute inset-0 min-h-[400px]'} z-[50] flex items-center justify-center bg-white/80 backdrop-blur-md transition-all duration-500`}>
            <div className="relative flex flex-col items-center justify-center">

                {/* Animated Background Glow */}
                <div className="absolute w-64 h-64 bg-primary/10 rounded-full blur-[80px] animate-pulse"></div>

                {/* Circular Container */}
                <div className="relative w-40 h-40 flex items-center justify-center">
                    {/* Outer Spinning Border */}
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary/30 animate-[spin_2s_linear_infinite]"></div>

                    {/* Inner White Circle */}
                    <div className="w-32 h-32 bg-white rounded-full border-2 border-primary/20 flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.05)] relative overflow-hidden group">

                        {/* Mirror Shimmer Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 skew-x-12"></div>

                        <div className="relative z-10 w-24 h-24 flex items-center justify-center animate-pulse">
                            <Image
                                src="/SP_logo.png"
                                alt="ScalePods Logo"
                                width={100}
                                height={100}
                                className="object-contain"
                                priority
                            />
                        </div>
                    </div>
                </div>

                {/* Advanced Text Section */}
                <div className="mt-10 text-center space-y-3">
                    <div className="flex flex-col items-center">
                        <h2 className="text-3xl font-black italic tracking-wider uppercase text-slate-900">
                            SCALE<span className="text-slate-600">PODS</span>
                        </h2>
                        <div className="h-[2px] w-24 bg-gradient-to-r from-transparent via-slate-400 to-transparent mt-1"></div>
                    </div>

                    <p className="text-[10px] font-bold tracking-[0.4em] text-slate-600 uppercase">
                        AI Automation Infrastructure
                    </p>
                    <p className="text-[10px] font-bold tracking-[0.4em] text-slate-500 uppercase">
                        Please wait loading...
                    </p>

                    {/* Loading Indicator */}
                    <div className="flex items-center justify-center gap-2 mt-4">
                        <div className="w-2 h-2 rounded-full bg-slate-900 animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 rounded-full bg-slate-700 animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SPLoader;
