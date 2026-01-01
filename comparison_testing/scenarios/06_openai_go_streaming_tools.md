Implement a Go example using the official openai-go SDK that streams a chat completion and handles tool calls. The example should:
- Create a client and send system + user messages
- Enable streaming and use an accumulator to assemble deltas
- Print content deltas as they arrive and detect finished tool calls
- Define at least one tool with a JSON schema and show how tool arguments are surfaced
