# Knowledge Base MCP

This repository now exposes a local MCP server for Agent clients.

## Server

- Command: `npm run mcp:kb`
- Transport: `stdio`
- Supported capabilities: `tools`, `resources`

## Tools

- `search_knowledge_base`
- `read_knowledge_base_entry`
- `list_knowledge_base_entries`

## Resources

- `kb://knowledge-base/...`
- `kb://wiki/...`

## Example

```json
{
  "mcpServers": {
    "blogx-kb": {
      "command": "node",
      "args": ["E:/Tree Workspace/blogX_x/scripts/kb-mcp-server.mjs"]
    }
  }
}
```
