Implement an MCP server tools interface that follows the MCP Tools specification. The response should:
- Declare the tools capability with listChanged
- Implement a tools/list request with pagination and a JSON Schema inputSchema
- Implement a tools/call request that returns structuredContent plus a text content block
- Include the tools/list_changed notification flow and error handling for invalid tool names
