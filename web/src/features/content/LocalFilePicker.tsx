"use client";

import { useRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { openLinkedFilePicker, supportsLinkedLocalFiles } from "./local-file-source";
import type { LinkedFilePickerOptions } from "./local-file-source";
import styles from "./content.module.css";

export type LocalFileAccept = NonNullable<LinkedFilePickerOptions["accept"]>;

export interface LocalFilePickerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "disabled" | "onClick" | "type"> {
  accept?: LocalFileAccept;
  children: ReactNode;
  description?: string;
  disabled?: boolean;
  multiple?: boolean;
  onFiles: (files: File[], handles?: Array<FileSystemFileHandle | null>) => void | Promise<void>;
  onPickerError?: (error: Error) => void;
}

function inputAccept(accept?: LocalFileAccept) {
  if (!accept) return undefined;
  return Array.from(new Set(
    Object.entries(accept).flatMap(([mimeType, extensions]) => [mimeType, ...extensions]),
  )).join(",");
}

function pickerError(error: unknown) {
  if (error instanceof Error) return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const normalized = new Error(String(error.message));
    if ("name" in error) normalized.name = String(error.name);
    return normalized;
  }
  return new Error("The file picker could not be opened.");
}

export function LocalFilePicker({
  accept,
  children,
  description,
  disabled = false,
  multiple = false,
  onFiles,
  onPickerError,
  ...buttonProps
}: LocalFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function chooseFiles() {
    if (disabled) return;
    if (!supportsLinkedLocalFiles()) {
      inputRef.current?.click();
      return;
    }

    let selections;
    try {
      selections = await openLinkedFilePicker({ accept, description, multiple });
    } catch (error) {
      onPickerError?.(pickerError(error));
      return;
    }
    if (selections === null) {
      onPickerError?.(new Error("The linked file picker is no longer available. Try selecting the file again."));
      return;
    }
    if (!selections.length) return;
    void onFiles(
      selections.map((selection) => selection.file),
      selections.map((selection) => selection.handle),
    );
  }

  return (
    <>
      <button {...buttonProps} type="button" disabled={disabled} onClick={() => void chooseFiles()}>
        {children}
      </button>
      <input
        ref={inputRef}
        className={styles.fileInput}
        type="file"
        aria-hidden="true"
        accept={inputAccept(accept)}
        disabled={disabled}
        multiple={multiple}
        tabIndex={-1}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length) void onFiles(files, files.map(() => null));
        }}
      />
    </>
  );
}
