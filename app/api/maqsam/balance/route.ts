import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  try {
    const ACCESS_KEY_ID = process.env.MAQSAM_ACCESS_KEY_ID!;
    const ACCESS_SECRET = process.env.MAQSAM_ACCESS_SECRET!;

    const mBase = process.env.MAQSAM_BASE_URL || 'maqsam.com';

    const fetchMaqsam = async (endpoint: string, useBasic: boolean) => {
      const timestamp = new Date().toISOString();
      const mUrl = `https://api.${mBase}${endpoint}`;
      const headers: any = { "Accept": "application/json" };
      if (useBasic) {
        headers["Authorization"] = `Basic ${Buffer.from(`${ACCESS_KEY_ID}:${ACCESS_SECRET}`).toString('base64')}`;
      } else {
        const method = "GET";
        const payload = `${method}${endpoint}${timestamp}`;
        headers["X-ACCESS-KEY"] = ACCESS_KEY_ID;
        headers["X-TIMESTAMP"] = timestamp;
        headers["X-SIGNATURE"] = crypto.createHmac("sha256", ACCESS_SECRET).update(payload).digest("base64");
      }
      return fetch(mUrl, { method: "GET", headers });
    };

    // Try V2 billing first (Modern)
    let response = await fetchMaqsam("/v2/billing/balance", true);

    // If V2 fails, try V1 (Legacy)
    if (!response.ok) {
      response = await fetchMaqsam("/v1/account/balance", false);
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      // Maqsam V1/V2 typically nests balance in "message" or "data"
      const balanceValue = data.balance ??
        data.message?.balance ??
        data.data?.balance ??
        data.message?.credits ??
        data.credits ??
        0;

      return NextResponse.json({
        ...data,
        balance: parseFloat(balanceValue)
      });
    } catch (e) {
      return NextResponse.json({
        status: response.status,
        error: "JSON Parse Error on Maqsam response",
        response: text,
        balance: 0
      });
    }

  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
    }, { status: 500 });
  }
}
