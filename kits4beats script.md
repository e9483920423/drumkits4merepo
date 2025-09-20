// ==UserScript==
// @name Kits4Beats Auto Download Opener
// @namespace http://tampermonkey.net/
// @version 1.4.9.19
// @description Opens any download link on kits4beats kit pages.
// @author 83924723904712
// @match https://kits4beats.com/*
// @icon https://www.google.com/s2/favicons?sz=64&domain=kits4beats.com
// @grant none
// ==/UserScript==

(function() {
'use strict';

    // Keep track of links we already opened
    const openedLinks = new Set();

    const handleDownloadLink = (anchor) => {
        const url = anchor.href;
        if (!openedLinks.has(url)) {
            console.log(`[Tampermonkey] Opening download link: ${url}`);
            window.open(url, '_blank');
            openedLinks.add(url);
        }
    };

    // Initial check in case the element already exists
    const initialLink = document.querySelector('a#download');
    if (initialLink) handleDownloadLink(initialLink);

    // Observe the page for any added nodes
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // element
                    const anchor = node.querySelector && node.querySelector('a#download');
                    if (anchor) handleDownloadLink(anchor);

                    // Also check if the node itself is the anchor
                    if (node.id === 'download' && node.tagName === 'A') {
                        handleDownloadLink(node);
                    }
                }
            });
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
