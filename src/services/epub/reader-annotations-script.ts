// Runs inside the reader's existing runtime, sharing its pagination and bridge.
// Anchors count chapter text without ruby readings, so lookup overlays and reflow
// do not change a saved passage's location. Highlight overlays never edit book HTML.
export function getReaderAnnotationsScript(): string {
  return `
        let savedHighlightRanges = [];
        let selectionTimer = null;
        let overlayFrame = null;

        function chapterTextNodes(section) {
          const nodes = [];
          collectLookupTextNodes(section, nodes);
          return nodes;
        }

        function positionAtBoundary(node, offset) {
          const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
          const section = element && element.closest(".wk-epub-section");
          if (!section || !contentEl.contains(section)) return null;
          const nodes = chapterTextNodes(section);
          let count = 0;
          const prefix = document.createRange();
          prefix.setStart(section, 0);
          prefix.setEnd(node, offset);
          for (const textNode of nodes) {
            if (textNode === node) return { sectionId: section.id, offset: count + offset };
            // Element boundaries (including paragraph selections) are legal Range endpoints.
            if (prefix.comparePoint(textNode, 0) > 0) break;
            if (prefix.comparePoint(textNode, textNode.length) > 0) break;
            count += textNode.length;
          }
          return { sectionId: section.id, offset: count };
        }

        function boundaryAtPosition(position, preferNext) {
          if (!position || !Number.isInteger(position.offset) || position.offset < 0) return null;
          const section = document.getElementById(position.sectionId);
          if (!section || !contentEl.contains(section)) return null;
          let remaining = position.offset;
          let previous = null;
          for (const node of chapterTextNodes(section)) {
            if (remaining < node.length || (remaining === node.length && !preferNext)) return { node, offset: remaining };
            remaining -= node.length;
            previous = node;
          }
          if (remaining === 0 && previous) return { node: previous, offset: previous.length };
          return null;
        }

        function rangeForPassage(passage) {
          if (!passage) return null;
          const start = boundaryAtPosition(passage.start, true);
          const end = boundaryAtPosition(passage.end);
          if (!start || !end) return null;
          const range = document.createRange();
          range.setStart(start.node, start.offset);
          range.setEnd(end.node, end.offset);
          return range.collapsed ? null : range;
        }

        function selectedPassage() {
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
          const range = selection.getRangeAt(0);
          const start = positionAtBoundary(range.startContainer, range.startOffset);
          const end = positionAtBoundary(range.endContainer, range.endOffset);
          const fragment = range.cloneContents();
          fragment.querySelectorAll("rt, rp, script, style").forEach(function (node) { node.remove(); });
          const text = (fragment.textContent || "").trim();
          if (!start || !end || !text) return null;
          if (!rangeForPassage({ start, end })) return null;
          return { page: currentPage + 1, text, passage: { start, end } };
        }

        function drawSavedHighlights() {
          overlayFrame = null;
          let root = document.getElementById("wk-saved-highlight-overlays");
          if (!root) {
            root = document.createElement("div");
            root.id = "wk-saved-highlight-overlays";
            root.style.cssText = "position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:1";
            document.body.appendChild(root);
          }
          root.replaceChildren();
          const visibleRects = [];
          for (const range of savedHighlightRanges) {
            for (const rect of Array.from(range.getClientRects())) {
              if (rect.right <= 0 || rect.left >= window.innerWidth || rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
              visibleRects.push(rect);
            }
          }
          // Ruby and nested inline elements can return overlapping rectangles.
          // Merge them so the same passage is never painted darker twice.
          for (const rect of mergeHighlightRects(visibleRects)) {
              const overlay = document.createElement("div");
              overlay.style.cssText = "position:absolute;pointer-events:none;border-radius:2px;background:var(--reader-saved-highlight,rgba(230,178,50,0.3))";
              overlay.style.left = rect.left + "px";
              overlay.style.top = rect.top + "px";
              overlay.style.width = rect.width + "px";
              overlay.style.height = rect.height + "px";
              root.appendChild(overlay);
          }
        }

        function scheduleSavedHighlights() {
          if (overlayFrame === null) overlayFrame = requestAnimationFrame(drawSavedHighlights);
        }

        function captureBookmark() {
          // Prefer the first visible character in reading order; works with vertical text.
          const sections = contentEl.querySelectorAll(".wk-epub-section");
          for (const section of sections) {
            let offset = 0;
            const nodes = chapterTextNodes(section);
            for (const node of nodes) {
              const range = document.createRange();
              range.selectNodeContents(node);
              const visible = Array.from(range.getClientRects()).some(function (rect) {
                return rect.right > 18 && rect.left < window.innerWidth - 18 && rect.bottom > 0 && rect.top < window.innerHeight;
              });
              if (visible && node.textContent.trim()) {
                // A text node can span many pages. Locate its first visible character.
                for (let index = 0; index < node.length; index++) {
                  range.setStart(node, index);
                  range.setEnd(node, index + 1);
                  const rect = range.getBoundingClientRect();
                  if (rect.right <= 18 || rect.left >= window.innerWidth - 18 || rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
                  const start = { sectionId: section.id, offset: offset + index };
                  const end = { sectionId: section.id, offset: offset + index + 1 };
                  const text = nodes.map(function (item) { return item.textContent; }).join("").slice(offset + index, offset + index + 120).trim();
                  postMessage("bookmark", { page: currentPage + 1, text, passage: { start, end } });
                  return;
                }
              }
              offset += node.length;
            }
          }
          postMessage("bookmark", { page: currentPage + 1, text: "" });
        }

        Object.assign(window.__WK_EPUB__, {
          captureBookmark,
          setAnnotations: function (annotations) {
            savedHighlightRanges = annotations.filter(function (item) { return item.kind === "highlight"; })
              .map(function (item) { return rangeForPassage(item.passage); }).filter(Boolean);
            scheduleSavedHighlights();
          },
          clearSelection: function () {
            const selection = window.getSelection();
            if (selection) selection.removeAllRanges();
          },
          goToAnnotation: function (annotation) {
            const range = rangeForPassage(annotation.passage);
            if (range) {
              // Navigate to the start, even when the highlighted range spans pages.
              range.setEnd(range.startContainer, Math.min(range.startOffset + 1, range.startContainer.length));
              const rect = range.getBoundingClientRect();
              // getCurrentOffset increases toward the book's beginning in this RTL scroller.
              const offset = getCurrentOffset() + rect.right - (window.innerWidth - 18);
              jumpToPage(offsetToPage(offset), false);
            } else {
              jumpToPage(annotation.page - 1, false);
            }
            scheduleSavedHighlights();
          },
        });

        document.addEventListener("selectionchange", function () {
          if (selectionTimer) clearTimeout(selectionTimer);
          selectionTimer = setTimeout(function () {
            postMessage("selection", selectedPassage() || { text: "" });
          }, 120);
        });
        scrollEl.addEventListener("scroll", scheduleSavedHighlights, { passive: true });
        window.addEventListener("resize", scheduleSavedHighlights);
        // Refresh overlays after fonts and image dimensions have settled.
        contentEl.addEventListener("load", scheduleSavedHighlights, true);
        if (document.fonts) document.fonts.ready.then(scheduleSavedHighlights);
  `;
}
