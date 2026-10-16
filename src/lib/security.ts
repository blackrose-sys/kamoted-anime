/**
 * Kamoted Security Shield
 * Anti-Bot, DDoS Protection, Rate Limiting & Brute-Force Prevention Suite
 */

// Storage keys
const STORAGE_PREFIX = 'kamoted_sec_';
const DEVICE_SALT_KEY = 'kamoted_dev_salt';

// Ensure a persistent device salt exists for tamper-evident hashing
function getDeviceSalt(): string {
  try {
    let salt = localStorage.getItem(DEVICE_SALT_KEY);
    if (!salt) {
      salt = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem(DEVICE_SALT_KEY, salt);
    }
    return salt;
  } catch {
    return 'fallback_device_salt_default';
  }
}

// Simple checksum generator to deter tampering with localStorage attempt counts
function computeChecksum(str: string): string {
  let hash = 0;
  const combined = str + getDeviceSalt();
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

// Safe localStorage wrapper
const safeStorage = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (!raw) return defaultValue;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data !== undefined && parsed.sig !== undefined) {
        // Validate checksum
        const expectedSig = computeChecksum(JSON.stringify(parsed.data));
        if (expectedSig === parsed.sig) {
          return parsed.data as T;
        }
      }
      return defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      const dataStr = JSON.stringify(value);
      const envelope = {
        data: value,
        sig: computeChecksum(dataStr)
      };
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(envelope));
    } catch {
      // ignore storage quota errors
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      // ignore
    }
  }
};

/* ───────────────────────────────────────────────────────────
   1. LOGIN BRUTE-FORCE & LOCKOUT GUARD
   ─────────────────────────────────────────────────────────── */

export interface LoginAttemptState {
  failures: number;
  lockoutUntil: number; // timestamp in ms
  lastAttempt: number;
}

const MAX_FREE_FAILURES = 5; // Lockout begins after 5 consecutive failures
const LOCKOUT_TIERS_SEC = [30, 60, 300, 900, 1800]; // 30s, 1m, 5m, 15m, 30m

function getLoginStateKey(email: string): string {
  const normalized = (email || 'global').trim().toLowerCase();
  return `login_${normalized.replace(/[^a-z0-9]/g, '_')}`;
}

export function checkLoginSecurity(email: string): {
  allowed: boolean;
  remainingAttempts: number;
  lockoutSeconds: number;
  message?: string;
  isLocked: boolean;
} {
  const key = getLoginStateKey(email);
  const state = safeStorage.get<LoginAttemptState>(key, { failures: 0, lockoutUntil: 0, lastAttempt: 0 });
  const now = Date.now();

  // If locked out, check if lockout period has expired
  if (state.lockoutUntil > now) {
    const lockoutSeconds = Math.ceil((state.lockoutUntil - now) / 1000);
    return {
      allowed: false,
      isLocked: true,
      remainingAttempts: 0,
      lockoutSeconds,
      message: `Account protection active: Too many failed login attempts. Please wait ${lockoutSeconds}s before trying again.`
    };
  }

  // If lockout expired or under threshold
  // Expire failures after 15 minutes of inactivity
  if (state.failures > 0 && now - state.lastAttempt > 15 * 60 * 1000) {
    safeStorage.remove(key);
    return {
      allowed: true,
      isLocked: false,
      remainingAttempts: MAX_FREE_FAILURES,
      lockoutSeconds: 0
    };
  }

  const remaining = Math.max(0, MAX_FREE_FAILURES - state.failures);
  return {
    allowed: true,
    isLocked: false,
    remainingAttempts: remaining,
    lockoutSeconds: 0,
    message: state.failures >= 3 
      ? `Warning: ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary security lockout.`
      : undefined
  };
}

