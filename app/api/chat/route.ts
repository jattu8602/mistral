import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    // Default to the model used in the curl example if not provided, though the curl showed it returns a model ID.
    // We'll just pass the messages structure as is, or reconstruct it to match the curl exactly.
    // Curl data:
    // {
    //   "messages": [ ... ],
    //   "max_tokens": 200
    // }

    const response = await fetch('http://168.119.2.104:8989/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages,
        max_tokens: 1000, // Increased from 200 for better conversation
        mode: "instruction", // sometimes needed for certain local LLM servers, though not in the curl
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM API Error:', response.status, errorText);
      return NextResponse.json(
        { error: `LLM API Error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
