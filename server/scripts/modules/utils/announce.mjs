// show a short confirmation in a role="status" element, which screen readers announce, then clear it
const clearTimers = new WeakMap();

const announce = (elem, text, duration = 5000) => {
	if (!elem) return;
	clearTimeout(clearTimers.get(elem));
	// empty it first so the same message is announced again when it repeats
	elem.textContent = '';
	setTimeout(() => {
		elem.textContent = text;
		clearTimers.set(elem, setTimeout(() => {
			elem.textContent = '';
		}, duration));
	}, 100);
};

export default announce;
