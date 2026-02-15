/**
 * Get selected content as Markdown, including the blocks at selection anchor/focus.
 * MDXEditor's getSelectionAsMarkdown uses only selection.getNodes(), which can omit
 * the first or last block (e.g. heading "4.1" when selecting from that line).
 * This implementation also adds the anchor and focus blocks, and when the anchor
 * is at the very start of a block, includes the previous block (so headings above
 * the first selected paragraph are not dropped).
 */

import type { LexicalEditor, LexicalNode } from 'lexical';
import {
  $getSelection,
  $getRoot,
  $isRangeSelection,
  $isElementNode,
  $isTextNode,
} from 'lexical';
import type { RangeSelection } from 'lexical';
import { $isLinkNode } from '@lexical/link';
import { $isHeadingNode } from '@lexical/rich-text';
import { $isListItemNode, $isListNode } from '@lexical/list';

function isBlockNode(node: LexicalNode): boolean {
  return (
    $isHeadingNode(node) ||
    $isListItemNode(node) ||
    node.getType() === 'paragraph' ||
    node.getType() === 'quote'
  );
}

/** Collect block nodes (heading, list item, paragraph, quote) from root in document order. */
function collectBlocksInOrder(node: LexicalNode, out: LexicalNode[]): void {
  if (isBlockNode(node) && $isElementNode(node)) {
    out.push(node);
  }
  if (!$isElementNode(node)) return;
  const children = node.getChildren();
  for (let i = 0; i < children.length; i++) {
    collectBlocksInOrder(children[i], out);
  }
}

function getFirstTextNode(node: LexicalNode): LexicalNode | null {
  if ($isTextNode(node)) return node;
  if ($isElementNode(node)) {
    const children = node.getChildren();
    if (children.length > 0) return getFirstTextNode(children[0]);
  }
  return null;
}

/** True if selection anchor is at the very first character of the given block. */
function isAnchorAtStartOfBlock(selection: RangeSelection, block: LexicalNode): boolean {
  const anchorNode = selection.anchor.getNode();
  const firstText = getFirstTextNode(block);
  return firstText !== null && anchorNode.getKey() === firstText.getKey() && selection.anchor.offset === 0;
}

/** True if selection focus is at the very last character of the given block. */
function isFocusAtEndOfBlock(selection: RangeSelection, block: LexicalNode): boolean {
  const focusNode = selection.focus.getNode();
  const lastText = getLastTextNode(block);
  return lastText !== null && focusNode.getKey() === lastText.getKey() && selection.focus.offset === lastText.getTextContentSize();
}

function getLastTextNode(node: LexicalNode): LexicalNode | null {
  if ($isTextNode(node)) return node;
  if ($isElementNode(node)) {
    const children = node.getChildren();
    if (children.length > 0) return getLastTextNode(children[children.length - 1]);
  }
  return null;
}

function nodeToMarkdown(node: LexicalNode): string {
  if ($isHeadingNode(node)) {
    const level = parseInt(node.getTag().replace('h', ''), 10) || 1;
    const children = node.getChildren();
    const headingText = children.map((child) => nodeToMarkdown(child)).join('');
    return '#'.repeat(level) + ' ' + headingText + '\n\n';
  }
  if ($isListItemNode(node)) {
    const parent = node.getParent();
    const prefix =
      parent && $isListNode(parent) && parent.getListType() === 'number'
        ? '1. '
        : '- ';
    const children = node.getChildren();
    const itemText = children.map((child) => nodeToMarkdown(child)).join('');
    return prefix + itemText + '\n';
  }
  if ($isListNode(node)) {
    const children = node.getChildren();
    return children.map((child) => nodeToMarkdown(child)).join('') + '\n';
  }
  if ($isTextNode(node)) {
    let text = node.getTextContent();
    const format = node.getFormat();
    if (format & 16) return `\`${text}\``;
    if (format & 1) text = `**${text}**`;
    if (format & 2) text = `*${text}*`;
    if (format & 4) text = `~~${text}~~`;
    return text;
  }
  if ($isLinkNode(node)) {
    const url = node.getURL();
    const title = node.getTitle();
    const children = node.getChildren();
    const linkText = children.map((child) => nodeToMarkdown(child)).join('');
    if (title) return `[${linkText}](${url} "${title}")`;
    return `[${linkText}](${url})`;
  }
  if ($isElementNode(node)) {
    const children = node.getChildren();
    return children.map((child) => nodeToMarkdown(child)).join('');
  }
  return node.getTextContent();
}

/**
 * Returns the selected content as Markdown. Ensures the blocks containing the
 * selection anchor and focus are included and that blocks are in document order.
 */
export function getSelectionAsMarkdown(editor: LexicalEditor): string {
  let markdown = '';
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!selection || !$isRangeSelection(selection) || selection.isCollapsed()) {
      return;
    }
    const nodes = selection.getNodes();
    const parentNodes = new Set<LexicalNode>();

    function addBlockForNode(node: LexicalNode): void {
      const block = getBlockForNode(node);
      if (block) parentNodes.add(block);
    }

    function getBlockForNode(node: LexicalNode): LexicalNode | null {
      let current: LexicalNode | null = node;
      while (current) {
        if (
          $isHeadingNode(current) ||
          $isListItemNode(current) ||
          current.getType() === 'paragraph' ||
          current.getType() === 'quote'
        ) {
          if ($isElementNode(current)) return current;
        }
        current = current.getParent();
      }
      return null;
    }

    nodes.forEach(addBlockForNode);
    // Ensure anchor and focus blocks are always included (fixes missing first/last line)
    addBlockForNode(selection.anchor.getNode());
    addBlockForNode(selection.focus.getNode());

    if (parentNodes.size === 0) return;

    const allBlocksInOrder: LexicalNode[] = [];
    collectBlocksInOrder($getRoot(), allBlocksInOrder);

    // When anchor is at the very start of a block, include the previous block (e.g. heading "2. 事业" above the paragraph)
    const anchorBlock = getBlockForNode(selection.anchor.getNode());
    if (anchorBlock) {
      const anchorIdx = allBlocksInOrder.indexOf(anchorBlock);
      if (anchorIdx > 0 && isAnchorAtStartOfBlock(selection, anchorBlock)) {
        parentNodes.add(allBlocksInOrder[anchorIdx - 1]);
      }
    }
    const focusBlock = getBlockForNode(selection.focus.getNode());
    if (focusBlock) {
      const focusIdx = allBlocksInOrder.indexOf(focusBlock);
      if (focusIdx >= 0 && focusIdx < allBlocksInOrder.length - 1 && isFocusAtEndOfBlock(selection, focusBlock)) {
        parentNodes.add(allBlocksInOrder[focusIdx + 1]);
      }
    }

    const nodesToProcess = allBlocksInOrder.filter((n) => parentNodes.has(n));
    markdown = nodesToProcess.map((n) => nodeToMarkdown(n)).join('');
  });
  return markdown.trim();
}
