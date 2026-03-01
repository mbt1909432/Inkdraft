# AI Assistant

![](../screenshot-editor-chat.png)

Inkdraft has a powerful AI assistant built-in. It doesn't just give suggestions — it can **directly modify your documents**.

## Core Capability: Agent Direct Document Control

In traditional editors, AI can only give suggestions. Inkdraft's Agent can:

| Action | Capability | Example |
|--------|------------|---------|
| **Create** | Add content | "Add a section about X" |
| **Delete** | Remove content | "Delete all duplicate paragraphs" |
| **Modify** | Edit content | "Make this paragraph more professional" |
| **Query** | Search info | "Summarize the main points" |

## How to Use

### 1. Open AI Panel
- Click the **AI Assistant** button in toolbar
- AI chat panel opens on the right side

### 2. Start Conversation
Type your question or instruction:
- "Polish this text"
- "Write a summary of this article"
- "Convert this list to a table"

### 3. Agent Executes
The Agent understands your intent and **directly modifies the editor**:
- See changes immediately
- Ctrl+Z to undo unsatisfied changes
- Continue conversation for further adjustments

## Text Selection Actions

When you select text, a context toolbar appears:

| Button | Action |
|--------|--------|
| **B** | Bold |
| **I** | Italic |
| **U** | Underline |
| **S** | Strikethrough |
| **Code** | Inline code |
| **Polish** | AI polish selected text |
| **Expand** | AI expand content |
| **Condense** | AI shorten content |
| **More** | More AI options |

## Context Memory

AI Agent remembers conversation history, supporting multi-turn dialogs:
- "Make that paragraph shorter"
- "Try a different wording"
- "Continue from where we left off"

Token usage is displayed in real-time.

## Acontext SDK Code Execution

In AI chat, Agent can run Python code:

```
User: Help me analyze the sales data

Agent: Running analysis code...
[Executes Python code]
Results:
- Total sales: $1,234,567
- Top region: East (35%)
...
```

Analysis results can be inserted directly into the document.
