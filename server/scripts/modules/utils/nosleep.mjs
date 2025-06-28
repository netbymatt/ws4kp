// track state of nosleep locally to avoid a null case error
// when nosleep.disable is called without first calling .enable

let wakeLock = false;

const noSleep = (enable = false) => {
	// get a nosleep controller
	if (!noSleep.controller) noSleep.controller = new NoSleep();
	// don't call anything if the states match
	if (wakeLock === enable) return Promise.resolve(false);
	// store the value
	wakeLock = enable;
	// call the function
	if (enable) {
		return noSleep.controller.enable().catch((error) => {
			// Handle wake lock request failures gracefully
			console.warn('Wake lock request failed:', error.message);
			wakeLock = false;
			return false;
		});
	}
	return Promise.resolve(noSleep.controller.disable());
};

export default noSleep;
