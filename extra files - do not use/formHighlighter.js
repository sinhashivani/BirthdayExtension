// /**
//  * FormHighlighter.js - Highlights detected form fields
//  * Provides visual feedback for detected form fields
//  */

// class FormHighlighter {
//     /**
//      * Initialize the form highlighter
//      * @param {Object} options - Configuration options
//      * @param {string} options.highlightColor - Color for highlighting detected fields
//      * @param {number} options.highlightDuration - Duration of highlight animation in ms
//      * @param {boolean} options.showTooltips - Whether to show tooltips with field type
//      */
//     constructor(options = {}) {
//         this.options = {
//             highlightColor: 'rgba(76, 175, 80, 0.3)',
//             highlightBorderColor: 'rgba(76, 175, 80, 0.8)',
//             highlightDuration: 1000,
//             showTooltips: true,
//             tooltipPosition: 'top', // 'top', 'bottom', 'left', 'right'
//             ...options
//         };

//         this.highlightedElements = new Map();
//         this.tooltips = [];
//     }

//     /**
//      * Highlight a detected form field
//      * @param {HTMLElement} element - The element to highlight
//      * @param {string} profileField - The matched profile field
//      * @param {boolean} willAutofill - Whether the field will be autofilled
//      */
//     highlightElement(element, profileField, willAutofill = true) {
//         if (!element || !(element instanceof HTMLElement)) {
//             return;
//         }

//         // Create a unique ID for this highlight
//         const highlightId = `highlight-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

//         // Store original styles
//         const originalStyles = {
//             backgroundColor: element.style.backgroundColor,
//             border: element.style.border,
//             boxShadow: element.style.boxShadow,
//             transition: element.style.transition
//         };

//         // Apply highlight styles
//         const color = willAutofill ? this.options.highlightColor : 'rgba(255, 235, 59, 0.3)';
//         const borderColor = willAutofill ? this.options.highlightBorderColor : 'rgba(255, 235, 59, 0.8)';

//         element.style.backgroundColor = color;
//         element.style.border = `2px solid ${borderColor}`;
//         element.style.boxShadow = `0 0 8px ${borderColor}`;
//         element.style.transition = `background-color ${this.options.highlightDuration}ms ease-out, 
//                               border ${this.options.highlightDuration}ms ease-out, 
//                               box-shadow ${this.options.highlightDuration}ms ease-out`;

//         // Show tooltip if enabled
//         if (this.options.showTooltips) {
//             this._createTooltip(element, profileField, willAutofill);
//         }

//         // Store element reference and original styles
//         this.highlightedElements.set(highlightId, {
//             element,
//             originalStyles,
//             profileField,
//             willAutofill
//         });

//         // Set timeout to restore original styles
//         setTimeout(() => {
//             this._fadeHighlight(highlightId);
//         }, this.options.highlightDuration);

//         return highlightId;
//     }

//     /**
//      * Highlight multiple elements at once
//      * @param {Array} elements - Array of {element, profileField, willAutofill} objects
//      */
//     highlightElements(elements) {
//         const highlightIds = [];

//         elements.forEach(({ element, profileField, willAutofill }) => {
//             const id = this.highlightElement(element, profileField, willAutofill);
//             if (id) {
//                 highlightIds.push(id);
//             }
//         });

//         return highlightIds;
//     }

//     /**
//      * Remove highlight from an element
//      * @param {string} highlightId - The ID of the highlight to remove
//      */
//     removeHighlight(highlightId) {
//         if (!this.highlightedElements.has(highlightId)) {
//             return;
//         }

//         const { element, originalStyles } = this.highlightedElements.get(highlightId);

//         // Restore original styles
//         Object.entries(originalStyles).forEach(([prop, value]) => {
//             element.style[prop] = value;
//         });

//         this.highlightedElements.delete(highlightId);
//     }

//     /**
//      * Remove all highlights
//      */
//     removeAllHighlights() {
//         this.highlightedElements.forEach((_, highlightId) => {
//             this.removeHighlight(highlightId);
//         });

//         this._removeAllTooltips();
//     }

//     /**
//      * Fade out a highlight gradually
//      * @param {string} highlightId - The ID of the highlight to fade
//      * @private
//      */
//     _fadeHighlight(highlightId) {
//         if (!this.highlightedElements.has(highlightId)) {
//             return;
//         }

//         const { element, originalStyles } = this.highlightedElements.get(highlightId);

//         // Gradually restore original background color
//         element.style.backgroundColor = originalStyles.backgroundColor;
//         element.style.border = originalStyles.border;
//         element.style.boxShadow = originalStyles.boxShadow;

//         // Clean up after transition
//         setTimeout(() => {
//             if (this.highlightedElements.has(highlightId)) {
//                 element.style.transition = originalStyles.transition;
//                 this.highlightedElements.delete(highlightId);
//             }
//         }, this.options.highlightDuration);
//     }

