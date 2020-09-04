/* globals _StationInfo, luxon, _RegionalCities, utils, icons, _TravelCities, SunCalc */
const {DateTime} = luxon;
const _DayShortNames = { 'Sunday': 'Sun', 'Monday': 'Mon', 'Tuesday': 'Tue', 'Wednesday': 'Wed', 'Thursday': 'Thu', 'Friday': 'Fri', 'Saturday': 'Sat' };
const _DayLongNameArray = Object.keys(_DayShortNames);
const _DayLongNames = { 'Sun': 'Sunday', 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday' };
const _MonthLongNames = { 'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April', 'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August', 'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December' };

var canvasProgress;
var divProgress;

var divRegionalCurrentMap;
var canvasRegionalObservations;

var divRegionalForecastMap1;
var divRegionalForecastMap2;
var canvasRegionalForecast1;
var canvasRegionalForecast2;

var divDopplerRadarMap;
var canvasLocalRadar;

var divTemperature;
var divStation;
var divConditions;
var divHumidity;
var divIcon;
var divDewpoint;
var divCeiling;
var divVisibility;
var divWind;
var divPressure;
var divGust;
var divHeatIndex;
var canvasCurrentWeather;

var canvasExtendedForecast1;
var canvasExtendedForecast2;

var canvasLocalForecast;

var divHazards;
var divHazardsScroll;
var canvasHazards;

var canvasAlmanac;
var canvasAlmanacTides;
var canvasOutlook;
var canvasMarineForecast;
var canvasAirQuality;

var tblTravelCities;
var divTravelCitiesScroll;
var canvasTravelForecast;

var divOutlookTemp;
var cnvOutlookTemp;
var divOutlookPrcp;
var cnvOutlookPrcp;

var tblRegionalObservations;
var canvasLatestObservations;

var _WeatherParameters = null;

var _DopplerRadarInterval = null;
var _DopplerRadarImageIndex = 0;
var _DopplerRadarImageMax = 6;

var LoadStatuses = {
	Loading: 0,
	Loaded: 1,
	Failed: 2,
	NoData: 3,
};

var _UpdateWeatherCanvasInterval = null;
var _UpdateWeatherUpdateMs = 50;
var canvasBackGroundDateTime = null;
var canvasBackGroundCurrentConditions = null;

var CurrentConditionTypes = {
	Title: 0,
	Conditions: 1,
	Temperature: 2,
	HumidityDewpoint: 3,
	BarometricPressure: 4,
	Wind: 5,
	VisibilityCeiling: 6,
	MonthPrecipitation: 7,
};
var _UpdateWeatherCurrentConditionType = CurrentConditionTypes.Title;
var _UpdateWeatherCurrentConditionCounterMs = 0;

var _UpdateCustomScrollTextMs = 0;

var _UpdateHazardsY = 0;

var _UpdateLocalForecastIndex = 0;

var CanvasTypes = {
	Progress: 0,
	CurrentWeather: 1,
	LatestObservations: 2,
	TravelForecast: 3,
	RegionalForecast1: 4,
	RegionalForecast2: 5,
	RegionalObservations: 6,
	LocalForecast: 7,
	MarineForecast: 8,
	ExtendedForecast1: 9,
	ExtendedForecast2: 10,
	Almanac: 11,
	AlmanacTides: 12,
	AirQuality: 13,
	Outlook: 14,
	LocalRadar: 15,
	Hazards: 16,
};
var _FirstCanvasType = CanvasTypes.Progress;
var _LastCanvasType = CanvasTypes.Hazards;
var _CurrentCanvasType = _FirstCanvasType;
var _CurrentPosition = 0.0;
var _PreviousPosition = 0.0;

var _IsPlaying = false;
var _PlayIntervalId = null;

var _IsAudioPlaying = false;
var _AudioPlayIntervalId = null;
var _AudioPlayInterval = 100;
var _AudioFadeOutIntervalId = null;
var _MusicUrls = [];
var _MusicUrlsTemp = [];
var audMusic = null;
var _AudioContext = null;
var _AudioBufferSource = null;
var _AudioDuration = 0;
var _AudioCurrentTime = 0;
var _AudioGain = null;
var _AudioRefreshIntervalId = null;

var _IsNarrationPlaying = false;
var _Utterance = false;
var _CurrentUtterance = false;
var _CurrentUtteranceId = null;
var _IsSpeaking = false;

const OperatingSystems = {
	Unknown: 0,
	Windows: 1,
	MacOS: 2,
	Linux: 3,
	Unix: 4,
	iOS: 5,
	Andriod: 6,
	WindowsPhone: 7,
};
let _OperatingSystem = OperatingSystems.Unknown;
const _UserAgent = window.navigator.userAgent;
if (_UserAgent.indexOf('Win') !== -1) _OperatingSystem = OperatingSystems.Windows;
if (_UserAgent.indexOf('Mac') !== -1) _OperatingSystem = OperatingSystems.MacOS;
if (_UserAgent.indexOf('X11') !== -1) _OperatingSystem = OperatingSystems.Unix;
if (_UserAgent.indexOf('Linux') !== -1) _OperatingSystem = OperatingSystems.Linux;
if (_UserAgent.indexOf('iPad') !== -1) _OperatingSystem = OperatingSystems.iOS;
if (_UserAgent.indexOf('iPhone') !== -1) _OperatingSystem = OperatingSystems.iOS;
if (_UserAgent.indexOf('iPod') !== -1) _OperatingSystem = OperatingSystems.iOS;
if (_UserAgent.toLowerCase().indexOf('android') !== -1) _OperatingSystem = OperatingSystems.Andriod;
if (_UserAgent.indexOf('Windows Phone') !== -1) _OperatingSystem = OperatingSystems.WindowsPhone;

const GetMonthPrecipitation = async (WeatherParameters) => {
	const DateTime = luxon.DateTime;
	const today = DateTime.local().startOf('day').toISO().replace('.000','');

	try {
		const cliProducts = await $.ajaxCORS({
			type: 'GET',
			url: 'https://api.weather.gov/products',
			data: {
				location: WeatherParameters.WeatherOffice,
				type: 'CLI',
				start: today,
			},
			dataType: 'json',
			crossDomain: true,
		});

		// get the first url from the list
		const cli = await $.ajaxCORS({
			type: 'GET',
			url: cliProducts['@graph'][0]['@id'],
			dataType: 'json',
			crossDomain: true,
		});

		WeatherParameters.WeatherMonthlyTotals = WeatherMonthlyTotalsParser(cli.productText);
		console.log(WeatherParameters.WeatherMonthlyTotals);

	} catch (e) {
		console.error('GetMonthPrecipitation failed');
		console.error(e);
		return false;
	}

};

var GetTideInfo2 = function (WeatherParameters) {
	var Url = 'https://tidesandcurrents.noaa.gov/mdapi/latest/webapi/tidepredstations.json?'; //lat=40&lon=-73&radius=50";
	Url += 'lat=' + WeatherParameters.Latitude + '&';
	Url += 'lon=' + WeatherParameters.Longitude + '&radius=50';


	var MaxStationCount = 2;
	var StationCount = 0;
	var TideInfoCount = 0;

	WeatherParameters.WeatherTides = null;

	// Load the xml file using ajax
	$.ajaxCORS({
		type: 'GET',
		url: Url,
		dataType: 'json',
		crossDomain: true,
		cache: false,
		success: function (json) {
			var StationIds = $(json.stationList);

			if (StationIds.length === 0) {
				// No tide stations available for this location.


				return;
			}

			const Today = DateTime.local();
			const Tomorrow = Today.plus({days: 1});

			StationIds.each(function () {
				var StationName = this.name;
				var StationId = this.stationId;

				//https://tidesandcurrents.noaa.gov/api/datagetter?product=predictions&application=NOS.COOPS.TAC.WL&begin_date=20181228&end_date=20181229&datum=MLLW&station=9410840&time_zone=lst_ldt&units=english&interval=hilo&format=json
				var Url = 'https://tidesandcurrents.noaa.gov/api/datagetter?product=predictions&application=NOS.COOPS.TAC.WL';
				Url += `&begin_date=${Today.toFormat('yyyyMMDD')}`;
				Url += `&end_date=${Tomorrow.toFormat('yyyyMMDD')}`;
				Url += `&datum=MLLW&station=${StationId}`;
				Url += '&time_zone=lst_ldt&units=english&interval=hilo&format=json';

				if (WeatherParameters.WeatherTides === null) {
					WeatherParameters.WeatherTides = [];
				}

				var WeatherTide = {
					StationId: StationId,
				};
				WeatherTide.StationName = StationName;
				WeatherParameters.WeatherTides.push(WeatherTide);

				// Load the xml file using ajax
				$.ajaxCORS({
					type: 'GET',
					url: Url,
					dataType: 'json',
					crossDomain: true,
					cache: false,
					success: function (json) {

						if (json.error) {
							console.error(json.error);
						}

						var TideTypes = [];
						var TideTimes = [];
						var TideDays = [];

						var Predictions = json.predictions;

						var Index = 0;

						$(Predictions).each(function () {
							if (Index > 3) {
								return false;
							}

							var Now = new Date();
							var date = new Date(this.t);

							// Skip elements that are less than the current time.
							if (date.getTime() < Now.getTime()) {
								return true;
							}

							switch (this.type) {
							case 'H':
								TideTypes.push('high');
								break;
							default:
								TideTypes.push('low');
								break;
							}

							TideTimes.push(date.toTimeAMPM());
							TideDays.push(date.getDayShortName());

							Index++;
						});

						$(TideTimes).each(function (Index) {
							var TideTime = this.toString();
							TideTime = TideTime.replaceAll(' AM', 'am');
							TideTime = TideTime.replaceAll(' PM', 'pm');

							if (TideTime.startsWith('0')) {
								TideTime = TideTime.substr(1);
							}

							TideTimes[Index] = TideTime;
						});

						WeatherTide.TideTypes = TideTypes;
						WeatherTide.TideTimes = TideTimes;
						WeatherTide.TideDays = TideDays;

						TideInfoCount++;
						if (TideInfoCount >= MaxStationCount) {
							PopulateTideInfo(WeatherParameters);


						}
					},
					error: function (xhr, error, errorThrown) {
						console.error('GetTideInfo failed: ' + errorThrown);

					},
				});

				StationCount++;
				if (StationCount >= MaxStationCount) {
					return false;
				}
			});

		},
		error: function (xhr, error, errorThrown) {
			console.error('GetTideInfo failed: ' + errorThrown);
		},
	});
};

var PopulateTideInfo = function (WeatherParameters) {
	if (WeatherParameters === null || (_DontLoadGifs && WeatherParameters.Progress.Almanac !== LoadStatuses.Loaded)) {
		return;
	}

	var AlmanacInfo = WeatherParameters.AlmanacInfo;
	var WeatherTides = WeatherParameters.WeatherTides;

	// Draw canvas
	var canvas = canvasAlmanacTides[0];
	var context = canvas.getContext('2d');

	var BackGroundImage = new Image();
	BackGroundImage.onload = function () {
		context.drawImage(BackGroundImage, 0, 0);
		DrawHorizontalGradientSingle(context, 0, 30, 500, 90, _TopColor1, _TopColor2);
		DrawTriangle(context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);
		DrawHorizontalGradientSingle(context, 0, 90, 52, 399, _SideColor1, _SideColor2);
		DrawHorizontalGradientSingle(context, 584, 90, 640, 399, _SideColor1, _SideColor2);

		DrawTitleText(context, 'Almanac', 'Tides');

		var Sunrise = '';
		if (isNaN(AlmanacInfo.TodaySunRise)) {
			Sunrise = 'None';
		} else {
			Sunrise = AlmanacInfo.TodaySunRise.getFormattedTime();
			Sunrise = Sunrise.replaceAll(' am', 'am');
			Sunrise = Sunrise.replaceAll(' pm', 'pm');
		}
		DrawText(context, 'Star4000', '24pt', '#FFFFFF', 115, 375, 'Sunrise ' + Sunrise, 2);

		var Sunset = '';
		if (isNaN(AlmanacInfo.TodaySunSet)) {
			Sunset = 'None';
		} else {
			Sunset = AlmanacInfo.TodaySunSet.getFormattedTime();
			Sunset = Sunset.replaceAll(' am', 'am');
			Sunset = Sunset.replaceAll(' pm', 'pm');
		}
		DrawText(context, 'Star4000', '24pt', '#FFFFFF', 360, 375, 'Set ' + Sunset, 2);

		var y = 140;
		var x = 0;
		$(WeatherTides).each(function () {
			var WeatherTide = this;

			DrawText(context, 'Star4000', '24pt', '#FFFFFF', 315, y, (WeatherTide.StationName + ' Tides').substr(0, 32), 2, 'center');
			y += 40;

			DrawText(context, 'Star4000', '24pt', '#FFFFFF', 70, y, 'Lows:', 2);
			x = 360;
			$(WeatherTide.TideTypes).each(function (Index) {
				var TideType = this.toString();

				if (TideType !== 'low') {
					return true;
				}

				var TideTime = WeatherTide.TideTimes[Index];
				var TideDay = WeatherTide.TideDays[Index];

				if (_Units === Units.Metric) {
					TideTime = utils.calc.TimeTo24Hour(TideTime);
				}

				DrawText(context, 'Star4000', '24pt', '#FFFFFF', x, y, TideTime + ' ' + TideDay, 2, 'right');
				x += 200;
			});
			y += 40;

			DrawText(context, 'Star4000', '24pt', '#FFFFFF', 70, y, 'Highs:', 2);
			x = 360;
			$(WeatherTide.TideTypes).each(function (Index) {
				var TideType = this.toString();

				if (TideType !== 'high') {
					return true;
				}

				var TideTime = WeatherTide.TideTimes[Index];
				var TideDay = WeatherTide.TideDays[Index];

				if (_Units === Units.Metric) {
					TideTime = utils.calc.TimeTo24Hour(TideTime);
				}

				DrawText(context, 'Star4000', '24pt', '#FFFFFF', x, y, TideTime + ' ' + TideDay, 2, 'right');
				x += 200;
			});
			y += 40;

		});

		//WeatherParameters.Progress.Almanac = LoadStatuses.Loaded;

		UpdateWeatherCanvas(WeatherParameters, canvasAlmanacTides);
	};
	//BackGroundImage.src = "images/BackGround1_1.png";
	//BackGroundImage.src = "images/BackGround1_" + _Themes.toString() + ".png";
	BackGroundImage.src = 'images/BackGround1_1.png';
};

var GetOutlook = function (WeatherParameters) {
	WeatherParameters.Outlook = null;

	// No current support for HI and AK.
	if (WeatherParameters.State === 'HI' || WeatherParameters.State === 'AK') {
		GetTideInfo2(WeatherParameters);
		return;
	}

	var ImagesLoadedCounter = 0;
	var ImagesLoadedMax = 2;

	var ImageOnError = function () {
		GetTideInfo2(WeatherParameters);
	};

	var ImageOnLoad = function () {
		ImagesLoadedCounter++;
		if (ImagesLoadedCounter < ImagesLoadedMax) {
			return;
		}

		var Outlook = {};

		var now = new Date();
		var CurrentMonth = new Date(now.getYear(), now.getMonth(), 1);
		if (now.getDate() <= 14) {
			CurrentMonth = CurrentMonth.addMonths(-1);
		}
		Outlook.From = CurrentMonth.getMonthShortName();
		CurrentMonth = CurrentMonth.addMonths(1);
		Outlook.To = CurrentMonth.getMonthShortName();

		var cnvOutlookTempId = 'cnvOutlookTemp';
		var contextTemp;

		if (_DontLoadGifs === false) {
			// Clear the current image.
			divOutlookTemp.empty();

			divOutlookTemp.html('<canvas id=\'' + cnvOutlookTempId + '\' />');
			cnvOutlookTemp = $('#' + cnvOutlookTempId);
			cnvOutlookTemp.attr('width', '719'); // For Chrome.
			cnvOutlookTemp.attr('height', '707'); // For Chrome.
		}
		cnvOutlookTemp = $('#' + cnvOutlookTempId);
		contextTemp = cnvOutlookTemp[0].getContext('2d');
		contextTemp.drawImage(TempImage, 0, 0);

		var TempColor = GetOutlookColor(WeatherParameters, contextTemp);
		var Temperature = GetOutlookTemperatureIndicator(TempColor);
		Outlook.Temperature = Temperature;

		var cnvOutlookPrcpId = 'cnvOutlookPrcp';
		var contextPrcp;

		if (_DontLoadGifs === false) {
			// Clear the current image.
			divOutlookPrcp.empty();

			divOutlookPrcp.html('<canvas id=\'' + cnvOutlookPrcpId + '\' />');
			cnvOutlookPrcp = $('#' + cnvOutlookPrcpId);
			cnvOutlookPrcp.attr('width', '719'); // For Chrome.
			cnvOutlookPrcp.attr('height', '707'); // For Chrome.
		}
		cnvOutlookPrcp = $('#' + cnvOutlookPrcpId);
		contextPrcp = cnvOutlookPrcp[0].getContext('2d');
		contextPrcp.drawImage(PrcpImage, 0, 0);

		var PrcpColor = GetOutlookColor(WeatherParameters, contextPrcp);
		var Precipitation = GetOutlookPrecipitationIndicator(PrcpColor);
		Outlook.Precipitation = Precipitation;

		WeatherParameters.Outlook = Outlook;

		PopulateOutlook(WeatherParameters);

		GetTideInfo2(WeatherParameters);
	};

	var TempUrl = 'https://www.cpc.ncep.noaa.gov/products/predictions/30day/off14_temp.gif';
	TempUrl = 'cors/?u=' + encodeURIComponent(TempUrl);
	var TempImage = new Image();
	TempImage.onload = ImageOnLoad;
	TempImage.onerror = ImageOnError;
	TempImage.src = TempUrl;

	var PrcpUrl = 'https://www.cpc.ncep.noaa.gov/products/predictions/30day/off14_prcp.gif';
	PrcpUrl = 'cors/?u=' + encodeURIComponent(PrcpUrl);
	var PrcpImage = new Image();
	PrcpImage.onload = ImageOnLoad;
	TempImage.onerror = ImageOnError;
	PrcpImage.src = PrcpUrl;

};

var GetOutlookColor = function (WeatherParameters, context) {
	var X = 0;
	var Y = 0;
	var PixelColor = '';
	var Latitude = WeatherParameters.Latitude;
	var Longitude = WeatherParameters.Longitude;

	// The height is in the range of latitude 75'N (top) - 15'N (bottom)
	Y = ((75 - Latitude) / 53) * 707;

	if (Latitude < 48.83) {
		Y -= Math.abs(48.83 - Latitude) * 2.9;
	}
	if (Longitude < -100.46) {
		Y -= Math.abs(-100.46 - Longitude) * 1.7;
	} else {
		Y -= Math.abs(-100.46 - Longitude) * 1.7;
	}

	// The width is in the range of the longitude ???
	X = ((-155 - Longitude) / -110) * 719; // -155 - -40

	if (Longitude < -100.46) {
		X -= Math.abs(-100.46 - Longitude) * 1;

		if (Latitude > 40) {
			X += Math.abs(40 - Latitude) * 4;
		} else {
			X -= Math.abs(40 - Latitude) * 4;
		}
	} else {
		X += Math.abs(-100.46 - Longitude) * 2;

		if (Latitude < 36 && Longitude > -90) {
			X += Math.abs(36 - Latitude) * 8;
		} else {
			X -= Math.abs(36 - Latitude) * 6;
		}
	}

	// The further left and right from lat 45 and lon -97 the y increases
	X = Math.round(X);
	Y = Math.round(Y);

	// Determine if there is any "non-white" colors around the area.
	// Search a 16x16 region.
	var FoundColor = false;
	for (var ColorX = X - 8; ColorX <= X + 8; ColorX++) {
		for (var ColorY = Y - 8; ColorY <= Y + 8; ColorY++) {
			PixelColor = GetPixelColor(context, ColorX, ColorY);

			if (PixelColor !== '#FFFFFF' && PixelColor !== '#000000') {
				FoundColor = true;
			}

			if (FoundColor) {
				break;
			}
		}

		if (FoundColor) {
			break;
		}
	}

	return PixelColor;
};

var GetOutlookTemperatureIndicator = function (PixelColor) {
	var RGB = HexToRgb(PixelColor);

	if (RGB.b > RGB.r) {
		return 'B';
	} else if (RGB.r > RGB.b) {
		return 'A';
	} else {
		return 'N';
	}
};

var GetOutlookPrecipitationIndicator = function (PixelColor) {
	var RGB = HexToRgb(PixelColor);

	if (RGB.g > RGB.r) {
		return 'A';
	} else if (RGB.r > RGB.g) {
		return 'B';
	} else {
		return 'N';
	}

};

const GetPixelColor = (context, x, y) => {
	var PixelData = context.getImageData(x, y, 1, 1).data;
	var R = PixelData[0];
	var G = PixelData[1];
	var B = PixelData[2];
	return '#' + ('000000' + RgbToHex(R, G, B)).slice(-6);
};

const RgbToHex = (r, g, b) => {
	if (r > 255 || g > 255 || b > 255) throw 'Invalid color component';
	return ((r << 16) | (g << 8) | b).toString(16).toUpperCase();
};

const HexToRgb = (h) => {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16),
	} : null;
};

var PopulateOutlook = function (WeatherParameters) {
	if (WeatherParameters === null || (_DontLoadGifs && WeatherParameters.Progress.Almanac !== LoadStatuses.Loaded)) {
		return;
	}

	var Outlook = WeatherParameters.Outlook;

	// Draw canvas
	var canvas = canvasOutlook[0];
	var context = canvas.getContext('2d');

	var BackGroundImage = new Image();
	BackGroundImage.onload = function () {
		context.drawImage(BackGroundImage, 0, 0);
		DrawHorizontalGradientSingle(context, 0, 30, 500, 90, _TopColor1, _TopColor2);
		DrawTriangle(context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);
		DrawHorizontalGradientSingle(context, 0, 90, 52, 399, _SideColor1, _SideColor2);
		DrawHorizontalGradientSingle(context, 584, 90, 640, 399, _SideColor1, _SideColor2);

		DrawTitleText(context, 'Almanac', 'Outlook');

		DrawText(context, 'Star4000', '24pt', '#FFFFFF', 320, 180, '30 Day Outlook', 2, 'center');

		var DateRange = 'MID-' + Outlook.From.toUpperCase() + ' TO MID-' + Outlook.To.toUpperCase();
		DrawText(context, 'Star4000', '24pt', '#FFFFFF', 320, 220, DateRange, 2, 'center');

		var Temperature = GetOutlookDescription(Outlook.Temperature);
		DrawText(context, 'Star4000', '24pt', '#FFFFFF', 70, 300, 'Temperatures:  ' + Temperature, 2);

		var Precipitation = GetOutlookDescription(Outlook.Precipitation);
		DrawText(context, 'Star4000', '24pt', '#FFFFFF', 70, 380, 'Precipitation: ' + Precipitation, 2);

		UpdateWeatherCanvas(WeatherParameters, canvasOutlook);
	};
	//BackGroundImage.src = "images/BackGround1_" + _Themes.toString() + ".png";
	BackGroundImage.src = 'images/BackGround1_1.png';
};

var GetOutlookDescription = function (OutlookIndicator) {
	switch (OutlookIndicator) {
	case 'N':
		return 'Normal';
	case 'A':
		return 'Above Normal';
	case 'B':
		return 'Below Normal';
	default:
	}
};

