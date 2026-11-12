import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const contentLength = Number(request.headers.get("content-length") || 0);
        if (contentLength > 4.5 * 1024 * 1024) {
            return NextResponse.json({
                error: "File size exceeds the 4.5 MB upload limit. Please split your file into smaller files and upload them separately."
            }, { status: 413 });
        }

        const formData = await request.formData();
        const webhookUrl = formData.get('webhookUrl') as string;
        
        // Remove the webhookUrl so we only send the file to n8n
        formData.delete('webhookUrl');

        console.log(`Proxying request to n8n webhook: ${webhookUrl}`);
        
        const res = await fetch(webhookUrl, {
            method: 'POST',
            body: formData,
        });

        const text = await res.text();
        console.log(`n8n responded with status ${res.status}:`, text);

        return NextResponse.json({ 
            status: res.status, 
            ok: res.ok, 
            response: text 
        });
    } catch (error: any) {
        console.error("Error proxying to n8n:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
