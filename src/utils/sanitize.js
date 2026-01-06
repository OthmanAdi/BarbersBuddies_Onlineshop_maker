// src/utils/sanitize.js
import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param {string} html - Raw HTML string to sanitize
 * @returns {string} - Sanitized HTML safe for rendering
 */
export const sanitizeHTML = (html) => {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                       'ul', 'ol', 'li', 'a', 'span', 'div', 'blockquote'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
        ALLOW_DATA_ATTR: false
    });
};

export default sanitizeHTML;