var GetMarineForecast = async (WeatherParameters) =>  {

	var Url = 'https://l-36.com/weather_marine_cg.php?lat_long2=';
	Url += encodeURIComponent(WeatherParameters.Latitude) + ',' + encodeURIComponent(WeatherParameters.Longitude);

	WeatherParameters.MarineForecast = null;

	// Load the xml file using ajax
	$.ajaxCORS({
		type: 'GET',
		url: Url,
		dataType: 'html',
		crossDomain: true,
		cache: false,
		success: function (html) {
			var $html = $(html);
			$html.find('[src]').attr('src', ''); // Prevents the browser from loading any images on this page.
			var MarineZoneId = null;

			var select = $html.find('select[name=zone1]');
			var options = select.find('option');
			if (options.length !== 0) {
				MarineZoneId = options.val();
			}

			WeatherParameters.MarineZoneId = MarineZoneId;

			if (MarineZoneId === null) {
				GetWeatherForecast(_WeatherParameters);
				return;
			}

			var Url = 'https://forecast.weather.gov/shmrn.php?mz=';
			Url += MarineZoneId;

			// Load the xml file using ajax
			$.ajaxCORS({
				type: 'GET',
				url: Url,
				dataType: 'html',
				crossDomain: true,
				cache: false,
				success: function (html) {
					var $html = $(html);
					$html.find('[src]').attr('src', ''); // Prevents the browser from loading any images on this page.

					if ($html.text().indexOf('No Current Marine Product for Zone ') !== -1) {
						GetWeatherForecast(_WeatherParameters);

						return;
					}

					var MarineForecast = {};

					MarineForecast.Warning = '';
					//var spanWarn = $html.find(".warn");
					//if (spanWarn.length !== 0)
					//{
					//    MarineForecast.Warning = spanWarn.text().trim();
					//    MarineForecast.Warning = MarineForecast.Warning.replace(" For Hazardous Seas", "");
					//}
					var fontWarning = $html.find('font[size=\'+1\'][color=\'#FF0000\']');
					if (fontWarning.length !== 0) {
						MarineForecast.Warning = fontWarning.text().trim();
						//MarineForecast.Warning = MarineForecast.Warning.replace(" For Hazardous Seas", "");

						var Index = MarineForecast.Warning.indexOf(' FOR HAZARDOUS SEAS');
						if (Index !== -1) {
							MarineForecast.Warning = MarineForecast.Warning.substr(0, Index);
						}

						var Index2 = MarineForecast.Warning.indexOf(' IN EFFECT');
						if (Index2 !== -1) {
							MarineForecast.Warning = MarineForecast.Warning.substr(0, Index2);
						}

						MarineForecast.Warning = MarineForecast.Warning.capitalize();
					}

					MarineForecast.SeasOrWaves = 'SEAS';

					var fontForecast = $html.find('font[size=\'+1\'][color=\'#800000\']');
					fontForecast.each(function (DayIndex) {
						var Day = $(this);
						var ForecastText = $(Day.parent()[0].nextSibling).text().trim().toUpperCase();
						ForecastText = ForecastText.replaceAll('\n', '').replaceAll(String.fromCharCode(160), ' ');

						var DayName = Day.text().trim().capitalize();
						if (_DayLongNames.hasOwnProperty(DayName)) {
							DayName = _DayLongNames[DayName];
						} else if (DayName === 'Overnight') {
							DayName = 'Tonight';
						}
						DayName = DayName.replaceAll('Rest Of ', '');

						var WindSpeedLow = 0;
						var WindSpeedHigh = 0;
						var WindSpeedLowC = 0;
						var WindSpeedHighC = 0;
						var WindDirection = '';
						var TideLow = 0;
						var TideHigh = 0;
						var TideLowC = 0;
						var TideHighC = 0;
						var TideConditions = '';
						var Index = 0;
						var Index2 = 0;
						var Offset = 0;

						if (ForecastText.indexOf('N WINDS ') !== -1 || ForecastText.indexOf('N WIND ') !== -1 || ForecastText.indexOf('NORTH WINDS ') !== -1 || ForecastText.indexOf('NORTH WIND ') !== -1) {
							WindDirection = 'N';
						} else if (ForecastText.indexOf('S WINDS ') !== -1 || ForecastText.indexOf('S WIND ') !== -1 || ForecastText.indexOf('SOUTH WINDS ') !== -1 || ForecastText.indexOf('SOUTH WIND ') !== -1) {
							WindDirection = 'S';
						} else if (ForecastText.indexOf('E WINDS ') !== -1 || ForecastText.indexOf('E WIND ') !== -1 || ForecastText.indexOf('EAST WINDS ') !== -1 || ForecastText.indexOf('EAST WIND ') !== -1) {
							WindDirection = 'E';
						} else if (ForecastText.indexOf('W WINDS ') !== -1 || ForecastText.indexOf('W WIND ') !== -1 || ForecastText.indexOf('WEST WINDS ') !== -1 || ForecastText.indexOf('WEST WIND ') !== -1) {
							WindDirection = 'W';
						}
						if (ForecastText.indexOf('NE WINDS ') !== -1 || ForecastText.indexOf('NE WIND ') !== -1 || ForecastText.indexOf('NORTHEAST WINDS ') !== -1 || ForecastText.indexOf('NORTHEAST WIND ') !== -1) {
							WindDirection = 'NE';
						} else if (ForecastText.indexOf('SE WINDS ') !== -1 || ForecastText.indexOf('SE WIND ') !== -1 || ForecastText.indexOf('SOUTHEAST WINDS ') !== -1 || ForecastText.indexOf('SOUTHEAST WIND ') !== -1) {
							WindDirection = 'SE';
						} else if (ForecastText.indexOf('NW WINDS ') !== -1 || ForecastText.indexOf('NW WIND ') !== -1 || ForecastText.indexOf('NORTHWEST WINDS ') !== -1 || ForecastText.indexOf('NORTHWEST WIND ') !== -1) {
							WindDirection = 'NW';
						} else if (ForecastText.indexOf('SW WINDS ') !== -1 || ForecastText.indexOf('SW WIND ') !== -1 || ForecastText.indexOf('SOUTHWEST WINDS ') !== -1) {
							WindDirection = 'SW';
						}

						Index = -1;
						if (Index === -1) { Index = ForecastText.indexOf(' WINDS AROUND '); Offset = 14; }
						if (Index === -1) { Index = ForecastText.indexOf(' WIND TO '); Offset = 9; }
						if (Index !== -1) {
							Index += Offset;
							Index2 = ForecastText.indexOf(' KT', Index);
							if (Index2 === -1) Index2 = ForecastText.indexOf(' KNOT', Index);
							WindSpeedHigh = parseInt(ForecastText.substr(Index, Index2 - Index));
						} else {
							Index = -1;
							if (Index === -1) { Index = ForecastText.indexOf(' WINDS '); Offset = 6; }
							if (Index === -1) { Index = ForecastText.indexOf(' WIND '); Offset = 5;}
							if (Index !== -1) {
								Index += Offset;

								Index2 = ForecastText.indexOf(' TO ', Index);
								if (Index2 === -1) {
									Index2 = ForecastText.indexOf(' KT', Index);
									if (Index2 === -1) Index2 = ForecastText.indexOf(' KNOT', Index);
									WindSpeedHigh = parseInt(ForecastText.substr(Index, Index2 - Index));
									WindSpeedLow = WindSpeedHigh;
								} else {
									WindSpeedLow = parseInt(ForecastText.substr(Index, Index2 - Index));
									Index = Index2 + 4;
									Index2 = ForecastText.indexOf(' KT', Index);
									if (Index2 === -1) Index2 = ForecastText.indexOf(' KNOT', Index);
									WindSpeedHigh = parseInt(ForecastText.substr(Index, Index2 - Index));

									if (isNaN(WindSpeedLow)) {
										WindSpeedLow = WindSpeedHigh;
									} else if (isNaN(WindSpeedHigh)) {
										WindSpeedHigh = WindSpeedLow;
									}
								}
							}
						}

						Index = -1;
						if (Index === -1) { Index = ForecastText.indexOf('SEAS AROUND '); Offset = 12; }
						if (Index === -1) { Index = ForecastText.indexOf('WAVES AROUND '); Offset = 13; MarineForecast.SeasOrWaves = 'WAVES'; }
						if (Index !== -1) {
							Index += Offset;
							Index2 = ForecastText.indexOf(' FT', Index);
							TideHigh = parseInt(ForecastText.substr(Index, Index2 - Index));
							TideLow = TideHigh;
						} else {
							Index = -1;
							if (Index === -1) { Index = ForecastText.indexOf('SEAS 1 FT OR LESS'); }
							if (Index === -1) { Index = ForecastText.indexOf('SEAS LESS THAN 1 FT'); }
							if (Index === -1) { Index = ForecastText.indexOf('WAVES 1 FT OR LESS'); MarineForecast.SeasOrWaves = 'WAVES'; }
							if (Index === -1) { Index = ForecastText.indexOf('WAVES LESS THAN 1 FT'); MarineForecast.SeasOrWaves = 'WAVES'; }
							if (Index !== -1) {
								TideHigh = 1;
							} else {
								Index = -1;
								if (Index === -1) { Index = ForecastText.indexOf('SEAS '); Offset = 5; }
								if (Index === -1) { Index = ForecastText.indexOf('WAVES '); Offset = 6; MarineForecast.SeasOrWaves = 'WAVES'; }
								if (Index !== -1) {
									Index += Offset;

									Index2 = ForecastText.indexOf(' FT OR LESS', Index);
									if (Index2 !== -1) {
										TideHigh = parseInt(ForecastText.substr(Index, Index2 - Index));
										TideLow = 0;
									} else {
										Index2 = ForecastText.indexOf(' TO ', Index);
										if (Index2 === -1) {
											Index2 = ForecastText.indexOf(' FT', Index);
											TideHigh = parseInt(ForecastText.substr(Index, Index2 - Index));
											TideLow = TideHigh;
										} else {
											TideLow = parseInt(ForecastText.substr(Index, Index2 - Index));
											Index = Index2 + 4;
											Index2 = ForecastText.indexOf(' FT', Index);
											if (Index2 === -1) { Index2 = ForecastText.indexOf(' FEET', Index); }
											TideHigh = parseInt(ForecastText.substr(Index, Index2 - Index));
										}

										if (isNaN(TideLow)) {
											TideLow = TideHigh;
										} else if (isNaN(TideHigh)) {
											TideHigh = TideLow;
										}
									}
								}
							}
						}

						TideConditions = 'LIGHT';

						if (TideHigh > 7) {
							TideConditions = 'ROUGH';
						} else if (TideHigh > 4) {
							TideConditions = 'CHOPPY';
						}

						TideHighC = utils.units.FeetToMeters(TideHigh);
						TideLowC = utils.units.FeetToMeters(TideLow);
						WindSpeedHighC = WindSpeedHigh;
						WindSpeedLowC = WindSpeedLow;

						if (TideHighC === 0 && TideHigh > 0) {
							TideHighC = 1;
						}

						switch (DayIndex) {
						case 0:
						default:
							// Today/Tonight
							MarineForecast.TodayDayName = DayName;
							MarineForecast.TodayWindSpeedHigh = WindSpeedHigh;
							MarineForecast.TodayWindSpeedLow = WindSpeedLow;
							MarineForecast.TodayWindDirection = WindDirection;
							MarineForecast.TodayTideLow = TideLow;
							MarineForecast.TodayTideHigh = TideHigh;
							MarineForecast.TodayTideConditions = TideConditions;
							MarineForecast.TodayTideHighC = TideHighC;
							MarineForecast.TodayTideLowC = TideLowC;
							MarineForecast.TodayWindSpeedHighC = WindSpeedHighC;
							MarineForecast.TodayWindSpeedLowC = WindSpeedLowC;
							return true;

						case 1:
							// Tomorrow
							MarineForecast.TomorrowDayName = DayName;
							MarineForecast.TomorrowWindSpeedHigh = WindSpeedHigh;
							MarineForecast.TomorrowWindSpeedLow = WindSpeedLow;
							MarineForecast.TomorrowWindDirection = WindDirection;
							MarineForecast.TomorrowTideLow = TideLow;
							MarineForecast.TomorrowTideHigh = TideHigh;
							MarineForecast.TomorrowTideConditions = TideConditions;
							MarineForecast.TomorrowTideHighC = TideHighC;
							MarineForecast.TomorrowTideLowC = TideLowC;
							MarineForecast.TomorrowWindSpeedHighC = WindSpeedHighC;
							MarineForecast.TomorrowWindSpeedLowC = WindSpeedLowC;
							return false;
						}
					});

					WeatherParameters.MarineForecast = MarineForecast;

					PopulateMarineForecast(WeatherParameters);

					GetWeatherForecast(_WeatherParameters);

				},
				error: function (xhr, error, errorThrown) {
					console.error('GetMarineForecast failed: ' + errorThrown);
				},
			});

		},
		error: function (xhr, error, errorThrown) {
			console.error('GetMarineForecast failed: ' + errorThrown);
		},
	});
};

var PopulateMarineForecast = function (WeatherParameters) {
	if (WeatherParameters === null || (_DontLoadGifs && WeatherParameters.Progress.WordedForecast !== LoadStatuses.Loaded)) {
		return;
	}

	var MarineForecast = WeatherParameters.MarineForecast;

	// Draw canvas
	var canvas = canvasMarineForecast[0];
	var context = canvas.getContext('2d');

	var BackGroundImage = new Image();
	BackGroundImage.onload = function () {
		context.drawImage(BackGroundImage, 0, 0);
		DrawHorizontalGradientSingle(context, 0, 30, 500, 90, _TopColor1, _TopColor2);
		DrawTriangle(context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);

		DrawTitleText(context, 'Marine Forecast');

		// Warning Message
		if (MarineForecast.Warning !== '') {
			DrawBorder(context, '#000000', 4, 100, 135, 440, 40);
			DrawText(context, 'Star4000', '24pt', '#ffffff', 320, 165, MarineForecast.Warning, true, 'center');
		}

		DrawText(context, 'Star4000', '24pt', '#ffffff', 80, 250, 'WINDS:', true);
		DrawText(context, 'Star4000', '24pt', '#ffffff', 80, 360, MarineForecast.SeasOrWaves + ':', true);

		// Today's Forecast
		DrawText(context, 'Star4000', '24pt', '#ffff00', 280, 210, MarineForecast.TodayDayName, true, 'center');
		DrawText(context, 'Star4000', '24pt', '#ffffff', 280, 250, MarineForecast.TodayWindDirection, true, 'center');

		var TodayWindSpeedHigh = 0;
		var TodayWindSpeedLow = 0;
		switch (_Units) {
		case Units.English:
			TodayWindSpeedHigh = MarineForecast.TodayWindSpeedHigh;
			TodayWindSpeedLow = MarineForecast.TodayWindSpeedLow;
			break;
		default:
			TodayWindSpeedHigh = MarineForecast.TodayWindSpeedHighC;
			TodayWindSpeedLow = MarineForecast.TodayWindSpeedLowC;
			break;
		}

		var TodayWindSpeed = TodayWindSpeedHigh.toString() + 'kts';
		//if (TodayWindSpeedLow > 0)
		if (TodayWindSpeedLow !== TodayWindSpeedHigh) {
			TodayWindSpeed = TodayWindSpeedLow.toString() + ' - ' + TodayWindSpeed;
		}
		DrawText(context, 'Star4000', '24pt', '#ffffff', 280, 285, TodayWindSpeed, true, 'center');

		DrawBorder(context, 'rgb(172, 165, 251)', '4', 205, 305, 150, 90);

		var TodayTideHigh = 0;
		var TodayTideLow = 0;
		var TideUnit = '';
		switch (_Units) {
		case Units.English:
			TodayTideHigh = MarineForecast.TodayTideHigh;
			TodayTideLow = MarineForecast.TodayTideLow;
			TideUnit = '\'';
			break;
		default:
			TodayTideHigh = MarineForecast.TodayTideHighC;
			TodayTideLow = MarineForecast.TodayTideLowC;
			TideUnit = 'm';
			break;
		}

		var TodayTide = '';
		if (TodayTideHigh > 0) {
			TodayTide = TodayTideHigh.toString() + TideUnit;
			//if (TodayTideLow > 0)
			if (TodayTideLow !== TodayTideHigh) {
				TodayTide = TodayTideLow.toString() + TideUnit + ' - ' + TodayTide;
			}
		}
		DrawText(context, 'Star4000', '24pt', '#ffffff', 280, 340, TodayTide, true, 'center');

		DrawText(context, 'Star4000', '24pt', '#ffffff', 280, 390, MarineForecast.TodayTideConditions, true, 'center');

		//DrawWaves(context, 240, 340, "rgb(172, 165, 251)", "ROUGH");
		DrawWaves(context, 240, 340, 'rgb(172, 165, 251)', MarineForecast.TodayTideConditions);

		// Tomorrow's Forecast
		DrawText(context, 'Star4000', '24pt', '#ffff00', 490, 210, MarineForecast.TomorrowDayName, true, 'center');
		DrawText(context, 'Star4000', '24pt', '#ffffff', 490, 250, MarineForecast.TomorrowWindDirection, true, 'center');

		var TomorrowWindSpeedHigh = 0;
		var TomorrowWindSpeedLow = 0;
		switch (_Units) {
		case Units.English:
			TomorrowWindSpeedHigh = MarineForecast.TomorrowWindSpeedHigh;
			TomorrowWindSpeedLow = MarineForecast.TomorrowWindSpeedLow;
			break;
		default:
			TomorrowWindSpeedHigh = MarineForecast.TomorrowWindSpeedHighC;
			TomorrowWindSpeedLow = MarineForecast.TomorrowWindSpeedLowC;
			break;
		}

		var TomorrowWindSpeed = TomorrowWindSpeedHigh.toString() + 'kts';
		//if (TomorrowWindSpeedLow > 0)
		if (TomorrowWindSpeedLow !== TomorrowWindSpeedHigh) {
			TomorrowWindSpeed = TomorrowWindSpeedLow.toString() + ' - ' + TomorrowWindSpeed;
		}
		DrawText(context, 'Star4000', '24pt', '#ffffff', 490, 285, TomorrowWindSpeed, true, 'center');

		DrawBorder(context, 'rgb(172, 165, 251)', '4', 410, 305, 150, 90);

		var TomorrowTideHigh = 0;
		var TomorrowTideLow = 0;

		switch (_Units) {
		case Units.English:
			TomorrowTideHigh = MarineForecast.TomorrowTideHigh;
			TomorrowTideLow = MarineForecast.TomorrowTideLow;
			TideUnit = '\'';
			break;
		default:
			TomorrowTideHigh = MarineForecast.TomorrowTideHighC;
			TomorrowTideLow = MarineForecast.TomorrowTideLowC;
			TideUnit = 'm';
			break;
		}

		var TomorrowTide = '';
		if (TomorrowTideHigh > 0) {
			TomorrowTide = TomorrowTideHigh.toString() + TideUnit;
			//if (TomorrowTideLow > 0)
			if (TomorrowTideLow !== TomorrowTideHigh) {
				TomorrowTide = TomorrowTideLow.toString() + TideUnit + ' - ' + TomorrowTide;
			}
		}
		DrawText(context, 'Star4000', '24pt', '#ffffff', 490, 340, TomorrowTide, true, 'center');

		DrawText(context, 'Star4000', '24pt', '#ffffff', 490, 390, MarineForecast.TomorrowTideConditions, true, 'center');

		DrawWaves(context, 445, 340, 'rgb(172, 165, 251)', MarineForecast.TomorrowTideConditions);

		//WeatherParameters.Progress.Almanac = LoadStatuses.Loaded;

		UpdateWeatherCanvas(WeatherParameters, canvasMarineForecast);
	};
	BackGroundImage.src = 'images/BackGround8_1.png';
	//BackGroundImage.src = "images/BackGround8_" + _Themes.toString() + ".png";

};

var DrawWaves = function (context, x, y, color, conditions) {
	//http://www.w3schools.com/tags/canvas_arc.asp

	switch (conditions) {
	case 'LIGHT':
		y -= 10;
		context.beginPath();
		context.arc(x, y, 35, Math.PI * 0.3, Math.PI * 0.7);
		context.strokeStyle = color;
		context.lineWidth = 4;
		context.stroke();
		context.beginPath();
		x += 40;
		context.arc(x, y, 35, Math.PI * 0.3, Math.PI * 0.7);
		context.stroke();
		context.beginPath();
		x += 40;
		context.arc(x, y, 35, Math.PI * 0.3, Math.PI * 0.7);
		context.stroke();
		break;

	case 'CHOPPY':
		context.beginPath();
		context.arc(x, y, 25, Math.PI * 0.2, Math.PI * 0.8);
		context.strokeStyle = color;
		context.lineWidth = 4;
		context.stroke();
		context.beginPath();
		x += 40;
		context.arc(x, y, 25, Math.PI * 0.2, Math.PI * 0.8);
		context.stroke();
		context.beginPath();
		x += 40;
		context.arc(x, y, 25, Math.PI * 0.2, Math.PI * 0.8);
		context.stroke();
		break;

	case 'ROUGH':
		context.beginPath();
		context.arc(x, y, 20, Math.PI * 0.1, Math.PI * 0.9);
		context.strokeStyle = color;
		context.lineWidth = 4;
		context.stroke();
		context.beginPath();
		x += 40;
		context.arc(x, y, 20, Math.PI * 0.1, Math.PI * 0.9);
		context.stroke();
		context.beginPath();
		x += 40;
		context.arc(x, y, 20, Math.PI * 0.1, Math.PI * 0.9);
		context.stroke();
		break;
	default:
	}

};

var GetAirQuality3 = function (WeatherParameters) {
	if (!WeatherParameters.ZipCode) {
		GetMarineForecast(WeatherParameters);
		return;
	}

	// TODO, this code does not currently execute because no zip code is provided

	var ZipCode = WeatherParameters.ZipCode;
	let date = DateTime.local();
	if (date.hour >= 12) {
		date = date.plus({days:1});
	}
	var _Date = date.getYYYYMMDD();

	var Url = 'http://www.airnowapi.org/aq/forecast/zipCode/?format=application/json&distance=25&API_KEY=E0E326E6-E199-4ABC-B382-0F9F9522E143';
	Url += '&zipCode=' + encodeURIComponent(ZipCode);
	Url += '&date=' + encodeURIComponent(_Date);

	WeatherParameters.AirQuality = null;

	// Load the xml file using ajax
	$.ajaxCORS({
		type: 'GET',
		url: Url,
		dataType: 'json',
		crossDomain: true,
		cache: false,
		success: function (json) {
			var maxAQI = 0;
			var City = '';

			$(json).each(function () {
				if (this.AQI > maxAQI) {
					City = this.ReportingArea;
					maxAQI = this.AQI;
				}
			});

			if (maxAQI === 0) {
				GetMarineForecast(WeatherParameters);
				return;
			}

			var AirQuality = {};

			AirQuality.City = City;
			AirQuality.Date = date;
			AirQuality.IndexValue = maxAQI;

			WeatherParameters.AirQuality = AirQuality;

			PopulateAirQuality(WeatherParameters);

			GetMarineForecast(WeatherParameters);
		},
		error: function (xhr, error, errorThrown) {
			console.error('GetAirQuality failed: ' + errorThrown);

			GetMarineForecast(WeatherParameters);
		},
	});
};


