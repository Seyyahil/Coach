/* ───────────────────────────────────────────
   Coach  ·  code.js  (Figma sandbox)
   ─────────────────────────────────────────── */

const NAMESPACE = 'coach';
const KEY_ALLOWLIST = 'allowlist';
const KEY_CONTENT   = 'content';

// ── screen sizes ────────────────────────────

const CHIP_W = 170, CHIP_H = 32;
const TYPE_MODAL_W = 300, TYPE_MODAL_H = 148;
const AUTH_W = 460, AUTH_H = 420;
const LIST_W = 320, LIST_H = 200;

// ── helpers ─────────────────────────────────

function load(key) {
  const raw = figma.root.getSharedPluginData(NAMESPACE, key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function save(key, value) {
  figma.root.setSharedPluginData(NAMESPACE, key, JSON.stringify(value));
}

/**
 * Normalize every entry in an allowlist array to {id, name} format.
 * Handles: plain strings, mixed arrays, already-correct objects.
 */
function migrateAllowlist(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(function (entry) {
    if (typeof entry === 'string') return { id: null, name: entry };
    return entry;
  });
}

/** ID-only membership check. Returns index or -1. */
function findUserInAllowlist(userId, list) {
  if (!userId || !Array.isArray(list)) return -1;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id && list[i].id === userId) return i;
  }
  return -1;
}

function sendTheme() {
  figma.ui.postMessage({ type: 'theme', theme: 'light' });
}

function sendAllowlist() {
  var al = migrateAllowlist(load(KEY_ALLOWLIST) || []);
  figma.ui.postMessage({ type: 'allowlist', data: al });
}

function sendContent() {
  figma.ui.postMessage({ type: 'content', data: load(KEY_CONTENT) || null });
}

function sendUserIdentity() {
  // figma.currentUser exposes .id and .name (display name) — no email field exists
  var user = figma.currentUser;
  var name = (user && user.name) ? user.name : '';
  var id   = (user && user.id)   ? user.id   : '';
  figma.ui.postMessage({ type: 'user-identity', name: name, id: id });
}

// ── init ────────────────────────────────────

// Migrate allowlist format on startup (one-time, idempotent)
(function migrateIfNeeded() {
  var raw = load(KEY_ALLOWLIST);
  if (Array.isArray(raw) && raw.length > 0 && raw.some(function (e) { return typeof e === 'string'; })) {
    save(KEY_ALLOWLIST, migrateAllowlist(raw));
  }
})();

// Open at user-type modal size (first screen shown)
figma.showUI(__html__, { width: TYPE_MODAL_W, height: TYPE_MODAL_H, themeColors: true });

// send initial data
sendTheme();
sendAllowlist();
sendContent();
sendUserIdentity();

// ── message handler ─────────────────────────

figma.ui.onmessage = function (msg) {
  switch (msg.type) {

    /* ── mode selection (routing) ──────── */
    case 'select-mode': {
      var mode = msg.mode;

      if (mode === 'user') {
        figma.ui.resize(CHIP_W, CHIP_H);
        figma.ui.postMessage({ type: 'route', screen: 'TINY' });
        break;
      }

      // mode === 'admin'
      var user = figma.currentUser;
      var uid  = (user && user.id)   ? user.id   : '';
      var uname = (user && user.name) ? user.name : '';

      // Guard: if no currentUser id available, silently go to chip
      if (!uid) {
        figma.ui.resize(CHIP_W, CHIP_H);
        figma.ui.postMessage({ type: 'route', screen: 'TINY' });
        break;
      }

      var al = migrateAllowlist(load(KEY_ALLOWLIST) || []);

      // Bootstrap: no admins with real IDs, or allowlist empty
      var hasRealEntry = al.some(function (e) { return !!e.id; });
      if (!hasRealEntry) {
        // Wipe id:null legacy entries, add current user with real ID
        al = [{ id: uid, name: uname }];
        save(KEY_ALLOWLIST, al);
        figma.ui.resize(LIST_W, LIST_H);
        figma.ui.postMessage({
          type: 'route',
          screen: 'ALLOWLIST',
          reason: 'bootstrap',
          allowlist: al,
        });
        break;
      }

      // Check membership by ID only
      var idx = findUserInAllowlist(uid, al);
      if (idx >= 0) {
        figma.ui.resize(AUTH_W, AUTH_H);
        figma.ui.postMessage({
          type: 'route',
          screen: 'AUTHORING',
          allowlist: al,
        });
      } else {
        // Not in allowlist → silently go to chip
        figma.ui.resize(CHIP_W, CHIP_H);
        figma.ui.postMessage({ type: 'route', screen: 'TINY' });
      }
      break;
    }

    /* ── resize ─────────────────────────── */
    case 'resize':
      figma.ui.resize(msg.width, msg.height);
      break;

    /* ── allowlist ──────────────────────── */
    case 'get-allowlist':
      sendAllowlist();
      break;

    case 'save-allowlist':
      // Normalize on write: ensure every entry is {id, name}
      save(KEY_ALLOWLIST, migrateAllowlist(msg.data));
      sendAllowlist();
      break;

    /* ── content (all 4 categories) ─────── */
    case 'get-content':
      sendContent();
      break;

    case 'save-content':
      save(KEY_CONTENT, msg.data);
      figma.ui.postMessage({ type: 'save-ok' });
      break;

    /* ── user identity request ────────── */
    case 'get-user-identity':
      sendUserIdentity();
      break;

    /* ── theme request ──────────────────── */
    case 'get-theme':
      sendTheme();
      break;

    /* ── close ──────────────────────────── */
    case 'close':
      figma.closePlugin();
      break;
  }
};
