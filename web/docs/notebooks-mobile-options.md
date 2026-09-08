# Notebook editor options for mobile

Research checked September 7, 2026. The chosen approach is now implemented behind the Portego account gate: BlockNote runs inside an Expo DOM component with a native notebook browser and mobile editing controls. See [Mobile notebooks](notebooks-mobile.md) for setup, behavior, and validation status. The comparison below records the decision; BlockNote itself remains a web editor, not a native React Native component.

## Current support and options

BlockNote has no first-party React Native integration documented by its maintainers. In an April 15, 2026 reply, maintainer YousefED said first-party React Native support was not planned at that time. The discussion includes a community implementation using Expo DOM and a native formatting toolbar; that example is evidence of feasibility, not a support guarantee. [BlockNote maintainer discussion](https://github.com/TypeCellOS/BlockNote/discussions/2618)

| Option | Reuse and tradeoff |
| --- | --- |
| BlockNote inside Expo DOM / WebView | Reuse the web editing engine, schema, and custom blocks. Build native navigation and adapt mobile interactions. The editing surface remains web content. |
| TenTap (`@10play/tentap-editor`) | A React Native integration around Tiptap with a native toolbar and keyboard handling. It also uses a WebView. Custom notebook nodes and format conversion require additional work. |
| An editor built from native controls | Native interaction throughout, but rebuilding block editing, rich text, selection, and custom notebook content is a substantially larger project. |

Expo officially supports running web React components through `use dom`; native and DOM code exchange serializable data and asynchronous actions. Their global state does not automatically cross that boundary. The editor can be bundled into the app, so this does not require loading the deployed website. The current mobile project uses Expo 55 and already includes `react-native-webview`, the prerequisite for that SDK. [Expo DOM documentation](https://docs.expo.dev/guides/dom-components/), [project dependencies](../../package.json)

TenTap's own basic example describes its editor as a WebView running a Tiptap bundle. Its advanced setup is needed for custom Tiptap extensions, and its bridge can read JSON and set document content. It is worth evaluating if mobile editing controls become the priority, but switching does not remove the WebView or automatically retain BlockNote features. [TenTap basic example](https://10play.github.io/10tap-editor/docs/examples/basic), [custom extensions](https://10play.github.io/10tap-editor/docs/mainConcepts), [document bridge](https://10play.github.io/10tap-editor/docs/api/EditorBridge)

## Sharing the same backend

Yes: different editors can use the same backend if they agree on the saved document format, or convert reliably to and from it. Kakehashi already stores a versioned JSON state with page IDs, blocks, sentence references, and revisions. Its validation and mutation logic has no editor runtime dependency. The document structure is nevertheless deliberately BlockNote-shaped; portable JSON is not automatically a universal editor format. [Notebook storage and API contract](notebooks-storage.md), [canonical model](../src/features/notebooks/model.ts)

BlockNote exposes an array of blocks with IDs, properties, inline content, and children. Tiptap exposes a ProseMirror document rooted at `{ type: "doc", content: [...] }`. Therefore, sharing their underlying engine does not make BlockNote JSON interchangeable with ordinary Tiptap/TenTap JSON. A second editor needs mappings for both document structure and every supported custom node. [BlockNote document structure](https://www.blocknotejs.org/docs/foundations/document-structure), [Tiptap document output](https://tiptap.dev/docs/guides/output-json-html)

For this app, mappings must preserve vocabulary blocks and inline mentions, sentence IDs, page links, callouts, nesting, tables, formatting, and stable block IDs. Keep the current canonical model and make any future editor convert at its boundary. Unsupported content should remain intact through a fallback or read-only behavior; it must not disappear on save. Tiptap's documentation explicitly discusses unknown-content stripping and schema checks. [Current supported content](notebooks-storage.md#portable-format-and-apis), [Tiptap schema handling](https://tiptap.dev/docs/guides/invalid-schema)

Markdown or ordinary HTML should not become the synchronization format just to connect editors: BlockNote documents both conversions as lossy. Keep them for export unless a narrower feature set is an intentional product decision. [BlockNote format interoperability](https://www.blocknotejs.org/docs/foundations/supported-formats)

The browser endpoint expects a web session cookie and validates web origins. The mobile implementation adds a verified native authentication boundary at `/api/notebooks/native` that resolves the same account identity; the database service credential stays on the server. [Native API contract](notebooks-native-api.md)

## First validation

Validate an existing notebook page in the mobile app using the same BlockNote schema. Check Japanese IME composition, keyboard visibility, cursor movement and selection, scrolling, paste, custom reference interactions, save/reopen, and conflicts with edits from web. The implementation and current verification record are tracked in [Mobile notebooks](notebooks-mobile.md#validation-record).
