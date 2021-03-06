/**
 * @file video.js
 * @module videojs
 */
 import {version} from '../../package.json';
 import window from 'global/window';
 import document from 'global/document';
 import * as setup from './setup';
 import * as stylesheet from './utils/stylesheet.js';
 import Component from './component';
 import EventTarget from './event-target';
 import * as Events from './utils/events.js';
 import Player from './player';
 import Plugin from './plugin';
 import mergeOptions from './utils/merge-options.js';
 import * as Fn from './utils/fn.js';
 import TextTrack from './tracks/text-track.js';
 import AudioTrack from './tracks/audio-track.js';
 import VideoTrack from './tracks/video-track.js';
 
 import { createTimeRanges } from './utils/time-ranges.js';
 import formatTime, { setFormatTime, resetFormatTime } from './utils/format-time.js';
 import log from './utils/log.js';
 import * as Dom from './utils/dom.js';
 import * as browser from './utils/browser.js';
 import * as Url from './utils/url.js';
 import {isObject} from './utils/obj';
 import computedStyle from './utils/computed-style.js';
 import extendFn from './extend.js';
 import xhr from 'xhr';
 
 // Include the built-in techs
 import Tech from './tech/tech.js';
 import { use as middlewareUse, TERMINATOR } from './tech/middleware.js';
 
 /**
  * Normalize an `id` value by trimming off a leading `#`
  *
  * @param   {string} id
  *          A string, maybe with a leading `#`.
  *
  * @returns {string}
  *          The string, without any leading `#`.
  */
 const normalizeId = (id) => id.indexOf('#') === 0 ? id.slice(1) : id;
 
 /**
  * Doubles as the main function for users to create a player instance and also
  * the main library object.
  * The `videojs` function can be used to initialize or retrieve a player.
   *
  * @param {string|Element} id
  *        Video element or video element ID
  *
  * @param {Object} [options]
  *        Optional options object for config/settings
  *
  * @param {Component~ReadyCallback} [ready]
  *        Optional ready callback
  *
  * @return {Player}
  *         A player instance
  */
 function videojs(id, options, ready) {
   let player = videojs.getPlayer(id);
 
   if (player) {
     if (options) {
       log.warn(`Player "${id}" is already initialised. Options will not be applied.`);
     }
     if (ready) {
       player.ready(ready);
     }
     return player;
   }
 
   const el = (typeof id === 'string') ? Dom.$('#' + normalizeId(id)) : id;
 
   if (!Dom.isEl(el)) {
     throw new TypeError('The element or ID supplied is not valid. (videojs)');
   }
 
   if (!document.body.contains(el)) {
     log.warn('The element supplied is not included in the DOM');
   }
 
   options = options || {};
 
   videojs.hooks('beforesetup').forEach((hookFunction) => {
     const opts = hookFunction(el, mergeOptions(options));
 
     if (!isObject(opts) || Array.isArray(opts)) {
       log.error('please return an object in beforesetup hooks');
       return;
     }
 
     options = mergeOptions(options, opts);
   });
 
   // We get the current "Player" component here in case an integration has
   // replaced it with a custom player.
   const PlayerComponent = Component.getComponent('Player');
 
   player = new PlayerComponent(el, options, ready);
 
   videojs.hooks('setup').forEach((hookFunction) => hookFunction(player));
 
   return player;
 }
 
 /**
  * An Object that contains lifecycle hooks as keys which point to an array
  * of functions that are run when a lifecycle is triggered
  */
 videojs.hooks_ = {};
 
 /**
  * Get a list of hooks for a specific lifecycle
  * @function videojs.hooks
  *
  * @param {string} type
  *        the lifecyle to get hooks from
  *
  * @param {Function|Function[]} [fn]
  *        Optionally add a hook (or hooks) to the lifecycle that your are getting.
  *
  * @return {Array}
  *         an array of hooks, or an empty array if there are none.
  */
 videojs.hooks = function(type, fn) {
   videojs.hooks_[type] = videojs.hooks_[type] || [];
   if (fn) {
     videojs.hooks_[type] = videojs.hooks_[type].concat(fn);
   }
   return videojs.hooks_[type];
 };
 
 /**
  * Add a function hook to a specific videojs lifecycle.
  *
  * @param {string} type
  *        the lifecycle to hook the function to.
  *
  * @param {Function|Function[]}
  *        The function or array of functions to attach.
  */
 videojs.hook = function(type, fn) {
   videojs.hooks(type, fn);
 };
 
 /**
  * Add a function hook that will only run once to a specific videojs lifecycle.
  *
  * @param {string} type
  *        the lifecycle to hook the function to.
  *
  * @param {Function|Function[]}
  *        The function or array of functions to attach.
  */
 videojs.hookOnce = function(type, fn) {
   videojs.hooks(type, [].concat(fn).map(original => {
     const wrapper = (...args) => {
       videojs.removeHook(type, wrapper);
       return original(...args);
     };
 
     return wrapper;
   }));
 };
 
 /**
  * Remove a hook from a specific videojs lifecycle.
  *
  * @param {string} type
  *        the lifecycle that the function hooked to
  *
  * @param {Function} fn
  *        The hooked function to remove
  *
  * @return {boolean}
  *         The function that was removed or undef
  */
 videojs.removeHook = function(type, fn) {
   const index = videojs.hooks(type).indexOf(fn);
 
   if (index <= -1) {
     return false;
   }
 
   videojs.hooks_[type] = videojs.hooks_[type].slice();
   videojs.hooks_[type].splice(index, 1);
 
   return true;
 };
 
 // Add default styles
 if (window.VIDEOJS_NO_DYNAMIC_STYLE !== true && Dom.isReal()) {
   let style = Dom.$('.vjs-styles-defaults');
 
   if (!style) {
     style = stylesheet.createStyleElement('vjs-styles-defaults');
     const head = Dom.$('head');
 
     if (head) {
       head.insertBefore(style, head.firstChild);
     }
     stylesheet.setTextContent(style, `
       .video-js {
         width: 300px;
         height: 150px;
       }
 
       .vjs-fluid {
         padding-top: 56.25%
       }
     `);
   }
 }
 
 // Run Auto-load players
 // You have to wait at least once in case this script is loaded after your
 // video in the DOM (weird behavior only with minified version)
 setup.autoSetupTimeout(1, videojs);
 
 /**
  * Current software version. Follows semver.
  *
  * @type {string}
  */
 videojs.VERSION = version;
 
 /**
  * The global options object. These are the settings that take effect
  * if no overrides are specified when the player is created.
  *
  * @type {Object}
  */
 videojs.options = Player.prototype.options_;
 
 /**
  * Get an object with the currently created players, keyed by player ID
  *
  * @return {Object}
  *         The created players
  */
 videojs.getPlayers = () => Player.players;
 
 /**
  * Get a single player based on an ID or DOM element.
  *
  * This is useful if you want to check if an element or ID has an associated
  * Video.js player, but not create one if it doesn't.
  *
  * @param   {string|Element} id
  *          An HTML element - `<video>`, `<audio>`, or `<video-js>` -
  *          or a string matching the `id` of such an element.
  *
  * @returns {Player|undefined}
  *          A player instance or `undefined` if there is no player instance
  *          matching the argument.
  */
 videojs.getPlayer = (id) => {
   const players = Player.players;
   let tag;
 
   if (typeof id === 'string') {
     const nId = normalizeId(id);
     const player = players[nId];
 
     if (player) {
       return player;
     }
 
     tag = Dom.$('#' + nId);
   } else {
     tag = id;
   }
 
   if (Dom.isEl(tag)) {
     const {player, playerId} = tag;
 
     // Element may have a `player` property referring to an already created
     // player instance. If so, return that.
     if (player || players[playerId]) {
       return player || players[playerId];
     }
   }
 };
 
 /**
  * Returns an array of all current players.
  *
  * @return {Array}
  *         An array of all players. The array will be in the order that
  *         `Object.keys` provides, which could potentially vary between
  *         JavaScript engines.
  *
  */
 videojs.getAllPlayers = () =>
 
   // Disposed players leave a key with a `null` value, so we need to make sure
   // we filter those out.
   Object.keys(Player.players).map(k => Player.players[k]).filter(Boolean);
 
 /**
  * Expose players object.
  *
  * @memberOf videojs
  * @property {Object} players
  */
 videojs.players = Player.players;
 
 /**
  * Get a component class object by name
  *
  * @borrows Component.getComponent as videojs.getComponent
  */
 videojs.getComponent = Component.getComponent;
 
 /**
  * Register a component so it can referred to by name. Used when adding to other
  * components, either through addChild `component.addChild('myComponent')` or through
  * default children options  `{ children: ['myComponent'] }`.
  *
  * > NOTE: You could also just initialize the component before adding.
  * `component.addChild(new MyComponent());`
  *
  * @param {string} name
  *        The class name of the component
  *
  * @param {Component} comp
  *        The component class
  *
  * @return {Component}
  *         The newly registered component
  */
 videojs.registerComponent = (name, comp) => {
   if (Tech.isTech(comp)) {
     log.warn(`The ${name} tech was registered as a component. It should instead be registered using videojs.registerTech(name, tech)`);
   }
 
   Component.registerComponent.call(Component, name, comp);
 };
 
 /**
  * Get a Tech class object by name
  *
  * @borrows Tech.getTech as videojs.getTech
  */
 videojs.getTech = Tech.getTech;
 
 /**
  * Register a Tech so it can referred to by name.
  * This is used in the tech order for the player.
  *
  * @borrows Tech.registerTech as videojs.registerTech
  */
 videojs.registerTech = Tech.registerTech;
 
 /**
  * Register a middleware to a source type.
  *
  * @param {String} type A string representing a MIME type.
  * @param {function(player):object} middleware A middleware factory that takes a player.
  */
 videojs.use = middlewareUse;
 
 /**
  * An object that can be returned by a middleware to signify
  * that the middleware is being terminated.
  *
  * @type {object}
  * @memberOf {videojs}
  * @property {object} middleware.TERMINATOR
  */
 Object.defineProperty(videojs, 'middleware', {
   value: {},
   writeable: false,
   enumerable: true
 });
 
 Object.defineProperty(videojs.middleware, 'TERMINATOR', {
   value: TERMINATOR,
   writeable: false,
   enumerable: true
 });
 
 /**
  * A suite of browser and device tests from {@link browser}.
  *
  * @type {Object}
  * @private
  */
 videojs.browser = browser;
 
 /**
  * Whether or not the browser supports touch events. Included for backward
  * compatibility with 4.x, but deprecated. Use `videojs.browser.TOUCH_ENABLED`
  * instead going forward.
  *
  * @deprecated since version 5.0
  * @type {boolean}
  */
 videojs.TOUCH_ENABLED = browser.TOUCH_ENABLED;
 
 /**
  * Subclass an existing class
  * Mimics ES6 subclassing with the `extend` keyword
  *
  * @borrows extend:extendFn as videojs.extend
  */
 videojs.extend = extendFn;
 
 /**
  * Merge two options objects recursively
  * Performs a deep merge like lodash.merge but **only merges plain objects**
  * (not arrays, elements, anything else)
  * Other values will be copied directly from the second object.
  *
  * @borrows merge-options:mergeOptions as videojs.mergeOptions
  */
 videojs.mergeOptions = mergeOptions;
 
 /**
  * Change the context (this) of a function
  *
  * > NOTE: as of v5.0 we require an ES5 shim, so you should use the native
  * `function() {}.bind(newContext);` instead of this.
  *
  * @borrows fn:bind as videojs.bind
  */
 videojs.bind = Fn.bind;
 
 /**
  * Register a Video.js plugin.
  *
  * @borrows plugin:registerPlugin as videojs.registerPlugin
  * @method registerPlugin
  *
  * @param  {string} name
  *         The name of the plugin to be registered. Must be a string and
  *         must not match an existing plugin or a method on the `Player`
  *         prototype.
  *
  * @param  {Function} plugin
  *         A sub-class of `Plugin` or a function for basic plugins.
  *
  * @return {Function}
  *         For advanced plugins, a factory function for that plugin. For
  *         basic plugins, a wrapper function that initializes the plugin.
  */
 videojs.registerPlugin = Plugin.registerPlugin;
 
 /**
  * Deprecated method to register a plugin with Video.js
  *
  * @deprecated
  *        videojs.plugin() is deprecated; use videojs.registerPlugin() instead
  *
  * @param {string} name
  *        The plugin name
  *
  * @param {Plugin|Function} plugin
  *         The plugin sub-class or function
  */
 videojs.plugin = (name, plugin) => {
   log.warn('videojs.plugin() is deprecated; use videojs.registerPlugin() instead');
   return Plugin.registerPlugin(name, plugin);
 };
 
 /**
  * Gets an object containing multiple Video.js plugins.
  *
  * @param  {Array} [names]
  *         If provided, should be an array of plugin names. Defaults to _all_
  *         plugin names.
  *
  * @return {Object|undefined}
  *         An object containing plugin(s) associated with their name(s) or
  *         `undefined` if no matching plugins exist).
  */
 videojs.getPlugins = Plugin.getPlugins;
 
 /**
  * Gets a plugin by name if it exists.
  *
  * @param  {string} name
  *         The name of a plugin.
  *
  * @return {Function|undefined}
  *         The plugin (or `undefined`).
  */
 videojs.getPlugin = Plugin.getPlugin;
 
 /**
  * Gets a plugin's version, if available
  *
  * @param  {string} name
  *         The name of a plugin.
  *
  * @return {string}
  *         The plugin's version or an empty string.
  */
 videojs.getPluginVersion = Plugin.getPluginVersion;
 
 /**
  * Adding languages so that they're available to all players.
  * Example: `videojs.addLanguage('es', { 'Hello': 'Hola' });`
  *
  * @param {string} code
  *        The language code or dictionary property
  *
  * @param {Object} data
  *        The data values to be translated
  *
  * @return {Object}
  *         The resulting language dictionary object
  */
 videojs.addLanguage = function(code, data) {
   code = ('' + code).toLowerCase();
 
   videojs.options.languages = mergeOptions(
     videojs.options.languages,
     {[code]: data}
   );
 
   return videojs.options.languages[code];
 };
 
 /**
  * Log messages
  *
  * @borrows log:log as videojs.log
  */
 videojs.log = log;
 
 /**
  * Creates an emulated TimeRange object.
  *
  * @borrows time-ranges:createTimeRanges as videojs.createTimeRange
  */
 /**
  * @borrows time-ranges:createTimeRanges as videojs.createTimeRanges
  */
 videojs.createTimeRange = videojs.createTimeRanges = createTimeRanges;
 
 /**
  * Format seconds as a time string, H:MM:SS or M:SS
  * Supplying a guide (in seconds) will force a number of leading zeros
  * to cover the length of the guide
  *
  * @borrows format-time:formatTime as videojs.formatTime
  */
 videojs.formatTime = formatTime;
 
 /**
  * Replaces format-time with a custom implementation, to be used in place of the default.
  *
  * @borrows format-time:setFormatTime as videojs.setFormatTime
  *
  * @method setFormatTime
  *
  * @param {Function} customFn
  *        A custom format-time function which will be called with the current time and guide (in seconds) as arguments.
  *        Passed fn should return a string.
  */
 videojs.setFormatTime = setFormatTime;
 
 /**
  * Resets format-time to the default implementation.
  *
  * @borrows format-time:resetFormatTime as videojs.resetFormatTime
  *
  * @method resetFormatTime
  */
 videojs.resetFormatTime = resetFormatTime;
 
 /**
  * Resolve and parse the elements of a URL
  *
  * @borrows url:parseUrl as videojs.parseUrl
  *
  */
 videojs.parseUrl = Url.parseUrl;
 
 /**
  * Returns whether the url passed is a cross domain request or not.
  *
  * @borrows url:isCrossOrigin as videojs.isCrossOrigin
  */
 videojs.isCrossOrigin = Url.isCrossOrigin;
 
 /**
  * Event target class.
  *
  * @borrows EventTarget as videojs.EventTarget
  */
 videojs.EventTarget = EventTarget;
 
 /**
  * Add an event listener to element
  * It stores the handler function in a separate cache object
  * and adds a generic handler to the element's event,
  * along with a unique id (guid) to the element.
  *
  * @borrows events:on as videojs.on
  */
 videojs.on = Events.on;
 
 /**
  * Trigger a listener only once for an event
  *
  * @borrows events:one as videojs.one
  */
 videojs.one = Events.one;
 
 /**
  * Removes event listeners from an element
  *
  * @borrows events:off as videojs.off
  */
 videojs.off = Events.off;
 
 /**
  * Trigger an event for an element
  *
  * @borrows events:trigger as videojs.trigger
  */
 videojs.trigger = Events.trigger;
 
 /**
  * A cross-browser XMLHttpRequest wrapper. Here's a simple example:
  *
  * @param {Object} options
  *        settings for the request.
  *
  * @return {XMLHttpRequest|XDomainRequest}
  *         The request object.
  *
  * @see https://github.com/Raynos/xhr
  */
 videojs.xhr = xhr;
 
 /**
  * TextTrack class
  *
  * @borrows TextTrack as videojs.TextTrack
  */
 videojs.TextTrack = TextTrack;
 
 /**
  * export the AudioTrack class so that source handlers can create
  * AudioTracks and then add them to the players AudioTrackList
  *
  * @borrows AudioTrack as videojs.AudioTrack
  */
 videojs.AudioTrack = AudioTrack;
 
 /**
  * export the VideoTrack class so that source handlers can create
  * VideoTracks and then add them to the players VideoTrackList
  *
  * @borrows VideoTrack as videojs.VideoTrack
  */
 videojs.VideoTrack = VideoTrack;
 
 /**
  * Determines, via duck typing, whether or not a value is a DOM element.
  *
  * @borrows dom:isEl as videojs.isEl
  * @deprecated Use videojs.dom.isEl() instead
  */
 
 /**
  * Determines, via duck typing, whether or not a value is a text node.
  *
  * @borrows dom:isTextNode as videojs.isTextNode
  * @deprecated Use videojs.dom.isTextNode() instead
  */
 
 /**
  * Creates an element and applies properties.
  *
  * @borrows dom:createEl as videojs.createEl
  * @deprecated Use videojs.dom.createEl() instead
  */
 
 /**
  * Check if an element has a CSS class
  *
  * @borrows dom:hasElClass as videojs.hasClass
  * @deprecated Use videojs.dom.hasClass() instead
  */
 
 /**
  * Add a CSS class name to an element
  *
  * @borrows dom:addElClass as videojs.addClass
  * @deprecated Use videojs.dom.addClass() instead
  */
 
 /**
  * Remove a CSS class name from an element
  *
  * @borrows dom:removeElClass as videojs.removeClass
  * @deprecated Use videojs.dom.removeClass() instead
  */
 
 /**
  * Adds or removes a CSS class name on an element depending on an optional
  * condition or the presence/absence of the class name.
  *
  * @borrows dom:toggleElClass as videojs.toggleClass
  * @deprecated Use videojs.dom.toggleClass() instead
  */
 
 /**
  * Apply attributes to an HTML element.
  *
  * @borrows dom:setElAttributes as videojs.setAttribute
  * @deprecated Use videojs.dom.setAttributes() instead
  */
 
 /**
  * Get an element's attribute values, as defined on the HTML tag
  * Attributes are not the same as properties. They're defined on the tag
  * or with setAttribute (which shouldn't be used with HTML)
  * This will return true or false for boolean attributes.
  *
  * @borrows dom:getElAttributes as videojs.getAttributes
  * @deprecated Use videojs.dom.getAttributes() instead
  */
 
 /**
  * Empties the contents of an element.
  *
  * @borrows dom:emptyEl as videojs.emptyEl
  * @deprecated Use videojs.dom.emptyEl() instead
  */
 
 /**
  * Normalizes and appends content to an element.
  *
  * The content for an element can be passed in multiple types and
  * combinations, whose behavior is as follows:
  *
  * - String
  *   Normalized into a text node.
  *
  * - Element, TextNode
  *   Passed through.
  *
  * - Array
  *   A one-dimensional array of strings, elements, nodes, or functions (which
  *   return single strings, elements, or nodes).
  *
  * - Function
  *   If the sole argument, is expected to produce a string, element,
  *   node, or array.
  *
  * @borrows dom:appendContents as videojs.appendContet
  * @deprecated Use videojs.dom.appendContent() instead
  */
 
 /**
  * Normalizes and inserts content into an element; this is identical to
  * `appendContent()`, except it empties the element first.
  *
  * The content for an element can be passed in multiple types and
  * combinations, whose behavior is as follows:
  *
  * - String
  *   Normalized into a text node.
  *
  * - Element, TextNode
  *   Passed through.
  *
  * - Array
  *   A one-dimensional array of strings, elements, nodes, or functions (which
  *   return single strings, elements, or nodes).
  *
  * - Function
  *   If the sole argument, is expected to produce a string, element,
  *   node, or array.
  *
  * @borrows dom:insertContent as videojs.insertContent
  * @deprecated Use videojs.dom.insertContent() instead
  */
 [
   'isEl',
   'isTextNode',
   'createEl',
   'hasClass',
   'addClass',
   'removeClass',
   'toggleClass',
   'setAttributes',
   'getAttributes',
   'emptyEl',
   'appendContent',
   'insertContent'
 ].forEach(k => {
   videojs[k] = function() {
     log.warn(`videojs.${k}() is deprecated; use videojs.dom.${k}() instead`);
     return Dom[k].apply(null, arguments);
   };
 });
 
 /**
  * A safe getComputedStyle.
  *
  * This is because in Firefox, if the player is loaded in an iframe with `display:none`,
  * then `getComputedStyle` returns `null`, so, we do a null-check to make sure
  * that the player doesn't break in these cases.
  * See https://bugzilla.mozilla.org/show_bug.cgi?id=548397 for more details.
  *
  * @borrows computed-style:computedStyle as videojs.computedStyle
  */
 videojs.computedStyle = computedStyle;
 
 /**
  * Export the Dom utilities for use in external plugins
  * and Tech's
  */
 videojs.dom = Dom;
 
 /**
  * Export the Url utilities for use in external plugins
  * and Tech's
  */
 videojs.url = Url;
 
 export default videojs;
 
 