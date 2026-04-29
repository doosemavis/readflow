const cache = {};

export function loadScript(url) {
  if (cache[url]) return cache[url];
  cache[url] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Failed to load " + url));
    document.head.appendChild(s);
  });
  return cache[url];
}
