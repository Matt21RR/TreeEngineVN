/*
 * highlight-within-textarea
 *
 * @author  Will Boyd
 * @github  https://github.com/lonekorean/highlight-within-textarea
 */
import $ from 'jquery';

let ID = 'hwt';

let HighlightWithinTextarea = function($el, config) {
	this.init($el, config);
};

HighlightWithinTextarea.prototype = {
	init: function($el, config) {
		this.$el = $el;

		// backwards compatibility with v1 (deprecated)
		if (this.getType(config) === 'function') {
			config = { highlight: config };
		}

		if (this.getType(config) === 'custom') {
			this.highlight = config;
			this.generate();
		} else {
			console.error('valid config object not provided');
		}
	},

	// returns identifier strings that aren't necessarily "real" JavaScript types
	getType: function(instance) {
		let type = typeof instance;
		if (!instance) {
			return 'falsey';
		} else if (Array.isArray(instance)) {
			if (instance.length === 2 && typeof instance[0] === 'number' && typeof instance[1] === 'number') {
				return 'range';
			} else {
				return 'array';
			}
		} else if (type === 'object') {
			if (instance instanceof RegExp) {
				return 'regexp';
			} else if (instance.hasOwnProperty('highlight')) {
				return 'custom';
			}
		} else if (type === 'function' || type === 'string') {
			return type;
		}

		return 'other';
	},

	generate: function() {
		this.$el
			.addClass(ID + '-input ' + ID + '-content')
			.on('input.' + ID, this.handleInput.bind(this))
			.on('load', this.handleInput.bind(this))
			.on('scroll.' + ID, this.handleScroll.bind(this));

		this.$highlights = $('<div>', { class: ID + '-highlights ' + ID + '-content' });

		this.$backdrop = $('<div>', { class: ID + '-backdrop' })
			.append(this.$highlights);

		this.$container = $('<div>', { class: ID + '-container' })
			.insertAfter(this.$el)
			.append(this.$backdrop, this.$el) // moves $el into $container
			.on('scroll', this.blockContainerScroll.bind(this));

		// plugin function checks this for success
		this.isGenerated = true;

		// trigger input event to highlight any existing input
		this.handleInput();
	},

	handleInput: function() {
		let input = this.$el.val();
		let ranges = this.getRanges(input, this.highlight);
		let unstaggeredRanges = this.removeStaggeredRanges(ranges);
		let boundaries = this.getBoundaries(unstaggeredRanges);
		this.renderMarks(boundaries);
	},

	getRanges: function(input, highlight) {
		let type = this.getType(highlight);
		switch (type) {
			case 'array':
				return this.getArrayRanges(input, highlight);
			case 'function':
				return this.getFunctionRanges(input, highlight);
			case 'regexp':
				return this.getRegExpRanges(input, highlight);
			case 'string':
				return this.getStringRanges(input, highlight);
			case 'range':
				return this.getRangeRanges(input, highlight);
			case 'custom':
				return this.getCustomRanges(input, highlight);
			default:
				if (!highlight) {
					// do nothing for falsey values
					return [];
				} else {
					console.error('unrecognized highlight type');
				}
		}
	},

	getArrayRanges: function(input, arr) {
		let ranges = arr.map(this.getRanges.bind(this, input));
		return Array.prototype.concat.apply([], ranges);
	},

	getFunctionRanges: function(input, func) {
		return this.getRanges(input, func(input));
	},

	getRegExpRanges: function(input, regex) {
		let ranges = [];
		let match;
		while (match = regex.exec(input), match !== null) {
			ranges.push([match.index, match.index + match[0].length]);
			if (!regex.global) {
				// non-global regexes do not increase lastIndex, causing an infinite loop,
				// but we can just break manually after the first match
				break;
			}
		}
		return ranges;
	},

	getStringRanges: function(input, str) {
		let ranges = [];
		let inputLower = input.toLowerCase();
		let strLower = str.toLowerCase();
		let index = 0;
		while (index = inputLower.indexOf(strLower, index), index !== -1) {
			ranges.push([index, index + strLower.length]);
			index += strLower.length;
		}
		return ranges;
	},

	getRangeRanges: function(input, range) {
		return [range];
	},

	getCustomRanges: function(input, custom) {
		let ranges = this.getRanges(input, custom.highlight);
		
		// Si existe secondPassRegex, aplicar segunda pasada
		if (custom.secondPassRegex) {
			ranges = this.applySecondPass(input, ranges, custom.secondPassRegex);
		}
		
		if (custom.className) {
			ranges.forEach(function(range) {
				// persist class name as a property of the array
				if (range.className) {
					range.className = custom.className + ' ' + range.className;
				} else {
					range.className = custom.className;
				}
			});
		}
		return ranges;
	},

	applySecondPass: function(input, ranges, secondPassRegex) {
		let secondPassRanges = [];
		
		ranges.forEach(function(range) {
			// Extraer el texto del rango capturado en la primera pasada
			let capturedText = input.substring(range[0], range[1]);
			let offset = range[0]; // offset para ajustar índices relativos
			
			// Aplicar el segundo regex al texto capturado
			let match;
			let regex = new RegExp(secondPassRegex.source, secondPassRegex.flags);
			
			while (match = regex.exec(capturedText), match !== null) {
				// Crear nuevo rango ajustado con el offset original
				let newRange = [
					offset + match.index,
					offset + match.index + match[0].length
				];
				
				// Preservar className si existe en el rango original
				if (range.className) {
					newRange.className = range.className;
				}
				
				secondPassRanges.push(newRange);
				
				if (!regex.global) {
					break;
				}
			}
		});
		
		return secondPassRanges;
	},

	// prevent staggered overlaps (clean nesting is fine)
	removeStaggeredRanges: function(ranges) {
		let unstaggeredRanges = [];
		ranges.forEach(function(range) {
			let isStaggered = unstaggeredRanges.some(function(unstaggeredRange) {
				let isStartInside = range[0] > unstaggeredRange[0] && range[0] < unstaggeredRange[1];
				let isStopInside = range[1] > unstaggeredRange[0] && range[1] < unstaggeredRange[1];
				return isStartInside !== isStopInside; // xor
			});
			if (!isStaggered) {
				unstaggeredRanges.push(range);
			}
		});
		return unstaggeredRanges;
	},

	getBoundaries: function(ranges) {
		let boundaries = [];
		ranges.forEach(function(range) {
			boundaries.push({
				type: 'start',
				index: range[0],
				className: range.className
			});
			boundaries.push({
				type: 'stop',
				index: range[1]
			});
		});

		this.sortBoundaries(boundaries);
		return boundaries;
	},

	sortBoundaries: function(boundaries) {
		// backwards sort (since marks are inserted right to left)
		boundaries.sort(function(a, b) {
			if (a.index !== b.index) {
				return b.index - a.index;
			} else if (a.type === 'stop' && b.type === 'start') {
				return 1;
			} else if (a.type === 'start' && b.type === 'stop') {
				return -1;
			} else {
				return 0;
			}
		});
	},

	renderMarks: function(boundaries) {
		let input = this.$el.val();
		boundaries.forEach(function(boundary, index) {
			let markup;
			if (boundary.type === 'start') {
				markup = '{{hwt-mark-start|' + index + '}}';
			} else {
				markup = '{{hwt-mark-stop}}';
			}
			input = input.slice(0, boundary.index) + markup + input.slice(boundary.index);
		});

		// this keeps scrolling aligned when input ends with a newline
		input = input.replace(/\n(\{\{hwt-mark-stop\}\})?$/, '\n\n$1');

		// encode HTML entities
		input = input.replace(/</g, '&lt;').replace(/>/g, '&gt;');

		// replace start tokens with opening <mark> tags with class name
		input = input.replace(/\{\{hwt-mark-start\|(\d+)\}\}/g, function(match, submatch) {
			var className = boundaries[+submatch].className;
			if (className) {
				return '<span class="' + className + '">';
			} else {
				return '<span>';
			}
		});

		// replace stop tokens with closing </mark> tags
		input = input.replace(/\{\{hwt-mark-stop\}\}/g, '</span>');

		this.$highlights.html(input);
	},

	handleScroll: function() {
		let scrollTop = this.$el.scrollTop();
		this.$backdrop.scrollTop(scrollTop);

		// Chrome and Safari won't break long strings of spaces, which can cause
		// horizontal scrolling, this compensates by shifting highlights by the
		// horizontally scrolled amount to keep things aligned
		let scrollLeft = this.$el.scrollLeft();
		this.$backdrop.css('transform', (scrollLeft > 0) ? 'translateX(' + -scrollLeft + 'px)' : '');
	},

	// in Chrome, page up/down in the textarea will shift stuff within the
	// container (despite the CSS), this immediately reverts the shift
	blockContainerScroll: function() {
		this.$container.scrollLeft(0);
	},

	destroy: function() {
		this.$backdrop.remove();
		this.$el
			.unwrap()
			.removeClass(ID + '-text ' + ID + '-input')
			.off(ID)
			.removeData(ID);
	},
};

// register the jQuery plugin
$.fn.highlightWithinTextarea = function(options) {
	return this.each(function() {
		let $this = $(this);
		let plugin = $this.data(ID);

		if (typeof options === 'string') {
			if (plugin) {
				switch (options) {
					case 'update':
						plugin.handleInput();
						break;
					case 'destroy':
						plugin.destroy();
						break;
					default:
						console.error('unrecognized method string');
				}
			} else {
				console.error('plugin must be instantiated first');
			}
		} else {
			if (plugin) {
				plugin.destroy();
			}
			plugin = new HighlightWithinTextarea($this, options);
			if (plugin.isGenerated) {
				$this.data(ID, plugin);
			}
		}
	});
};