export function recordLoginFailure(email: string): {
  isLocked: boolean;
  lockoutSeconds: number;
  remainingAttempts: number;
  message: string;
} {
  const key = getLoginStateKey(email);
  const now = Date.now();
  const state = safeStorage.get<LoginAttemptState>(key, { failures: 0, lockoutUntil: 0, lastAttempt: 0 });

  state.failures += 1;
  state.lastAttempt = now;

  let lockoutSeconds = 0;
  let isLocked = false;

  if (state.failures >= MAX_FREE_FAILURES) {
    // Determine lockout duration from tier
    const tierIndex = Math.min(state.failures - MAX_FREE_FAILURES, LOCKOUT_TIERS_SEC.length - 1);
    lockoutSeconds = LOCKOUT_TIERS_SEC[tierIndex];
    state.lockoutUntil = now + (lockoutSeconds * 1000);
    isLocked = true;
  }

  safeStorage.set(key, state);

  if (isLocked) {
    return {
      isLocked: true,
      lockoutSeconds,
      remainingAttempts: 0,
      message: `Security Lockout Triggered: Too many incorrect attempts. For database and account safety, login is locked for ${lockoutSeconds} seconds.`
    };
  }

  const remainingAttempts = Math.max(0, MAX_FREE_FAILURES - state.failures);
  return {
    isLocked: false,
    lockoutSeconds: 0,
    remainingAttempts,
    message: `Incorrect credentials. You have ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining before temporary security cooldown.`
  };
}

export function recordLoginSuccess(email: string): void {
  const key = getLoginStateKey(email);
  safeStorage.remove(key);
}

/* ───────────────────────────────────────────────────────────
   2. GENERIC SLIDING WINDOW RATE LIMITER
   ─────────────────────────────────────────────────────────── */

interface SlidingWindowState {
  timestamps: number[];
  cooldownUntil?: number;
}

export interface RateLimitOptions {
  maxRequests: number;
  windowSeconds: number;
  cooldownSeconds?: number;
}

