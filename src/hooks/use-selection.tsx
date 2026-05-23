import { useCallback, useEffect, useState } from "react";

const KEY = "stockjp-selected-products";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function write(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("stockjp-selection-changed"));
}

export function useSelection() {
  const [ids, setIds] = useState<string[]>(read);

  useEffect(() => {
    const sync = () => setIds(read());
    window.addEventListener("stockjp-selection-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("stockjp-selection-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    write(next);
  }, []);

  const clear = useCallback(() => write([]), []);
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const remove = useCallback((id: string) => write(read().filter((x) => x !== id)), []);

  return { ids, toggle, clear, has, remove };
}
