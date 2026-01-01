Implement a Python example using LiteLLM that demonstrates exception mapping and retry decisions. The example should:
- Call litellm.completion with a short timeout to trigger a timeout error
- Catch the mapped OpenAI exception type and show how to read status_code and llm_provider
- Use _should_retry to decide whether to retry based on status code
- Include a streaming example that catches timeout errors while iterating over chunks