var PopulateAirQuality = function (WeatherParameters) {
	if (WeatherParameters === null || (_DontLoadGifs && WeatherParameters.Progress.WordedForecast !== LoadStatuses.Loaded)) {
		return;
	}

	var AirQuality = WeatherParameters.AirQuality;

	// Draw canvas
	var canvas = canvasAirQuality[0];
	var context = canvas.getContext('2d');

	var BackGroundImage = new Image();
	BackGroundImage.onload = function () {
		context.drawImage(BackGroundImage, 0, 0);
		DrawHorizontalGradientSingle(context, 0, 30, 500, 90, _TopColor1, _TopColor2);
		DrawTriangle(context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);
		DrawHorizontalGradientSingle(context, 0, 90, 640, 399, _SideColor1, _SideColor2);

		// Title
		var DayName = AirQuality.Date.getDayName();
		DrawTitleText(context, 'Air Quality', 'For ' + DayName);

		// Hazardous
		DrawBox(context, '#FF0000', 320, 90, 320, 309);
		DrawTriangle(context, '#FF0000', 300, 90, 320, 90, 320, 110);
		DrawText(context, 'Star4000 Small', '20pt', '#FFFFFF', 320, 105, 'HAZARDOUS', 1);

		// Very Unhealthy
		DrawBox(context, '#FF8000', 320, 110, 230, 289);
		DrawTriangle(context, '#FF8000', 300, 110, 320, 110, 320, 130);
		DrawTriangle(context, '#FF0000', 530, 110, 550, 110, 550, 130);
		DrawText(context, 'Star4000 Small', '20pt', '#FFFFFF', 320, 125, 'VERY UNHEALTHY', 1);

		// Unhealthy
		DrawBox(context, '#FFB000', 320, 130, 160, 269);
		DrawTriangle(context, '#FFB000', 300, 130, 320, 130, 320, 150);
		DrawTriangle(context, '#FF8000', 460, 130, 480, 130, 480, 150);
		DrawText(context, 'Star4000 Small', '20pt', '#FFFFFF', 320, 145, 'UNHEALTHY', 1);

		// Good
		DrawBox(context, '#FFFF00', 320, 150, 70, 249);
		DrawTriangle(context, '#FFFF00', 300, 150, 320, 150, 320, 170);
		DrawTriangle(context, '#FFB000', 370, 150, 390, 150, 390, 170);
		DrawText(context, 'Star4000 Small', '20pt', '#FFFFFF', 320, 165, 'GOOD', 1);

		// City Name
		DrawText(context, 'Star4000', '24pt', '#FFFFFF', 240, 280, AirQuality.City, 2, 'right');

		// Air Quality Value
		DrawText(context, 'Star4000', '24pt', '#FFFFFF', 310, 280, AirQuality.IndexValue.toString(), 2, 'right');

		// Draw Bar
		var BarWidth = GetAqiWidth(AirQuality.IndexValue);
		DrawHorizontalGradient(context, 315, 245, 315 + BarWidth, 295, '#404040', '#B0B0B0');
		DrawBox(context, '#000000', 315 + BarWidth - 2, 245, 2, 50);
		DrawBox(context, '#FFFFFF', 315, 245, BarWidth, 2);
		DrawBox(context, '#FFFFFF', 315, 245, 2, 50);
		DrawBox(context, '#000000', 315, 293, BarWidth, 2);

		UpdateWeatherCanvas(WeatherParameters, canvasAirQuality);
	};
	BackGroundImage.src = 'images/BackGround9_1.png';
	//BackGroundImage.src = "images/BackGround9_" + _Themes.toString() + ".png";

};

var GetAqiWidth = function (IndexValue) {
	var BarWidth = 0;

	if (IndexValue <= 100) {
		BarWidth = (IndexValue * 70) / 100;
	} else if (IndexValue <= 200) {
		//BarWidth = 70 + ((IndexValue - 100) * 160) / 200;
		BarWidth = 70 + ((IndexValue - 100) * 90) / 100;
	} else if (IndexValue <= 300) {
		//BarWidth = 160 + ((IndexValue - 200) * 230) / 300;
		BarWidth = 160 + ((IndexValue - 200) * 70) / 100;
	} else if (IndexValue <= 500) {
		//BarWidth = 230 + ((IndexValue - 300) * 320) / 500;
		BarWidth = 230 + ((IndexValue - 300) * 90) / 200;
	}
	BarWidth = Math.round(BarWidth);

	return BarWidth;
};

var GetAqiDescription = function (IndexValue) {
	var Description = 'unknown';

	if (IndexValue <= 100) {
		Description = 'good';
	} else if (IndexValue <= 200) {
		Description = 'unhealthy';
	} else if (IndexValue <= 300) {
		Description = 'very unhealthy';
	} else if (IndexValue <= 500) {
		Description = 'hazardous';
	}

	return Description;
};


String.prototype.capitalize = function () {
	return this.toLowerCase().replace(/\b[a-z]/g, function (letter) {
		return letter.toUpperCase();
	});
};


Date.prototype.stdTimezoneOffset = function () {
	var jan = new Date(this.getFullYear(), 0, 1);
	var jul = new Date(this.getFullYear(), 6, 1);
	return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
};

Date.prototype.dst = function () {
	return this.getTimezoneOffset() < this.stdTimezoneOffset();
};

var GetWeatherHazards3 = function (WeatherParameters) {
	var ZoneId = WeatherParameters.ZoneId;
	var HazardUrls = [];
	var HazardCounter = 0;

	WeatherParameters.WeatherHazardConditions =
	{
		ZoneId: WeatherParameters.ZoneId,
		Hazards: [],
	};

	var Url = 'https://alerts.weather.gov/cap/wwaatmget.php?x=' + ZoneId + '&y=0';

	// Load the xml file using ajax
	$.ajaxCORS({
		type: 'GET',
		url: Url,
		dataType: 'text',
		crossDomain: true,
		cache: false,
		success: function (text) {
			// IE doesn't support XML tags with colons.
			text = text.replaceAll('<cap:', '<cap_');
			text = text.replaceAll('</cap:', '</cap_');

			var $xml = $(text);
			//console.log(xml);

			$xml.find('entry').each(function () {
				var entry = $(this);

				// Skip non-alerts.
				var cap_msgType = entry.find('cap_msgType');
				if (cap_msgType.text() !== 'Alert') {
					return true;
				}

				var link = entry.find('link');
				var Url = link.attr('href');

				HazardUrls.push(Url);
			});

			if (HazardUrls.length === 0) {
				PopulateHazardConditions(WeatherParameters);
				console.log(WeatherParameters.WeatherHazardConditions);
				return;
			}

			$(HazardUrls).each(function () {
				var Url = this.toString();

				$.ajaxCORS({
					type: 'GET',
					url: Url,
					dataType: 'xml',
					crossDomain: true,
					cache: true,
					success: function (xml) {
						var $xml = $(xml);
						console.log(xml);

						var description = $xml.find('description');
						WeatherParameters.WeatherHazardConditions.Hazards.push(description.text());

						HazardCounter++;
						if (HazardCounter === HazardUrls.length) {
							PopulateHazardConditions(WeatherParameters);
							console.log(WeatherParameters.WeatherHazardConditions);
						}
					},
					error: function () {
						console.error('GetWeatherHazards3 failed for Url: ' + Url);
						WeatherParameters.Progress.Hazards = LoadStatuses.Failed;
					},
				});
			});

		},
		error: function (xhr, error, errorThrown) {
			console.error('GetWeatherHazards3 failed: ' + errorThrown);
			WeatherParameters.Progress.Hazards = LoadStatuses.Failed;
		},
	});
};

$(() => {
	canvasBackGroundDateTime = $('#canvasBackGroundDateTime');
	canvasBackGroundCurrentConditions = $('#canvasBackGroundCurrentConditions');
	canvasProgress = $('#canvasProgress');
	divProgress = $('#divProgress');

	divDopplerRadarMap = $('#divDopplerRadarMap');
	canvasLocalRadar = $('#canvasLocalRadar');

	divRegionalForecastMap1 = $('#divRegionalForecastMap1');
	divRegionalForecastMap2 = $('#divRegionalForecastMap2');
	canvasRegionalForecast1 = $('#canvasRegionalForecast1');
	canvasRegionalForecast2 = $('#canvasRegionalForecast2');

	divRegionalCurrentMap = $('#divRegionalCurrentMap');
	canvasRegionalObservations = $('#canvasRegionalObservations');

	divTemperature = $('#divTemperature');
	divStation = $('#divStation');
	divConditions = $('#divConditions');
	divHumidity = $('#divHumidity');
	divIcon = $('#divIcon');
	divDewpoint = $('#divDewpoint');
	divCeiling = $('#divCeiling');
	divVisibility = $('#divVisibility');
	divWind = $('#divWind');
	divPressure = $('#divPressure');
	divGust = $('#divGust');
	divHeatIndex = $('#divHeatIndex');
	canvasCurrentWeather = $('#canvasCurrentWeather');

	canvasExtendedForecast1 = $('#canvasExtendedForecast1');
	canvasExtendedForecast2 = $('#canvasExtendedForecast2');

	canvasLocalForecast = $('#canvasLocalForecast');

	divHazards = $('#divHazards');
	divHazardsScroll = $('#divHazardsScroll');
	canvasHazards = $('#canvasHazards');

	canvasAlmanac = $('#canvasAlmanac');
	canvasAlmanacTides = $('#canvasAlmanacTides');
	canvasOutlook = $('#canvasOutlook');
	canvasMarineForecast = $('#canvasMarineForecast');
	canvasAirQuality = $('#canvasAirQuality');

	divOutlookTemp = $('#divOutlookTemp');
	divOutlookPrcp = $('#divOutlookPrcp');

	tblTravelCities = $('#tblTravelCities');
	divTravelCitiesScroll = $('#divTravelCitiesScroll');
	canvasTravelForecast = $('#canvasTravelForecast');

	tblRegionalObservations = $('#tblRegionalObservations');
	canvasLatestObservations = $('#canvasLatestObservations');

	audMusic = $('#audMusic');
	PopulateMusicUrls();

	canvasProgress.mousemove(canvasProgress_mousemove);
	canvasProgress.click(canvasProgress_click);

	_WeatherParameters = {};

	_WeatherParameters.WeatherHazardConditions = {};

	const WeatherCanvases = [];
	WeatherCanvases.push(canvasProgress);
	WeatherCanvases.push(canvasCurrentWeather);
	WeatherCanvases.push(canvasLatestObservations);
	WeatherCanvases.push(canvasTravelForecast);
	WeatherCanvases.push(canvasRegionalForecast1);
	WeatherCanvases.push(canvasRegionalForecast2);
	WeatherCanvases.push(canvasRegionalObservations);
	WeatherCanvases.push(canvasAlmanac);
	WeatherCanvases.push(canvasAlmanacTides);
	WeatherCanvases.push(canvasOutlook);
	WeatherCanvases.push(canvasMarineForecast);
	WeatherCanvases.push(canvasAirQuality);
	WeatherCanvases.push(canvasLocalForecast);
	WeatherCanvases.push(canvasExtendedForecast1);
	WeatherCanvases.push(canvasExtendedForecast2);
	WeatherCanvases.push(canvasHazards);
	WeatherCanvases.push(canvasLocalRadar);
	_WeatherParameters.WeatherCanvases = WeatherCanvases;

	$(WeatherCanvases).each(function () {
		var WeatherCanvas = $(this);
		WeatherCanvas.css('position', 'absolute');
		WeatherCanvas.css('top', '0px');
		WeatherCanvas.css('left', '0px');
		WeatherCanvas.hide();
	});
	canvasProgress.show();

	_WeatherParameters.TravelCities = _TravelCities;

	_WeatherParameters.Progress = new Progress({
		WeatherParameters: _WeatherParameters,
	});
});

var NavigateMenu = function () {
	if (_IsPlaying) {
		NavigatePlayToggle();
	}
	Navigate(0);
	_PlayMs = 0;
};
var NavigateNext = function () {
	if (_CurrentCanvasType === CanvasTypes.Progress) {
		_PlayMs = 0;
	} else {
		_PlayMs += 10000;
	}

	_IsSpeaking = false; // Force navigation

	UpdatePlayPosition();
};
var NavigatePrevious = function () {
	if (_CurrentCanvasType === CanvasTypes.Progress) {
		_PlayMs = _PlayMsOffsets.End - 10000;
	} else {
		_PlayMs -= 10000;
	}

	_IsSpeaking = false; // Force navigation

	UpdatePlayPosition();
};
const NavigateReset = () => Navigate();

const Navigate = (offset) => {
	const LocalForecastScreenTexts = _WeatherParameters.LocalForecastScreenTexts;
	const Hazards = _WeatherParameters.WeatherHazardConditions.Hazards;
	const $cnvTravelCitiesScroll = $('#cnvTravelCitiesScroll');
	const $cnvHazardsScroll = $('#cnvHazardsScroll');

	if (offset === 0) {
		_CurrentCanvasType = _FirstCanvasType;
	} else if (offset !== undefined) {
		switch (offset) {
		case 1:
			switch (_CurrentCanvasType) {
			case CanvasTypes.LocalForecast:
				if (_WeatherParameters.Progress.WordedForecast === LoadStatuses.Loaded) {
					if (LocalForecastScreenTexts) {
						if (_UpdateLocalForecastIndex < LocalForecastScreenTexts.length - 1) {
							UpdateLocalForecast(1);
							return;
						}
					}
				}
				break;


			case CanvasTypes.Hazards:
				if (_WeatherParameters.Progress.Hazards === LoadStatuses.Loaded && Hazards.length > 0) {
					if (_UpdateHazardsY < $cnvHazardsScroll.height()) {
						UpdateHazards(1);
						return;
					}
				}
				break;

			case CanvasTypes.LocalRadar:
				if (_WeatherParameters.Progress.DopplerRadar === LoadStatuses.Loaded) {
					if (_DopplerRadarImageIndex > 0) {
						UpdateDopplarRadarImage(1);
						return;
					}
				}
				break;
			default:
			}

			break;

		case -1:
			switch (_CurrentCanvasType) {
			case CanvasTypes.LocalForecast:
				if (_WeatherParameters.Progress.WordedForecast === LoadStatuses.Loaded) {
					if (LocalForecastScreenTexts) {
						if (_UpdateLocalForecastIndex > 0) {
							UpdateLocalForecast(-1);
							return;
						}
					}
				}
				break;

			case CanvasTypes.Hazards:
				if (_WeatherParameters.Progress.Hazards === LoadStatuses.Loaded && Hazards.length > 0) {
					if (_UpdateHazardsY > 0) {
						UpdateHazards(-1);
						return;
					}
				}
				break;

			case CanvasTypes.LocalRadar:
				if (_WeatherParameters.Progress.DopplerRadar === LoadStatuses.Loaded) {
					if (_DopplerRadarImageIndex < (_DopplerRadarImageMax - 1)) {
						UpdateDopplarRadarImage(-1);
						return;
					}
				}
				break;
			default:
			}

			break;
		default:
		}

		_CurrentCanvasType += offset;
		if (_CurrentCanvasType > _LastCanvasType) {
			_CurrentCanvasType = _FirstCanvasType;
		} else if (_CurrentCanvasType < _FirstCanvasType) {
			_CurrentCanvasType = _LastCanvasType;
		}

	}

	//window.location.hash = "";

	switch (_CurrentCanvasType) {
	case CanvasTypes.Progress:
		//window.location.hash = "aProgress";
		canvasProgress.scrollIntoView();
		break;
	case CanvasTypes.CurrentWeather:
		if (_WeatherParameters.Progress.CurrentConditions !== LoadStatuses.Loaded) {
			if (offset) { Navigate(offset); } return;
		}
		//window.location.hash = "aCurrentWeather";
		//canvasCurrentWeather[0].scrollIntoView();
		//canvasCurrentWeather[0].scrollIntoView(true);
		//$("body").scrollTop(canvasCurrentWeather.offset().top);
		//canvasCurrentWeather[0].parentNode.scrollTop = canvasCurrentWeather[0].offsetTop;
		canvasCurrentWeather.scrollIntoView();
		break;
	case CanvasTypes.LatestObservations:
		if (_WeatherParameters.Progress.NearbyConditions !== LoadStatuses.Loaded) {
			if (offset) { Navigate(offset); } return;
		}
		//window.location.hash = "aLatestObservations";
		canvasLatestObservations.scrollIntoView();
		break;
	case CanvasTypes.TravelForecast:
		if (_WeatherParameters.Progress.TravelForecast !== LoadStatuses.Loaded) {
			if (offset) { Navigate(offset); } return;
		}
		if (offset === 1) {
			UpdateTravelCities(0);
		} else if (offset === -1) {
			UpdateTravelCities(Infinity);
		}

		canvasTravelForecast.scrollIntoView();
		break;
	case CanvasTypes.RegionalForecast1:
		if (_WeatherParameters.Progress.TomorrowsRegionalMap !== LoadStatuses.Loaded) {
			if (offset) { Navigate(offset); } return;
		}
		//window.location.hash = "aRegionalForecast";
		canvasRegionalForecast1.scrollIntoView();
		break;
	case CanvasTypes.RegionalForecast2:
		if (_WeatherParameters.Progress.TomorrowsRegionalMap !== LoadStatuses.Loaded) {
			if (offset) { Navigate(offset); } return;
		}
		//window.location.hash = "aRegionalForecast";
		canvasRegionalForecast2.scrollIntoView();
		break;
	case CanvasTypes.RegionalObservations:
		if (_WeatherParameters.Progress.CurrentRegionalMap !== LoadStatuses.Loaded) {
			if (offset) { Navigate(offset); } return;
		}
		//window.location.hash = "aRegionalObservations";
		canvasRegionalObservations.scrollIntoView();
		break;
	case CanvasTypes.LocalForecast:
		if (_WeatherParameters.Progress.WordedForecast !== LoadStatuses.Loaded) {
			if (offset) { Navigate(offset); } return;
		}
		if (offset === 1) {
			UpdateLocalForecast(0);
		} else if (offset === -1) {
			UpdateLocalForecast(Infinity);
		}
		//window.location.hash = "aLocalForecast";
		canvasLocalForecast.scrollIntoView();
		break;
	case CanvasTypes.MarineForecast:
		if (_WeatherParameters.Progress.WordedForecast !== LoadStatuses.Loaded && _WeatherParameters.MarineForecast) {
			if (offset) { Navigate(offset); } return;
		}
		canvasMarineForecast.scrollIntoView();
		break;
	case CanvasTypes.AirQuality:
		if (_WeatherParameters.Progress.WordedForecast !== LoadStatuses.Loaded && _WeatherParameters.AirQuality) {
			if (offset) { Navigate(offset); } return;
		}
		canvasAirQuality.scrollIntoView();
		break;
	case CanvasTypes.ExtendedForecast1:
		if (_WeatherParameters.Progress.FourDayForecast !== LoadStatuses.Loaded) {
			if (offset) { Navigate(offset); } return;
		}
		//window.location.hash = "aExtendedForecast";
		canvasExtendedForecast1.scrollIntoView();
		break;
	case CanvasTypes.ExtendedForecast2:
		if (_WeatherParameters.Progress.FourDayForecast !== LoadStatuses.Loaded) {
			if (offset) { Navigate(offset); } return;
		}
		//window.location.hash = "aExtendedForecast";
		canvasExtendedForecast2.scrollIntoView();
		break;
	case CanvasTypes.Almanac:
		if (_WeatherParameters.Progress.Almanac !== LoadStatuses.Loaded) {
			if (offset) { Navigate(offset); } return;
		}
		//window.location.hash = "aAlmanac";
		canvasAlmanac.scrollIntoView();
		break;
	case CanvasTypes.AlmanacTides:
		if (_WeatherParameters.Progress.Almanac !== LoadStatuses.Loaded && _WeatherParameters.WeatherTides) {
			if (offset) { Navigate(offset); } return;
		}
		//window.location.hash = "aAlmanac";
		canvasAlmanacTides.scrollIntoView();
		break;
	case CanvasTypes.Outlook:
		if (_WeatherParameters.Progress.Almanac !== LoadStatuses.Loaded && _WeatherParameters.Outlook) {
			if (offset) { Navigate(offset); } return;
		}
		canvasOutlook.scrollIntoView();
		break;
	case CanvasTypes.LocalRadar:
		if (_WeatherParameters.Progress.DopplerRadar !== LoadStatuses.Loaded) {
			if (offset) { Navigate(offset); } return;
		}
		if (offset === 1) {
			UpdateDopplarRadarImage(0);
		} else if (offset === -1) {
			UpdateDopplarRadarImage(Infinity);
		}
		//window.location.hash = "aLocalRadar";
		canvasLocalRadar.scrollIntoView();
		break;
	case CanvasTypes.Hazards:
		if (_WeatherParameters.Progress.Hazards !== LoadStatuses.Loaded || Hazards.length === 0) {
			if (offset) { Navigate(offset); } return;
		}
		if (offset === 1) {
			UpdateHazards(0);
		} else if (offset === -1) {
			UpdateHazards(Infinity);
		}
		//window.location.hash = "aHazards";
		canvasHazards.scrollIntoView();
		break;
	default:
	}

	if (Math.floor(_CurrentPosition) !== _CurrentCanvasType) {
		_CurrentPosition = _CurrentCanvasType;
	}

	if (_PreviousPosition !== _CurrentPosition) {
		_PreviousPosition = _CurrentPosition;
		SpeakUtterance();
	}

};

$.fn.scrollIntoView = function () {
	const $self = this;
	const OkToFadeOut = true;

	_WeatherParameters.WeatherCanvases.forEach($WeatherCanvas => {

		if (!$WeatherCanvas.is($self)) {
			if ($WeatherCanvas.is(':visible')) {
				$WeatherCanvas.css('z-index', '9999');
				if (!OkToFadeOut) {
					$WeatherCanvas.hide();
				} else {
					$WeatherCanvas.fadeOut({
						progress: () => {
							UpdateWeatherCanvas(_WeatherParameters, $WeatherCanvas);
							UpdateWeatherCanvas(_WeatherParameters, $self);
						},
					});
				}
			}
		} else {
			if (!$WeatherCanvas.is(':visible')) {
				$WeatherCanvas.css('z-index', '');
				$WeatherCanvas.show();
			}
			$WeatherCanvas.stop();
			$WeatherCanvas.css('opacity', '');
			UpdateWeatherCanvas(_WeatherParameters, $WeatherCanvas);
		}
	});

	_RefreshGifs = true;
	window.setTimeout(function () { _RefreshGifs = false; }, 200);

};


var _PlayInterval = 100;
var _PlayMs = 0;
var _PlayMsOffsets = {
	Start: 0,
	End: 0,
	Length: 0,
	CurrentWeather_Start: 0,
	CurrentWeather_End: 10000,
	CurrentWeather_Length: 10000,
	CurrentWeather_Loaded: false,
	LatestObservations_Start: 0,
	LatestObservations_End: 0,
	LatestObservations_Length: 10000,
	LatestObservations_Loaded: false,
	TravelForecast_Start: 0,
	TravelForecast_End: 0,
	TravelForecast_Length: 60000,
	TravelForecast_Loaded: false,
	RegionalForecast1_Start: 0,
	RegionalForecast1_End: 0,
	RegionalForecast1_Length: 10000,
	RegionalForecast1_Loaded: false,
	RegionalForecast2_Start: 0,
	RegionalForecast2_End: 0,
	RegionalForecast2_Length: 10000,
	RegionalForecast2_Loaded: false,
	RegionalObservations_Start: 0,
	RegionalObservations_End: 0,
	RegionalObservations_Length: 10000,
	RegionalObservations_Loaded: false,
	LocalForecast_Start: 0,
	LocalForecast_End: 0,
	LocalForecast_Length: 0,
	LocalForecast_Loaded: false,
	MarineForecast_Start: 0,
	MarineForecast_End: 0,
	MarineForecast_Length: 10000,
	MarineForecast_Loaded: false,
	AirQuality_Start: 0,
	AirQuality_End: 0,
	AirQuality_Length: 10000,
	AirQuality_Loaded: false,
	ExtendedForecast1_Start: 0,
	ExtendedForecast1_End: 0,
	ExtendedForecast1_Length: 10000,
	ExtendedForecast1_Loaded: false,
	ExtendedForecast2_Start: 0,
	ExtendedForecast2_End: 0,
	ExtendedForecast2_Length: 10000,
	ExtendedForecast2_Loaded: false,
	Almanac_Start: 0,
	Almanac_End: 0,
	Almanac_Length: 10000,
	Almanac_Loaded: false,
	AlmanacTides_Start: 0,
	AlmanacTides_End: 0,
	AlmanacTides_Length: 10000,
	AlmanacTides_Loaded: false,
	Outlook_Start: 0,
	Outlook_End: 0,
	Outlook_Length: 10000,
	Outlook_Loaded: false,
	LocalRadar_Start: 0,
	LocalRadar_End: 0,
	LocalRadar_Length: 15000,
	LocalRadar_Loaded: false,
	Hazards_Start: 0,
	Hazards_End: 0,
	Hazards_Length: 0,
	Hazards_Loaded: false,
};

