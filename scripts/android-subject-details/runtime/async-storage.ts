const values = new Map<string, string>([["wanikani_forecast_view_mode", "list"]]);
export default {
  getItem: async (key: string) => values.get(key) ?? null,
  setItem: async (key: string, value: string) => { values.set(key, value); },
  removeItem: async (key: string) => { values.delete(key); },
  getAllKeys: async () => [...values.keys()],
  multiGet: async (keys: string[]) => keys.map(key => [key, values.get(key) ?? null]),
  multiSet: async (pairs: string[][]) => { pairs.forEach(([key, value]) => values.set(key, value)); },
  multiRemove: async (keys: string[]) => { keys.forEach(key => values.delete(key)); },
};
