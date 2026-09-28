const listeners = new Set();

export const store = {
  user: null,
  methods: [],
  rentalHours: 48,
  provider: 'simulated',
  setUser(user) {
    this.user = user;
    listeners.forEach((fn) => fn(user));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

// Per-browser convenience only (remembered payment method / phone).
export const prefs = {
  get(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(`mboa:${key}`)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`mboa:${key}`, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};
