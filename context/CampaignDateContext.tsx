"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export interface CampaignDateRange {
    from: Date | undefined;
    to?: Date | undefined;
}

interface CampaignDateContextType {
    dateRange: CampaignDateRange;
    setDateRange: (range: CampaignDateRange | undefined, label?: string) => void;
    dateLabel: string | undefined;
    fromIso: string | undefined;
    toIso: string | undefined;
    isDefault: boolean;
    resetToDefault: () => void;
    clearDateFilter: () => void;
}

const CampaignDateContext = createContext<CampaignDateContextType | undefined>(undefined);

const STORAGE_KEY_FROM = 'campaigns_date_from';
const STORAGE_KEY_TO = 'campaigns_date_to';
const STORAGE_KEY_LABEL = 'campaigns_date_label';

export function getDefaultCampaignDateRange(): CampaignDateRange {
    const today = new Date();
    return {
        from: subDays(today, 30),
        to: today,
    };
}

export function CampaignDateProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();

    // Initialize from URL searchParams, fallback to sessionStorage, fallback to dynamic default (last 30 days)
    const [dateRange, setDateRangeState] = useState<CampaignDateRange>(() => {
        const defaultRange = getDefaultCampaignDateRange();

        // 1. Check URL parameters
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const pFrom = urlParams.get('from');
            const pTo = urlParams.get('to');
            if (pFrom) {
                const parsedFrom = new Date(pFrom);
                const parsedTo = pTo ? new Date(pTo) : parsedFrom;
                if (!isNaN(parsedFrom.getTime()) && !isNaN(parsedTo.getTime())) {
                    return {
                        from: startOfDay(parsedFrom),
                        to: endOfDay(parsedTo),
                    };
                }
            }

            // 2. Check SessionStorage
            try {
                const sFrom = sessionStorage.getItem(STORAGE_KEY_FROM);
                const sTo = sessionStorage.getItem(STORAGE_KEY_TO);
                if (sFrom) {
                    const parsedFrom = new Date(sFrom);
                    const parsedTo = sTo ? new Date(sTo) : parsedFrom;
                    if (!isNaN(parsedFrom.getTime()) && !isNaN(parsedTo.getTime())) {
                        return {
                            from: startOfDay(parsedFrom),
                            to: endOfDay(parsedTo),
                        };
                    }
                }
            } catch {
                // Ignore storage access errors
            }
        }

        return defaultRange;
    });

    const [dateLabel, setDateLabel] = useState<string | undefined>(() => {
        if (typeof window !== 'undefined') {
            try {
                return sessionStorage.getItem(STORAGE_KEY_LABEL) || undefined;
            } catch {
                return undefined;
            }
        }
        return undefined;
    });

    // Synchronize whenever URL changes externally (e.g. back/forward navigation or route changes)
    useEffect(() => {
        const syncFromUrl = () => {
            if (typeof window === 'undefined') return;
            const params = new URLSearchParams(window.location.search);
            const pFrom = params.get('from');
            const pTo = params.get('to');
            if (pFrom) {
                const parsedFrom = new Date(pFrom);
                const parsedTo = pTo ? new Date(pTo) : parsedFrom;
                if (!isNaN(parsedFrom.getTime()) && !isNaN(parsedTo.getTime())) {
                    const normFrom = startOfDay(parsedFrom);
                    const normTo = endOfDay(parsedTo);
                    setDateRangeState(prev => {
                        if (prev.from?.getTime() === normFrom.getTime() && prev.to?.getTime() === normTo.getTime()) {
                            return prev;
                        }
                        return { from: normFrom, to: normTo };
                    });
                }
            }
        };

        syncFromUrl();
        window.addEventListener('popstate', syncFromUrl);
        return () => window.removeEventListener('popstate', syncFromUrl);
    }, [pathname]);

    const setDateRange = useCallback((range: CampaignDateRange | undefined, label?: string) => {
        if (!range || !range.from) {
            // Cleared
            setDateRangeState({ from: undefined, to: undefined });
            setDateLabel(undefined);
            try {
                sessionStorage.removeItem(STORAGE_KEY_FROM);
                sessionStorage.removeItem(STORAGE_KEY_TO);
                sessionStorage.removeItem(STORAGE_KEY_LABEL);
            } catch {}

            // Update URL without from/to
            const params = new URLSearchParams(window.location.search);
            params.delete('from');
            params.delete('to');
            const qs = params.toString();
            router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
            return;
        }

        const normalizedFrom = startOfDay(range.from);
        const normalizedTo = endOfDay(range.to || range.from);

        setDateRangeState({ from: normalizedFrom, to: normalizedTo });
        setDateLabel(label);

        try {
            sessionStorage.setItem(STORAGE_KEY_FROM, normalizedFrom.toISOString());
            sessionStorage.setItem(STORAGE_KEY_TO, normalizedTo.toISOString());
            if (label) {
                sessionStorage.setItem(STORAGE_KEY_LABEL, label);
            } else {
                sessionStorage.removeItem(STORAGE_KEY_LABEL);
            }
        } catch {}

        // Update URL search parameters
        const params = new URLSearchParams(window.location.search);
        params.set('from', normalizedFrom.toISOString());
        params.set('to', normalizedTo.toISOString());
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [pathname, router]);

    const resetToDefault = useCallback(() => {
        const defaultRange = getDefaultCampaignDateRange();
        setDateRange(defaultRange, "Last 30 days");
    }, [setDateRange]);

    const clearDateFilter = useCallback(() => {
        setDateRange(undefined);
    }, [setDateRange]);

    const fromIso = useMemo(() => {
        return dateRange.from ? startOfDay(dateRange.from).toISOString() : undefined;
    }, [dateRange.from]);

    const toIso = useMemo(() => {
        if (!dateRange.to && !dateRange.from) return undefined;
        return endOfDay(dateRange.to || dateRange.from!).toISOString();
    }, [dateRange.from, dateRange.to]);

    const isDefault = useMemo(() => {
        if (!dateRange.from || !dateRange.to) return false;
        const d = getDefaultCampaignDateRange();
        const diffDays = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 29 && diffDays <= 31;
    }, [dateRange]);

    return (
        <CampaignDateContext.Provider
            value={{
                dateRange,
                setDateRange,
                dateLabel,
                fromIso,
                toIso,
                isDefault,
                resetToDefault,
                clearDateFilter,
            }}
        >
            {children}
        </CampaignDateContext.Provider>
    );
}

export function useCampaignDateRange() {
    const context = useContext(CampaignDateContext);
    if (!context) {
        throw new Error('useCampaignDateRange must be used within a CampaignDateProvider');
    }
    return context;
}

