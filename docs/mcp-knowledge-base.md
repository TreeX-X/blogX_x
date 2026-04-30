# Knowledge Base MCP

This repository now exposes a local MCP server for Agent clients.

## Server

- Command: `npm run mcp:kb`
- Transport: `stdio`
- Supported capabilities: `tools`, `resources`

### HTTP bridge

- Command: `npm run mcp:kb:http`
- Endpoint: `http://127.0.0.1:8787/mcp`
- Health check: `http://127.0.0.1:8787/health`
- Discovery: `GET http://127.0.0.1:8787/mcp`

Example `mcp.json` entry:

```json
{
  "servers": {
    "blogX_x": {
      "type": "http",
      "url": "http://127.0.0.1:8787/mcp"
    }
  }
}
```

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
