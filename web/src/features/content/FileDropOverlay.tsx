"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import styles from "./content.module.css";

interface FileDropOverlayProps {
  disabled?: boolean;
  hint: string;
  icon: ReactNode;
  label: string;
  multiple?: boolean;
  onFiles: (files: File[], handles?: Array<FileSystemFileHandle | null>) => void | Promise<void>;
}

type DataTransferItemWithHandle = DataTransferItem & {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
};

function hasFiles(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false;
  const types = Array.from(dataTransfer.types ?? []);
  return types.includes("Files") || dataTransfer.files.length > 0;
}

function droppedFileHandles(dataTransfer: DataTransfer, count: number) {
  const items = dataTransfer.items
    ? Array.from(dataTransfer.items).filter((item) => item.kind === "file") as DataTransferItemWithHandle[]
    : [];
  const selectedItems = items.slice(0, count);
  if (selectedItems.length !== count || !selectedItems.some((item) => typeof item.getAsFileSystemHandle === "function")) {
    return null;
  }
  return Promise.all(selectedItems.map(async (item) => {
    if (typeof item.getAsFileSystemHandle !== "function") return null;
    try {
      const handle = await item.getAsFileSystemHandle();
      return handle?.kind === "file" ? handle as FileSystemFileHandle : null;
    } catch {
      return null;
    }
  }));
}

export function FileDropOverlay({
  disabled = false,
  hint,
  icon,
  label,
  multiple = false,
  onFiles,
}: FileDropOverlayProps) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    function resetDragging() {
      dragDepth.current = 0;
      setDragging(false);
    }

    function handleDragEnter(event: globalThis.DragEvent) {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      if (disabled) return;
      dragDepth.current += 1;
      setDragging(true);
    }

    function handleDragLeave(event: globalThis.DragEvent) {
      if (dragDepth.current === 0) return;
      event.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    }

    function handleDragOver(event: globalThis.DragEvent) {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    }

    function handleDrop(event: globalThis.DragEvent) {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      resetDragging();
      if (disabled || !event.dataTransfer) return;
      const files = Array.from(event.dataTransfer.files);
      const selectedFiles = multiple ? files : files.slice(0, 1);
      if (!selectedFiles.length) return;
      const handles = droppedFileHandles(event.dataTransfer, selectedFiles.length);
      if (!handles) {
        void onFiles(selectedFiles);
        return;
      }
      void handles.then((selectedHandles) => onFiles(selectedFiles, selectedHandles));
    }

    window.addEventListener("dragenter", handleDragEnter, true);
    window.addEventListener("dragleave", handleDragLeave, true);
    window.addEventListener("dragover", handleDragOver, true);
    window.addEventListener("drop", handleDrop, true);
    window.addEventListener("dragend", resetDragging, true);
    window.addEventListener("blur", resetDragging);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter, true);
      window.removeEventListener("dragleave", handleDragLeave, true);
      window.removeEventListener("dragover", handleDragOver, true);
      window.removeEventListener("drop", handleDrop, true);
      window.removeEventListener("dragend", resetDragging, true);
      window.removeEventListener("blur", resetDragging);
      dragDepth.current = 0;
      setDragging(false);
    };
  }, [disabled, multiple, onFiles]);

  if (!dragging || disabled) return null;

  return (
    <div className={styles.fileDropOverlay} role="status" aria-live="polite">
      <div className={styles.fileDropOverlayContent}>
        {icon}
        <strong>{label}</strong>
        <span>{hint}</span>
      </div>
    </div>
  );
}