var AssignPlayMsOffsets = function (CalledFromProgress) {
	var LocalForecastScreenTexts = _WeatherParameters.LocalForecastScreenTexts;
	var cnvHazardsScroll = $('#cnvHazardsScroll');
	var Hazards = _WeatherParameters.WeatherHazardConditions.Hazards;
	var Progress = _WeatherParameters.Progress;

	//CurrentWeather
	_PlayMsOffsets.CurrentWeather_Start = 0;
	if (Progress.CurrentConditions === LoadStatuses.Loaded) {
		_PlayMsOffsets.LatestObservations_Length = 10000;
	} else {
		_PlayMsOffsets.LatestObservations_Length = 0;
	}
	_PlayMsOffsets.CurrentWeather_End = _PlayMsOffsets.CurrentWeather_Start + _PlayMsOffsets.LatestObservations_Length;

	//LatestObservations
	_PlayMsOffsets.LatestObservations_Start = _PlayMsOffsets.CurrentWeather_End;
	if (Progress.NearbyConditions === LoadStatuses.Loaded) {
		_PlayMsOffsets.LatestObservations_Length = 10000;
	} else {
		_PlayMsOffsets.LatestObservations_Length = 0;
	}
	_PlayMsOffsets.LatestObservations_End = _PlayMsOffsets.LatestObservations_Start + _PlayMsOffsets.LatestObservations_Length;

	//TravelForecast
	_PlayMsOffsets.TravelForecast_Start = _PlayMsOffsets.LatestObservations_End;
	if (Progress.TravelForecast === LoadStatuses.Loaded) {
		_PlayMsOffsets.TravelForecast_Length = 60000;
	} else {
		_PlayMsOffsets.TravelForecast_Length = 0;
	}
	_PlayMsOffsets.TravelForecast_End = _PlayMsOffsets.TravelForecast_Start + _PlayMsOffsets.TravelForecast_Length;

	//RegionalForecast1
	_PlayMsOffsets.RegionalForecast1_Start = _PlayMsOffsets.TravelForecast_End;
	if (Progress.TomorrowsRegionalMap === LoadStatuses.Loaded) {
		_PlayMsOffsets.RegionalForecast1_Length = 10000;
	} else {
		_PlayMsOffsets.RegionalForecast1_Length = 0;
	}
	_PlayMsOffsets.RegionalForecast1_End = _PlayMsOffsets.RegionalForecast1_Start + _PlayMsOffsets.RegionalForecast1_Length;

	//RegionalForecast2
	_PlayMsOffsets.RegionalForecast2_Start = _PlayMsOffsets.RegionalForecast1_End;
	if (Progress.TomorrowsRegionalMap === LoadStatuses.Loaded) {
		_PlayMsOffsets.RegionalForecast2_Length = 10000;
	} else {
		_PlayMsOffsets.RegionalForecast2_Length = 0;
	}
	_PlayMsOffsets.RegionalForecast2_End = _PlayMsOffsets.RegionalForecast2_Start + _PlayMsOffsets.RegionalForecast2_Length;

	//RegionalObservations
	_PlayMsOffsets.RegionalObservations_Start = _PlayMsOffsets.RegionalForecast2_End;
	if (Progress.CurrentRegionalMap === LoadStatuses.Loaded) {
		_PlayMsOffsets.RegionalObservations_Length = 10000;
	} else {
		_PlayMsOffsets.RegionalObservations_Length = 0;
	}
	_PlayMsOffsets.RegionalObservations_End = _PlayMsOffsets.RegionalObservations_Start + _PlayMsOffsets.RegionalObservations_Length;

	//LocalForecast
	_PlayMsOffsets.LocalForecast_Start = _PlayMsOffsets.RegionalObservations_End;
	if (Progress.WordedForecast === LoadStatuses.Loaded) {
		_PlayMsOffsets.LocalForecast_Length = LocalForecastScreenTexts.length * 10000;
	} else {
		_PlayMsOffsets.LocalForecast_Length = 0;
	}
	_PlayMsOffsets.LocalForecast_End = _PlayMsOffsets.LocalForecast_Start + _PlayMsOffsets.LocalForecast_Length;

	//Marine Forecast
	_PlayMsOffsets.MarineForecast_Start = _PlayMsOffsets.LocalForecast_End;
	if (Progress.WordedForecast === LoadStatuses.Loaded && _WeatherParameters.MarineForecast) {
		_PlayMsOffsets.MarineForecast_Length = 10000;
	} else {
		_PlayMsOffsets.MarineForecast_Length = 0;
	}
	_PlayMsOffsets.MarineForecast_End = _PlayMsOffsets.MarineForecast_Start + _PlayMsOffsets.MarineForecast_Length;

	//Air Quality
	_PlayMsOffsets.AirQuality_Start = _PlayMsOffsets.MarineForecast_End;
	if (Progress.WordedForecast === LoadStatuses.Loaded && _WeatherParameters.AirQuality) {
		_PlayMsOffsets.AirQuality_Length = 10000;
	} else {
		_PlayMsOffsets.AirQuality_Length = 0;
	}
	_PlayMsOffsets.AirQuality_End = _PlayMsOffsets.AirQuality_Start + _PlayMsOffsets.AirQuality_Length;

	//ExtendedForecast1
	_PlayMsOffsets.ExtendedForecast1_Start = _PlayMsOffsets.AirQuality_End;
	if (Progress.FourDayForecast === LoadStatuses.Loaded) {
		_PlayMsOffsets.ExtendedForecast1_Length = 10000;
	} else {
		_PlayMsOffsets.ExtendedForecast1_Length = 0;
	}
	_PlayMsOffsets.ExtendedForecast1_End = _PlayMsOffsets.ExtendedForecast1_Start + _PlayMsOffsets.ExtendedForecast1_Length;

	//ExtendedForecast2
	_PlayMsOffsets.ExtendedForecast2_Start = _PlayMsOffsets.ExtendedForecast1_End;
	if (Progress.FourDayForecast === LoadStatuses.Loaded) {
		_PlayMsOffsets.ExtendedForecast2_Length = 10000;
	} else {
		_PlayMsOffsets.ExtendedForecast2_Length = 0;
	}
	_PlayMsOffsets.ExtendedForecast2_End = _PlayMsOffsets.ExtendedForecast2_Start + _PlayMsOffsets.ExtendedForecast2_Length;

	//Almanac
	_PlayMsOffsets.Almanac_Start = _PlayMsOffsets.ExtendedForecast2_End;
	if (Progress.Almanac === LoadStatuses.Loaded) {
		_PlayMsOffsets.Almanac_Length = 10000;
	} else {
		_PlayMsOffsets.Almanac_Length = 0;
	}
	_PlayMsOffsets.Almanac_End = _PlayMsOffsets.Almanac_Start + _PlayMsOffsets.Almanac_Length;

	//Almanac (Tides)
	_PlayMsOffsets.AlmanacTides_Start = _PlayMsOffsets.Almanac_End;
	if (Progress.Almanac === LoadStatuses.Loaded && _WeatherParameters.WeatherTides) {
		_PlayMsOffsets.AlmanacTides_Length = 10000;
	} else {
		_PlayMsOffsets.AlmanacTides_Length = 0;
	}
	_PlayMsOffsets.AlmanacTides_End = _PlayMsOffsets.AlmanacTides_Start + _PlayMsOffsets.AlmanacTides_Length;

	//Outlook
	_PlayMsOffsets.Outlook_Start = _PlayMsOffsets.AlmanacTides_End;
	if (Progress.Almanac === LoadStatuses.Loaded && _WeatherParameters.Outlook) {
		_PlayMsOffsets.Outlook_Length = 10000;
	} else {
		_PlayMsOffsets.Outlook_Length = 0;
	}
	_PlayMsOffsets.Outlook_End = _PlayMsOffsets.Outlook_Start + _PlayMsOffsets.Outlook_Length;

	//LocalRadar
	_PlayMsOffsets.LocalRadar_Start = _PlayMsOffsets.Outlook_End;
	if (Progress.DopplerRadar === LoadStatuses.Loaded) {
		_PlayMsOffsets.LocalRadar_Length = 15000;
	} else {
		_PlayMsOffsets.LocalRadar_Length = 0;
	}
	_PlayMsOffsets.LocalRadar_End = _PlayMsOffsets.LocalRadar_Start + _PlayMsOffsets.LocalRadar_Length;

	//Hazards
	_PlayMsOffsets.Hazards_Start = _PlayMsOffsets.LocalRadar_End;
	if (Progress.Hazards === LoadStatuses.Loaded && Hazards.length > 0) {
		_PlayMsOffsets.Hazards_Length = (((385 + cnvHazardsScroll.height()) / 385) * 13000) + 3000;
	} else {
		_PlayMsOffsets.Hazards_Length = 0;
	}
	_PlayMsOffsets.Hazards_End = _PlayMsOffsets.Hazards_Start + _PlayMsOffsets.Hazards_Length;

	//Global offsets
	_PlayMsOffsets.Start = 0;
	_PlayMsOffsets.End = _PlayMsOffsets.Hazards_End;
	_PlayMsOffsets.Length = _PlayMsOffsets.Hazards_End;

	// Update the Play Position
	if (CalledFromProgress) {
		if (Progress.CurrentConditions === LoadStatuses.Loaded && _PlayMsOffsets.CurrentWeather_Loaded === false) {
			//if (_PlayMs > _PlayMsOffsets.CurrentWeather_End)
			//if (_PlayMs <= _PlayMsOffsets.CurrentWeather_Start
			//if (_PlayMs < _PlayMsOffsets.CurrentWeather_End)
			if (_CurrentCanvasType > CanvasTypes.CurrentWeather) {
				_PlayMs += _PlayMsOffsets.CurrentWeather_Length;
			}
			_PlayMsOffsets.CurrentWeather_Loaded = true;
		}
		if (Progress.NearbyConditions === LoadStatuses.Loaded && _PlayMsOffsets.LatestObservations_Loaded === false) {
			//if (_PlayMs > _PlayMsOffsets.LatestObservations_End)
			//if (_PlayMs <= _PlayMsOffsets.LatestObservations_Start)
			//if (_PlayMs < _PlayMsOffsets.LatestObservations_End)
			if (_CurrentCanvasType > CanvasTypes.LatestObservations) {
				_PlayMs += _PlayMsOffsets.LatestObservations_Length;
			}
			_PlayMsOffsets.LatestObservations_Loaded = true;
		}
		if (Progress.TravelForecast === LoadStatuses.Loaded && _PlayMsOffsets.TravelForecast_Loaded === false) {
			//if (_PlayMs > _PlayMsOffsets.TravelForecast_End)
			//if (_PlayMs <= _PlayMsOffsets.TravelForecast_Start)
			//if (_PlayMs < _PlayMsOffsets.TravelForecast_End)
			if (_CurrentCanvasType > CanvasTypes.TravelForecast) {
				_PlayMs += _PlayMsOffsets.TravelForecast_Length;
			}
			_PlayMsOffsets.TravelForecast_Loaded = true;
		}
		if (Progress.TomorrowsRegionalMap === LoadStatuses.Loaded && _PlayMsOffsets.RegionalForecast1_Loaded === false) {
			//if (_PlayMs > _PlayMsOffsets.RegionalForecast_End)
			//if (_PlayMs <= _PlayMsOffsets.RegionalForecast_Start)
			//if (_PlayMs < _PlayMsOffsets.RegionalForecast_End)
			if (_CurrentCanvasType > CanvasTypes.RegionalForecast1) {
				_PlayMs += _PlayMsOffsets.RegionalForecast1_Length;
			}
			_PlayMsOffsets.RegionalForecast1_Loaded = true;
		}
		if (Progress.TomorrowsRegionalMap === LoadStatuses.Loaded && _PlayMsOffsets.RegionalForecast2_Loaded === false) {
			//if (_PlayMs > _PlayMsOffsets.RegionalForecast_End)
			//if (_PlayMs <= _PlayMsOffsets.RegionalForecast_Start)
			//if (_PlayMs < _PlayMsOffsets.RegionalForecast_End)
			if (_CurrentCanvasType > CanvasTypes.RegionalForecast2) {
				_PlayMs += _PlayMsOffsets.RegionalForecast2_Length;
			}
			_PlayMsOffsets.RegionalForecast2_Loaded = true;
		}
		if (Progress.CurrentRegionalMap === LoadStatuses.Loaded && _PlayMsOffsets.RegionalObservations_Loaded === false) {
			//if (_PlayMs > _PlayMsOffsets.RegionalObservations_End)
			//if (_PlayMs <= _PlayMsOffsets.RegionalObservations_Start)
			//if (_PlayMs < _PlayMsOffsets.RegionalObservations_End)
			if (_CurrentCanvasType > CanvasTypes.RegionalObservations) {
				_PlayMs += _PlayMsOffsets.RegionalObservations_Length;
			}
			_PlayMsOffsets.RegionalObservations_Loaded = true;
		}
		if (Progress.WordedForecast === LoadStatuses.Loaded && _PlayMsOffsets.LocalForecast_Loaded === false) {
			//if (_PlayMs > _PlayMsOffsets.LocalForecast_End)
			//if (_PlayMs <= _PlayMsOffsets.LocalForecast_Start)
			//if (_PlayMs < _PlayMsOffsets.LocalForecast_Start)
			if (_CurrentCanvasType > CanvasTypes.LocalForecast) {
				_PlayMs += _PlayMsOffsets.LocalForecast_Length;
			}
			_PlayMsOffsets.LocalForecast_Loaded = true;
		}
		if (Progress.WordedForecast === LoadStatuses.Loaded && _PlayMsOffsets.MarineForecast_Loaded === false && _WeatherParameters.MarineForecast) {
			if (_CurrentCanvasType > CanvasTypes.MarineForecast) {
				_PlayMs += _PlayMsOffsets.MarineForecast_Length;
			}
			_PlayMsOffsets.MarineForecast_Loaded = true;
		}
		if (Progress.WordedForecast === LoadStatuses.Loaded && _PlayMsOffsets.AirQuality_Loaded === false && _WeatherParameters.AirQuality) {
			if (_CurrentCanvasType > CanvasTypes.AirQuality) {
				_PlayMs += _PlayMsOffsets.AirQuality_Length;
			}
			_PlayMsOffsets.AirQuality_Loaded = true;
		}
		if (Progress.FourDayForecast === LoadStatuses.Loaded && _PlayMsOffsets.ExtendedForecast1_Loaded === false) {
			//if (_PlayMs > _PlayMsOffsets.ExtendedForecast_End)
			//if (_PlayMs <= _PlayMsOffsets.ExtendedForecast_Start)
			//if (_PlayMs > _PlayMsOffsets.ExtendedForecast_Start)
			if (_CurrentCanvasType > CanvasTypes.ExtendedForecast1) {
				_PlayMs += _PlayMsOffsets.ExtendedForecast1_Length;
			}
			_PlayMsOffsets.ExtendedForecast1_Loaded = true;
		}
		if (Progress.FourDayForecast === LoadStatuses.Loaded && _PlayMsOffsets.ExtendedForecast2_Loaded === false) {
			if (_CurrentCanvasType > CanvasTypes.ExtendedForecast2) {
				_PlayMs += _PlayMsOffsets.ExtendedForecast2_Length;
			}
			_PlayMsOffsets.ExtendedForecast2_Loaded = true;
		}
		if (Progress.Almanac === LoadStatuses.Loaded && _PlayMsOffsets.Almanac_Loaded === false) {
			//if (_PlayMs > _PlayMsOffsets.Almanac_End)
			//if (_PlayMs <= _PlayMsOffsets.Almanac_Start)
			//if (_PlayMs > _PlayMsOffsets.Almanac_Start)
			if (_CurrentCanvasType > CanvasTypes.Almanac) {
				_PlayMs += _PlayMsOffsets.Almanac_Length;
			}
			_PlayMsOffsets.Almanac_Loaded = true;
		}
		if (Progress.Almanac === LoadStatuses.Loaded && _PlayMsOffsets.AlmanacTides_Loaded === false && _WeatherParameters.WeatherTides) {
			if (_CurrentCanvasType > CanvasTypes.AlmanacTides) {
				_PlayMs += _PlayMsOffsets.AlmanacTides_Length;
			}
			_PlayMsOffsets.AlmanacTides_Loaded = true;
		}
		if (Progress.Almanac === LoadStatuses.Loaded && _PlayMsOffsets.Outlook_Loaded === false && _WeatherParameters.Outlook) {
			if (_CurrentCanvasType > CanvasTypes.Outlook) {
				_PlayMs += _PlayMsOffsets.Outlook_Length;
			}
			_PlayMsOffsets.Outlook_Loaded = true;
		}
		if (Progress.DopplerRadar === LoadStatuses.Loaded && _PlayMsOffsets.LocalRadar_Loaded === false) {
			//if (_PlayMs > _PlayMsOffsets.LocalRadar_End)
			//if (_PlayMs <= _PlayMsOffsets.LocalRadar_Start)
			//if (_PlayMs > _PlayMsOffsets.LocalRadar_Start)
			if (_CurrentCanvasType > CanvasTypes.LocalRadar) {
				_PlayMs += _PlayMsOffsets.LocalRadar_Length;
			}
			_PlayMsOffsets.LocalRadar_Loaded = true;
		}
		if (Progress.Hazards === LoadStatuses.Loaded && _PlayMsOffsets.Hazards_Loaded === false) {
			//if (_PlayMs > _PlayMsOffsets.Hazards_End)
			//if (_PlayMs <= _PlayMsOffsets.Hazards_Start)
			//if (_PlayMs > _PlayMsOffsets.Hazards_Start)
			if (_CurrentCanvasType > CanvasTypes.Hazards) {
				_PlayMs += _PlayMsOffsets.Hazards_Length;
			}
			_PlayMsOffsets.Hazards_Loaded = true;
		}
	} else {
		switch (_CurrentCanvasType) {
		case CanvasTypes.Progress:
			_PlayMs = 0;
			break;
		case CanvasTypes.CurrentWeather:
			_PlayMs = _PlayMsOffsets.CurrentWeather_Start;
			break;
		case CanvasTypes.LatestObservations:
			_PlayMs = _PlayMsOffsets.LatestObservations_Start;
			break;
		case CanvasTypes.TravelForecast:
			_PlayMs = _PlayMsOffsets.TravelForecast_Start;
			break;
		case CanvasTypes.RegionalForecast1:
			_PlayMs = _PlayMsOffsets.RegionalForecast1_Start;
			break;
		case CanvasTypes.RegionalForecast2:
			_PlayMs = _PlayMsOffsets.RegionalForecast2_Start;
			break;
		case CanvasTypes.RegionalObservations:
			_PlayMs = _PlayMsOffsets.RegionalObservations_Start;
			break;
		case CanvasTypes.LocalForecast:
			_PlayMs = _PlayMsOffsets.LocalForecast_Start;
			break;
		case CanvasTypes.MarineForecast:
			_PlayMs = _PlayMsOffsets.MarineForecast_Start;
			break;
		case CanvasTypes.AirQuality:
			_PlayMs = _PlayMsOffsets.AirQuality_Start;
			break;
		case CanvasTypes.ExtendedForecast1:
			_PlayMs = _PlayMsOffsets.ExtendedForecast1_Start;
			break;
		case CanvasTypes.ExtendedForecast2:
			_PlayMs = _PlayMsOffsets.ExtendedForecast2_Start;
			break;
		case CanvasTypes.Almanac:
			_PlayMs = _PlayMsOffsets.Almanac_Start;
			break;
		case CanvasTypes.AlmanacTides:
			_PlayMs = _PlayMsOffsets.AlmanacTides_Start;
			break;
		case CanvasTypes.Outlook:
			_PlayMs = _PlayMsOffsets.Outlook_Start;
			break;
		case CanvasTypes.LocalRadar:
			_PlayMs = _PlayMsOffsets.LocalRadar_Start;
			break;
		case CanvasTypes.Hazards:
			_PlayMs = _PlayMsOffsets.Hazards_Start;
			break;
		default:
		}
	}

};

var UpdatePlayPosition = function () {
	var cnvTravelCitiesScroll = $('#cnvTravelCitiesScroll');
	var cnvHazardsScroll = $('#cnvHazardsScroll');
	var SubMs;

	var PrevPlayMs = _PlayMs;
	var PrevCanvasType = _CurrentCanvasType;
	var PrevPosition = _CurrentPosition;
	var PrevUpdateLocalForecastIndex = _UpdateLocalForecastIndex;

	if (_PlayMs < _PlayMsOffsets.Start) {
		_PlayMs = _PlayMsOffsets.End + _PlayMs;
	} else if (_PlayMs >= _PlayMsOffsets.End) {
		_PlayMs = _PlayMs - _PlayMsOffsets.End;
	}

	if (_PlayMs >= _PlayMsOffsets.CurrentWeather_Start && _PlayMs < _PlayMsOffsets.CurrentWeather_End) {
		_CurrentCanvasType = CanvasTypes.CurrentWeather;
		_CurrentPosition = _CurrentCanvasType;
	} else if (_PlayMs >= _PlayMsOffsets.LatestObservations_Start && _PlayMs < _PlayMsOffsets.LatestObservations_End) {
		_CurrentCanvasType = CanvasTypes.LatestObservations;
		_CurrentPosition = _CurrentCanvasType;
	} else if (_PlayMs >= _PlayMsOffsets.TravelForecast_Start && _PlayMs < _PlayMsOffsets.TravelForecast_End) {
		_CurrentCanvasType = CanvasTypes.TravelForecast;
		_CurrentPosition = _CurrentCanvasType;
		SubMs = _PlayMs - _PlayMsOffsets.TravelForecast_Start;


	} else if (_PlayMs >= _PlayMsOffsets.RegionalForecast1_Start && _PlayMs < _PlayMsOffsets.RegionalForecast1_End) {
		_CurrentCanvasType = CanvasTypes.RegionalForecast1;
		_CurrentPosition = _CurrentCanvasType;
	} else if (_PlayMs >= _PlayMsOffsets.RegionalForecast2_Start && _PlayMs < _PlayMsOffsets.RegionalForecast2_End) {
		_CurrentCanvasType = CanvasTypes.RegionalForecast2;
		_CurrentPosition = _CurrentCanvasType;
	} else if (_PlayMs >= _PlayMsOffsets.RegionalObservations_Start && _PlayMs < _PlayMsOffsets.RegionalObservations_End) {
		_CurrentCanvasType = CanvasTypes.RegionalObservations;
		_CurrentPosition = _CurrentCanvasType;
	} else if (_PlayMs >= _PlayMsOffsets.LocalForecast_Start && _PlayMs < _PlayMsOffsets.LocalForecast_End) {
		_CurrentCanvasType = CanvasTypes.LocalForecast;
		_CurrentPosition = _CurrentCanvasType;
		SubMs = _PlayMs - _PlayMsOffsets.LocalForecast_Start;

		_UpdateLocalForecastIndex = Math.floor(SubMs / 10000);
		_CurrentPosition += _UpdateLocalForecastIndex / 10;

		if (_IsSpeaking) {
			if (_UpdateLocalForecastIndex !== PrevUpdateLocalForecastIndex) {
				_UpdateLocalForecastIndex = PrevUpdateLocalForecastIndex;
				_CurrentPosition = _CurrentCanvasType;
				_CurrentPosition += _UpdateLocalForecastIndex / 10;
			}
		}

		UpdateLocalForecast();
	} else if (_PlayMs >= _PlayMsOffsets.MarineForecast_Start && _PlayMs < _PlayMsOffsets.MarineForecast_End) {
		_CurrentCanvasType = CanvasTypes.MarineForecast;
		_CurrentPosition = _CurrentCanvasType;
	} else if (_PlayMs >= _PlayMsOffsets.AirQuality_Start && _PlayMs < _PlayMsOffsets.AirQuality_End) {
		_CurrentCanvasType = CanvasTypes.AirQuality;
		_CurrentPosition = _CurrentCanvasType;
	} else if (_PlayMs >= _PlayMsOffsets.ExtendedForecast1_Start && _PlayMs < _PlayMsOffsets.ExtendedForecast1_End) {
		_CurrentCanvasType = CanvasTypes.ExtendedForecast1;
		_CurrentPosition = _CurrentCanvasType;
	} else if (_PlayMs >= _PlayMsOffsets.ExtendedForecast2_Start && _PlayMs < _PlayMsOffsets.ExtendedForecast2_End) {
		_CurrentCanvasType = CanvasTypes.ExtendedForecast2;
		_CurrentPosition = _CurrentCanvasType;
	} else if (_PlayMs >= _PlayMsOffsets.Almanac_Start && _PlayMs < _PlayMsOffsets.Almanac_End) {
		_CurrentCanvasType = CanvasTypes.Almanac;
		_CurrentPosition = _CurrentCanvasType;
	} else if (_PlayMs >= _PlayMsOffsets.AlmanacTides_Start && _PlayMs < _PlayMsOffsets.AlmanacTides_End) {
		_CurrentCanvasType = CanvasTypes.AlmanacTides;
		_CurrentPosition = _CurrentCanvasType;
	} else if (_PlayMs >= _PlayMsOffsets.Outlook_Start && _PlayMs < _PlayMsOffsets.Outlook_End) {
		_CurrentCanvasType = CanvasTypes.Outlook;
		_CurrentPosition = _CurrentCanvasType;
	} else if (_PlayMs >= _PlayMsOffsets.LocalRadar_Start && _PlayMs < _PlayMsOffsets.LocalRadar_End) {
		_CurrentCanvasType = CanvasTypes.LocalRadar;
		_CurrentPosition = _CurrentCanvasType;
		SubMs = _PlayMs - _PlayMsOffsets.LocalRadar_Start;

		SubMs = SubMs % 4500;

		if (SubMs < 2000) {
			_DopplerRadarImageIndex = 0;
		} else {
			_DopplerRadarImageIndex = (_DopplerRadarImageMax - 1) - (Math.floor((SubMs - 2000) / 500));
		}

		//_CurrentPosition += _DopplerRadarImageIndex / 10;

		UpdateDopplarRadarImage();
	} else if (_PlayMs >= _PlayMsOffsets.Hazards_Start && _PlayMs < _PlayMsOffsets.Hazards_End) {
		_CurrentCanvasType = CanvasTypes.Hazards;
		_CurrentPosition = _CurrentCanvasType;

		SubMs = _PlayMs - _PlayMsOffsets.Hazards_Start;

		// Wait 3 seconds and then start scrolling.
		if (SubMs < 3000) {
			_UpdateHazardsY = -385;
		}
		if (SubMs >= 3000) {
			//y += 1;
			_UpdateHazardsY = (3 * ((SubMs - 3000) / _PlayInterval)) - 385;
		}
		if (_UpdateHazardsY > cnvHazardsScroll.height()) {
			_UpdateHazardsY = cnvHazardsScroll.height();

			// Wait 10 seconds and start all over.
		}

		//_CurrentPosition += Math.round(_UpdateHazardsY / 385) / 10;

		UpdateHazards();
	}

	if (_IsSpeaking) {
		if (_CurrentCanvasType !== PrevCanvasType) {
			_CurrentCanvasType = PrevCanvasType;
			_CurrentPosition = PrevPosition;
			_PlayMs = PrevPlayMs - _PlayInterval;
		}
	}
	//console.log("_PlayMs=" + _PlayMs);


	Navigate();


};

