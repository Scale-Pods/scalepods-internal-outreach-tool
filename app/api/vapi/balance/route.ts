import { NextResponse } from 'next/server';

async function fetchOrgBalance(privKey: string | undefined) {
    if (!privKey) return { error: 'API Key Missing' };

    try {
        // Try /org first (standard)
        const vapiRes = await fetch('https://api.vapi.ai/org', {
            headers: { 'Authorization': `Bearer ${privKey}`, 'Content-Type': 'application/json' }
        });

        if (vapiRes.ok) {
            let rawVapi = await vapiRes.json();

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

            return {
                ...rawVapi,
                balance,
                used,
                total_recharge: total > balance ? total : balance,
            };
        }

        const vapiMeRes = await fetch('https://api.vapi.ai/me', {
            headers: { 'Authorization': `Bearer ${privKey}`, 'Content-Type': 'application/json' }
        });

        if (vapiMeRes.ok) {
            const rawMe = await vapiMeRes.json();
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

            return {
                ...rawMe,
                balance,
                used,
                total_recharge: total > balance ? total : balance,
            };
        }

        return { error: `Fetch failed (Org: ${vapiRes.status}, Me: ${vapiMeRes.status})` };
    } catch (e) {
        console.error('Vapi Balance Fetch Error:', e);
        return { error: 'Fetch exception' };
    }
}

export async function GET() {
    const [hot, cold] = await Promise.all([
        fetchOrgBalance(process.env.VAPI_PRIVATE_KEY_HOT_LEADS),
        fetchOrgBalance(process.env.VAPI_PRIVATE_KEY_COLD_LEADS),
    ]);

    const hotBalance = typeof hot.balance === 'number' ? hot.balance : 0;
    const coldBalance = typeof cold.balance === 'number' ? cold.balance : 0;
    const hotUsed = typeof hot.used === 'number' ? hot.used : 0;
    const coldUsed = typeof cold.used === 'number' ? cold.used : 0;

    const hasAnyData = typeof hot.balance === 'number' || typeof cold.balance === 'number';

    const combined = hasAnyData
        ? {
            balance: hotBalance + coldBalance,
            used: hotUsed + coldUsed,
            total_recharge: (hotBalance + coldBalance) + (hotUsed + coldUsed),
        }
        : { error: hot.error || cold.error || 'API Key Missing' };

    return NextResponse.json({
        vapi: combined,
        vapiHot: hot,
        vapiCold: cold,
    });
}
