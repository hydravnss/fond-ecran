/**
 * Fond d'écran — image derrière le chat, façon Emochi, avec réglage du flou.
 */

const MODULE_NAME = 'fond_ecran';
const LOG = '[Fond d\'écran]';
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;

const defaultSettings = Object.freeze({
    enabled: true,
    blur: 6,
    dim: 40,
    posY: 28,
    zoom: 110,
    chars: {},
});

const ctx = () => SillyTavern.getContext();
const save = () => ctx().saveSettingsDebounced();

let settings = null;

function clamp(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, n));
}

function loadSettings() {
    const store = ctx().extensionSettings;
    const prev = store[MODULE_NAME] && typeof store[MODULE_NAME] === 'object'
        ? store[MODULE_NAME]
        : {};
    store[MODULE_NAME] = {
        enabled: prev.enabled !== false,
        blur: clamp(prev.blur, 0, 40, defaultSettings.blur),
        dim: clamp(prev.dim, 0, 80, defaultSettings.dim),
        posY: clamp(prev.posY, 0, 100, defaultSettings.posY),
        zoom: clamp(prev.zoom, 100, 180, defaultSettings.zoom),
        chars: prev.chars && typeof prev.chars === 'object' ? prev.chars : {},
    };
    settings = store[MODULE_NAME];
}

function currentKey() {
    const c = ctx();
    if (c.groupId) {
        return `group:${c.groupId}`;
    }
    const ch = c.characters?.[c.characterId];
    return ch?.avatar || null;
}

function currentLabel() {
    const c = ctx();
    if (c.groupId) {
        const group = (c.groups || []).find((item) => String(item.id) === String(c.groupId));
        return group?.name || 'Groupe';
    }
    const ch = c.characters?.[c.characterId];
    return ch?.name || '';
}

function nameForKey(key) {
    if (!key) {
        return '';
    }
    if (key.startsWith('group:')) {
        const id = key.slice(6);
        const group = (ctx().groups || []).find((item) => String(item.id) === String(id));
        return group?.name || 'Groupe';
    }
    const ch = (ctx().characters || []).find((item) => item && item.avatar === key);
    return ch?.name || key;
}

function avatarUrlForKey(key) {
    const c = ctx();
    if (!key) {
        return '';
    }
    if (key.startsWith('group:')) {
        const id = key.slice(6);
        const group = (c.groups || []).find((item) => String(item.id) === String(id));
        if (group?.avatar_url) {
            return group.avatar_url;
        }
        try {
            if (typeof c.getThumbnailUrl === 'function') {
                return c.getThumbnailUrl('group', id);
            }
        } catch (err) {
            console.debug(LOG, 'miniature groupe', err);
        }
        return '';
    }
    if (!key || key === 'none') {
        return '';
    }
    try {
        if (typeof c.getThumbnailUrl === 'function') {
            return c.getThumbnailUrl('avatar', key);
        }
    } catch (err) {
        console.debug(LOG, 'miniature', err);
    }
    return `/characters/${encodeURIComponent(key)}`;
}

function imageUrlForKey(key) {
    if (!key || !settings) {
        return '';
    }
    const rec = settings.chars[key];
    if (rec && rec.custom) {
        return rec.custom;
    }
    return avatarUrlForKey(key);
}