var NavigatePlayToggle = function () {

	_IsPlaying = !(_IsPlaying);

	if (_PlayIntervalId) {
		window.clearInterval(_PlayIntervalId);
		_PlayIntervalId = null;
	}

	if (_IsPlaying) {

		_PlayIntervalId = window.setInterval(function () {
			if (_WeatherParameters.Progress.GetTotalPercentage() !== 100) {
				return;
			}

			UpdatePlayPosition();
			_PlayMs += _PlayInterval;

		}, _PlayInterval);
		//NavigateNext();
	} else {
		//if (_PlayIntervalId)
		//{
		//    window.clearInterval(_PlayIntervalId);
		//    _PlayIntervalId = null;
		//}
	}

	if (_CallBack) _CallBack({ Status: 'ISPLAYING', Value: _IsPlaying });

};

var IsPlaying = function () {
	return _IsPlaying;
};

var canvasProgress_mousemove = function (e) {
	canvasProgress.css('cursor', '');

	var RatioX = canvasProgress.width() / 640;
	var RatioY = canvasProgress.height() / 480;

	if (e.offsetX >= (70 * RatioX) && e.offsetX <= (565 * RatioX)) {
		//if (e.offsetY >= (105 * RatioY) && e.offsetY <= (350 * RatioY))
		if (e.offsetY >= (100 * RatioY) && e.offsetY <= (385 * RatioY)) {
			// Show hand cursor.
			canvasProgress.css('cursor', 'pointer');
		}
	}
};
var canvasProgress_click = function (e) {
	var Hazards = _WeatherParameters.WeatherHazardConditions.Hazards;

	var RatioX = canvasProgress.width() / 640;
	var RatioY = canvasProgress.height() / 480;

	if (e.offsetX >= (70 * RatioX) && e.offsetX <= (565 * RatioX)) {
		if (e.offsetY >= (100 * RatioY) && e.offsetY < (129 * RatioY)) {
			if (_WeatherParameters.Progress.CurrentConditions === LoadStatuses.Loaded) {
				// Current Conditions
				_CurrentCanvasType = CanvasTypes.CurrentWeather;
				AssignPlayMsOffsets();
				//window.location.hash = "#aCurrentWeather";
				NavigateReset();
			}
		} else if (e.offsetY >= (129 * RatioY) && e.offsetY < (158 * RatioY)) {
			// Latest Observations
			if (_WeatherParameters.Progress.NearbyConditions === LoadStatuses.Loaded) {
				_CurrentCanvasType = CanvasTypes.LatestObservations;
				AssignPlayMsOffsets();
				//window.location.hash = "#aLatestObservations";
				NavigateReset();
			}
		} else if (e.offsetY >= (158 * RatioY) && e.offsetY < (187 * RatioY)) {
			// Travel Forecast
			if (_WeatherParameters.Progress.TravelForecast === LoadStatuses.Loaded) {
				_CurrentCanvasType = CanvasTypes.TravelForecast;
				UpdateTravelCities(0);
				AssignPlayMsOffsets();
				//window.location.hash = "#aTravelForecast";
				NavigateReset();
			}
		} else if (e.offsetY >= (187 * RatioY) && e.offsetY < (216 * RatioY)) {
			// Regional Forecast
			if (_WeatherParameters.Progress.TomorrowsRegionalMap === LoadStatuses.Loaded) {
				_CurrentCanvasType = CanvasTypes.RegionalForecast1;
				//window.location.hash = "#aRegionalForecast";
				AssignPlayMsOffsets();
				NavigateReset();
			}
		} else if (e.offsetY >= (216 * RatioY) && e.offsetY < (245 * RatioY)) {
			if (_WeatherParameters.Progress.CurrentRegionalMap === LoadStatuses.Loaded) {
				// Regional Observations
				_CurrentCanvasType = CanvasTypes.RegionalObservations;
				AssignPlayMsOffsets();
				//window.location.hash = "#aRegionalObservations";
				NavigateReset();
			}
		} else if (e.offsetY >= (245 * RatioY) && e.offsetY < (274 * RatioY)) {
			// Local Forecast
			if (_WeatherParameters.Progress.WordedForecast === LoadStatuses.Loaded) {
				_CurrentCanvasType = CanvasTypes.LocalForecast;
				UpdateLocalForecast(0);
				AssignPlayMsOffsets();
				//window.location.hash = "#aLocalForecast";
				NavigateReset();
			}
		} else if (e.offsetY >= (274 * RatioY) && e.offsetY < (303 * RatioY)) {
			// Extended Forecast
			if (_WeatherParameters.Progress.FourDayForecast === LoadStatuses.Loaded) {
				_CurrentCanvasType = CanvasTypes.ExtendedForecast1;
				AssignPlayMsOffsets();
				//window.location.hash = "#aExtendedForecast";
				NavigateReset();
			}
		} else if (e.offsetY >= (303 * RatioY) && e.offsetY < (332 * RatioY)) {
			// Almanac
			if (_WeatherParameters.Progress.Almanac === LoadStatuses.Loaded) {
				_CurrentCanvasType = CanvasTypes.Almanac;
				AssignPlayMsOffsets();
				//window.location.hash = "#aAlmanac";
				NavigateReset();
			}
		} else if (e.offsetY >= (332 * RatioY) && e.offsetY < (361 * RatioY)) {
			// Local Radar
			if (_WeatherParameters.Progress.DopplerRadar === LoadStatuses.Loaded) {
				_CurrentCanvasType = CanvasTypes.LocalRadar;
				UpdateDopplarRadarImage(0);
				AssignPlayMsOffsets();
				//window.location.hash = "#aLocalRadar";
				NavigateReset();
			}
		} else if (e.offsetY >= (361 * RatioY) && e.offsetY < (390 * RatioY)) {
			// Hazards
			if (_WeatherParameters.Progress.Hazards === LoadStatuses.Loaded && Hazards.length > 0) {
				_CurrentCanvasType = CanvasTypes.Hazards;
				UpdateHazards(0);
				AssignPlayMsOffsets();
				//window.location.hash = "#aHazards";
				NavigateReset();
			}
		}


	}
};


String.prototype.centerText = function(numberOfSpaces) {
	var text = this;
	text = text.trim();
	if (text.length > numberOfSpaces) {
		return text;
	}
	var l = text.length;
	var w2 = Math.floor(numberOfSpaces / 2);
	var l2 = Math.floor(l / 2);
	var s = new Array(w2 - l2).join(' ');
	text = s + text + s;
	if (text.length < numberOfSpaces) {
		text += new Array(numberOfSpaces - text.length + 1).join(' ');
	}
	return text;
};

var PopulateHazardConditions = function (WeatherParameters) {
	if (WeatherParameters === null || (_DontLoadGifs && WeatherParameters.Progress.Hazards !== LoadStatuses.Loaded)) {
		return;
	}

	var WeatherHazardConditions = WeatherParameters.WeatherHazardConditions;
	var ZoneId = WeatherHazardConditions.ZoneId;
	var Text;
	var Line;
	var SkipLine;

	var DontLoadGifs = _DontLoadGifs;

	divHazards.empty();

	$(WeatherHazardConditions.Hazards).each(function () {
		//Text = this.replaceAll("\n", "<br/>");
		//divHazards.html(divHazards.html() + "<br/><br/>" + Text);

		Text = this.toString();

		SkipLine = false;

		Text = Text.replaceAll('\n', ' ');
		//Text = Text.replaceAll("*** ", "");

		//$(Text.split("\n")).each(function ()
		$(Text.split(' ')).each(function () {
			Line = this.toString();
			Line = Line.toUpperCase();

			if (Line.startsWith('&&')) {
				return false;
			} else if (Line.startsWith('$$')) {
				return false;
			}
			if (SkipLine) {
				if (Line === '') {
					SkipLine = false;
					return true;
				}

				return true;
			}

			if (Line.startsWith(ZoneId)) {
				SkipLine = true;
				return true;
			} else if (Line.indexOf('>') !== -1) {
				SkipLine = true;
				return true;
			} else if (Line.indexOf('LAT...LON ') !== -1) {
				SkipLine = true;
				return true;
			}

			//divHazards.html(divHazards.html() + "<br/>" + Line);
			if (Line.indexOf('.') === 0 || Line.indexOf('*') === 0) {
				divHazards.html(divHazards.html() + '<br/><br/>');
				if (Line.indexOf('.') === 0 && Line.indexOf('...') !== 0) {
					Line = Line.substr(1);
				}
			}

			divHazards.html(divHazards.html() + Line + ' ');

		});

		divHazards.html(divHazards.html() + '<br/><br/>');
	});

	var DrawHazards = function () {
		// Draw canvas
		var canvas = canvasHazards[0];
		var context = canvas.getContext('2d');

		var BackGroundImage = new Image();
		BackGroundImage.onload = function () {
			context.drawImage(BackGroundImage, 0, 0);

			if (DontLoadGifs) {
				UpdateHazards();
			}

			if (WeatherHazardConditions.Hazards.length > 0) {
				WeatherParameters.Progress.Hazards = LoadStatuses.Loaded;
			} else {
				WeatherParameters.Progress.Hazards = LoadStatuses.NoData;
			}

			UpdateWeatherCanvas(WeatherParameters, canvasHazards);
		};
		BackGroundImage.src = 'images/BackGround7.png';
	};

	var HazardsText = divHazards.html();

	HazardsText = HazardsText.replaceAll('<br>', '\n');
	HazardsText = HazardsText.replaceAll('<br/>', '\n');
	HazardsText = HazardsText.replaceAll('<br />', '\n');
	HazardsText = HazardsText.replaceAll('<br></br>', '\n');

	WeatherHazardConditions.HazardsText = HazardsText;
	WeatherHazardConditions.HazardsTextC = ConvertConditionsToMetric(HazardsText);
	if (_Units === Units.Metric) {
		HazardsText = WeatherHazardConditions.HazardsTextC;
	}

	var HazardsWrapped = HazardsText.wordWrap(32);

	var cnvHazardsScroll;

	var ShowHazardsScroll = function () {
		var cnvHazardsScrollId;
		var context;

		cnvHazardsScrollId = 'cnvHazardsScroll';

		var HazardsWrappedLines = HazardsWrapped.split('\n');
		var MaxHazardsWrappedLines = 365;
		if (_OperatingSystem === OperatingSystems.Andriod) {
			MaxHazardsWrappedLines = 92;
		}

		if (HazardsWrappedLines.length > MaxHazardsWrappedLines) {
			HazardsWrappedLines = HazardsWrappedLines.splice(0, MaxHazardsWrappedLines - 1);
		}
		var height = 0 + (HazardsWrappedLines.length * 45);

		if (DontLoadGifs === false) {
			// Clear the current image.
			divHazardsScroll.empty();
			divHazardsScroll.html('<canvas id=\'' + cnvHazardsScrollId + '\' />');
			cnvHazardsScroll = $('#' + cnvHazardsScrollId);
			cnvHazardsScroll.attr('width', '640'); // For Chrome.
			cnvHazardsScroll.attr('height', height); // For Chrome.
		}
		cnvHazardsScroll = $('#' + cnvHazardsScrollId);
		context = cnvHazardsScroll[0].getContext('2d');

		DrawBox(context, 'rgb(112, 35, 35)', 0, 0, 640, height);

		//var y = 0;
		var y = 45;

		$(HazardsWrappedLines).each(function () {
			var HazardLine = this.toString();

			DrawText(context, 'Star4000', '24pt', '#FFFFFF', 80, y, HazardLine, 1);

			y += 45;
		});

		DrawHazards();
	};
	ShowHazardsScroll();

};

var UpdateHazards = function (Offset) {
	var canvas = canvasHazards[0];
	var context = canvas.getContext('2d');
	var cnvHazardsScroll = $('#cnvHazardsScroll');

	switch (Offset) {
	case undefined:
		break;
	case 0:
		_UpdateHazardsY = 0;
		break;
	case Infinity:
		_UpdateHazardsY = cnvHazardsScroll.height();
		break;
	default:
		_UpdateHazardsY += (385 * Offset);
		if (_UpdateHazardsY > cnvHazardsScroll.height()) {
			_UpdateHazardsY = cnvHazardsScroll.height();
		} else if (_UpdateHazardsY < 0) {
			_UpdateHazardsY = 0;
		}
		break;
	}

	DrawBox(context, 'rgb(112, 35,35)', 0, 0, 640, 385);
	context.drawImage(cnvHazardsScroll[0], 0, _UpdateHazardsY, 640, 385, 0, 0, 640, 385);


};


const WeatherMonthlyTotalsParser = (text) => {
	return +text.match(/MONTH TO DATE\s*(\d{1,2}\.\d\d)/)[1];
};

Number.prototype.pad = function(size) {
	var s = String(this);
	while (s.length < (size || 1)) {
		s = '0' + s;
	}
	return s;
};



const PopulateAlmanacInfo = async (WeatherParameters) => {
	if (WeatherParameters === null || (_DontLoadGifs && WeatherParameters.Progress.Almanac !== LoadStatuses.Loaded)) return;

	const info = WeatherParameters.AlmanacInfo;

	// Draw canvas
	const canvas = canvasAlmanac[0];
	const context = canvas.getContext('2d');

	// load all images in parallel
	const [FullMoonImage, LastMoonImage, NewMoonImage, FirstMoonImage, BackGroundImage] = await Promise.all([
		utils.loadImg('images/2/Full-Moon.gif'),
		utils.loadImg('images/2/Last-Quarter.gif'),
		utils.loadImg('images/2/New-Moon.gif'),
		utils.loadImg('images/2/First-Quarter.gif'),
		utils.loadImg('images/BackGround3_1.png'),
	]);

	context.drawImage(BackGroundImage, 0, 0);
	DrawHorizontalGradientSingle(context, 0, 30, 500, 90, _TopColor1, _TopColor2);
	DrawTriangle(context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);
	DrawHorizontalGradientSingle(context, 0, 90, 640, 190, _SideColor1, _SideColor2);

	DrawTitleText(context, 'Almanac', 'Astronomical');

	const Today = luxon.DateTime.local();
	const Tomorrow = Today.plus({days: 1});
	DrawText(context, 'Star4000', '24pt', '#FFFF00', 320, 120, Today.toLocaleString({weekday: 'long'}), 2, 'center');
	DrawText(context, 'Star4000', '24pt', '#FFFF00', 500, 120, Tomorrow.toLocaleString({weekday: 'long'}), 2, 'center');

	DrawText(context, 'Star4000', '24pt', '#FFFFFF', 70, 150, 'Sunrise:', 2);
	DrawText(context, 'Star4000', '24pt', '#FFFFFF', 270, 150, luxon.DateTime.fromJSDate(info.sun[0].sunrise).toLocaleString(luxon.DateTime.TIME_SIMPLE).toLowerCase(), 2);
	DrawText(context, 'Star4000', '24pt', '#FFFFFF', 450, 150, luxon.DateTime.fromJSDate(info.sun[1].sunrise).toLocaleString(luxon.DateTime.TIME_SIMPLE).toLowerCase(), 2);

	DrawText(context, 'Star4000', '24pt', '#FFFFFF', 70, 180, ' Sunset:', 2);
	DrawText(context, 'Star4000', '24pt', '#FFFFFF', 270, 180, luxon.DateTime.fromJSDate(info.sun[0].sunset).toLocaleString(luxon.DateTime.TIME_SIMPLE).toLowerCase(), 2);
	DrawText(context, 'Star4000', '24pt', '#FFFFFF', 450, 180, luxon.DateTime.fromJSDate(info.sun[1].sunset).toLocaleString(luxon.DateTime.TIME_SIMPLE).toLowerCase(), 2);

	DrawText(context, 'Star4000', '24pt', '#FFFF00', 70, 220, 'Moon Data:', 2);


	info.moon.forEach((MoonPhase, Index) => {
		const date = MoonPhase.date.toLocaleString({month: 'short', day: 'numeric'});

		DrawText(context, 'Star4000', '24pt', '#FFFFFF', 120+Index*130, 260, MoonPhase.phase, 2, 'center');
		DrawText(context, 'Star4000', '24pt', '#FFFFFF', 120+Index*130, 390, date, 2, 'center');

		const image = (() => {
			switch (MoonPhase.phase) {
			case 'Full':
				return FullMoonImage;
			case 'Last':
				return LastMoonImage;
			case 'New':
				return NewMoonImage;
			case 'First':
			default:
				return FirstMoonImage;
			}
		})();
		context.drawImage(image, 75+Index*130, 270);
	});

	WeatherParameters.Progress.Almanac = LoadStatuses.Loaded;

	UpdateWeatherCanvas(WeatherParameters, canvasAlmanac);


};




