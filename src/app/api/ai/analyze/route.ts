import { NextRequest, NextResponse } from 'next/server';
import { streamChat } from '@/lib/llm';
import { ensureEnvLoaded } from '@/lib/env-loader';

export async function POST(request: NextRequest) {
  await ensureEnvLoaded();
  try {
    const { type, context, question } = await request.json();

    if (!question && !context) {
      return NextResponse.json({ error: 'Please provide analysis content' }, { status: 400 });
    }

    const systemPrompts: Record<string, string> = {
      sales: 'You are a B2B sales assistant. Help sales personnel provide reasonable quotation suggestions based on product cost prices, historical transaction prices, and market conditions. Keep responses concise and professional, with specific figures.',
      procurement: 'You are a procurement assistant. Help analyse the reasonableness of supplier quotations, compare pros and cons of different suppliers, and provide procurement recommendations. Keep responses concise and professional.',
      logistics: 'You are a logistics assistant. Help analyse logistics exceptions and provide delivery optimisation recommendations. Keep responses concise and professional.',
      finance: 'You are a finance assistant. Help analyse financial data anomalies and provide receivables & payables management recommendations. Keep responses concise and professional.',
      marketing: 'You are a marketing assistant. Help analyse campaign effectiveness, provide lead scoring, and market trend analysis. Keep responses concise and professional.',
    };

    const systemPrompt = systemPrompts[type || 'sales'] || systemPrompts.sales;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'user' as const,
        content: context
          ? `Context:\n${context}\n\nQuestion: ${question || 'Please provide your analysis and recommendations'}`
          : question,
      },
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamChat(messages, { temperature: 0.5 })) {
            if (chunk.content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`),
              );
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Analysis failed';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI analysis error:', error);
    const message = error instanceof Error ? error.message : 'AI analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
