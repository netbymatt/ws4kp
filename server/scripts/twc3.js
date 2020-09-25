/* globals luxon, _TravelCities */

var canvasRegionalObservations;

var canvasRegionalForecast1;
var canvasRegionalForecast2;

var canvasLocalRadar;

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

var canvasTravelForecast;

var divOutlookTemp;
var divOutlookPrcp;

var canvasLatestObservations;

var _WeatherParameters = null;

var _UpdateWeatherUpdateMs = 50;
var canvasBackGroundDateTime = null;
var canvasBackGroundCurrentConditions = null;

var _UpdateWeatherCurrentConditionType = CurrentConditionTypes.Title;
var _UpdateWeatherCurrentConditionCounterMs = 0;

var _UpdateCustomScrollTextMs = 0;

var _UpdateHazardsY = 0;

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
		console.error(e.status, e.responseJSON);
		return false;
	}

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

	var text;

	if (WeatherParameters.Progress.GetTotalPercentage() != 100) {
		return;
	}

	// Clear the date and time area.
	context.drawImage(canvasBackGroundCurrentConditions[0], 0, 0, 640, 75, 0, 405, 640, 75);

	var WeatherCurrentConditions = WeatherParameters.WeatherCurrentConditions;
	var WeatherMonthlyTotals = WeatherParameters.WeatherMonthlyTotals;


	if (_UpdateWeatherCurrentConditionCounterMs >= 4000) {
		_UpdateWeatherCurrentConditionCounterMs = 0;
		_UpdateWeatherCurrentConditionType++;
		if (_UpdateWeatherCurrentConditionType > CurrentConditionTypes.MonthPrecipitation) {
			_UpdateWeatherCurrentConditionType = CurrentConditionTypes.Title;
		}
	}

	switch(_UpdateWeatherCurrentConditionType) {
	case CurrentConditionTypes.Title:
		// mjb 06/01/19 text = "Conditions at " + WeatherCurrentConditions.StationName;
		text = 'Conditions at ' + WeatherCurrentConditions.StationName.substr(0, 20); // mjb 06/01/19
		break;
	case CurrentConditionTypes.Conditions:
		text = WeatherCurrentConditions.Conditions;
		break;
	case CurrentConditionTypes.Temperature:
		text = 'Temp: ' + Temperature + String.fromCharCode(176) + TemperatureUnit;
		if (HeatIndex != Temperature) {
			text += '    ';
			text += 'Heat Index: ' + HeatIndex + String.fromCharCode(176) + TemperatureUnit;
		} else if (WindChill != '' && WindChill < Temperature) {
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
		} else if (WindSpeed == 'NA') {
			text = 'Wind: NA';
		} else {
			text = 'Wind: Calm';
		}
		if (WindGust != '') {
			text += '  ';
			text += 'Gusts to ' + WindGust;
		}
		break;
	case CurrentConditionTypes.VisibilityCeiling:
		text = 'Visib: ' + parseInt(Visibility).toString() + VisibilityUnit;
		text += '  ';
		text += 'Ceiling: ' + (Ceiling == '' ? 'Unlimited' : Ceiling + CeilingUnit);
		break;
	case CurrentConditionTypes.MonthPrecipitation:
		if (PrecipitationTotal.toString() == '') {
			_UpdateWeatherCurrentConditionCounterMs += 4000;
			DrawCurrentConditions(WeatherParameters, context);
			return;
		}

		// mjb 10/02/19 Begin
		//text = WeatherMonthlyTotals.MonthName + " Precipitation: " + PrecipitationTotal.toString() + PrecipitationTotalUnit;

		if (PrecipitationTotal.toString() == 'T') {
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

