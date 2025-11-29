let COUNTRY_TO_FLAG = {};
const countryMapPromise = loadCountryMap();

const storage = chrome?.storage?.local || null;

init();

function loadCountryMap() {
  const mapUrl = chrome.runtime.getURL('countries.json');
  return fetch(mapUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load countries.json (${response.status})`);
      return response.json();
    })
    .then((data) => {
      COUNTRY_TO_FLAG = data || {};
      return COUNTRY_TO_FLAG;
    })
    .catch((error) => {
      console.error('[X Country] Failed to load country map:', error);
      COUNTRY_TO_FLAG = {};
      return COUNTRY_TO_FLAG;
    });
}

function init() {
  const observer = new MutationObserver(handleMutations);
  observer.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('article, [data-testid="UserCell"]').forEach(injectTrigger);
}

function handleMutations(mutations) {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType !== 1) return;
      const isArticle = node.tagName === 'ARTICLE';
      const isUserCell = node.dataset?.testid === 'UserCell';
      if (isArticle || isUserCell) {
        injectTrigger(node);
      } else {
        node.querySelectorAll?.('article, [data-testid="UserCell"]').forEach(injectTrigger);
      }
    });
  });
}

function injectTrigger(container) {
  if (container.dataset.xCountryInjected) return;

  const username = getUsernameFromContainer(container);
  if (!username) return;

  const userNameBlock =
    container.querySelector('div[data-testid="User-Name"]') ||
    container.querySelector('div[dir="ltr"][role="heading"]') ||
    container.querySelector('div[dir="ltr"]');
  if (!userNameBlock) return;

  const trigger = document.createElement('span');
  trigger.textContent = ' ❓';
  trigger.className = 'x-country-trigger';
  trigger.dataset.username = username;
  trigger.addEventListener('mouseenter', handleTriggerHover);

  const firstLine =
    userNameBlock.querySelector('.css-175oi2r.r-18u37iz') || userNameBlock.firstChild;
  (firstLine instanceof Element ? firstLine : userNameBlock).appendChild(trigger);

  container.dataset.xCountryInjected = 'true';
  preloadCachedValue(username, trigger);
}

function getUsernameFromContainer(root) {
  const userLink =
    root.querySelector('div[data-testid="User-Name"] a[href^="/"]') ||
    root.querySelector('a[href^="/"][aria-hidden="true"]') ||
    root.querySelector('a[href^="/"][role="link"]');

  if (userLink) {
    const match = userLink.getAttribute('href').match(/^\/([^\/]+)/);
    if (match) return match[1];
  }

  const handleSpan = Array.from(root.querySelectorAll('span')).find((span) =>
    span.textContent?.trim().startsWith('@')
  );
  if (handleSpan) return handleSpan.textContent.trim().replace(/^@/, '');

  return null;
}

function preloadCachedValue(username, trigger) {
  if (!storage) return;
  storage.get(username, (result) => {
    if (result[username]) {
      trigger.textContent = ` ${result[username]}`;
      trigger.dataset.status = 'done';
    }
  });
}

async function handleTriggerHover(event) {
  const trigger = event.currentTarget;
  const username = trigger.dataset.username;
  if (!username) return;
  if (trigger.dataset.status === 'loading' || trigger.dataset.status === 'done') return;

  try {
    trigger.dataset.status = 'loading';
    trigger.textContent = ' ⏳';
    const cached = await getCachedCountry(username);
    if (cached) {
      trigger.textContent = ` ${cached}`;
      trigger.dataset.status = 'done';
      return;
    }
    const rawCountry = await requestCountryFromBackground(username);
    const resolved = await normalizeCountry(rawCountry);
    trigger.textContent = ` ${resolved}`;
    await cacheCountry(username, resolved);
    trigger.dataset.status = 'done';
  } catch (error) {
    console.error('X Country Error:', error);
    trigger.textContent = ' ❌';
    trigger.dataset.status = '';
  }
}

function getCachedCountry(username) {
  if (!storage) return Promise.resolve(null);
  return new Promise((resolve) => {
    storage.get(username, (result) => resolve(result[username] || null));
  });
}

function cacheCountry(username, value) {
  if (!storage) return Promise.resolve();
  return new Promise((resolve) => storage.set({ [username]: value }, resolve));
}

async function normalizeCountry(raw) {
  if (!raw) return 'Unknown';
  await countryMapPromise;
  const trimmed = raw.trim();
  return COUNTRY_TO_FLAG[trimmed] || trimmed;
}

function requestCountryFromBackground(username) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'SCRAPE_COUNTRY', username }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      resolve(response?.country || null);
    });
  });
}