//     /**
//      * Create a tooltip for a highlighted element
//      * @param {HTMLElement} element - The element to attach tooltip to
//      * @param {string} profileField - The matched profile field
//      * @param {boolean} willAutofill - Whether the field will be autofilled
//      * @private
//      */
//     _createTooltip(element, profileField, willAutofill) {
//         // Format profile field for display (camelCase to Title Case)
//         const formattedField = profileField
//             .replace(/([A-Z])/g, ' $1')
//             .replace(/^./, str => str.toUpperCase());

//         // Create tooltip element
//         const tooltip = document.createElement('div');
//         tooltip.className = 'loyalty-assistant-tooltip';
//         tooltip.textContent = willAutofill ?
//             `Autofill: ${formattedField}` :
//             `Detected: ${formattedField}`;

//         // Style the tooltip
//         tooltip.style.cssText = `
//       position: absolute;
//       background-color: rgba(33, 33, 33, 0.9);
//       color: white;
//       padding: 5px 10px;
//       border-radius: 4px;
//       font-size: 12px;
//       z-index: 10000;
//       pointer-events: none;
//       white-space: nowrap;
//     `;

//         // Position the tooltip
//         const rect = element.getBoundingClientRect();
//         const positions = {
//             top: {
//                 top: `${rect.top + window.scrollY - 30}px`,
//                 left: `${rect.left + window.scrollX + (rect.width / 2)}px`,
//                 transform: 'translateX(-50%)'
//             },
//             bottom: {
//                 top: `${rect.bottom + window.scrollY + 5}px`,
//                 left: `${rect.left + window.scrollX + (rect.width / 2)}px`,
//                 transform: 'translateX(-50%)'
//             },
//             left: {
//                 top: `${rect.top + window.scrollY + (rect.height / 2)}px`,
//                 left: `${rect.left + window.scrollX - 5}px`,
//                 transform: 'translate(-100%, -50%)'
//             },
//             right: {
//                 top: `${rect.top + window.scrollY + (rect.height / 2)}px`,
//                 left: `${rect.right + window.scrollX + 5}px`,
//                 transform: 'translateY(-50%)'
//             }
//         };

//         const position = this.options.tooltipPosition;
//         Object.assign(tooltip.style, positions[position]);

//         // Add arrow based on position
//         const arrow = document.createElement('div');
//         arrow.style.cssText = `
//       position: absolute;
//       width: 0;
//       height: 0;
//       border-style: solid;
//     `;

//         const arrowStyles = {
//             top: {
//                 borderWidth: '5px 5px 0 5px',
//                 borderColor: 'rgba(33, 33, 33, 0.9) transparent transparent transparent',
//                 bottom: '-5px',
//                 left: '50%',
//                 transform: 'translateX(-50%)'
//             },
//             bottom: {
//                 borderWidth: '0 5px 5px 5px',
//                 borderColor: 'transparent transparent rgba(33, 33, 33, 0.9) transparent',
//                 top: '-5px',
//                 left: '50%',
//                 transform: 'translateX(-50%)'
//             },
//             left: {
//                 borderWidth: '5px 0 5px 5px',
//                 borderColor: 'transparent transparent transparent rgba(33, 33, 33, 0.9)',
//                 right: '-5px',
//                 top: '50%',
//                 transform: 'translateY(-50%)'
//             },
//             right: {
//                 borderWidth: '5px 5px 5px 0',
//                 borderColor: 'transparent rgba(33, 33, 33, 0.9) transparent transparent',
//                 left: '-5px',
//                 top: '50%',
//                 transform: 'translateY(-50%)'
//             }
//         };

//         Object.assign(arrow.style, arrowStyles[position]);
//         tooltip.appendChild(arrow);

//         // Add to document
//         document.body.appendChild(tooltip);
//         this.tooltips.push(tooltip);

//         // Remove tooltip after a delay
//         setTimeout(() => {
//             if (tooltip.parentNode) {
//                 tooltip.parentNode.removeChild(tooltip);
//                 this.tooltips = this.tooltips.filter(t => t !== tooltip);
//             }
//         }, this.options.highlightDuration);
//     }

//     /**
//      * Remove all tooltips
//      * @private
//      */
//     _removeAllTooltips() {
//         this.tooltips.forEach(tooltip => {
//             if (tooltip.parentNode) {
//                 tooltip.parentNode.removeChild(tooltip);
//             }
//         });

//         this.tooltips = [];
//     }

//     /**
//      * Update highlighter options
//      * @param {Object} newOptions - New options to apply
//      */
//     updateOptions(newOptions) {
//         this.options = {
//             ...this.options,
//             ...newOptions
//         };
//     }
// }

// // Export the FormHighlighter class
// export default FormHighlighter;