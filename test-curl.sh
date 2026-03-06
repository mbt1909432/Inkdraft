#!/bin/bash
# Test with curl directly to isolate the issue

# Load environment variables
export $(grep -v '^#' .env.local | xargs)

echo "=== Test 1: curl with max_tokens + tools ==="
curl -s "$OPENAI_LLM_ENDPOINT/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_LLM_API_KEY" \
  -d '{
    "model": "'"$OPENAI_LLM_MODEL"'",
    "messages": [{"role": "user", "content": "Say hello"}],
    "max_tokens": 100,
    "tools": [{
      "type": "function",
      "function": {
        "name": "output_result",
        "description": "Output the result",
        "parameters": {
          "type": "object",
          "properties": {
            "result": {"type": "string"}
          },
          "required": ["result"]
        }
      }
    }],
    "tool_choice": {"type": "function", "function": {"name": "output_result"}}
  }' | jq .

echo ""
echo "=== Test 2: curl with tools only (no max_tokens) ==="
curl -s "$OPENAI_LLM_ENDPOINT/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_LLM_API_KEY" \
  -d '{
    "model": "'"$OPENAI_LLM_MODEL"'",
    "messages": [{"role": "user", "content": "Say hello"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "output_result",
        "description": "Output the result",
        "parameters": {
          "type": "object",
          "properties": {
            "result": {"type": "string"}
          },
          "required": ["result"]
        }
      }
    }],
    "tool_choice": {"type": "function", "function": {"name": "output_result"}}
  }' | jq .
