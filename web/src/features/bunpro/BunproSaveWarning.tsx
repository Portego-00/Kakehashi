export function BunproSaveWarning({ count }: { count: number }) {
  if (!count) return null;
  return <p role="status">Bunpro could not confirm saving {count} {count === 1 ? "answer" : "answers"}. {count === 1 ? "This item may" : "These items may"} still be due in Bunpro.</p>;
}
