const LABEL_TEXT = 'Account based in';
const ABOUT_URL = (username) =>
  `https://x.com/${encodeURIComponent(username)}/about?xcountry=1`;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'SCRAPE_COUNTRY' && message.username) {
    handleScrapeRequest(message.username)
      .then((country) => sendResponse({ country }))
      .catch((error) => sendResponse({ error: error?.message || 'Scrape failed' }));
    return true; // keep channel open for async response
  }
  return false;
});

async function handleScrapeRequest(username) {
  const tab = await chrome.tabs.create({
    url: ABOUT_URL(username),
    active: false
  });

  try {
    await waitForTabComplete(tab.id);
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeCountryFromAboutPage,
      args: [LABEL_TEXT]
    });
    return result || null;
  } finally {
    if (tab.id !== undefined) {
      chrome.tabs.remove(tab.id);
    }
  }
}

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timed out loading /about page'));
    }, 15000);

    function listener(updatedId, info) {
      if (updatedId === tabId && info.status === 'complete') {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function scrapeCountryFromAboutPage(labelText) {
  const spans = Array.from(document.querySelectorAll('span'));
  const labelSpan = spans.find((span) => span.textContent.trim() === labelText);
  if (!labelSpan) return null;

  const container = labelSpan.closest('div');
  if (!container) return null;

  let node = container.nextElementSibling;
  while (node && !node.textContent.trim()) {
    node = node.nextElementSibling;
  }
  return node?.textContent?.trim() || null;
}