function cssUrl(url) {
    if (!url) {
        return 'none';
    }
    return `url("${String(url).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
}

function fallbackAvatarUrl(key) {
    if (!key || key.startsWith('group:') || key === 'none') {
        return '';
    }
    return `/characters/${encodeURIComponent(key)}`;
}

function ensureRoot() {
    const sheld = document.getElementById('sheld');
    let root = document.getElementById('fe-root');
    const imgOk = root && root.querySelector('img#fe-img');
    if (!imgOk) {
        root?.remove();
        root = document.createElement('div');
        root.id = 'fe-root';
        root.innerHTML = '<img id="fe-img" alt="" decoding="async"><div id="fe-dim" aria-hidden="true"></div>';
    }
    if (sheld && root.parentElement !== sheld) {
        sheld.insertBefore(root, sheld.firstChild);
    } else if (!sheld && !root.parentElement) {
        document.body.prepend(root);
    }
    return root;
}

const CLEAR_PROPS = [
    ['background', 'transparent'],
    ['background-color', 'transparent'],
    ['background-image', 'none'],
    ['backdrop-filter', 'none'],
    ['-webkit-backdrop-filter', 'none'],
];

function setLayerClear(on) {
    for (const id of ['chat', 'sheld', 'form_sheld']) {
        const el = document.getElementById(id);
        if (!el) {
            continue;
        }
        for (const [prop, value] of CLEAR_PROPS) {
            if (on) {
                el.style.setProperty(prop, value, 'important');
            } else {
                el.style.removeProperty(prop);
            }
        }
        if (on) {
            el.style.setProperty('--SmartThemeChatTintColor', 'transparent', 'important');
        } else {
            el.style.removeProperty('--SmartThemeChatTintColor');
        }
    }
}

function applyVars(root) {
    root.style.setProperty('--fe-blur', `${settings.blur}px`);
    root.style.setProperty('--fe-dim', String(settings.dim / 100));
    root.style.setProperty('--fe-pos', `${settings.posY}%`);
    root.style.setProperty('--fe-zoom', String(settings.zoom / 100));
}

function setWallpaperSrc(url, fallbackUrl) {
    const img = document.getElementById('fe-img');
    if (!img) {
        return;
    }
    img.onerror = () => {
        if (fallbackUrl && img.dataset.feTried !== 'fallback') {
            img.dataset.feTried = 'fallback';
            img.src = fallbackUrl;
        }
    };
    if (!url) {
        img.removeAttribute('src');
        img.dataset.feTried = '';
        return;
    }
    if (img.getAttribute('src') !== url) {
        img.dataset.feTried = '';
        img.src = url;
    }
}

function apply() {
    if (!settings) {
        return;
    }
    const root = ensureRoot();
    const key = currentKey();
    const url = imageUrlForKey(key);
    const active = !!(settings.enabled && key && url);

    document.body.classList.toggle('fe-on', active);
    setLayerClear(active);
    if (active) {
        applyVars(root);
        const custom = !!(settings.chars[key] && settings.chars[key].custom);
        setWallpaperSrc(url, custom ? '' : fallbackAvatarUrl(key));
    } else {
        setWallpaperSrc('');
    }
    refreshSettingsPreview();
}

function fileToJpegDataUrl(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, MAX_SIDE / Math.max(img.width || 1, img.height || 1));
                const width = Math.max(1, Math.round((img.width || 1) * scale));
                const height = Math.max(1, Math.round((img.height || 1) * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const draw = canvas.getContext('2d');
                draw.fillStyle = '#111114';
                draw.fillRect(0, 0, width, height);
                draw.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
            } catch (err) {
                reject(err);
            } finally {
                URL.revokeObjectURL(url);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('image illisible'));
        };
        img.src = url;
    });
}

function bindSlider(id, key, min, max, format) {
    const input = document.getElementById(id);
    const label = document.getElementById(`${id}_val`);
    if (!input) {
        return;
    }
    const paint = () => {
        input.value = String(settings[key]);
        if (label) {
            label.textContent = format(settings[key]);
        }
    };
    paint();
    input.addEventListener('input', () => {
        settings[key] = clamp(input.value, min, max, defaultSettings[key]);
        if (label) {
            label.textContent = format(settings[key]);
        }
        save();
        apply();
    });
}

function refreshSettingsPreview() {
    const preview = document.getElementById('fe_preview');
    const hint = document.getElementById('fe_current_hint');
    const url = imageUrlForKey(currentKey());
    const label = currentLabel();
    if (preview) {
        if (url) {
            preview.classList.remove('is-empty');
            preview.textContent = '';
            preview.style.backgroundImage = cssUrl(url);
            preview.style.backgroundPosition = `center ${settings.posY}%`;
            preview.style.filter = settings.blur ? `blur(${Math.min(settings.blur, 12) / 3}px)` : 'none';
        } else {
            preview.classList.add('is-empty');
            preview.style.backgroundImage = 'none';
            preview.style.filter = 'none';
            preview.textContent = 'Aucun fond pour le moment';
        }
    }
    if (hint) {
        if (!currentKey()) {
            hint.textContent = 'Ouvre un chat pour choisir une image personnalisée.';
        } else {
            const rec = settings.chars[currentKey()];
            const kind = rec && rec.custom ? 'image personnalisée' : 'avatar du personnage';
            hint.textContent = `${label} — ${kind}`;
        }
    }
    renderCustomList();
}

function renderCustomList() {
    const host = document.getElementById('fe_char_list');
    if (!host || !settings) {
        return;
    }
    const entries = Object.entries(settings.chars).filter(([, rec]) => rec && rec.custom);
    if (!entries.length) {
        host.innerHTML = '';
        return;
    }
    host.innerHTML = entries.map(([key, rec]) => {
        const title = String(nameForKey(key) || key).replace(/</g, '&lt;');
        return `<div class="fe-card" data-key="${key.replace(/"/g, '&quot;')}">
            <img class="fe-card-preview" src="${rec.custom}" alt="">
            <div class="fe-card-title">${title}</div>
            <button type="button" class="menu_button" data-forget="${key.replace(/"/g, '&quot;')}">Retirer</button>
        </div>`;
    }).join('');
    host.querySelectorAll('[data-forget]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-forget');
            if (key && settings.chars[key]) {
                delete settings.chars[key];
                save();
                apply();
            }
        });
    });
}

const SETTINGS_HTML = `
<div id="fe_settings" class="extension_container">
  <div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
      <b>Fond d'écran</b>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
      <div class="fe-hint">Image derrière le chat, comme dans Emochi. Tu règles le flou, l'assombrissement, la position et le zoom.</div>
      <div class="fe-row">
        <label for="fe_enabled">Activer</label>
        <input type="checkbox" id="fe_enabled">
      </div>
      <div id="fe_preview" class="fe-preview is-empty">Aucun fond pour le moment</div>
      <div class="fe-hint" id="fe_current_hint"></div>
      <div class="fe-actions">
        <button type="button" class="menu_button" id="fe_pick">Choisir une image</button>
        <button type="button" class="menu_button" id="fe_reset">Revenir à l'avatar</button>
        <input type="file" id="fe_file" accept="image/png,image/webp,image/jpeg,image/gif,image/*" hidden>
      </div>
      <div class="fe-slider">
        <label for="fe_blur">Flou <span id="fe_blur_val">6 px</span></label>
        <input type="range" id="fe_blur" min="0" max="40" step="1">
      </div>
      <div class="fe-slider">
        <label for="fe_dim">Assombrissement <span id="fe_dim_val">40 %</span></label>
        <input type="range" id="fe_dim" min="0" max="80" step="1">
      </div>
      <div class="fe-slider">
        <label for="fe_posY">Position <span id="fe_posY_val">28 %</span></label>
        <input type="range" id="fe_posY" min="0" max="100" step="1">
      </div>
      <div class="fe-slider">
        <label for="fe_zoom">Zoom <span id="fe_zoom_val">110 %</span></label>
        <input type="range" id="fe_zoom" min="100" max="180" step="1">
      </div>
      <div class="fe-hint">Images personnalisées</div>
      <div id="fe_char_list"></div>
    </div>
  </div>
