// tabs below the weather display (displays, settings, share, headend)

document.addEventListener('DOMContentLoaded', () => init());

const init = () => {
	// one listener on the bar, so tabs added later (such as from custom.mjs) work without extra code
	document.querySelector('#lower-tabs .tab-bar').addEventListener('click', (e) => {
		const tab = e.target.closest('[role=tab]');
		if (tab) selectTab(tab);
	});

	// keep the "enabled of total" count on the displays tab current
	const enabledDisplays = document.querySelector('#enabledDisplays');
	enabledDisplays.addEventListener('change', updateCount);
	// checkboxes are generated after the page loads
	new MutationObserver(updateCount).observe(enabledDisplays, { childList: true });
	updateCount();

	document.querySelector('#copy-headend').addEventListener('click', copyHeadend);

	// the player is scaled with a transform on small or short windows, which css widths can't follow
	// re-measure whenever navigation.mjs changes its scale (style) or display mode (class)
	const player = document.querySelector('#divTwc');
	new MutationObserver(matchPlayerWidth).observe(player, { attributes: true, attributeFilter: ['style', 'class'] });
	window.addEventListener('resize', matchPlayerWidth);
	matchPlayerWidth();
};

const matchPlayerWidth = () => {
	const { width } = document.querySelector('#divTwc').getBoundingClientRect();
	document.querySelector('#lower-tabs').style.setProperty('--player-width', `${width}px`);
};

const selectTab = (selected) => {
	document.querySelectorAll('#lower-tabs [role=tab]').forEach((tab) => {
		const isSelected = tab === selected;
		tab.setAttribute('aria-selected', isSelected);
		const panel = document.getElementById(tab.getAttribute('aria-controls'));
		panel.classList.toggle('active', isSelected);
		// let the panel's owner refresh its content
		if (isSelected) panel.dispatchEvent(new Event('tab-shown'));
	});
};

const updateCount = () => {
	const checkboxes = [...document.querySelectorAll('#enabledDisplays input[type=checkbox]')];
	const enabled = checkboxes.filter((checkbox) => checkbox.checked).length;
	document.querySelector('#enabled-count').textContent = checkboxes.length ? `${enabled}/${checkboxes.length}` : '';
};

// copy the headend information as "label: value" lines
const copyHeadend = async () => {
	const lines = [...document.querySelectorAll('#divInfo > div')].map((item) => {
		const label = item.querySelector('dt').textContent.trim().toLowerCase();
		// location is made of two spans, collapse the space between them
		const value = item.querySelector('dd').textContent.replace(/\s+/g, ' ').trim();
		return `${label}: ${value}`;
	});

	const confirmSpan = document.querySelector('#copy-headend-copied');
	try {
		await navigator.clipboard.writeText(lines.join('\n'));
		confirmSpan.textContent = 'Copied to clipboard!';
	} catch (error) {
		console.error(error);
		confirmSpan.textContent = 'Unable to copy';
	}
	confirmSpan.classList.add('show');
	setTimeout(() => confirmSpan.classList.remove('show'), 5000);
};