const ShowDopplerMap = async (WeatherParameters) => {



	let OffsetY;
	let OffsetX;
	let SourceXY;
	let contextWorker;

	const cnvDopplerMapId = 'cnvDopplerRadarMap';
	const cnvRadarWorkerId = 'cnvRadarWorker';

	// Clear the current image.
	divDopplerRadarMap.empty();

	let src = 'images/4000RadarMap2.jpg';
	if (WeatherParameters.State === 'HI') src = 'images/HawaiiRadarMap2.png';
	const img = await utils.loadImg(src);
	console.log('Doppler Image Loaded');

	divDopplerRadarMap.html(`<canvas id='${cnvDopplerMapId}'/><canvas id='${cnvRadarWorkerId}'/>`);
	const $cnvDopplerMap = $(`#${cnvDopplerMapId}`);
	$cnvDopplerMap.attr('width', '640'); // For Chrome.
	$cnvDopplerMap.attr('height', '367'); // For Chrome.
	const context = $cnvDopplerMap[0].getContext('2d');

	const $cnvRadarWorker = $(`#${cnvRadarWorkerId}`);
	OffsetX = 120;
	OffsetY = 69;
	if (WeatherParameters.State === 'HI') {
		$cnvRadarWorker.attr('width', '600'); // For Chrome.
		$cnvRadarWorker.attr('height', '571'); // For Chrome.
		SourceXY = GetXYFromLatitudeLongitudeHI(WeatherParameters.Latitude, WeatherParameters.Longitude, OffsetX, OffsetY);
	} else {
		$cnvRadarWorker.attr('width', '2550'); // For Chrome.
		$cnvRadarWorker.attr('height', '1600'); // For Chrome.
		OffsetX *= 2;
		OffsetY *= 2;
		SourceXY = GetXYFromLatitudeLongitudeDoppler(WeatherParameters.Latitude, WeatherParameters.Longitude, OffsetX, OffsetY);
	}
	$cnvRadarWorker.css('display', 'none');
	contextWorker = $cnvRadarWorker[0].getContext('2d');

	// Draw them onto the map.
	context.drawImage(img, SourceXY.x, SourceXY.y, (OffsetX * 2), (OffsetY * 2), 0, 0, 640, 367);

	const baseUrl = 'https://radar.weather.gov/Conus/RadarImg/';

	const RadarContexts = [];

	try {
		// get a list of available radars
		const radarHtml = await $.ajaxCORS({
			type: 'GET',
			url: baseUrl,
			dataType: 'text',
			crossDomain: true,
		});

		// convert to an array of gif urls
		const $list = $(radarHtml);
		const gifs = $list.find('a[href]').map((i,elem) => elem.innerHTML).get();

		// filter for selected urls
		let filter = /^Conus_\d/;
		if (WeatherParameters.State === 'HI') filter = /hawaii_\d/;

		// get the last few images
		const urlsFull = gifs.filter(gif => gif.match(filter));
		const urls = urlsFull.slice(-_DopplerRadarImageMax);

		// Load the most recent doppler radar images.
		const RadarImages = await Promise.all(urls.map(async (url, idx) => {
			// create destination context
			const id = 'cnvRadar' + idx.toString();
			let RadarContext = $(`#${id}`);
			if (!RadarContext[idx]) {
				$('body').append(`<canvas id='${id}'/>`);
				RadarContext = $(`#${id}`);
				RadarContext.attr('width', '640'); // For Chrome.
				RadarContext.attr('height', '367'); // For Chrome.
				RadarContext.css('display', 'none');
			}
			RadarContexts.push(RadarContext);

			// get the image
			const blob = await $.ajaxCORS({
				type: 'GET',
				url: baseUrl + url,
				xhrFields: {
					responseType: 'blob',
				},
				crossDomain: true,
			});

			// assign to an html image element
			return await utils.loadImg(blob);
		}));

		RadarImages.forEach((radarImg, idx) => {

			const RadarContext = RadarContexts[idx][0].getContext('2d');
			contextWorker.clearRect(0, 0, contextWorker.canvas.width, contextWorker.canvas.height);

			SmoothingEnabled(contextWorker, false);

			if (WeatherParameters.State === 'HI') {
				contextWorker.drawImage(radarImg, 0, 0, 571, 600);
			} else {
				contextWorker.drawImage(radarImg, 0, 0, 2550, 1600);
			}

			let RadarOffsetX;
			let RadarOffsetY;
			let RadarSourceXY;
			let RadarSourceX;
			let RadarSourceY;
			if (WeatherParameters.State === 'HI') {
				RadarOffsetX = 120;
				RadarOffsetY = 69;
				RadarSourceXY = GetXYFromLatitudeLongitudeHI(WeatherParameters.Latitude, WeatherParameters.Longitude, OffsetX, OffsetY);
				RadarSourceX = RadarSourceXY.x;
				RadarSourceY = RadarSourceXY.y;
			} else {
				RadarOffsetX = 117;
				RadarOffsetY = 60;
				RadarSourceXY = GetXYFromLatitudeLongitudeDoppler(WeatherParameters.Latitude, WeatherParameters.Longitude, OffsetX, OffsetY);
				RadarSourceX = RadarSourceXY.x / 2;
				RadarSourceY = RadarSourceXY.y / 2;
			}

			// Draw them onto the map.
			RadarContext.clearRect(0, 0, RadarContext.canvas.width, RadarContext.canvas.height);

			SmoothingEnabled(RadarContext, false);

			RadarContext.drawImage(contextWorker.canvas, RadarSourceX, RadarSourceY, (RadarOffsetX * 2), (RadarOffsetY * 2.33), 0, 0, 640, 367);
			RemoveDopplerRadarImageNoise(RadarContext);
		});

		console.log('Doppler Radar Images Loaded');

		WeatherParameters.DopplerRadarInfo = {
			RadarContexts: RadarContexts,
			RadarImage: img,
			RadarMapContext: context,
			RadarSourceX: SourceXY.x,
			RadarSourceY: SourceXY.y,
			OffsetY: OffsetY,
			OffsetX: OffsetX,
		};

		// draw the background image
		const RadarContext = RadarContexts[0][0].getContext('2d');
		context.drawImage(img, SourceXY.x, SourceXY.y, (OffsetX * 2), (OffsetY * 2), 0, 0, 640, 367);
		MergeDopplerRadarImage(context, RadarContext);


		// Draw canvas
		{
			const BackGroundImage = await utils.loadImg('images/BackGround4_1.png');

			const canvas = canvasLocalRadar[0];
			const context = canvas.getContext('2d');
			context.drawImage(BackGroundImage, 0, 0);

			// Title
			DrawText(context, 'Arial', 'bold 28pt', '#ffffff', 175, 65, 'Local', 2);
			DrawText(context, 'Arial', 'bold 28pt', '#ffffff', 175, 100, 'Radar', 2);

			DrawText(context, 'Arial', 'bold 18pt', '#ffffff', 390, 49, 'PRECIP', 2);
			DrawText(context, 'Arial', 'bold 18pt', '#ffffff', 298, 73, 'Light', 2);
			DrawText(context, 'Arial', 'bold 18pt', '#ffffff', 517, 73, 'Heavy', 2);

			let x = 362;
			const y = 52;
			DrawBox(context, '#000000', x - 2, y - 2, 154, 28);
			DrawBox(context, 'rgb(49, 210, 22)', x, y, 17, 24); x += 19;
			DrawBox(context, 'rgb(28, 138, 18)', x, y, 17, 24); x += 19;
			DrawBox(context, 'rgb(20, 90, 15)', x, y, 17, 24); x += 19;
			DrawBox(context, 'rgb(10, 40, 10)', x, y, 17, 24); x += 19;
			DrawBox(context, 'rgb(196, 179, 70)', x, y, 17, 24); x += 19;
			DrawBox(context, 'rgb(190, 72, 19)', x, y, 17, 24); x += 19;
			DrawBox(context, 'rgb(171, 14, 14)', x, y, 17, 24); x += 19;
			DrawBox(context, 'rgb(115, 31, 4)', x, y, 17, 24); x += 19;

			DrawBox(context, 'rgb(143, 73, 95)', 318, 83, 32, 24);
			DrawBox(context, 'rgb(250, 122, 232)', 320, 85, 28, 20);
			DrawText(context, 'Arial', 'bold 18pt', '#ffffff', 355, 105, '= Incomplete Data', 2);

			window.setInterval(() => {
				context.drawImage($cnvDopplerMap[0], 0, 0, 640, 367, 0, 113, 640, 367);
				UpdateWeatherCanvas(WeatherParameters, canvasLocalRadar);
			}, 100);
			WeatherParameters.Progress.DopplerRadar = LoadStatuses.Loaded;
		}

	} catch (e) {
		console.error('Unable to load radar');
		console.error(e);
		WeatherParameters.Progress.DopplerRadar = LoadStatuses.Failed;
	}


};




const UpdateDopplarRadarImage = (offset) => {
	switch (offset) {
	case undefined:
		break;
	case 0:
		_DopplerRadarImageIndex = _DopplerRadarImageMax - 1;
		break;
	case Infinity:
		_DopplerRadarImageIndex = 0;
		break;
	default:
		_DopplerRadarImageIndex -= offset;
		if (_DopplerRadarImageIndex > _DopplerRadarImageMax - 1) _DopplerRadarImageIndex = 0;
		if (_DopplerRadarImageIndex < 0) _DopplerRadarImageIndex = _DopplerRadarImageMax - 1;
		break;
	}

	const RadarContexts = _WeatherParameters.DopplerRadarInfo.RadarContexts;
	const img = _WeatherParameters.DopplerRadarInfo.RadarImage;
	const context = _WeatherParameters.DopplerRadarInfo.RadarMapContext;
	const SourceX = _WeatherParameters.DopplerRadarInfo.RadarSourceX;
	const SourceY = _WeatherParameters.DopplerRadarInfo.RadarSourceY;
	const OffsetY = _WeatherParameters.DopplerRadarInfo.OffsetY;
	const OffsetX = _WeatherParameters.DopplerRadarInfo.OffsetX;

	const RadarContext = RadarContexts[_DopplerRadarImageIndex][0].getContext('2d');
	context.drawImage(img, SourceX, SourceY, (OffsetX * 2), (OffsetY * 2), 0, 0, 640, 367);
	MergeDopplerRadarImage(context, RadarContext);
};

const RemoveDopplerRadarImageNoise = (RadarContext) => {
	const RadarImageData = RadarContext.getImageData(0, 0, RadarContext.canvas.width, RadarContext.canvas.height);

	// examine every pixel,
	// change any old rgb to the new-rgb
	for (let i = 0; i < RadarImageData.data.length; i += 4) {
		// i + 0 = red
		// i + 1 = green
		// i + 2 = blue
		// i + 3 = alpha (0 = transparent, 255 = opaque)
		let [R, G, B, A] = RadarImageData.data.slice(i,i+4);

		// is this pixel the old rgb?
		if ((R === 1 && G === 159 && B === 244)
			|| (R >= 200 && G >= 200 && B >= 200)
			|| (R === 4 && G === 233 && B === 231)
			|| (R === 3 && G === 0 && B === 244)) {
			// Transparent
			R = 0;
			G = 0;
			B = 0;
			A = 0;
		} else if (R === 2 && G === 253 && B === 2) {
			// Light Green 1
			R = 49;
			G = 210;
			B = 22;
			A = 255;
		} else if (R === 1 && G === 197 && B === 1) {
			// Light Green 2
			R = 0;
			G = 142;
			B = 0;
			A = 255;
		} else if (R === 0 && G === 142 && B === 0) {
			// Dark Green 1
			R = 20;
			G = 90;
			B = 15;
			A = 255;
		} else if (R === 253 && G === 248 && B === 2) {
			// Dark Green 2
			R = 10;
			G = 40;
			B = 10;
			A = 255;
		} else if (R === 229 && G === 188 && B === 0) {
			// Yellow
			R = 196;
			G = 179;
			B = 70;
			A = 255;
		} else if (R === 253 && G === 139 && B === 0) {
			// Orange
			R = 190;
			G = 72;
			B = 19;
			A = 255;
		} else if (R === 212 && G === 0 && B === 0) {
			// Red
			R = 171;
			G = 14;
			B = 14;
			A = 255;
		} else if (R === 188 && G === 0 && B === 0) {
			// Brown
			R = 115;
			G = 31;
			B = 4;
			A = 255;
		}

		// store new values
		RadarImageData.data[i] = R;
		RadarImageData.data[i + 1] = G;
		RadarImageData.data[i + 2] = B;
		RadarImageData.data[i + 3] = A;
	}

	// rewrite the image
	RadarContext.putImageData(RadarImageData, 0, 0);
};

const MergeDopplerRadarImage = (MapContext, RadarContext) => {
	const MapImageData = MapContext.getImageData(0, 0, MapContext.canvas.width, MapContext.canvas.height);
	const RadarImageData = RadarContext.getImageData(0, 0, RadarContext.canvas.width, RadarContext.canvas.height);

	// examine every pixel,
	// change any old rgb to the new-rgb
	for (let i = 0; i < RadarImageData.data.length; i += 4) {
		// i + 0 = red
		// i + 1 = green
		// i + 2 = blue
		// i + 3 = alpha (0 = transparent, 255 = opaque)

		// is this pixel the old rgb?
		if ((MapImageData.data[i] < 116 && MapImageData.data[i + 1] < 116 && MapImageData.data[i + 2] < 116)) {
			// Transparent
			RadarImageData.data[i] = 0;
			RadarImageData.data[i + 1] = 0;
			RadarImageData.data[i + 2] = 0;
			RadarImageData.data[i + 3] = 0;
		}
	}

	RadarContext.putImageData(RadarImageData, 0, 0);
	MapContext.drawImage(RadarContext.canvas, 0, 0);
};

const Progress = function (e) {
	const WeatherParameters = e.WeatherParameters;

	this.CurrentConditions = LoadStatuses.Loading;
	this.WordedForecast = LoadStatuses.Loading;
	this.FourDayForecast = LoadStatuses.Loading;
	this.TravelForecast = LoadStatuses.Loading;
	this.NearbyConditions = LoadStatuses.Loading;
	this.CurrentRegionalMap = LoadStatuses.Loading;
	this.TomorrowsRegionalMap = LoadStatuses.Loading;
	this.Almanac = LoadStatuses.Loading;
	this.DopplerRadar = LoadStatuses.Loading;
	this.Hazards = LoadStatuses.Loading;

	this.Loaded = false;

	const _self = this;

	const canvas = canvasProgress[0];
	const context = canvas.getContext('2d');
	let gifProgress;

	const _ProgressInterval = window.setInterval(() => {
		if (!_self.Loaded) return;
		if (!gifProgress) return;

		const ProgressPercent = _self.GetTotalPercentage();
		divProgress.html(ProgressPercent.toString());

		gifProgress.get_canvas().width = (ProgressPercent / 100) * 530 + 1;

		if (ProgressPercent > 0) {
			gifProgress.setX(53);
			gifProgress.setY(430);
		}

		_DisplayLoadingDetails();
		AssignPlayMsOffsets(true);

		if (ProgressPercent >= 100) {
			gifProgress.pause();
			window.clearInterval(_ProgressInterval);
			if (typeof _CallBack === 'function') _CallBack({ Status: 'LOADED', LastUpdate: new Date() });
		}

	}, 250);

	const _DisplayLoadingDetails = () => {
		context.drawImage(BackGroundImage, 0, 100, 640, 300, 0, 100, 640, 300);
		DrawHorizontalGradientSingle(context, 0, 90, 52, 399, _SideColor1, _SideColor2);
		DrawHorizontalGradientSingle(context, 584, 90, 640, 399, _SideColor1, _SideColor2);

		let OffsetY = 120;
		const __DrawText = (caption, status) => {
			let StatusText;
			let StatusColor;

			const Dots = Array(120 - Math.floor(caption.length * 2.5)).join('.');
			DrawText(context, 'Star4000 Extended', '19pt', '#ffffff', 70, OffsetY, caption + Dots, 2);

			// Erase any dots that spill into the status text.
			context.drawImage(BackGroundImage, 475, OffsetY - 20, 165, 30, 475, OffsetY - 20, 165, 30);
			DrawHorizontalGradientSingle(context, 584, 90, 640, 399, _SideColor1, _SideColor2);

			switch (status) {
			case LoadStatuses.Loading:
				StatusText = 'Loading';
				StatusColor = '#ffff00';
				break;
			case LoadStatuses.Loaded:
				//StatusText = "Loaded";
				StatusText = 'Press Here';
				StatusColor = '#00ff00';

				if (caption === 'Hazardous Weather') {
					StatusColor = '#ff0000';
				}

				context.drawImage(BackGroundImage, 440, OffsetY - 20, 75, 25, 440, OffsetY - 20, 75, 25);
				break;
			case LoadStatuses.Failed:
				StatusText = 'Failed';
				StatusColor = '#ff0000';
				break;
			case LoadStatuses.NoData:
				StatusText = 'No Data';
				StatusColor = '#C0C0C0';
				DrawBox(context, 'rgb(33, 40, 90)', 475, OffsetY - 15, 75, 15);
				break;
			default:
			}
			DrawText(context, 'Star4000 Extended', '19pt', StatusColor, 565, OffsetY, StatusText, 2, 'end');

			OffsetY += 29;
		};

		__DrawText('Current Conditions', WeatherParameters.Progress.CurrentConditions);
		__DrawText('Latest Observations', WeatherParameters.Progress.NearbyConditions);
		__DrawText('Travel Forecast', WeatherParameters.Progress.TravelForecast);
		__DrawText('Regional Forecast', WeatherParameters.Progress.TomorrowsRegionalMap);
		__DrawText('Regional Observations', WeatherParameters.Progress.CurrentRegionalMap);
		__DrawText('Local Forecast', WeatherParameters.Progress.WordedForecast);
		__DrawText('Extended Forecast', WeatherParameters.Progress.FourDayForecast);
		__DrawText('Almanac', WeatherParameters.Progress.Almanac);
		__DrawText('Local Radar', WeatherParameters.Progress.DopplerRadar);
		__DrawText('Hazardous Weather', WeatherParameters.Progress.Hazards);

		UpdateWeatherCanvas(WeatherParameters, $(canvas));

	};

	this.GetTotalPercentage = function() {
		let Percentage = 0;
		let IncreaseAmount = 10;

		if (this.CurrentConditions !== LoadStatuses.Loading) Percentage += IncreaseAmount;
		if (this.WordedForecast !== LoadStatuses.Loading) Percentage += IncreaseAmount;
		if (this.FourDayForecast !== LoadStatuses.Loading) Percentage += IncreaseAmount;
		if (this.TravelForecast !== LoadStatuses.Loading) Percentage += IncreaseAmount;
		if (this.NearbyConditions !== LoadStatuses.Loading) Percentage += IncreaseAmount;
		if (this.CurrentRegionalMap !== LoadStatuses.Loading) Percentage += IncreaseAmount;
		if (this.TomorrowsRegionalMap !== LoadStatuses.Loading) Percentage += IncreaseAmount;
		if (this.Almanac !== LoadStatuses.Loading) Percentage += IncreaseAmount;
		if (this.DopplerRadar !== LoadStatuses.Loading) Percentage += IncreaseAmount;
		if (this.Hazards !== LoadStatuses.Loading) Percentage += IncreaseAmount;

		return Percentage;
	};

	let BackGroundImage;

	this.DrawProgress = async () => {
		const DontLoadGifs = _DontLoadGifs;

		BackGroundImage = await utils.loadImg('images/BackGround1_1.png');
		_self.Loaded = false;

		if (!DontLoadGifs || !gifProgress) {
			// Conditions Icon
			gifProgress = await utils.SuperGifAsync({
				src: 'images/Progress1.gif',
				loop_delay: 100,
				auto_play: true,
				canvas: canvas,
				x: 50,
				y: 480,
			});
		}

		context.drawImage(BackGroundImage, 0, 0);
		DrawHorizontalGradientSingle(context, 0, 30, 500, 90, _TopColor1, _TopColor2);
		DrawTriangle(context, 'rgb(28, 10, 87)', 500, 30, 450, 90, 500, 90);

		canvasBackGroundDateTime[0].getContext('2d').drawImage(canvas, 410, 30, 175, 60, 0, 0, 175, 60);
		canvasBackGroundCurrentConditions[0].getContext('2d').drawImage(canvas, 0, 405, 640, 75, 0, 0, 640, 75);

		DrawTitleText(context, 'WeatherStar', '4000+ 2.00');

		// Draw a box for the progress.
		DrawBox(context, '#000000', 51, 428, 534, 22);
		DrawBox(context, '#ffffff', 53, 430, 530, 18);

		_DisplayLoadingDetails();

		UpdateWeatherCanvas(WeatherParameters, canvasProgress);

		_self.Loaded = true;

		if (DontLoadGifs === false)e.OnLoad();

	};
	this.DrawProgress();
};


const SmoothingEnabled = (context, enable) => {
	context.imageSmoothingEnabled = enable;
	context.webkitImageSmoothingEnabled = enable;
	context.mozImageSmoothingEnabled = enable;
	context.msImageSmoothingEnabled = enable;
	context.oImageSmoothingEnabled = enable;
};

const UpdateWeatherCanvases = function (WeatherParameters) {
	// skip if parameters not loaded
	if (WeatherParameters === null) return;

	WeatherParameters.WeatherCanvases.forEach((WeatherCanvas) => {
		// find the foreground canvas
		// Attempt to save battery/cpu.
		if (document.elementFromPoint(0, 0) !== WeatherCanvas[0]) return;
		UpdateWeatherCanvas(WeatherParameters, WeatherCanvas);
	});

	if (WeatherParameters.Progress.GetTotalPercentage() === 100) {
		_UpdateWeatherCurrentConditionCounterMs += _UpdateWeatherUpdateMs;
		_UpdateCustomScrollTextMs += _UpdateWeatherUpdateMs;
	}
};

const UpdateWeatherCanvas = (WeatherParameters, Canvas) => {
	let OkToDrawCurrentConditions = true;
	let OkToDrawNoaaImage = true;
	let OkToDrawCurrentDateTime = true;
	let OkToDrawLogoImage = true;
	let OkToDrawCustomScrollText = false;
	let bottom = undefined;

	const context = Canvas[0].getContext('2d');

	// visibility tests
	if (_ScrollText !== '') OkToDrawCustomScrollText = true;
	if (Canvas[0] === canvasAlmanac[0]) OkToDrawNoaaImage = false;
	if (Canvas[0] === canvasAlmanacTides[0]) OkToDrawNoaaImage = false;
	if (Canvas[0] === canvasOutlook[0]) OkToDrawNoaaImage = false;
	if (Canvas[0] === canvasMarineForecast[0])OkToDrawNoaaImage = false;
	if (Canvas[0] === canvasAirQuality[0]) OkToDrawNoaaImage = false;
	if (Canvas[0] === canvasTravelForecast[0]) OkToDrawNoaaImage = false;
	if (Canvas[0] === canvasRegionalForecast1[0])OkToDrawNoaaImage = false;
	if (Canvas[0] === canvasRegionalForecast2[0]) OkToDrawNoaaImage = false;
	if (Canvas[0] === canvasRegionalObservations[0]) OkToDrawNoaaImage = false;
	if (Canvas[0] === canvasLocalRadar[0]) {
		OkToDrawCurrentConditions = false;
		OkToDrawCurrentDateTime = false;
		OkToDrawNoaaImage = false;
		OkToDrawCustomScrollText = false;
	}
	if (Canvas[0] === canvasHazards[0]) {
		OkToDrawNoaaImage = false;
		bottom = true;
		OkToDrawLogoImage = false;
	}
	// draw functions
	if (OkToDrawCurrentDateTime) DrawCurrentDateTime(context, bottom);
	if (OkToDrawLogoImage) DrawLogoImage(context);
	if (OkToDrawNoaaImage) DrawNoaaImage(context);
	if (OkToDrawCurrentConditions) DrawCurrentConditions(WeatherParameters, context);
	if (OkToDrawCustomScrollText) DrawCustomScrollText(WeatherParameters, context);
};

const DrawCurrentDateTime = (context, bottom) => {
	// test if needed
	if (_WeatherParameters === null || _WeatherParameters.TimeZone === undefined) return;

	const font = 'Star4000 Small';
	const size = '24pt';
	const color = '#ffffff';
	const shadow = 2;

	// Clear the date and time area.
	if (bottom) {
		DrawBox(context, 'rgb(25, 50, 112)', 0, 389, 640, 16);
	} else {
		context.drawImage(canvasBackGroundDateTime[0], 0, 0, 175, 60, 410, 30, 175, 60);
	}

	// Get the current date and time.
	let now = new Date();
	now = utils.calc.DateToTimeZone(now, _WeatherParameters.TimeZone);

	//time = "11:35:08 PM";
	let h = now.getHours();
	let m = now.getMinutes();
	let s = now.getSeconds();
	let time = '';
	let x;
	let y;
	let date;

	if (_Units === Units.English) {
		if (h < 10) {
			if (h === 0) {
				time = '12';
			} else {
				time += ' ' + h.toString();
			}
		} else if (h > 12) {
			if (h - 12 < 10) {
				time += ' ' + (h - 12).toString();
			} else {
				time += (h - 12).toString();
			}
		} else {
			time += h.toString();
		}
	} else if (_Units === Units.Metric) {
		if (h < 10) {
			time += ' ' + h.toString();
		} else {
			time += h.toString();
		}
	}

	time += ':';
	if (m < 10) time += '0';
	time += m.toString() + ':';
	if (s < 10) time += '0';
	time += s.toString() + ' ';

	if (_Units === Units.English) {
		if (h >= 12) {
			time += 'PM';
		} else {
			time += 'AM';
		}
	}

	if (bottom) {
		x = 400;
		y = 402;
	} else {
		x = 410;
		y = 65;
	}
	if (_Units === Units.Metric) {
		x += 45;
	}

	DrawText(context, font, size, color, x, y, time, shadow); //y += 20;

	if (_Units === Units.English) {
		date = ' ';
		const W = now.getDayShortName().toUpperCase();
		date += W + ' ';
		const M = now.getMonthShortName().toUpperCase();
		date += M + ' ';
		const D = now.getDate();
		if (D < 10) date += ' ';
		//date += " " + D.toString();
		date += D.toString();
	} else {
		date = ' ';
		const W = now.getDayShortName().toUpperCase();
		date += W + ' ';
		const D = now.getDate();
		if (D < 10) date += ' ';
		date += D.toString();
		const M = now.getMonthShortName().toUpperCase();
		date += ' ' + M;
	}

	if (bottom) {
		x = 55;
		y = 402;
	} else {
		x = 410;
		y = 85;
	}
	DrawText(context, font, size, color, x, y, date, shadow);
};

const DrawNoaaImage = async (context) => {
	// load the image and store locally
	if (!DrawNoaaImage.image) {
		DrawNoaaImage.image = utils.loadImg('images/noaa5.gif');
	}
	// wait for the image to load completely
	const img = await DrawNoaaImage.image;
	context.drawImage(img, 356, 39);
};

const DrawLogoImage = async (context) => {
	// load the image and store locally
	if (!DrawLogoImage.image) {
		DrawLogoImage.image = utils.loadImg('images/Logo3.png');
	}
	// wait for the image load completely
	const img = await DrawLogoImage.image;
	context.drawImage(img, 50, 30, 85, 67);
};

