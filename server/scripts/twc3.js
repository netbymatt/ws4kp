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

	canvasLocalRadar = $('#canvasLocalRadar');

	canvasRegionalForecast1 = $('#canvasRegionalForecast1');
	canvasRegionalForecast2 = $('#canvasRegionalForecast2');

	canvasRegionalObservations = $('#canvasRegionalObservations');

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

	canvasTravelForecast = $('#canvasTravelForecast');

	canvasLatestObservations = $('#canvasLatestObservations');


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

const AssignScrollText = (e) => {
	_ScrollText = e.ScrollText;
	_UpdateCustomScrollTextMs = 0;
	_UpdateWeatherCurrentConditionType = CurrentConditionTypes.Title;
	_UpdateWeatherCurrentConditionCounterMs = 0;
};