</div>`;

function bindSettingsUi() {
    const enabled = document.getElementById('fe_enabled');
    const pick = document.getElementById('fe_pick');
    const reset = document.getElementById('fe_reset');
    const file = document.getElementById('fe_file');
    if (!enabled || !pick || !reset || !file) {
        return;
    }
    enabled.checked = !!(settings && settings.enabled);
    enabled.addEventListener('input', () => {
        settings.enabled = enabled.checked;
        save();
        apply();
    });
    bindSlider('fe_blur', 'blur', 0, 40, (v) => `${v} px`);
    bindSlider('fe_dim', 'dim', 0, 80, (v) => `${v} %`);
    bindSlider('fe_posY', 'posY', 0, 100, (v) => `${v} %`);
    bindSlider('fe_zoom', 'zoom', 100, 180, (v) => `${v} %`);

    pick.addEventListener('click', () => {
        if (!currentKey()) {
            window.toastr?.warning?.('Ouvre un chat avant de choisir une image.') || alert('Ouvre un chat avant de choisir une image.');
            return;
        }
        file.click();
    });
    reset.addEventListener('click', () => {
        const key = currentKey();
        if (key && settings.chars[key]) {
            delete settings.chars[key];
            save();
            apply();
        }
    });
    file.addEventListener('change', async () => {
        const picked = file.files && file.files[0];
        file.value = '';
        const key = currentKey();
        if (!picked || !key) {
            return;
        }
        try {
            const data = await fileToJpegDataUrl(picked);
            settings.chars[key] = { custom: data };
            save();
            apply();
        } catch (err) {
            console.warn(LOG, 'import', err);
            window.toastr?.error?.('Impossible de lire cette image.') || alert('Impossible de lire cette image.');
        }
    });
    refreshSettingsPreview();
}

jQuery(async () => {
    loadSettings();
    window.jQuery('#extensions_settings2').append(SETTINGS_HTML);
    bindSettingsUi();
    apply();

    try {
        const { eventSource, event_types, eventTypes } = ctx();
        const types = event_types || eventTypes || {};
        const refresh = () => {
            loadSettings();
            apply();
        };
        if (types.APP_READY) {
            eventSource.on(types.APP_READY, refresh);
        }
        if (types.CHAT_CHANGED) {
            eventSource.on(types.CHAT_CHANGED, apply);
        }
        if (types.CHARACTER_PAGE_LOADED) {
            eventSource.on(types.CHARACTER_PAGE_LOADED, apply);
        }
        if (types.GROUP_UPDATED) {
            eventSource.on(types.GROUP_UPDATED, apply);
        }
        if (types.SETTINGS_LOADED_AFTER) {
            eventSource.on(types.SETTINGS_LOADED_AFTER, refresh);
        }
        if (types.SETTINGS_UPDATED) {
            eventSource.on(types.SETTINGS_UPDATED, apply);
        }
    } catch (err) {
        console.debug(LOG, 'évènements indisponibles', err);
    }

    const chat = document.getElementById('chat');
    if (chat && typeof MutationObserver === 'function') {
        const observer = new MutationObserver(() => apply());
        observer.observe(chat, { childList: true });
    }
    console.log(LOG, 'chargé (1.0.2)');
});