var DrawCurrentConditions = function (WeatherParameters, context) {
	var Humidity;
	var DewPoint;
	var Temperature;
	var TemperatureUnit;
	var HeatIndex;
	var WindChill;
	var Pressure;
	var PressureDirection;
	var WindSpeed;
	var WindDirection;
	var WindGust;
	var WindUnit;
	var Visibility;
	var VisibilityUnit;
	var Ceiling;
	var CeilingUnit;
	var PrecipitationTotal;
	var PrecipitationTotalUnit;

	var font, size, color, x, y, shadow;
	var text;

	font = 'Star4000';
	size = '24pt';
	color = '#ffffff';
	shadow = 2;
	x = 70;
	y = 430;

	if (WeatherParameters.Progress.GetTotalPercentage() !== 100) {
		return;
	}

	// Clear the date and time area.
	context.drawImage(canvasBackGroundCurrentConditions[0], 0, 0, 640, 75, 0, 405, 640, 75);

	var WeatherCurrentConditions = WeatherParameters.WeatherCurrentConditions;
	var WeatherMonthlyTotals = WeatherParameters.WeatherMonthlyTotals;

	switch (_Units) {
	case Units.English:
		Temperature = WeatherCurrentConditions.Temperature;
		TemperatureUnit = 'F';
		HeatIndex = WeatherCurrentConditions.HeatIndex;
		WindChill = WeatherCurrentConditions.WindChill;
		Humidity = WeatherCurrentConditions.Humidity;
		DewPoint = WeatherCurrentConditions.DewPoint;
		Pressure = WeatherCurrentConditions.Pressure;
		PressureDirection = WeatherCurrentConditions.PressureDirection;
		WindSpeed = WeatherCurrentConditions.WindSpeed;
		WindGust = WeatherCurrentConditions.WindGust;
		WindDirection = WeatherCurrentConditions.WindDirection;
		WindUnit = ' MPH';
		VisibilityUnit = ' mi.';
		Visibility = WeatherCurrentConditions.Visibility;
		Ceiling = WeatherCurrentConditions.Ceiling;
		CeilingUnit = ' ft.';
		PrecipitationTotal = WeatherMonthlyTotals.PrecipitationTotal;
		PrecipitationTotalUnit = ' in';
		break;

	case Units.Metric:
		Temperature = WeatherCurrentConditions.TemperatureC;
		TemperatureUnit = 'C';
		HeatIndex = WeatherCurrentConditions.HeatIndexC;
		WindChill = WeatherCurrentConditions.WindChillC;
		Humidity = WeatherCurrentConditions.Humidity;
		DewPoint = WeatherCurrentConditions.DewPointC;
		Pressure = WeatherCurrentConditions.PressureC;
		PressureDirection = WeatherCurrentConditions.PressureDirection;
		WindSpeed = WeatherCurrentConditions.WindSpeedC;
		WindGust = WeatherCurrentConditions.WindGustC;
		WindDirection = WeatherCurrentConditions.WindDirection;
		WindUnit = ' KPH';
		VisibilityUnit = ' km.';
		Visibility = WeatherCurrentConditions.VisibilityC;
		Ceiling = WeatherCurrentConditions.CeilingC;
		CeilingUnit = ' m.';
		PrecipitationTotal = WeatherMonthlyTotals.PrecipitationTotalC;
		PrecipitationTotalUnit = ' cm';
		break;
	default:
	}

	if (_UpdateWeatherCurrentConditionCounterMs >= 4000) {
		_UpdateWeatherCurrentConditionCounterMs = 0;
		_UpdateWeatherCurrentConditionType++;
		if (_UpdateWeatherCurrentConditionType > CurrentConditionTypes.MonthPrecipitation) {
			_UpdateWeatherCurrentConditionType = CurrentConditionTypes.Title;
		}
	}

	switch(_UpdateWeatherCurrentConditionType) {
	case CurrentConditionTypes.Title:
		text = 'Conditions at ' + WeatherCurrentConditions.StationName.substr(0, 20); // mjb 06/01/19
		break;
	case CurrentConditionTypes.Conditions:
		text = WeatherCurrentConditions.Conditions;
		break;
	case CurrentConditionTypes.Temperature:
		text = 'Temp: ' + Temperature + String.fromCharCode(176) + TemperatureUnit;
		if (HeatIndex !== Temperature) {
			text += '    ';
			text += 'Heat Index: ' + HeatIndex + String.fromCharCode(176) + TemperatureUnit;
		} else if (WindChill !== '' && WindChill < Temperature) {
			text += '    ';
			text += 'Wind Chill: ' + WindChill + String.fromCharCode(176) + TemperatureUnit;
		}
		break;
	case CurrentConditionTypes.HumidityDewpoint:
		text = 'Humidity: ' + Humidity + '%';
		text += '  ';
		text += 'Dewpoint: ' + DewPoint + String.fromCharCode(176) + TemperatureUnit;
		break;
	case CurrentConditionTypes.BarometricPressure:
		text = 'Barometric Pressure: ' + Pressure + ' ' + PressureDirection;
		break;
	case CurrentConditionTypes.Wind:
		if (WindSpeed > 0) {
			text = 'Wind: ' + WindDirection + ' ' + WindSpeed + WindUnit;
		} else if (WindSpeed === 'NA') {
			text = 'Wind: NA';
		} else {
			text = 'Wind: Calm';
		}
		if (WindGust !== '') {
			text += '  ';
			text += 'Gusts to ' + WindGust;
		}
		break;
	case CurrentConditionTypes.VisibilityCeiling:
		text = 'Visib: ' + parseInt(Visibility).toString() + VisibilityUnit;
		text += '  ';
		text += 'Ceiling: ' + (Ceiling === '' ? 'Unlimited' : Ceiling + CeilingUnit);
		break;
	case CurrentConditionTypes.MonthPrecipitation:
		if (PrecipitationTotal.toString() === '') {
			_UpdateWeatherCurrentConditionCounterMs += 4000;
			DrawCurrentConditions(WeatherParameters, context);
			return;
		}

		// mjb 10/02/19 Begin
		//text = WeatherMonthlyTotals.MonthName + " Precipitation: " + PrecipitationTotal.toString() + PrecipitationTotalUnit;

		if (PrecipitationTotal.toString() === 'T') {
			text = WeatherMonthlyTotals.MonthName + ' Precipitation: Trace';
		} else {
			text = WeatherMonthlyTotals.MonthName + ' Precipitation: ' + PrecipitationTotal.toString() + PrecipitationTotalUnit;
		}

		// mjb 10/02/19 End
		break;
	default:
	}

	// Draw the current condition.
	DrawText(context, font, size, color, x, y, text, shadow);

	//_UpdateWeatherCurrentConditionCounterMs += _UpdateWeatherUpdateMs;
	//console.log(_UpdateWeatherUpdateMs);
};

const DrawCustomScrollText = (WeatherParameters, context) => {
	const font = 'Star4000';
	const size = '24pt';
	const color = '#ffffff';
	const shadow = 2;
	let x = 640;
	const y = 430;

	if (WeatherParameters.Progress.GetTotalPercentage() !== 100) {
		return;
	}

	// Clear the date and time area.
	context.drawImage(canvasBackGroundCurrentConditions[0], 0, 0, 640, 75, 0, 405, 640, 75);

	const text = _ScrollText;
	//text = "WELCOME TO THE WEATHER STAR 4000+! IF YOU ARE ENJOYING THIS SITE THEN YOU WILL LOVE THE WEATHER STAR 4000 SIMULATOR!";
	//text = "Hello World!";
	//text = "A";

	x = 640 - ((_UpdateCustomScrollTextMs / _UpdateWeatherUpdateMs) * 5);
	// Wait an extra 5 characters.
	if (x < ((text.length + 10) * 15 * -1)) {
		_UpdateCustomScrollTextMs = 0;
		x = 640;
	}

	// Draw the current condition.
	DrawText(context, font, size, color, x, y, text, shadow);

};

let _CallBack = null;

var SetCallBack = (e) => _CallBack = e.CallBack;

const Units = {
	English: 0,
	Metric: 1,
};
var _Units = Units.English;

var _ScrollText = '';

var _DontLoadGifs = false;
var _RefreshGifs = false;

var AssignUnits = (e) => {
	switch (e.Units) {
	case 'ENGLISH':
		_Units = Units.English;
		break;
	case 'METRIC':
		_Units = Units.Metric;
		break;
	default:
	}

	RefreshSegments();
};

const RefreshSegments = () => {
	_DontLoadGifs = true;

	if (_WeatherParameters)  _WeatherParameters.Progress.DrawProgress();

	PopulateCurrentConditions(_WeatherParameters);
	PopulateRegionalObservations(_WeatherParameters);
	PopulateExtendedForecast(_WeatherParameters, 1);
	PopulateExtendedForecast(_WeatherParameters, 2);
	PopulateAlmanacInfo(_WeatherParameters);
	PopulateTideInfo(_WeatherParameters);
	PopulateOutlook(_WeatherParameters);
	PopulateMarineForecast(_WeatherParameters);
	PopulateAirQuality(_WeatherParameters);
	PopulateTravelCities(_WeatherParameters);
	ShowRegionalMap(_WeatherParameters, true);
	ShowRegionalMap(_WeatherParameters, false, true);
	ShowRegionalMap(_WeatherParameters);
	PopulateLocalForecast(_WeatherParameters);
	PopulateHazardConditions(_WeatherParameters);
	UpdateWeatherCanvases(_WeatherParameters);

	_DontLoadGifs = false;

	_RefreshGifs = true;
	window.setTimeout(() => _RefreshGifs = false, 200);
};

var AudioPlayToggle = () => {
	_IsAudioPlaying = !(_IsAudioPlaying);

	if (_IsAudioPlaying) {
		_AudioPlayIntervalId = window.setIntervalWorker(function () {
			if (_WeatherParameters.Progress.GetTotalPercentage() !== 100) return;

			window.clearIntervalWorker(_AudioPlayIntervalId);
			_AudioPlayIntervalId = null;

			if (_AudioContext === null && audMusic.attr('src') === '') {
				LoadAudio(GetNextMusicUrl());
				return;
			}
			PlayAudio();

		}, _AudioPlayInterval);
	} else {
		if (_AudioPlayIntervalId) {
			window.clearIntervalWorker(_AudioPlayIntervalId);
			_AudioPlayIntervalId = null;
		}

		//audio.pause();
		PauseAudio();
	}

	if (_CallBack) _CallBack({ Status: 'ISAUDIOPLAYING', Value: _IsAudioPlaying });

};

const IsAudioPlaying = () => {
	return _IsAudioPlaying;
};

const audMusic_OnError = () => {
	//RefreshStateOfMusicAudio();
};

const RefreshStateOfMusicAudio = () => {
	const IsAudioPlaying = _IsAudioPlaying;

	if (window.AudioContext) {
		_IsAudioPlaying = (_AudioContext.state === 'running' && _AudioDuration !== 0);
	} else {
		var audio = audMusic[0];
		_IsAudioPlaying = (audio.paused === false && _AudioDuration !== 0);
	}

	if (IsAudioPlaying !== _IsAudioPlaying) {
		if (_CallBack) _CallBack({ Status: 'ISAUDIOPLAYING', Value: _IsAudioPlaying });
	}
};

const AudioOnTimeUpdate = () => {
	if (window.AudioContext) {
		_AudioCurrentTime = _AudioContext.currentTime;
	} else {
		//audio.currentTime
		_AudioCurrentTime = audMusic[0].currentTime;
	}

	if (_IsAudioPlaying) {
		const EndingOffsetInSeconds = 3;
		let VolumeDecrementBy = 0.0;
		const IntervalMs = 50;

		VolumeDecrementBy = 1 / ((EndingOffsetInSeconds * 1000) / IntervalMs);

		if (_AudioCurrentTime >= (_AudioDuration - EndingOffsetInSeconds)) {
			if (!_AudioFadeOutIntervalId) {
				_AudioFadeOutIntervalId = window.setIntervalWorker(function () {
					var volume = VolumeAudio();
					volume -= VolumeDecrementBy;
					VolumeAudio(volume);

					if (volume <= 0) {
						window.clearIntervalWorker(_AudioFadeOutIntervalId);
						_AudioFadeOutIntervalId = null;

						if (_IsAudioPlaying) {
							LoadAudio(GetNextMusicUrl());
						}
					}
				}, IntervalMs);

			}
		}
	}

};

const PopulateMusicUrls = () => {
	_MusicUrls = [];
	_MusicUrls.push('Audio/Andrew Korus - Hello There.mp3');
	_MusicUrls.push('Audio/Ficara - Stormy Weather.mp3');
	_MusicUrls.push('Audio/Incognito - Larc En Ciel De Miles.mp3');
	_MusicUrls.push('Audio/Ozzie Ahlers - Fingerpainting.mp3');
	_MusicUrls.push('Audio/Ray Obiedo - Blue Kiss.mp3');
	_MusicUrls.push('Audio/Richard Tyznik - Hi Times.mp3');
	_MusicUrls.push('Audio/Torcuato Mariano - Ocean Way.mp3');
	_MusicUrls.push('Audio/Gota - All Alone.mp3');
	_MusicUrls.push('Audio/Ficara - High Tides Of Maui.mp3');
	_MusicUrls.push('Audio/Chris Camozzi - Swing Shift.mp3');
	_MusicUrls.push('Audio/Brian Hughes - StringBean.mp3');
	_MusicUrls.push('Audio/Brian Hughes - Postcard From Brazil.mp3');
	_MusicUrls.push('Audio/Brian Hughes - One 2 One.mp3');
	_MusicUrls.push('Audio/Brian Hughes - Here We Go.mp3');
	_MusicUrls.push('Audio/Brian Hughes - Three Graces.mp3');
	_MusicUrls.push('Audio/Ficara - Friends Forever.mp3');
	_MusicUrls.push('Audio/Physical Therapy - What The Flush.mp3');
	_MusicUrls.push('Audio/Trammell Starks - The Blizzard Song.mp3');
	_MusicUrls.push('Audio/Terry Coleman - Just Groovin.mp3');
	_MusicUrls.push('Audio/Terry Coleman - Autumn Dance.mp3');
	_MusicUrls.push('Audio/Terry Coleman - Amazed.mp3');
	_MusicUrls.push('Audio/Ray Obiedo - Sienna.mp3');
	_MusicUrls.push('Audio/Incognito - Sunchild.mp3');
	_MusicUrls.push('Audio/Ficara - Gliding.mp3');
	_MusicUrls.push('Audio/Ficara - Craig.mp3');
	_MusicUrls.push('Audio/Eddie Reasoner - Sea Breeze.mp3');
	_MusicUrls.push('Audio/Chris Camozzi - My Dancing Heart.mp3');
	_MusicUrls.push('Audio/Chris Camozzi - Suede.mp3');
	_MusicUrls.push('Audio/Joe Sample - Rainbow Seeker.mp3');
	_MusicUrls.push('Audio/Norman Brown - Celebration.mp3');
	_MusicUrls.push('Audio/Wayne Gerard - Aint She Sweet.mp3');
	_MusicUrls.push('Audio/Wayman Tisdale - Brazilia.mp3');
	_MusicUrls.push('Audio/The Rippingtons - In Another Life.mp3');
	_MusicUrls.push('Audio/The Rippingtons - Life In The Tropics.mp3');
	_MusicUrls.push('Audio/Chris Camozzi - Hangin Out.mp3');
	_MusicUrls.push('Audio/Bryan Savage - Two Cool.mp3');
	_MusicUrls.push('Audio/Trammell Starks - 50 Below.mp3');
	_MusicUrls.push('Audio/Trammell Starks - After Midnight.mp3');
	_MusicUrls.push('Audio/Trammell Starks - After The Rain.mp3');
	_MusicUrls.push('Audio/Trammell Starks - All I Need To Know.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Autumn Blue.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Better Than Nothing.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Bobbys Theme.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Broken Record.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Crazy Pianos.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Desert Nights.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Here Comes The Rain.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Im So Dizzy.mp3');
	_MusicUrls.push('Audio/Trammell Starks - If You Only Knew.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Just For The Moment.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Midnight Rain.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Pier 32.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Rainbeat.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Road Trip.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Rollercoaster Ride.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Round And Round.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Season On Edge.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Slightly Blued.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Someday.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Something About You.mp3');
	_MusicUrls.push('Audio/Trammell Starks - The End.mp3');
	_MusicUrls.push('Audio/Trammell Starks - The Last Song.mp3');
	_MusicUrls.push('Audio/Trammell Starks - The Mist.mp3');
	_MusicUrls.push('Audio/Trammell Starks - The Only One For Me.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Under The Influence.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Ups And Downs.mp3');
	_MusicUrls.push('Audio/Trammell Starks - Water Colors.mp3');
	_MusicUrlsTemp = _MusicUrls.slice(0);
};

const GetNextMusicUrl = () => {
	if (_MusicUrlsTemp.length < 1) { _MusicUrlsTemp = _MusicUrls.slice(0); }
	const index = Math.floor(Math.random() * _MusicUrlsTemp.length);
	const item = _MusicUrlsTemp[index];
	_MusicUrlsTemp.splice(index, 1);
	return item;
};

const LoadAudio = async (Url) => {
	if (_AudioRefreshIntervalId) {
		window.clearIntervalWorker(_AudioRefreshIntervalId);
		_AudioRefreshIntervalId = null;
	}

	if (window.AudioContext) {
		if (_AudioContext) {
			_AudioContext.close();
			_AudioContext = null;
		}
		if (_AudioBufferSource) {
			_AudioBufferSource.stop();
			_AudioBufferSource = null;
		}
		_AudioContext = new AudioContext();
		_AudioDuration = 0;
		_AudioCurrentTime = 0;

		const audioData = await $.ajax({
			type: 'GET',
			url: Url,
			xhr: () => {
				const xhr = new XMLHttpRequest();
				xhr.responseType = 'arraybuffer';
				return xhr;
			},
		});

		//decode the loaded data
		_AudioContext.decodeAudioData(audioData, (buffer) => {
			//create a source node from the buffer
			_AudioBufferSource = _AudioContext.createBufferSource();
			_AudioBufferSource.buffer = buffer;

			_AudioDuration = buffer.duration;
			_AudioCurrentTime = 0;

			//create a gain node
			_AudioGain = _AudioContext.createGain();
			_AudioBufferSource.connect(_AudioGain);
			_AudioGain.connect(_AudioContext.destination);
			_AudioGain.gain.value = 1.00;

			_AudioBufferSource.start();
			_AudioContext.resume();

			_AudioRefreshIntervalId = window.setIntervalWorker(function () {
				AudioOnTimeUpdate();
				RefreshStateOfMusicAudio();
			}, 500);
		});


	} else {
		var audio = audMusic[0];

		PauseAudio();

		_AudioDuration = 0;
		_AudioCurrentTime = 0;

		audio.volume = 1.00;
		audio.oncanplaythrough = () => {
			_AudioDuration = audio.duration;
			_AudioCurrentTime = 0;

			PlayAudio();

			_AudioRefreshIntervalId = window.setIntervalWorker(() => {
				AudioOnTimeUpdate();
				RefreshStateOfMusicAudio();
			}, 500);

		};
		audio.src = Url;
		audio.load();
	}
};

const PlayAudio = () => {
	if (window.AudioContext) {
		if (_AudioDuration !== 0) {
			_AudioContext.resume();
		}
	} else {
		var audio = audMusic[0];
		audio.play();
	}
};

const PauseAudio = () => {
	if (window.AudioContext) {
		if (_AudioDuration !== 0) {
			//_AudioBufferSource.stop();
			_AudioContext.suspend();
		}
	} else {
		var audio = audMusic[0];
		audio.pause();
	}
};

const VolumeAudio = (vol) => {
	let volume = -1;

	if (window.AudioContext) {
		if (_AudioGain) {
			if (vol !== undefined) {
				_AudioGain.gain.value = vol;
			}

			volume =_AudioGain.gain.value;
		}
	} else {
		let audio = audMusic[0];
		if (vol !== undefined) {
			audio.volume = vol;
		}

		volume = audio.volume;
	}

	return volume;
};

var NarrationPlayToggle = () => {
	_IsNarrationPlaying = !(_IsNarrationPlaying);
	let _NarrationPlayIntervalId;

	if (_IsNarrationPlaying) {
		if (!window.speechSynthesis) {
			_IsNarrationPlaying = false;
			return;
		}

		if (_OperatingSystem === OperatingSystems.iOS) {
			_IsNarrationPlaying = false;
			return;
		}

		_NarrationPlayIntervalId = window.setIntervalWorker(() => {

			window.clearIntervalWorker(_NarrationPlayIntervalId);
			_NarrationPlayIntervalId = null;

			_Utterance = new SpeechSynthesisUtterance();

			_Utterance.lang = 'en-US';
			_Utterance.volume = 1.0;
			_Utterance.rate = 0.9;
			_Utterance.pitch = 1.0;
			SpeakUtterance();

		}, 100);
	} else {
		if (_NarrationPlayIntervalId) {
			window.clearIntervalWorker(_NarrationPlayIntervalId);
			_NarrationPlayIntervalId = null;
		}
		if (window.speechSynthesis.speaking) {
			window.speechSynthesis.cancel();
		}
		_IsSpeaking = false;
	}

	if (_CallBack) _CallBack({ Status: 'ISNARRATIONPLAYING', Value: _IsNarrationPlaying });

};

var IsNarrationPlaying = () => _IsNarrationPlaying;

const SpeakUtterance = () => {
	if (_IsNarrationPlaying === false) return;

	const CurrentUtteranceId = new Date().getTime();
	_CurrentUtteranceId = CurrentUtteranceId;

	if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();

	const Text = GetNarrationText();
	if (Text === '') return;

	console.log(`Speak Utterance: '${Text}'`);

	const Sentences = Text.split('.');
	let SentenceIndex = -1;

	const SpeakNextSentence = () => {
		if (_IsNarrationPlaying === false) {
			console.log('_IsNarrationPlaying === false.');
			_IsSpeaking = false;
			return;
		}

		if (CurrentUtteranceId !== _CurrentUtteranceId) {
			console.log(`CurrentUtteranceId (${CurrentUtteranceId}) !== _CurrentUtteranceId (${_CurrentUtteranceId})`);
			return;
		}

		SentenceIndex++;
		if (SentenceIndex > Sentences.length - 1) {
			console.log('Narration Finished.');
			_IsSpeaking = false;
			return;
		}

		const Sentence = Sentences[SentenceIndex];

		_CurrentUtterance = new SpeechSynthesisUtterance();
		_CurrentUtterance.text = Sentence;
		_CurrentUtterance.onend = SpeakNextSentence;
		_CurrentUtterance.rate = _Utterance.rate;
		_CurrentUtterance.pitch = _Utterance.pitch;
		_CurrentUtterance.volume = _Utterance.volume;

		window.speechSynthesis.speak(_CurrentUtterance);
		console.log(`Speaking '${Sentence}'`);
		_IsSpeaking = true;
	};

	setTimeout(SpeakNextSentence, 500);

};

