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
		// typing only schedules a highlight (coalesced per animation frame), instead of a full
		// synchronous re-highlight on every keystroke
		this.pendingFrame = 0;
		this.$el
			.addClass(ID + '-input ' + ID + '-content')
			.on('input.' + ID, this.scheduleInput.bind(this))
			.on('load.' + ID, this.scheduleInput.bind(this))
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

	scheduleInput: function() {
		if (this.pendingFrame) {
			return;
		}
		this.pendingFrame = requestAnimationFrame(() => {
			this.pendingFrame = 0;
			this.handleInput();
		});
	},

	cancelScheduledInput: function() {
		if (this.pendingFrame) {
			cancelAnimationFrame(this.pendingFrame);
			this.pendingFrame = 0;
		}
	},

	handleInput: function() {
		// a direct (synchronous) update makes any scheduled one redundant
		this.cancelScheduledInput();
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
				if (custom.title) {
					range.title = custom.title;
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
	//
	// Same result as the original pairwise check (a range is dropped if it staggers with any
	// previously accepted one: exactly one of its ends strictly inside the other), but in
	// O(R log n) instead of O(R²). For a range [s, e] (s <= e) that xor reduces to:
	//   A) some accepted U with  U0 < s < U1 <= e   -> min U0 over U1 in (s, e]  is < s
	//   B) some accepted U with  s <= U0 < e < U1   -> max U1 over U0 in [s, e)  is > e
	// Both are answered with two segment trees indexed by text position.
	removeStaggeredRanges: function(ranges) {
		let unstaggeredRanges = [];
		if (ranges.length === 0) {
			return unstaggeredRanges;
		}
		let maxPos = 0;
		ranges.forEach(function(range) {
			if (range[1] > maxPos) maxPos = range[1];
			if (range[0] > maxPos) maxPos = range[0];
		});
		let size = 1;
		while (size < maxPos + 1) size <<= 1;
		// minStartByEnd[pos = U1] = min U0 ; maxEndByStart[pos = U0] = max U1
		let minStartByEnd = new Float64Array(size * 2).fill(Infinity);
		let maxEndByStart = new Float64Array(size * 2).fill(-Infinity);

		let update = function(tree, pos, value, isMin) {
			let i = pos + size;
			if (isMin ? value < tree[i] : value > tree[i]) {
				tree[i] = value;
			} else {
				return;
			}
			i >>= 1;
			while (i >= 1) {
				let next = isMin ? Math.min(tree[2 * i], tree[2 * i + 1]) : Math.max(tree[2 * i], tree[2 * i + 1]);
				if (tree[i] === next) break;
				tree[i] = next;
				i >>= 1;
			}
		};
		// query over the inclusive position interval [lo, hi]
		let query = function(tree, lo, hi, isMin) {
			let res = isMin ? Infinity : -Infinity;
			if (lo < 0) lo = 0;
			if (hi > size - 1) hi = size - 1;
			if (lo > hi) return res;
			let l = lo + size, r = hi + size + 1;
			while (l < r) {
				if (l & 1) { res = isMin ? Math.min(res, tree[l]) : Math.max(res, tree[l]); l++; }
				if (r & 1) { r--; res = isMin ? Math.min(res, tree[r]) : Math.max(res, tree[r]); }
				l >>= 1; r >>= 1;
			}
			return res;
		};

		// literal pairwise check, only used against malformed (reversed) ranges, which the trees don't hold
		let staggersWith = function(range, list) {
			return list.some(function(u) {
				let isStartInside = range[0] > u[0] && range[0] < u[1];
				let isStopInside = range[1] > u[0] && range[1] < u[1];
				return isStartInside !== isStopInside; // xor
			});
		};
		let reversedAccepted = [];

		ranges.forEach(function(range) {
			let s = range[0], e = range[1];
			let isStaggered;
			if (s <= e) {
				isStaggered = (s < e) && (
					query(minStartByEnd, s + 1, e, true) < s ||
					query(maxEndByStart, s, e - 1, false) > e
				);
				isStaggered = isStaggered || (reversedAccepted.length > 0 && staggersWith(range, reversedAccepted));
			} else {
				isStaggered = staggersWith(range, unstaggeredRanges);
			}
			if (!isStaggered) {
				unstaggeredRanges.push(range);
				if (s <= e) {
					update(minStartByEnd, e, s, true);
					update(maxEndByStart, s, e, false);
				} else {
					reversedAccepted.push(range);
				}
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
				className: range.className,
				title: range.title
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
		let escape = function(text) {
			return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
		};
		let openTag = function(boundary) {
			const className = boundary.className;
			const titleAttribute = boundary.title ? ' title="' + boundary.title.replace(/\"/g, '&quot;') + '"' : '';
			if (className) {
				return '<span class="' + className + '"' + titleAttribute + '>';
			} else {
				return '<span' + titleAttribute + '>';
			}
		};

		// Boundaries are sorted backwards (the original inserted them right to left, so at equal
		// positions the later boundary ends up first). Walking the array in reverse yields the
		// exact same textual order, letting us build the HTML in one linear pass instead of
		// re-slicing the whole string once per boundary.
		let pieces = [];
		let pos = 0;
		for (let i = boundaries.length - 1; i >= 0; i--) {
			let boundary = boundaries[i];
			if (boundary.index > pos) {
				pieces.push(escape(input.slice(pos, boundary.index)));
				pos = boundary.index;
			}
			pieces.push(boundary.type === 'start' ? openTag(boundary) : '</span>');
		}
		pieces.push(escape(input.slice(pos)));
		let html = pieces.join('');

		// this keeps scrolling aligned when input ends with a newline
		html = html.replace(/\n(<\/span>)?$/, '\n\n$1');

		this.$highlights.html(html);
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
		this.cancelScheduledInput();
		this.$backdrop.remove();
		this.$el
			.unwrap()
			.removeClass(ID + '-text ' + ID + '-input')
			.off('.' + ID)
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