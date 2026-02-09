/* ───────────────────────────────────────────
   Coach  ·  code.js  (Figma sandbox)
   ─────────────────────────────────────────── */

const NAMESPACE = 'coach';
const KEY_GUIDANCE_OVERRIDES  = 'guidanceOverrides';
const KEY_DETACH_COUNT       = 'detachCount';
const KEY_INDEXED_COMPONENTS = 'indexedComponents';

// ── screen sizes ────────────────────────────

const CHIP_W = 170, CHIP_H = 32;

// ── tracking state ──────────────────────────

// Component instances: { nodeId: { name, parentId, x, y, w, h } }
var trackedInstances = {};

// Text style bindings: { nodeId: textStyleId }
var trackedTextStyles = {};

// Variable/token bindings: { nodeId: { field: variableId, ... } }
var trackedVariables = {};

// Which variable fields map to which drift category
var VAR_FIELD_CATEGORY = {
  // color
  fills: 'color', strokes: 'color',
  // spacing (component category — layout tokens)
  paddingLeft: 'component', paddingRight: 'component',
  paddingTop: 'component', paddingBottom: 'component',
  itemSpacing: 'component', counterAxisSpacing: 'component',
  // radius
  topLeftRadius: 'component', topRightRadius: 'component',
  bottomLeftRadius: 'component', bottomRightRadius: 'component',
  // border width
  strokeWeight: 'component',
  strokeTopWeight: 'component', strokeRightWeight: 'component',
  strokeBottomWeight: 'component', strokeLeftWeight: 'component'
};

// ── helpers ─────────────────────────────────