const GetNarrationText = () => {
	const CanvasType = Math.floor(_CurrentPosition);
	const SubCanvasType = Math.round2((_CurrentPosition - CanvasType), 1) * 10;

	let Text = '';

	switch (CanvasType) {
	case CanvasTypes.CurrentWeather:
		{const WeatherCurrentConditions = _WeatherParameters.WeatherCurrentConditions;


			let Temperature = WeatherCurrentConditions.Temperature;
			let HeatIndex = WeatherCurrentConditions.HeatIndex;
			let WindChill = WeatherCurrentConditions.WindChill;
			let Humidity = WeatherCurrentConditions.Humidity;
			let DewPoint = WeatherCurrentConditions.DewPoint;
			let Pressure = WeatherCurrentConditions.Pressure;
			let PressureDirection = WeatherCurrentConditions.PressureDirection;
			let PressureUnit = ' inches ';
			let WindSpeed = WeatherCurrentConditions.WindSpeed;
			let WindGust = WeatherCurrentConditions.WindGust;
			let WindDirection = WeatherCurrentConditions.WindDirection;
			let WindUnit = ' miles per hour ';
			let VisibilityUnit = ' miles ';
			let Visibility = WeatherCurrentConditions.Visibility;
			let Ceiling = WeatherCurrentConditions.Ceiling;
			let CeilingUnit = ' feet ';
			if (_Units === Units.Metric) {
				Temperature = WeatherCurrentConditions.TemperatureC.toString();
				HeatIndex = WeatherCurrentConditions.HeatIndexC.toString();
				WindChill = WeatherCurrentConditions.WindChillC.toString();
				Humidity = WeatherCurrentConditions.Humidity.toString();
				DewPoint = WeatherCurrentConditions.DewPointC.toString();
				Pressure = WeatherCurrentConditions.PressureC.toString();
				PressureDirection = WeatherCurrentConditions.PressureDirection;
				PressureUnit = ' millibars ';
				WindSpeed = WeatherCurrentConditions.WindSpeedC.toString();
				WindGust = WeatherCurrentConditions.WindGustC.toString();
				WindDirection = WeatherCurrentConditions.WindDirection;
				WindUnit = ' kilometers per hour ';
				VisibilityUnit = ' kilometers ';
				Visibility = WeatherCurrentConditions.VisibilityC.toString();
				Ceiling = WeatherCurrentConditions.CeilingC.toString();
				CeilingUnit = ' meters ';

			}

			Text += `The current conditions at ${WeatherCurrentConditions.StationName}. `;
			Text += WeatherCurrentConditions.Conditions + '. ';
			Text += Temperature.toString().replaceAll('.', ' point ') + ' degrees ';

			if (HeatIndex !== Temperature) {
				Text += 'with a heat index of ' + HeatIndex.toString().replaceAll('.', ' point ') + ' degrees ';
			} else if (WindChill !== '' && WindChill < Temperature) {
				Text += 'with a wind chill of ' + WindChill.toString().replaceAll('.', ' point ') + ' degrees';
			}
			Text += '. ';

			if (WindSpeed > 0) {
				Text += 'Winds ' + GetWindDirectionWords(WindDirection) + ' at ' + WindSpeed + WindUnit;
			} else if (WindSpeed === 'NA') {
				Text += 'Winds are not available ';
			} else {
				Text += 'Winds are calm ';
			}
			if (WindGust !== '') {
				Text += ' gusts to ' + WindGust;
			}
			Text += '. ';

			Text += 'Humidity is ' + Humidity.toString() + ' percent. ';
			Text += 'Dewpoint is ' + DewPoint.toString().replaceAll('.', ' point ') + ' degrees. ';

			Text += 'Ceiling  is ' + (Ceiling === '' ? 'Unlimited' : Ceiling + CeilingUnit) + '. ';
			Text += 'Visibility is ' + parseInt(Visibility).toString() + VisibilityUnit + '. ';

			Text += 'Barometric Pressure is ' + Pressure.replaceAll('.', ' point ') + ' ' + PressureUnit + ' and ';
			switch (PressureDirection) {
			case 'R':
				Text += 'rising';
				break;
			case 'F':
				Text += 'falling';
				break;
			default:
			}
			Text += '. ';}

		break;

	case CanvasTypes.LatestObservations:
		{const WeatherCurrentRegionalConditions = _WeatherParameters.WeatherCurrentRegionalConditions;
			const SortedArray = WeatherCurrentRegionalConditions.SortedArray;

			Text += 'Latest observations for the following cities. ';

			$(SortedArray).each(function () {
				const WeatherCurrentCondition = this;


				let Temperature = WeatherCurrentCondition.Temperature;
				let WindSpeed = WeatherCurrentCondition.WindSpeed;
				let WindUnit = ' miles per hour ';

				if (_Units === Units.Metric) {
					Temperature = Math.round(WeatherCurrentCondition.TemperatureC);
					WindSpeed = WeatherCurrentCondition.WindSpeedC;
					WindUnit = ' kilometers per hour ';
				}

				Text += WeatherCurrentCondition.StationName + ' ';
				Text += WeatherCurrentCondition.Conditions + '. ';
				Text += Temperature.toString().replaceAll('.', ' point ') + ' degrees ';

				if (WeatherCurrentCondition.WindSpeed > 0) {
					Text += ' with Winds ' + GetWindDirectionWords(WeatherCurrentCondition.WindDirection) + ' at ' + WindSpeed.toString() + ' ' + WindUnit + ' ';
				} else {
					Text += ' with Calm Winds ';
				}

				Text += '. ';

			});}

		break;

	case CanvasTypes.ExtendedForecast1:
	case CanvasTypes.ExtendedForecast2:
		{	const WeatherExtendedForecast = _WeatherParameters.WeatherExtendedForecast;

			Text += 'Extended Forecast. ';

			let LBound;
			let UBound;
			switch (CanvasType) {
			case CanvasTypes.ExtendedForecast1:
				LBound = 0;
				UBound = 2;
				break;
			case CanvasTypes.ExtendedForecast2:
				LBound = 3;
				UBound = 5;
				break;
			default:
			}

			$(WeatherExtendedForecast.Day).each(function (Index) {
				if (Index < LBound || Index > UBound) return true;

				const Day = this;
				let MinimumTemperature = Day.MinimumTemperature;
				let MaximumTemperature = Day.MaximumTemperature;

				if (_Units === Units.Metric) {
					MinimumTemperature = Math.round(Day.MinimumTemperatureC);
					MaximumTemperature = Math.round(Day.MaximumTemperatureC);
				}

				Text += Day.DayName + ' ';
				Text += Day.Conditions + '. ';
				Text += ' with a high of ' + MaximumTemperature.toString().replaceAll('.', ' point ') + ' ';
				Text += ' and a low of ' + MinimumTemperature.toString().replaceAll('.', ' point ') + ' ';
				Text += '. ';
			});
		}
		break;

	case CanvasTypes.Almanac:
	{	const AlmanacInfo = _WeatherParameters.AlmanacInfo;
		const Today = DateTime.local();
		const Tomorrow = Today.plus({days: 1});

		if (isNaN(AlmanacInfo.TodaySunRise)) {
			Text += 'No sunrise for ' + Today.getDayName() + ' ';
		} else {
			Text += 'Sunrise for ' + Today.getDayName() + ' is at ' + AlmanacInfo.TodaySunRise.getFormattedTime() + ' ';
		}
		if (isNaN(AlmanacInfo.TodaySunSet)) {
			Text += 'no setset. ';
		} else {
			Text += 'sunset is at ' + AlmanacInfo.TodaySunSet.getFormattedTime() + '. ';
		}

		if (isNaN(AlmanacInfo.TomorrowSunRise)) {
			Text += 'No sunrise for ' + Tomorrow.getDayName() + ' ';
		} else {
			Text += 'Sunrise for ' + Tomorrow.getDayName() + ' is at ' + AlmanacInfo.TomorrowSunRise.getFormattedTime() + ' ';
		}
		if (isNaN(AlmanacInfo.TomorrowSunSet)) {
			Text += 'no setset. ';
		} else {
			Text += 'sunset is at ' + AlmanacInfo.TomorrowSunSet.getFormattedTime() + '. ';
		}

		AlmanacInfo.MoonPhases.forEach(MoonPhase => {
			switch (MoonPhase.Phase) {
			case 'Full':
				Text += 'Full moon ';
				break;
			case 'Last':
				Text += 'Last quarter ';
				break;
			case 'New':
				Text += 'New moon ';
				break;
			case 'First':
				Text += 'First quarter ';
				break;
			default:
			}
			Text += 'is on ' + MoonPhase.Date.getMonthName() + ' ' + MoonPhase.Date.getDate().toString() + '. ';
		});

		Text += '. ';

		break;}

	case CanvasTypes.AlmanacTides:
		{
			const AlmanacInfo = _WeatherParameters.AlmanacInfo;
			const WeatherTides = _WeatherParameters.WeatherTides;
			let TideCounter = 0;

			WeatherTides.forEach(WeatherTide => {
				Text += WeatherTide.StationName.toLowerCase() + ' Tides. ';

				TideCounter = 0;
				Text += 'Low tides at ';
				WeatherTide.TideTypes.forEach((TideType, Index) => {
					if (TideType !== 'low') return true;

					let TideTime = WeatherTide.TideTimes[Index];
					let TideDay = WeatherTide.TideDays[Index];

					if (_Units === Units.Metric) {
						TideTime = utils.calc.TimeTo24Hour(TideTime);
					}
					TideDay = _DayLongNames[TideDay];

					Text += TideDay + ' at ' + TideTime;
					if (TideCounter === 0) {
						Text += ' and ';
					} else {
						Text += '. ';
					}
					TideCounter++;
				});

				TideCounter = 0;
				Text += 'High tides at ';
				WeatherTide.TideTypes.forEach((TideType, Index) => {
					if (TideType !== 'high') return true;

					let TideTime = WeatherTide.TideTimes[Index];
					let TideDay = WeatherTide.TideDays[Index];

					if (_Units === Units.Metric) {
						TideTime = utils.calc.TimeTo24Hour(TideTime);
					}
					TideDay = _DayLongNames[TideDay];

					Text += TideDay + ' at ' + TideTime;
					if (TideCounter === 0) {
						Text += ' and ';
					} else {
						Text += '. ';
					}
					TideCounter++;
				});

			});

			if (isNaN(AlmanacInfo.TodaySunRise)) {
				Text += 'No sunrise for today ';
			} else {
				Text += 'Sunrise for today is at ' + AlmanacInfo.TodaySunRise.getFormattedTime() + ' ';
			}
			if (isNaN(AlmanacInfo.TodaySunSet)) {
				Text += ' and no setset. ';
			} else {
				Text += ' and sunset is at ' + AlmanacInfo.TodaySunSet.getFormattedTime() + '. ';
			}
		}
		break;

	case CanvasTypes.Outlook:
		{const Outlook = _WeatherParameters.Outlook;

			Text += 'Your 30 day outlook from mid ' + _MonthLongNames[Outlook.From] + ' to mid ' + _MonthLongNames[Outlook.To] + '. ';
			Text += 'Temperatures are expected to be ' + GetOutlookDescription(Outlook.Temperature) + '. ';
			Text += 'Precipitation is expected to be ' + GetOutlookDescription(Outlook.Precipitation) + '. ';
		}
		break;

	case CanvasTypes.MarineForecast:
		{const MarineForecast = _WeatherParameters.MarineForecast;
			let WindSpeed;
			let Tide;

			Text += 'Marine Forecast. ';

			if (MarineForecast.Warning !== '') {
				Text += MarineForecast.Warning + '. ';
			}

			Text += MarineForecast.TodayDayName;

			switch (_Units) {
			case Units.English:
				WindSpeed = MarineForecast.TodayWindSpeedHigh.toString() + ' knots.';
				if (MarineForecast.TodayWindSpeedLow !== MarineForecast.TodayWindSpeedHigh) {
					WindSpeed = MarineForecast.TodayWindSpeedLow.toString() + ' to ' + WindSpeed;
				}
				break;
			default:
				WindSpeed = MarineForecast.TodayWindSpeedHighC.toString() + ' knots.';
				if (MarineForecast.TodayWindSpeedLowC !== MarineForecast.TodayWindSpeedHighC) {
					WindSpeed = MarineForecast.TodayWindSpeedLowC.toString() + ' to ' + WindSpeed;
				}
				break;
			}
			Text += ' winds ' + GetWindDirectionWords(MarineForecast.TodayWindDirection) + ' at ' + WindSpeed;

			switch (_Units) {
			case Units.English:
				Tide = MarineForecast.TodayTideHigh.toString() + ' feet. ';
				if (MarineForecast.TodayTideLow !== MarineForecast.TodayTideHigh) {
					Tide = MarineForecast.TodayTideLow.toString() + ' to ' + Tide;
				}
				break;
			default:
				Tide = MarineForecast.TodayTideHighC.toString() + ' meters. ';
				if (MarineForecast.TodayTideLowC !== MarineForecast.TodayTideHighC) {
					Tide = MarineForecast.TodayTideLowC.toString() + ' to ' + Tide;
				}
				break;
			}
			Text += ' ' + MarineForecast.SeasOrWaves.capitalize() + ' at ' + Tide;


			Text += MarineForecast.TomorrowDayName;

			switch (_Units) {
			case Units.English:
				WindSpeed = MarineForecast.TomorrowWindSpeedHigh.toString() + ' knots. ';
				if (MarineForecast.TomorrowWindSpeedLow !== MarineForecast.TomorrowWindSpeedHigh) {
					WindSpeed = MarineForecast.TomorrowWindSpeedLow.toString() + ' to ' + WindSpeed;
				}
				break;
			default:
				WindSpeed = MarineForecast.TomorrowWindSpeedHighC.toString() + ' knots. ';
				if (MarineForecast.TomorrowWindSpeedLowC !== MarineForecast.TomorrowWindSpeedHighC) {
					WindSpeed = MarineForecast.TomorrowWindSpeedLowC.toString() + ' to ' + WindSpeed;
				}
				break;
			}
			Text += ' winds ' + GetWindDirectionWords(MarineForecast.TomorrowWindDirection) + ' at ' + WindSpeed;

			switch (_Units) {
			case Units.English:
				Tide = MarineForecast.TomorrowTideHigh.toString() + ' feet. ';
				if (MarineForecast.TomorrowTideLow !== MarineForecast.TomorrowTideHigh) {
					Tide = MarineForecast.TomorrowTideLow.toString() + ' to ' + Tide;
				}
				break;
			default:
				Tide = MarineForecast.TomorrowTideHighC.toString() + ' meters. ';
				if (MarineForecast.TomorrowTideLowC !== MarineForecast.TomorrowTideHighC) {
					Tide = MarineForecast.TomorrowTideLowC.toString() + ' to ' + Tide;
				}
				break;
			}
			Text += ' ' + MarineForecast.SeasOrWaves.capitalize() + ' at ' + Tide;
		}
		break;

	case CanvasTypes.AirQuality:
		{const AirQuality = _WeatherParameters.AirQuality;

			Text = 'Air quality forecast for ' + AirQuality.Date.getDayName() + '. ';
			Text += AirQuality.City + ', ' + GetAqiDescription(AirQuality.IndexValue) + ' with an air quality index of ' + AirQuality.IndexValue.toString() + '.';
		}
		break;

	case CanvasTypes.RegionalForecast1:
	case CanvasTypes.RegionalForecast2:
		{		const Today = new Date();
			var addDays = 0;
			var IsNightTime;
			var RegionalForecastCities;

			if (CanvasType === CanvasTypes.RegionalForecast2) {
				RegionalForecastCities = _WeatherParameters.RegionalForecastCities2;

				if (Today.getHours() >= 12) {
				// Tomorrow's daytime forecast
					addDays = 1;
					Today.setHours(0, 0, 0, 0);
					IsNightTime = false;
				} else {
				// Todays's nighttime forecast
					if (Today.getHours() === 0) {
					// Prevent Midnight from causing the wrong icons to appear.
						Today.setHours(1, 0, 0, 0);
					}
					IsNightTime = true;
				}
			} else {
				RegionalForecastCities = _WeatherParameters.RegionalForecastCities1;

				if (Today.getHours() >= 12) {
				// Todays's nighttime forecast
				// Prevent Midnight from causing the wrong icons to appear.
					Today.setHours(1, 0, 0, 0);
					IsNightTime = true;
				} else {
				// Today's daytime forecast
					if (Today.getHours() === 0) {
					// Prevent Midnight from causing the wrong icons to appear.
						Today.setHours(1, 0, 0, 0);
					}
					IsNightTime = false;
				}
			}

			const Tomorrow = Today.addDays(addDays);
			var DayName = Tomorrow.getDayName();

			Text += 'Regional forecast for ' + DayName + (IsNightTime ? ' Night ' : '') + ' for the following cities. ';

			$(RegionalForecastCities).each(function () {
				var RegionalForecastCity = this;

				var RegionalCity = RegionalForecastCity.RegionalCity;
				var weatherTravelForecast = RegionalForecastCity.weatherTravelForecast;

				// City Name
				Text += RegionalCity.Name + ' ';
				Text += weatherTravelForecast.Conditions + ' ';

				// Temperature
				if (IsNightTime) {
					var MinimumTemperature;
					if (_Units === Units.English) {
						MinimumTemperature = weatherTravelForecast.MinimumTemperature.toString();
					} else {
						MinimumTemperature = Math.round(weatherTravelForecast.MinimumTemperatureC).toString();
					}
					Text += ' with a low of ' + MinimumTemperature.toString().replaceAll('.', ' point ') + '. ';
				} else {
					var MaximumTemperature;
					if (_Units === Units.English) {
						MaximumTemperature = weatherTravelForecast.MaximumTemperature.toString();
					} else {
						MaximumTemperature = Math.round(weatherTravelForecast.MaximumTemperatureC).toString();
					}
					Text += ' with a high of ' + MaximumTemperature.toString().replaceAll('.', ' point ') + '. ';
				}
			});

			Text += '. ';
		}
		break;

	case CanvasTypes.RegionalObservations:
		Text += 'Regional Observations for the following cities. ';

		$(_WeatherParameters.RegionalObservationsCities).each(function () {
			var RegionalObservationsCity = this;

			var RegionalCity = RegionalObservationsCity.RegionalCity;
			var weatherCurrentConditions = RegionalObservationsCity.weatherCurrentConditions;

			// City Name
			Text += RegionalCity.Name + ' ';
			Text += weatherCurrentConditions.Conditions + ' ';

			// Temperature
			var Temperature;
			if (_Units === Units.English) {
				Temperature = weatherCurrentConditions.Temperature.toString();
			} else {
				Temperature = Math.round(weatherCurrentConditions.TemperatureC).toString();
			}
			Text += Temperature.toString().replaceAll('.', ' point ') + '. ';

		});

		Text += '. ';

		break;

	case CanvasTypes.LocalForecast:
		var LocalForecastScreenTexts = _WeatherParameters.LocalForecastScreenTexts;
		var UpdateLocalForecastIndex = SubCanvasType;
		Text = LocalForecastScreenTexts[UpdateLocalForecastIndex];
		Text = GetVerboseText(Text);
		Text = Text.toLowerCase();
		break;

	case CanvasTypes.LocalRadar:
		Text = 'Your local radar.';
		break;

	case CanvasTypes.TravelForecast:
		var TravelCities = _WeatherParameters.TravelCities;
		var UpdateTravelCitiesIndex = SubCanvasType;

		if (UpdateTravelCitiesIndex === 0) {
			//Text += "Travel Forecast for " + TravelCities[0].WeatherTravelForecast.DayName + " for the following cities. ";
			Text += 'Travel Forecast for ' + GetTravelCitiesDayName(TravelCities) + ' for the following cities. ';
		}

		//for (var Index = (UpdateTravelCitiesIndex * 3) ; Index <= ((UpdateTravelCitiesIndex * 3) + 3) - 1; Index++)
		$(TravelCities).each(function () {
			var TravelCity = this;
			var WeatherTravelForecast = TravelCity.WeatherTravelForecast;

			Text += TravelCity.Name + ' ';

			if (WeatherTravelForecast && WeatherTravelForecast.Icon !== 'images/r/') {
				Text += WeatherTravelForecast.Conditions + ' ';

				var MinimumTemperature;
				var MaximumTemperature;

				switch (_Units) {
				case Units.English:
					MinimumTemperature = WeatherTravelForecast.MinimumTemperature.toString();
					MaximumTemperature = WeatherTravelForecast.MaximumTemperature.toString();
					break;

				default:
					MinimumTemperature = Math.round(WeatherTravelForecast.MinimumTemperatureC).toString();
					MaximumTemperature = Math.round(WeatherTravelForecast.MaximumTemperatureC).toString();
					break;
				}

				Text += ' with high of ' + MaximumTemperature.replaceAll('.', ' point ') + ' ';
				Text += ' and low of ' + MinimumTemperature.replaceAll('.', ' point ') + ' ';
			} else {
				Text += ' No travel data available ';
			}
			Text += '. ';
		});

		break;

	case CanvasTypes.Hazards:
		var WeatherHazardConditions = _WeatherParameters.WeatherHazardConditions;

		switch (_Units) {
		case Units.English:
			Text = WeatherHazardConditions.HazardsText;
			break;

		default:
			Text = WeatherHazardConditions.HazardsTextC;
			break;
		}

		Text = GetVerboseText(Text);
		Text = Text.toLowerCase();

		break;
	default:
	}

	return Text;
};

const GetVerboseText = (Text) => {
	Text = ' ' + Text;
	Text = Text.replaceAll('\n', ' ');
	Text = Text.replaceAll('*', ' ');

	Text = Text.replaceAll(' MPH', ' MILES PER HOUR');
	Text = Text.replaceAll(' KPH', ' KILOMETERS PER HOUR');
	Text = Text.replaceAll(' IN.', ' INCHES ');
	Text = Text.replaceAll(' CM.', ' CENTIMETERS ');

	Text = Text.replaceAll(' EST', ' EASTERN STANDARD TIME');
	Text = Text.replaceAll(' CST', ' CENTRAL STANDARD TIME');
	Text = Text.replaceAll(' MST', ' MOUNTAIN STANDARD TIME');
	Text = Text.replaceAll(' PST', ' PACIFIC STANDARD TIME');
	Text = Text.replaceAll(' AST', ' ALASKA STANDARD TIME');
	Text = Text.replaceAll(' AKST', ' ALASKA STANDARD TIME');
	Text = Text.replaceAll(' HST', ' HAWAII STANDARD TIME');

	//'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety
	Text = Text.replaceAll(' -0S', ' MINUS SINGLE DIGITS ');
	Text = Text.replaceAll(' -10S', ' MINUS TEENS ');
	Text = Text.replaceAll(' -20S', ' MINUS TWENTIES ');
	Text = Text.replaceAll(' -30S', ' MINUS THIRTIES ');
	Text = Text.replaceAll(' -40S', ' MINUS FORTIES ');
	Text = Text.replaceAll(' -50S', ' MINUS FIFTIES ');
	Text = Text.replaceAll(' -60S', ' MINUS SIXTIES ');
	Text = Text.replaceAll(' -70S', ' MINUS SEVENTIES ');
	Text = Text.replaceAll(' -80S', ' MINUS EIGHTIES ');
	Text = Text.replaceAll(' -90S', ' MINUS NINETIES ');
	Text = Text.replaceAll(' 0S', ' SINGLE DIGITS ');
	Text = Text.replaceAll(' 10S', ' TEENS ');
	Text = Text.replaceAll(' 20S', ' TWENTIES ');
	Text = Text.replaceAll(' 30S', ' THIRTIES ');
	Text = Text.replaceAll(' 40S', ' FORTIES ');
	Text = Text.replaceAll(' 50S', ' FIFTIES ');
	Text = Text.replaceAll(' 60S', ' SIXTIES ');
	Text = Text.replaceAll(' 70S', ' SEVENTIES ');
	Text = Text.replaceAll(' 80S', ' EIGHTIES ');
	Text = Text.replaceAll(' 90S', ' NINETIES ');
	Text = Text.replaceAll(' 100S', ' HUNDREDS ');
	Text = Text.replaceAll(' 110S', ' HUNDRED TEENS ');
	Text = Text.replaceAll(' 120S', ' HUNDRED TWENTIES ');
	Text = Text.replaceAll(' 130S', ' HUNDRED THIRTIES ');
	Text = Text.replaceAll(' 140S', ' HUNDRED FORTIES ');
	Text = Text.replaceAll(' 150S', ' HUNDRED FIFTIES ');
	Text = Text.replaceAll(' 160S', ' HUNDRED SIXTIES ');
	Text = Text.replaceAll(' 170S', ' HUNDRED SEVENTIES ');
	Text = Text.replaceAll(' 180S', ' HUNDRED EIGHTIES ');
	Text = Text.replaceAll(' 190S', ' HUNDRED NINETIES ');

	return Text;
};

const GetWindDirectionWords = (WindDirection) => {
	var Words = WindDirection;

	Words = Words.replaceAll('N', 'North ');
	Words = Words.replaceAll('S', 'South ');
	Words = Words.replaceAll('E', 'East ');
	Words = Words.replaceAll('W', 'West ');

	return Words;
};

const AssignScrollText = (e) => {
	_ScrollText = e.ScrollText;
	_UpdateCustomScrollTextMs = 0;
	_UpdateWeatherCurrentConditionType = CurrentConditionTypes.Title;
	_UpdateWeatherCurrentConditionCounterMs = 0;
};

