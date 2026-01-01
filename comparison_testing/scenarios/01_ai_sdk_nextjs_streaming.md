Implement a Next.js API route that streams AI responses and supports tool-calling using the Vercel AI SDK v6 with the OpenAI provider. The route should:
- Accept POST with chat messages
- Stream the assistant response
- Define one tool with a schema (e.g., getWeather) and show how tool calls are handled
- Return the correct streaming response type per the SDK docs
