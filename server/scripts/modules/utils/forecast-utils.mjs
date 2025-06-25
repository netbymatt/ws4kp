// shared utility functions for forecast processing

/**
 * Filter out expired periods from forecast data
 * @param {Array} periods - Array of forecast periods
 * @param {string} forecastUrl - URL used for logging (optional)
 * @returns {Array} - Array of active (non-expired) periods
 */
const filterExpiredPeriods = (periods, forecastUrl = '') => {
	const now = new Date();

	const { activePeriods, removedPeriods } = periods.reduce((acc, period) => {
		const endTime = new Date(period.endTime);
		if (endTime > now) {
			acc.activePeriods.push(period);
		} else {
			acc.removedPeriods.push(period);
		}
		return acc;
	}, { activePeriods: [], removedPeriods: [] });

	if (removedPeriods.length > 0) {
		const source = forecastUrl ? ` from ${forecastUrl}` : '';
		console.log(`🚮 Forecast: Removed expired periods${source}: ${removedPeriods.map((p) => `${p.name} (ended ${p.endTime})`).join(', ')}`);
	}

	return activePeriods;
};

export default filterExpiredPeriods;
