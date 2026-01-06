const blockedDomains = ['sp.tinymce.com'];

export function setupNetworkBlocker() {
    const originalFetch = window.fetch;
    window.fetch = function (resource, init) {
        if (typeof resource === 'string') {
            const url = new URL(resource, window.location.origin);
            if (blockedDomains.some(domain => url.hostname.includes(domain))) {
                console.log(`Blocked request to ${url.hostname}`);
                return Promise.reject(new Error(`Request to ${url.hostname} was blocked`));
            }
        }
        return originalFetch.apply(this, arguments);
    };

    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        const parsedUrl = new URL(url, window.location.origin);
        if (blockedDomains.some(domain => parsedUrl.hostname.includes(domain))) {
            console.log(`Blocked XHR request to ${parsedUrl.hostname}`);
            throw new Error(`Request to ${parsedUrl.hostname} was blocked`);
        }
        return originalXHROpen.call(this, method, url, ...rest);
    };
}