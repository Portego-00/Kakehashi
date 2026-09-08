# Study notebooks

Notebooks are currently available only to the verified WaniKani account `Portego` (case-insensitive, with surrounding whitespace ignored). For that account, open **More → Notebooks** in the web app. To keep it in the desktop navigation, add Notebooks under the navigation options in Settings. Other accounts and demo sessions cannot access notebook pages, controls, or the API.

## Start with the example notebook

Your notebook includes a one-time editable example: **Start here**, **Japanese in context**, and **Writing playground**. Open it from the notebook overview to try vocabulary links, synchronized sentences, rich blocks, and page organization with short instructions alongside each example. Existing accounts receive it too, when their notebook next loads and there is room within their storage allowance.

Use **Delete example notebook** on the overview or any sample page when you are done. After confirmation, it removes the three original sample pages and never adds them back. Pages you created are kept, including personal pages nested inside the tour. A sample sentence you edited or reused in another page is kept as well. Duplicate a sample page first if you want to keep your own copy.

## Write and organize

Start with a blank page or a grammar, lesson, or reading template. Give it a title. Type `/` in the editor to add headings, lists, checklists, tables, toggles, code, or a grammar callout. Use the block handle to rearrange content.

Create nested pages with the plus beside a sidebar page or **Page options → Add nested page**. Page options also includes move, duplicate, full width, Markdown export, and move to Trash. Star a page to keep it in Favorites. Search finds page text and connected sentences.

Click the emoji beside the page title to change its icon. Choose a suggested emoji, browse categories, or search the full emoji library by name, keyword, shortcode, or emoji, including skin-tone variants. Your choice saves automatically and appears in the page browser. **Reset icon** restores the default page icon.

Trash keeps pages recoverable and still counts toward your storage. Restore pages from Trash, or permanently delete them when finished. Deleting a parent also deletes its nested pages.

## Connect vocabulary and sentences

- **Word** opens subject search for radicals, kanji, and vocabulary, with type filters and the same colors used on their cards. Select “Insert within the text” for an inline mention, or type `@` followed by a character, reading, or meaning. Hover or focus a reference for a preview; clicking it opens its card in a new tab.
- **Sentence** searches your saved examples and built-in vocabulary examples. Choose an existing example or write your own with optional kana and translation. Associate it with word cards to use it in context practice.
- Sentence blocks show the Japanese with compact subject links and an expandable translation. Saved kana remains available in the edit form. Click outside a selected block or press Escape to leave its selection.
- On desktop, the page browser stays below the app header; its page list scrolls independently from the note. Slash and mention menus fit within the visible writing area and scroll when needed.
- **Page link** connects another notebook page. The destination displays a backlink.

On a word card, use **Add to notebook** in the Notebook section to capture the word into an existing or new page. The Notebook section also lists pages mentioning the word and your shared sentences. To collect built-in examples, use **Sentence** inside a notebook. Word capture is available from the corresponding subject details in lessons and reviews, and sentence capture is available from revealed context sentence practice.

Shared sentences use one saved record. Editing a sentence in a page or word card updates its other references. Capturing a built-in example makes a private personal copy; it does not alter the source example. Removing a sentence block only removes that reference. Use **Delete** in the Existing sentences picker or **Delete sentence** on a word card to remove a saved example. Deletion is protected while any page references it, including pages in Trash.

## Saving and recovery

Portego's connected account saves privately to Supabase. The toolbar shows when a page is saved.

If a save fails, the editor retains a local draft. If another tab or device has edited the same page, a conflict message offers the current cloud version or saving your draft as a separate page. The app does not silently replace the other edit.

If a draft exceeds the storage allowance, shorten it and retry, or export the page as Markdown before choosing **Load saved version**. Loading the saved version asks before discarding the unsaved draft and lets you return to your pages to free space.

Use **Page options → Export Markdown** for a readable copy of one page, or **Export notebooks** in the sidebar for a JSON copy of all notebook data. Exports are downloads; this release does not include an import tool.

The default allowance is 1 MiB of text data per account, up to 200 pages and 1,500 shared sentences. Text, formatting, and links are supported. Attachments are excluded to keep storage small. See [storage and deployment](notebooks-storage.md) for configuration and the future native app integration boundary.