function load(key) {
  var raw = figma.root.getSharedPluginData(NAMESPACE, key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function save(key, value) {
  figma.root.setSharedPluginData(NAMESPACE, key, JSON.stringify(value));
}

function sendTheme() {
  figma.ui.postMessage({ type: 'theme', theme: 'light' });
}

function sendGuidanceOverrides() {
  figma.ui.postMessage({ type: 'guidance-overrides', data: load(KEY_GUIDANCE_OVERRIDES) || null });
}

function sendUserIdentity() {
  var user = figma.currentUser;
  var name = (user && user.name) ? user.name : '';
  var id   = (user && user.id)   ? user.id   : '';
  figma.ui.postMessage({ type: 'user-identity', name: name, id: id });
}

function loadDetachCount() {
  var raw = figma.root.getSharedPluginData(NAMESPACE, KEY_DETACH_COUNT);
  return raw ? (parseInt(raw, 10) || 0) : 0;
}

function saveDetachCount(n) {
  figma.root.setSharedPluginData(NAMESPACE, KEY_DETACH_COUNT, String(n));
}

function sendDetachCount() {
  figma.ui.postMessage({ type: 'detach-count', detachCount: loadDetachCount() });
}

function emitDrift(category) {
  var count = loadDetachCount() + 1;
  saveDetachCount(count);

  var allContent = load(KEY_GUIDANCE_OVERRIDES);
  var catContent = (allContent && allContent[category]) ? allContent[category] : null;

  figma.ui.postMessage({
    type: 'drift',
    category: category,
    detachCount: count,
    content: catContent
  });
}

// ── snapshot helpers ────────────────────────

function snapshotBoundVars(node) {
  var snap = {};
  var bv = node.boundVariables;
  if (!bv) return snap;
  for (var field in VAR_FIELD_CATEGORY) {
    var binding = bv[field];
    if (binding) {
      // Array fields (fills, strokes) → array of VariableAlias
      if (Array.isArray(binding) && binding.length > 0) {
        snap[field] = binding.map(function(b) { return b.id; }).join(',');
      }
      // Scalar fields → single VariableAlias
      else if (binding.id) {
        snap[field] = binding.id;
      }
    }
  }
  return snap;
}

// ── indexing ─────────────────────────────────

async function runIndexing() {
  // loadAsync required under dynamic-page before findAll
  await figma.currentPage.loadAsync();
  var nodes = figma.currentPage.findAll(function (n) {
    return n.type === 'COMPONENT' || n.type === 'COMPONENT_SET';
  });
  var components = nodes.map(function (n) {
    return { id: n.id, key: n.key || null, name: n.name, type: n.type };
  });
  save(KEY_INDEXED_COMPONENTS, components);
  return components;
}

function sendIndexedComponents() {
  figma.ui.postMessage({
    type: 'indexed-components',
    data: load(KEY_INDEXED_COMPONENTS) || []
  });
}

// ── init ────────────────────────────────────

// Migrate old 'content' key → 'guidanceOverrides' (one-time, idempotent)
(function migrateContentKey() {
  if (!load(KEY_GUIDANCE_OVERRIDES)) {
    var old = load('content');
    if (old) save(KEY_GUIDANCE_OVERRIDES, old);
  }
})();

// Open at chip size (first screen shown)
figma.showUI(__html__, { width: CHIP_W, height: CHIP_H, themeColors: true });
// (dynamic-page) getNodeByIdAsync is safe without loadAllPagesAsync

// ── component detach detection (polling, dynamic-page safe) ──
// Reliable: does not depend on documentchange timing and uses getNodeByIdAsync only.
var detachPollRunning = false;

function startDetachPoll() {
  if (detachPollRunning) return;
  detachPollRunning = true;

  setInterval(function () {
    var tids = Object.keys(trackedInstances);
    if (tids.length === 0) return;

    Promise.all(tids.map(function (id) { return figma.getNodeByIdAsync(id); }))
      .then(function (nodes) {
        var didFire = false;

        // Snapshot current selection once per tick
        var sel = figma.currentPage.selection || [];

        for (var i = 0; i < tids.length; i++) {
          var id = tids[i];
          var node = nodes[i];
          var meta = trackedInstances[id];

          if (!node) {
            // Under detach, Figma often deletes the INSTANCE and creates a new FRAME with a new id.
            // If the user is still “on” the detached result (selection contains the replacement), treat as detach.
            var looksLikeDetachReplacement = false;
            if (meta && sel && sel.length > 0) {
              for (var s = 0; s < sel.length; s++) {
                var sn = sel[s];
                if (!sn) continue;
                if (sn.type === 'INSTANCE') continue;

                var sameName = (sn.name || '') === (meta.name || '');
                var sameParent = (sn.parent && sn.parent.id) ? (sn.parent.id === meta.parentId) : false;
                var closeX = (typeof sn.x === 'number') && Math.abs(sn.x - meta.x) < 1;
                var closeY = (typeof sn.y === 'number') && Math.abs(sn.y - meta.y) < 1;
                var closeW = (typeof sn.width === 'number') && Math.abs(sn.width - meta.w) < 1;
                var closeH = (typeof sn.height === 'number') && Math.abs(sn.height - meta.h) < 1;

                if (sameName && sameParent && closeX && closeY && closeW && closeH) {
                  looksLikeDetachReplacement = true;
                  break;
                }
              }
            }

            delete trackedInstances[id];

            if (looksLikeDetachReplacement && !didFire) {
              didFire = true;
              emitDrift('component');
            }
            continue;
          }

          if (node.type !== 'INSTANCE') {
            delete trackedInstances[id];
            if (!didFire) {
              didFire = true;
              emitDrift('component');
            }
          }
        }
      })
      .catch(function () {
        // swallow: no false drift
      });
  }, 200);
}

startDetachPoll();

// send initial data
sendTheme();
sendGuidanceOverrides();
sendUserIdentity();
sendDetachCount();

// ── selection tracking ──────────────────────

figma.on('selectionchange', function () {
  var sel = figma.currentPage.selection;
  var nextInstances = {};
  var nextTextStyles = {};
  var nextVars = {};

  for (var i = 0; i < sel.length; i++) {
    var node = sel[i];
    if (!node) continue;

    if (node.type === 'INSTANCE') {
      // Save enough info to detect detach-as-replace (INSTANCE deleted → FRAME created with new id)
      nextInstances[node.id] = {
        name: node.name || '',
        parentId: (node.parent && node.parent.id) ? node.parent.id : '',
        x: (typeof node.x === 'number') ? node.x : 0,
        y: (typeof node.y === 'number') ? node.y : 0,
        w: (typeof node.width === 'number') ? node.width : 0,
        h: (typeof node.height === 'number') ? node.height : 0
      };
    }

    if (node.type === 'TEXT' && node.textStyleId && node.textStyleId !== '' && node.textStyleId !== figma.mixed) {
      nextTextStyles[node.id] = node.textStyleId;
    }

    var varSnap = snapshotBoundVars(node);
    if (Object.keys(varSnap).length > 0) {
      nextVars[node.id] = varSnap;
    }
  }

  // Instances: preserve across post-detach FRAME selection, but clear when nothing is selected
  if (sel.length === 0) {
    trackedInstances = {};
  } else if (Object.keys(nextInstances).length > 0) {
    trackedInstances = nextInstances;
  }

  // Text styles + variables: preserve tracking across non-text/non-token selections,
  // but clear when nothing is selected.
  if (sel.length === 0) {
    trackedTextStyles = {};
    trackedVariables  = {};
  } else {
    // Only overwrite when we actually have something to track.
    // This prevents wiping the snapshot right before a detach change event.
    if (Object.keys(nextTextStyles).length > 0) trackedTextStyles = nextTextStyles;
    if (Object.keys(nextVars).length > 0) trackedVariables = nextVars;
  }
});

// ── text style & variable detach (nodechange) ──
// nodechange works without loadAllPagesAsync and provides change.node directly.

function handleNodeChanges(event) {
  var changes = event.nodeChanges;
  var firedCategories = {};

  for (var i = 0; i < changes.length; i++) {
    var change = changes[i];
    var node = change.node;
    if (!node || !node.id) continue;
    var changeNodeId = node.id;

    // ── Text style detach ──
    if (change.type === 'PROPERTY_CHANGE' && change.properties.indexOf('textStyleId') >= 0) {
      if (trackedTextStyles[changeNodeId]) {
        if (node.type === 'TEXT') {
          if (node.textStyleId === '' || node.textStyleId === figma.mixed) {
            delete trackedTextStyles[changeNodeId];
            if (!firedCategories.text) {
              firedCategories.text = true;
              emitDrift('text');
            }
          } else {
            trackedTextStyles[changeNodeId] = node.textStyleId;
          }
        }
      }
    }

    // ── Variable/token detach ──
    if (change.type === 'PROPERTY_CHANGE') {
      if (trackedVariables[changeNodeId]) {
        var oldSnap = trackedVariables[changeNodeId];
        var newSnap = snapshotBoundVars(node);

        for (var field in oldSnap) {
          if (!newSnap[field]) {
            var cat = VAR_FIELD_CATEGORY[field] || 'component';
            if (!firedCategories[cat]) {
              firedCategories[cat] = true;
              emitDrift(cat);
            }
          }
        }

        if (Object.keys(newSnap).length > 0) {
          trackedVariables[changeNodeId] = newSnap;
        } else {
          delete trackedVariables[changeNodeId];
        }
      }
    }
  }
}

var nodechangePage = figma.currentPage;
nodechangePage.on('nodechange', handleNodeChanges);

figma.on('currentpagechange', function () {
  try {
    if (nodechangePage && nodechangePage.off) nodechangePage.off('nodechange', handleNodeChanges);
  } catch (_) {}

  trackedInstances = {};
  trackedTextStyles = {};
  trackedVariables = {};

  nodechangePage = figma.currentPage;
  nodechangePage.on('nodechange', handleNodeChanges);
});


// ── message handler ─────────────────────────

figma.ui.onmessage = function (msg) {
  switch (msg.type) {

    /* ── resize / reposition ─────────────── */
    case 'resize':
      figma.ui.resize(msg.width, msg.height);
      break;

    case 'resize-center': {
      // Resize and reposition to the center of the viewport (canvas coords).
      // Used for drift modal so it appears near the user's focus.
      var w = msg.width;
      var h = msg.height;
      figma.ui.resize(w, h);
      try {
        var vc = figma.viewport.center;
        figma.ui.reposition(
          Math.round(vc.x - w / 2),
          Math.round(vc.y - h / 2)
        );
      } catch (_) {
        // reposition may fail if user has dragged the window — resize alone is fine
      }
      break;
    }

    /* ── guidance overrides (all 4 categories) ── */
    case 'get-guidance-overrides':
      sendGuidanceOverrides();
      break;

    case 'save-guidance-overrides':
      save(KEY_GUIDANCE_OVERRIDES, msg.data);
      figma.ui.postMessage({ type: 'save-ok' });
      break;

    /* ── indexing ─────────────────────── */
    case 'run-indexing': {
      runIndexing().then(function (indexed) {
        figma.ui.postMessage({ type: 'index-results', data: indexed });
      });
      break;
    }

    case 'get-indexed-components':
      sendIndexedComponents();
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
