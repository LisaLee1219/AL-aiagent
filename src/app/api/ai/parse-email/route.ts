import { NextRequest, NextResponse } from 'next/server';
import { invokeChat, isAIConfigured } from '@/lib/llm';
import { isBCConfigured, getCustomers } from '@/lib/business-central';
import { ensureEnvLoaded } from '@/lib/env-loader';

export async function POST(request: NextRequest) {
  await ensureEnvLoaded();
  try {
    if (!isAIConfigured()) {
      return NextResponse.json(
        {
          error:
            'AI 未配置：请在 .env.local 中设置有效的 OPENAI_API_KEY，然后重启 pnpm dev。',
        },
        { status: 503 },
      );
    }

    const { emailContent, emailSubject, emailFrom } = await request.json();

    if (!emailContent) {
      return NextResponse.json({ error: 'Email content is required' }, { status: 400 });
    }

    const systemPrompt = `You are a B2B industrial supply RFQ extraction assistant for Allinton Engineering (Singapore).

Return ONLY valid JSON (no markdown) in this exact structure:
{
  "customer": {
    "name": "",
    "company": "",
    "email": "",
    "channel": "email"
  },
  "request": {
    "type": "RFQ",
    "urgency": "urgent | normal | low",
    "required_details": {
      "price": true,
      "lead_time": true,
      "delivery_fee": true,
      "vat": true,
      "item_photo": false
    },
    "summary": ""
  },
  "items": [
    {
      "line_id": "line-1",
      "original_text": "",
      "normalized_name": "",
      "product_type": "",
      "quantity": 1,
      "uom": "pcs",
      "specs": {
        "size": "",
        "material": "",
        "grade": "",
        "brand": "",
        "standard": "",
        "thread": "",
        "dimension": ""
      },
      "missing_info": [],
      "completeness_status": "complete | incomplete | ambiguous",
      "recommended_action": ""
    }
  ],
  "customerName": "",
  "companyName": "",
  "products": [],
  "quantity": "",
  "urgency": "high | medium | low",
  "keyRequirements": [],
  "summary": ""
}

Rules:
- List every distinct product line from the RFQ in items[].
- quantity must be a number only (e.g. 10). Never include UOM in quantity.
- uom must be a separate unit code (e.g. EA, PCS, SET, BOX, MTR).
- For vague items (e.g. Flat Wheel 4 inch without material/bore/load rating), set completeness_status incomplete, missing_info, recommended_action to ask customer.
- For clear fasteners (e.g. Bolt M16 x 100mm Grade 8.8), set completeness_status complete.
- urgency: urgent/ASAP/rush → urgent; hope soon → normal; else low.
- Also fill legacy fields customerName, companyName, products[] for compatibility.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'user' as const,
        content: `Please analyse the following customer email:

From: ${emailFrom || 'Unknown'}
Subject: ${emailSubject || 'No Subject'}

Email Content:
${emailContent}`,
      },
    ];

    const response = await invokeChat(messages, { temperature: 0.3 });

    let parsedResult;
    try {
      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        parsedResult = { raw: content };
      }
    } catch {
      parsedResult = { raw: response.content };
    }

    let bcCustomerMatch = null;
    if (parsedResult.companyName && (await isBCConfigured())) {
      try {
        const customers = await getCustomers({ search: parsedResult.companyName, top: 1 });
        if (customers.length > 0) {
          bcCustomerMatch = {
            id: customers[0].id,
            number: customers[0].number,
            displayName: customers[0].displayName,
            email: customers[0].email,
            balance: customers[0].balance,
          };
        }
      } catch (e) {
        console.error('BC customer lookup failed:', e);
      }
    }

    const companyName =
      parsedResult.companyName ||
      parsedResult.customer?.company ||
      '';

    return NextResponse.json({
      success: true,
      data: {
        ...parsedResult,
        bcCustomer: bcCustomerMatch,
      },
      rfq: parsedResult.customer ? parsedResult : null,
      source: (await isBCConfigured()) ? 'business_central' : 'mock',
    });
  } catch (error) {
    console.error('Email parsing error:', error);
    const message = error instanceof Error ? error.message : 'Email parsing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
