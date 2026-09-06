SHOPLINE provides a Model Context Protocol (MCP) server that can be integrated into AI-powered IDEs like Cursor or any other AI tool supporting MCP. Once added, your AI tool can utilize this MCP to search SHOPLINE documentation, retrieve API parameters, and assist in writing or modifying code based on technical documents.

## Configure the MCP client 

To communicate with the SHOPLINE Developer MCP server, the MCP client requires specific configurations.

**Note**: The SHOPLINE Developer MCP is based on the MCP STDIO (Standard Input/Output) transport mechanism, runs locally, and does not require authentication.

### Prerequisites 

- Ensure that you have [Node.js](https://nodejs.org/en) version 18.0.0 or higher installed.
- Install any AI tool that supports MCP, such as Cursor.

### Cursor 

If you are using [Cursor](https://cursor.com/) as your AI tool, configure the client as follows:

1. Open Cursor, then navigate to **Cursor Settings** > **Tools & MCP** > **MCP** > **New MCP Server**, and add the following configuration:

```json
{
  "mcpServers": {
      "shopline-developer-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@shoplineos/shopline-developer-mcp"
      ]
    }
  }
}
```

1. After saving the configuration, terminate all Cursor processes and restart Cursor to apply the new settings.
2. Verify the connection by checking the MCP server's connection status or by asking questions.

### Claude Desktop

If you are using [Claude Desktop](https://claude.ai/download) as your AI tool, configure the client as follows:

1. Open Claude Desktop, then go to **Settings** > **Developer** > **Edit Config**, and add the following configuration:

```json
{
  "mcpServers": {
      "shopline-developer-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@shoplineos/shopline-developer-mcp"
      ]
    }
  }
}
```

1. Save the configuration, terminate all Claude Desktop processes, and restart Claude Desktop to apply the new settings.
2. Verify the connection by checking the MCP server's connection status or by asking questions.

### Cline

If you have installed the [Cline](https://cline.bot/) plugin in your IDE, configure the client as follows:

1. Open the Cline plugin, navigate to **MCP Servers** > **Configure MCP Servers**, and add the following configuration:

```json
{
  "mcpServers": {
      "shopline-developer-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@shoplineos/shopline-developer-mcp"
      ]
    }
  }
}
```

1. Save the configuration, terminate all processes of the IDE, and restart it to apply the new settings.
2. Verify the connection by checking the MCP server's connection status or by asking questions.

## Use MCP 

Once configured, AI tools can use MCP to access the necessary technical documents or API information. 

Instruct the AI on what you want to accomplish, for example: 

- What are the required fields for creating a product? 
- How to install and use the SHOPLINE CLI? 
- How to perform app authorization? 

## Available tools 

SHOPLINE Developer MCP offers the following tools:

| **Tool**                       | **Description**                                              |
| ------------------------------ | ------------------------------------------------------------ |
| shopline_readme                | Used for understanding the dependencies and best practices of SHOPLINE Developer MCP tools. |
| search_shopline_docs           | Searches through [SHOPLINE developer documentation](https://developer.shopline.com/docs/apps/overview). |
| read_full_docs                 | Retrieves the full content of a document via its URL.        |
| search_admin_rest_endpoints    | Searches endpoints in the SHOPLINE Admin REST API.           |
| get_rest_api_definition        | Obtains the complete specification of the SHOPLINE Admin REST API. |
| get_admin_rest_endpoint_detail | Gets detailed information on a SHOPLINE Admin REST API through its endpoint, including request and response parameters and examples. |
| get_graphql_schema             | Queries the SHOPLINE GraphQL API schema, returning corresponding Query, Mutation, and Type. |
| validate_graphql_codes         | Validates GraphQL codes based on the SHOPLINE GraphQL API Schema. It can detect syntax errors, deprecated fields, and hallucinated fields, ensuring code compliance with SHOPLINE API definitions and coding standards. |
| shopline_mcp_feedback          | Sends feedback to SHOPLINE.                                  |