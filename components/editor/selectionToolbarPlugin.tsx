'use client';

import { realmPlugin, addComposerChild$ } from '@mdxeditor/editor';
import { SelectionToolbar } from './SelectionToolbar';

/**
 * MDXEditor plugin: show a floating toolbar when the user selects text,
 * with actions: 润色, 扩写, 缩写, 翻译, 总结, 纠错.
 */
export const selectionToolbarPlugin = realmPlugin({
  init(realm) {
    realm.pub(addComposerChild$, SelectionToolbar);
  },
});
