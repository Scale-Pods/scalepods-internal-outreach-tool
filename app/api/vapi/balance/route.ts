import { NextResponse } from 'next/server';

export async function GET() {
    const vapiPrivKey = process.env.VAPI_PRIVATE_KEY;

    let vapiData = null;

    if (vapiPrivKey) {
        try {
            // Try /org first (standard)
            const vapiRes = await fetch('https://api.vapi.ai/org', {
                headers: { 'Authorization': `Bearer ${vapiPrivKey}`, 'Content-Type': 'application/json' }
            });

            if (vapiRes.ok) {
                let rawVapi = await vapiRes.json();
                console.log('[Vapi API Debug] Org Response Type:', typeof rawVapi, Array.isArray(rawVapi) ? 'Array' : 'Object');

                // If it's an array, take the first org
                if (Array.isArray(rawVapi) && rawVapi.length > 0) {
                    rawVapi = rawVapi[0];
                }

                const balance = rawVapi.balance ??
                    rawVapi.billing?.balance ??
                    rawVapi.credits ??
                    rawVapi.creditsBalance ??
                    rawVapi.org?.balance ??
                    rawVapi.billingPlan?.balance ??
                    rawVapi.billing?.credits ??
                    rawVapi.billing?.balance_amount ??
                    0;

                const used = rawVapi.totalSpent ??
                    rawVapi.billing?.totalSpent ??
                    rawVapi.usage?.totalCost ??
                    rawVapi.org?.usage?.totalCost ??
                    rawVapi.billing?.total_spent ??
                    rawVapi.consumed_credits ??
                    rawVapi.used_credits ??
                    0;

                const total = balance + used;

                vapiData = {
                    ...rawVapi,
                    balance,
                    used,
                    total_recharge: total > balance ? total : balance
                };
            } else {
                const vapiMeRes = await fetch('https://api.vapi.ai/me', {
                    headers: { 'Authorization': `Bearer ${vapiPrivKey}`, 'Content-Type': 'application/json' }
                });

                if (vapiMeRes.ok) {
                    let rawMe = await vapiMeRes.json();
                    const org = rawMe.org || rawMe.organization || rawMe;

                    const balance = org.balance ??
                        org.billing?.balance ??
                        org.credits ??
                        org.billingPlan?.balance ??
                        0;

                    const used = org.billing?.totalSpent ??
                        org.usage?.totalCost ??
                        0;

                    const total = balance + used;

                    vapiData = {
                        ...rawMe,
                        balance,
                        used,
                        total_recharge: total > balance ? total : balance
                    };
                } else {
                    const errStatus = vapiRes.status;
                    const errMeStatus = vapiMeRes.status;
                    vapiData = { error: `Fetch failed (Org: ${errStatus}, Me: ${errMeStatus})` };
                }
            }
        } catch (e) {
            console.error('Vapi Balance Fetch Error:', e);
            vapiData = { error: 'Fetch exception' };
        }
    } else {
        vapiData = { error: 'API Key Missing' };
    }

    return NextResponse.json({
        vapi: vapiData
    });
}
