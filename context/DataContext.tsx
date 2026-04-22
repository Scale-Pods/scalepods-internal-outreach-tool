"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { consolidateLeads, ConsolidatedLead } from "@/lib/leads-utils";
import { supabase } from "@/lib/supabase";

interface DataContextType {
    leads: ConsolidatedLead[];
    calls: any[];
    loadingLeads: boolean;
    loadingCalls: boolean;
    loadingBalances: boolean;
    voiceBalance: any;
    maqsamBalance: any;
    twilioBalance: any;
    error: string | null;
    refreshLeads: () => Promise<void>;
    refreshCalls: (from?: Date, to?: Date) => Promise<void>;
    refreshBalances: () => Promise<void>;
    refreshAll: (from?: Date, to?: Date) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [leads, setLeads] = useState<ConsolidatedLead[]>([]);
    const [calls, setCalls] = useState<any[]>([]);
    const [loadingLeads, setLoadingLeads] = useState(true);
    const [loadingCalls, setLoadingCalls] = useState(true);
    const [loadingBalances, setLoadingBalances] = useState(true);
    const [voiceBalance, setVoiceBalance] = useState<any>(null);
    const [maqsamBalance, setMaqsamBalance] = useState<any>(null);
    const [twilioBalance, setTwilioBalance] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchLeads = useCallback(async () => {
        setLoadingLeads(true);
        try {
            const response = await fetch('/api/leads');
            if (!response.ok) throw new Error('Failed to fetch leads');
            const data = await response.json();
            const consolidated = consolidateLeads(data);
            setLeads(consolidated);
        } catch (err: any) {
            console.error('DataProvider leads fetch error:', err);
            setError(err.message);
        } finally {
            setLoadingLeads(false);
        }
    }, []);

    const fetchCalls = useCallback(async (from?: Date, to?: Date) => {
        setLoadingCalls(prev => prev || true);
        try {
            let url = '/api/calls';
            if (from || to) {
                const params = new URLSearchParams();
                if (from) params.append('from', from.toISOString());
                if (to) params.append('to', to.toISOString());
                url += `?${params.toString()}`;
            }
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) setCalls(data);
            }
        } catch (err: any) {
            console.error('DataProvider calls fetch error:', err);
        } finally {
            setLoadingCalls(false);
        }
    }, []);

    const fetchBalances = useCallback(async () => {
        try {
            const [vapiRes, maqsamRes, twilioRes] = await Promise.all([
                fetch('/api/vapi/balance'),
                fetch('/api/maqsam/balance'),
                fetch('/api/twilio/balance')
            ]);
            if (vapiRes.ok) setVoiceBalance(await vapiRes.json());
            if (maqsamRes.ok) setMaqsamBalance(await maqsamRes.json());
            if (twilioRes.ok) setTwilioBalance(await twilioRes.json());
        } catch (err) { }
        finally { setLoadingBalances(false); }
    }, []);

    const refreshAll = useCallback(async (from?: Date, to?: Date) => {
        await Promise.all([fetchLeads(), fetchCalls(from, to), fetchBalances()]);
    }, [fetchLeads, fetchCalls, fetchBalances]);

    useEffect(() => {
        refreshAll();
    }, []);

    return (
        <DataContext.Provider value={{
            leads,
            calls,
            loadingLeads,
            loadingCalls,
            loadingBalances,
            voiceBalance,
            maqsamBalance,
            twilioBalance,
            error,
            refreshLeads: fetchLeads,
            refreshCalls: fetchCalls,
            refreshBalances: fetchBalances,
            refreshAll
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