export function checkActionRateLimit(
  actionKey: string,
  options: RateLimitOptions
): {
  allowed: boolean;
  remaining: number;
  waitSeconds: number;
  message?: string;
} {
  const key = `ratelimit_${actionKey}`;
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const state = safeStorage.get<SlidingWindowState>(key, { timestamps: [] });

  // Check active cooldown
  if (state.cooldownUntil && state.cooldownUntil > now) {
    const waitSeconds = Math.ceil((state.cooldownUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      waitSeconds,
      message: `Rate limit reached. Please wait ${waitSeconds}s before trying again.`
    };
  }

  // Filter timestamps within window
  const validTimestamps = (state.timestamps || []).filter(t => now - t < windowMs);

  if (validTimestamps.length >= options.maxRequests) {
    const cooldownSec = options.cooldownSeconds || options.windowSeconds;
    const cooldownUntil = now + (cooldownSec * 1000);
    safeStorage.set(key, { timestamps: validTimestamps, cooldownUntil });
    return {
      allowed: false,
      remaining: 0,
      waitSeconds: cooldownSec,
      message: `Action limit reached (${options.maxRequests} per ${options.windowSeconds}s). Please wait ${cooldownSec}s.`
    };
  }

  return {
    allowed: true,
    remaining: options.maxRequests - validTimestamps.length,
    waitSeconds: 0
  };
}

export function recordAction(actionKey: string): void {
  const key = `ratelimit_${actionKey}`;
  const now = Date.now();
  const state = safeStorage.get<SlidingWindowState>(key, { timestamps: [] });
  state.timestamps.push(now);
  safeStorage.set(key, state);
}

/* ───────────────────────────────────────────────────────────
   3. BOT & AUTOMATION DETECTION (HEURISTICS + HONEYPOT)
   ─────────────────────────────────────────────────────────── */

export function isKnownBotEnvironment(): { isBot: boolean; reason?: string } {
  if (typeof window === 'undefined') return { isBot: false };

  const nav = window.navigator as any;

  // 1. Headless Chrome / Webdriver flag
  if (nav.webdriver === true) {
    return { isBot: true, reason: 'Automated browser detected (webdriver active)' };
  }

  // 2. PhantomJS / NightmareJS signatures
  if (window && ((window as any).callPhantom || (window as any)._phantom || (window as any).__nightmare)) {
    return { isBot: true, reason: 'Automation framework detected' };
  }

  // 3. Selenium attributes on document
  if (
    document.documentElement.getAttribute('selenium') !== null ||
    document.documentElement.getAttribute('webdriver') !== null ||
    (window as any).document?.$cdc_asdjflasutopfhvcZLmcfl_
  ) {
    return { isBot: true, reason: 'Selenium driver detected' };
  }

  // 4. Inconsistent navigator features (languages length 0 in non-mobile)
  if (nav.languages !== undefined && nav.languages.length === 0) {
    return { isBot: true, reason: 'Anomalous browser environment' };
  }

  return { isBot: false };
}

/**
 * Checks submission speed.
 * Bots fill forms and submit within < 800ms.
 * Real humans take > 1500ms to visually parse and fill out fields.
 */
export function isSubmissionTooFast(formMountTimeMs: number, thresholdMs = 800): boolean {
  if (!formMountTimeMs) return false;
  const elapsed = Date.now() - formMountTimeMs;
  return elapsed < thresholdMs;
}

/**
 * Honeypot validation
 * If a bot fills out hidden input fields, this returns true.
 */
export function isHoneypotTriggered(honeypotValue: string): boolean {
  return typeof honeypotValue === 'string' && honeypotValue.trim().length > 0;
}

/* ───────────────────────────────────────────────────────────
   4. CLIENT-SIDE PROOF-OF-WORK (PoW) COMPUTATIONAL CHALLENGE
   ───────────────────────────────────────────────────────────
   Lightweight SHA-256 computational challenge.
   Takes 25-60ms for a single real user browser (imperceptible).
   Forces a botnet or DDoS attacker to spend massive CPU cycles,
   stopping high-frequency automated database hammer attacks.
   ─────────────────────────────────────────────────────────── */

export interface ProofOfWorkChallenge {
  seed: string;
  difficulty: number;
  timestamp: number;
}

export function generatePoWChallenge(difficulty = 3): ProofOfWorkChallenge {
  const seed = Math.random().toString(36).substring(2) + Date.now().toString(36);
  return {
    seed,
    difficulty,
    timestamp: Date.now()
  };
}

export async function solvePoWChallenge(
  challenge: ProofOfWorkChallenge
): Promise<{ nonce: string; hash: string; durationMs: number }> {
  const start = Date.now();
  const targetPrefix = '0'.repeat(challenge.difficulty);
  const encoder = new TextEncoder();
  let nonceNum = 0;

  // Use Web Crypto API for hardware-accelerated SHA-256
  while (true) {
    const nonce = nonceNum.toString(16);
    const data = encoder.encode(`${challenge.seed}:${nonce}:${challenge.timestamp}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert first 4 bytes to hex to quickly check prefix
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (hashHex.startsWith(targetPrefix)) {
      return {
        nonce,
        hash: hashHex,
        durationMs: Date.now() - start
      };
    }

    nonceNum++;
    // Failsafe limit
    if (nonceNum > 200000) {
      return { nonce: nonceNum.toString(16), hash: '', durationMs: Date.now() - start };
    }
  }
}

export async function verifyPoWSolution(
  challenge: ProofOfWorkChallenge,
  nonce: string
): Promise<boolean> {
  // Validate expiration (valid for 5 minutes)
  if (Date.now() - challenge.timestamp > 5 * 60 * 1000) {
    return false;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(`${challenge.seed}:${nonce}:${challenge.timestamp}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const targetPrefix = '0'.repeat(challenge.difficulty);

  return hashHex.startsWith(targetPrefix);
}

/* ───────────────────────────────────────────────────────────
   5. INPUT SANITIZATION & XSS PROTECTION
   ─────────────────────────────────────────────────────────── */

export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Strip script tags
    .replace(/javascript:/gi, '') // Strip inline javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Strip onload=, onerror=, etc.
    .replace(/data:text\/html/gi, '')
    .trim();
}

/* ───────────────────────────────────────────────────────────
   6. GLOBAL DDOS BURST SHIELD
   Monitors high-frequency network requests from the page.
   Prevents accidental or malicious infinite loops flooding the DB.
   ─────────────────────────────────────────────────────────── */

class DDoSBurstShield {
  private requests: number[] = [];
  private readonly maxRequestsPer10s = 50;

  public canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < 10000);
    if (this.requests.length >= this.maxRequestsPer10s) {
      console.warn('[DDoSBurstShield] Outgoing request burst threshold exceeded. Throttling.');
      return false;
    }
    this.requests.push(now);
    return true;
  }

  public getCount(): number {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < 10000);
    return this.requests.length;
  }
}

export const ddosBurstShield = new DDoSBurstShield();
