import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

type Common = { label: string; helper?: string; error?: string; success?: string; loading?: boolean };

export const Field = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Common>(function Field({ label, helper, error, success, loading, id, className, ...props }, ref) {
  const fieldId = id || `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const messageId = `${fieldId}-message`;
  return <div className={styles.field}><label className={styles.label} htmlFor={fieldId}>{label}</label><span className={styles.inputWrap}><input ref={ref} id={fieldId} name={props.name || fieldId} className={cn(styles.input, error && styles.inputError, success && styles.inputSuccess, className)} aria-invalid={Boolean(error)} aria-describedby={messageId} {...props} />{(loading || error || success) && <span className={styles.fieldIcon} data-state={loading ? "loading" : error ? "error" : "success"} aria-hidden>{loading ? <LoaderCircle size={17} /> : error ? <CircleAlert size={17} /> : <Check size={17} />}</span>}</span><span id={messageId} className={cn(styles.helper, error && styles.helperError, success && styles.helperSuccess)} aria-live={error || success ? "polite" : undefined}>{error || success || helper || "\u00a0"}</span></div>;
});

export function TextAreaField({ label, helper, error, success, id, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & Common) {
  const fieldId = id || `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const messageId = `${fieldId}-message`;
  return <div className={styles.field}><label className={styles.label} htmlFor={fieldId}>{label}</label><textarea id={fieldId} name={props.name || fieldId} className={cn(styles.input, styles.textarea, error && styles.inputError, success && styles.inputSuccess, className)} aria-invalid={Boolean(error)} aria-describedby={messageId} {...props} /><span id={messageId} className={cn(styles.helper, error && styles.helperError, success && styles.helperSuccess)} aria-live={error || success ? "polite" : undefined}>{error || success || helper || "\u00a0"}</span></div>;
}
