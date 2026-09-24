// the headend tab lists what the current forecast is built from, and tabs.mjs copies it for issue reports
// rows are marked with data-headend="key" in index.ejs and are only written through here

// rows that describe a location, cleared when the location is reset
const LOCATION_ROWS = ['location', 'station', 'radar', 'observed', 'zone', 'office', 'refreshed', 'grid', 'hrrr'];

const setHeadend = (key, text = '') => {
	const row = document.querySelector(`#divInfo [data-headend="${key}"]`);
	if (!row) {
		console.warn(`Unknown headend row: ${key}`);
		return;
	}
	row.textContent = text;
};

const clearLocationRows = () => {
	LOCATION_ROWS.forEach((key) => setHeadend(key));
};

export default setHeadend;
export {
	clearLocationRows,
};
