import en from './locale/en.js';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}

function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

class ParseError extends Error {
    constructor(message) {
        super(message);
        this.name = "ParseError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
class InvalidWeatherStatementError extends ParseError {
    constructor(cause) {
        super(typeof cause === "string"
            ? `Invalid weather string: ${cause}`
            : "Invalid weather string");
        this.name = "InvalidWeatherStatementError";
        Object.setPrototypeOf(this, new.target.prototype);
        if (typeof cause !== "string")
            this.cause = cause;
    }
}
/**
 * Thrown when an input contains data elements that are recognized but
 * intentionally not supported.
 */
class PartialWeatherStatementError extends InvalidWeatherStatementError {
    constructor(partialMessage, part, total) {
        super(`Input is partial TAF (${partialMessage}), see: https://github.com/aeharding/metar-taf-parser/issues/68`);
        this.name = "PartialWeatherStatementError";
        Object.setPrototypeOf(this, new.target.prototype);
        this.part = part;
        this.total = total;
    }
}
/**
 * Thrown when command marked as canParse, but couldn't parse when
 * executing (for example, an invalid CloudQuantity)
 */
class CommandExecutionError extends ParseError {
    constructor(message) {
        super(message);
        this.name = "CommandExecutionError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
/**
 * Should never occur
 */
class UnexpectedParseError extends ParseError {
    constructor(message) {
        super(message);
        this.name = "UnexpectedParseError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Split behaving similar to Python's implementation
 */
function pySplit(string, separator, n) {
    let split = string.split(separator);
    // Note: Python implementation will automatically trim empty values if
    // separator is undefined. Since this function is kinda meh, we'll just do it
    // for any spaces (pretty close to their implementation, since a space is the
    // default character to split on)
    //
    // https://docs.python.org/3/library/stdtypes.html?highlight=split#str.split
    if (separator === " ")
        split = split.filter((n) => n);
    if (n == null || split.length <= n)
        return split;
    const out = split.slice(0, n);
    out.push(split.slice(n).join(separator));
    return out;
}
/**
 * Access nested object properties by string path
 *
 * https://stackoverflow.com/a/22129960
 */
function resolve(obj, path, separator = ".") {
    const properties = Array.isArray(path) ? path : path.split(separator);
    return properties.reduce((prev, curr) => prev?.[curr], obj);
}
/**
 * For safely casting input values
 * @param input String that is expected to be in the snum
 * @param enumExpected The enum to cast the input value to
 * @throws RemarkExecutionError when input is not a key of enum
 */
function as(input, enumExpected) {
    if (!Object.values(enumExpected).includes(input))
        throw new CommandExecutionError(`${input} not found in ${Object.values(enumExpected)}`);
    return input;
}

function _(path, lang) {
    const translation = resolve(lang, path);
    if (!translation || typeof translation !== "string")
        return undefined;
    return translation;
}
function format(message, ...args) {
    if (!message)
        return;
    // All arguments must be defined, otherwise nothing is returned
    for (const arg of args) {
        if (arg === undefined)
            return;
    }
    return message.replace(/{\d+}/g, (match) => {
        const index = +match.slice(1, -1);
        return `${args[index]}`;
    });
}

class Command {
    constructor(locale) {
        this.locale = locale;
    }
}

var _CeilingHeightCommand_regex;
class CeilingHeightCommand extends Command {
    constructor() {
        super(...arguments);
        _CeilingHeightCommand_regex.set(this, /^CIG (\d{3})V(\d{3})\b/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _CeilingHeightCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _CeilingHeightCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const min = +matches[1] * 100;
        const max = +matches[2] * 100;
        const description = format(_("Remark.Ceiling.Height", this.locale), min, max);
        remark.push({
            type: RemarkType.CeilingHeight,
            description,
            raw: matches[0],
            min,
            max,
        });
        return [code.replace(__classPrivateFieldGet(this, _CeilingHeightCommand_regex, "f"), "").trim(), remark];
    }
}
_CeilingHeightCommand_regex = new WeakMap();

var _CeilingSecondLocationCommand_regex;
class CeilingSecondLocationCommand extends Command {
    constructor() {
        super(...arguments);
        _CeilingSecondLocationCommand_regex.set(this, /^CIG (\d{3}) (\w+)\b/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _CeilingSecondLocationCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _CeilingSecondLocationCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const height = +matches[1] * 100;
        const location = matches[2];
        const description = format(_("Remark.Ceiling.Second.Location", this.locale), height, location);
        remark.push({
            type: RemarkType.CeilingSecondLocation,
            description,
            raw: matches[0],
            height,
            location,
        });
        return [code.replace(__classPrivateFieldGet(this, _CeilingSecondLocationCommand_regex, "f"), "").trim(), remark];
    }
}
_CeilingSecondLocationCommand_regex = new WeakMap();

var MetarType;
(function (MetarType) {
    MetarType["METAR"] = "METAR";
    MetarType["SPECI"] = "SPECI";
})(MetarType || (MetarType = {}));
var CloudQuantity;
(function (CloudQuantity) {
    /**
     * Sky clear
     */
    CloudQuantity["SKC"] = "SKC";
    /**
     * Few
     */
    CloudQuantity["FEW"] = "FEW";
    /**
     * Broken
     */
    CloudQuantity["BKN"] = "BKN";
    /**
     * Scattered
     */
    CloudQuantity["SCT"] = "SCT";
    /**
     * Overcast
     */
    CloudQuantity["OVC"] = "OVC";
    /**
     * No significant cloud
     */
    CloudQuantity["NSC"] = "NSC";
})(CloudQuantity || (CloudQuantity = {}));
var CloudType;
(function (CloudType) {
    /**
     * Cumulonimbus
     */
    CloudType["CB"] = "CB";
    /**
     * Towering cumulus, cumulus congestus
     */
    CloudType["TCU"] = "TCU";
    /**
     * Cirrus
     */
    CloudType["CI"] = "CI";
    /**
     * Cirrocumulus
     */
    CloudType["CC"] = "CC";
    /**
     * Cirrostratus
     */
    CloudType["CS"] = "CS";
    /**
     * Altocumulus
     */
    CloudType["AC"] = "AC";
    /**
     * Stratus
     */
    CloudType["ST"] = "ST";
    /**
     * Cumulus
     */
    CloudType["CU"] = "CU";
    /**
     * Astrostratus
     */
    CloudType["AS"] = "AS";
    /**
     * Nimbostratus
     */
    CloudType["NS"] = "NS";
    /**
     * Stratocumulus
     */
    CloudType["SC"] = "SC";
})(CloudType || (CloudType = {}));
/**
 * Moderate has no qualifier.
 */
var Intensity;
(function (Intensity) {
    Intensity["LIGHT"] = "-";
    /**
     * Heavy or well-developed
     */
    Intensity["HEAVY"] = "+";
    Intensity["IN_VICINITY"] = "VC";
})(Intensity || (Intensity = {}));
var Descriptive;
(function (Descriptive) {
    Descriptive["SHOWERS"] = "SH";
    Descriptive["SHALLOW"] = "MI";
    Descriptive["PATCHES"] = "BC";
    Descriptive["PARTIAL"] = "PR";
    Descriptive["DRIFTING"] = "DR";
    Descriptive["THUNDERSTORM"] = "TS";
    Descriptive["BLOWING"] = "BL";
    Descriptive["FREEZING"] = "FZ";
})(Descriptive || (Descriptive = {}));
var Phenomenon;
(function (Phenomenon) {
    Phenomenon["RAIN"] = "RA";
    Phenomenon["DRIZZLE"] = "DZ";
    Phenomenon["SNOW"] = "SN";
    Phenomenon["SNOW_GRAINS"] = "SG";
    Phenomenon["ICE_PELLETS"] = "PL";
    Phenomenon["ICE_CRYSTALS"] = "IC";
    Phenomenon["HAIL"] = "GR";
    Phenomenon["SMALL_HAIL"] = "GS";
    Phenomenon["UNKNOW_PRECIPITATION"] = "UP";
    Phenomenon["FOG"] = "FG";
    Phenomenon["VOLCANIC_ASH"] = "VA";
    Phenomenon["MIST"] = "BR";
    Phenomenon["HAZE"] = "HZ";
    Phenomenon["WIDESPREAD_DUST"] = "DU";
    Phenomenon["SMOKE"] = "FU";
    Phenomenon["SAND"] = "SA";
    Phenomenon["SPRAY"] = "PY";
    Phenomenon["SQUALL"] = "SQ";
    Phenomenon["SAND_WHIRLS"] = "PO";
    Phenomenon["THUNDERSTORM"] = "TS";
    Phenomenon["DUSTSTORM"] = "DS";
    Phenomenon["SANDSTORM"] = "SS";
    Phenomenon["FUNNEL_CLOUD"] = "FC";
    Phenomenon["NO_SIGNIFICANT_WEATHER"] = "NSW";
})(Phenomenon || (Phenomenon = {}));
var TimeIndicator;
(function (TimeIndicator) {
    TimeIndicator["AT"] = "AT";
    TimeIndicator["FM"] = "FM";
    TimeIndicator["TL"] = "TL";
})(TimeIndicator || (TimeIndicator = {}));
/**
 * https://www.aviationweather.gov/taf/decoder
 */
var WeatherChangeType;
(function (WeatherChangeType) {
    /**
     * FROM Group
     *
     * ie. `FM1600`
     *
     * The FM group is used when a rapid change, usually occuring in less than one
     * hour, in prevailing conditions is expected. Typically, a rapid change of
     * prevailing conditions to more or less a completely new set of prevailing
     * conditions is associated with a synoptic feature passing through the
     * terminal area (cold or warm frontal passage). Appended to the FM indicator
     * is the four-digit hour and minute the change is expected to begin and
     * continues until the next change group or until the end of the current
     * forecast.
     *
     * A FM group will mark the beginning of a new line in a TAF report. Each FM
     * group contains all the required elements -- wind, visibility, weather, and
     * sky condition. Weather will be omitted in FM groups when it is not
     * significant to aviation. FM groups will not include the contraction NSW.
     *
     * Examples:
     *
     *  1. `FM0100 SKC` - After 0100Z sky clear
     *  2. `FM1430 OVC020` - After 1430Z ceiling two thousand overcast
     */
    WeatherChangeType["FM"] = "FM";
    /**
     * BECOMING Group
     *
     * ie. `BECMG 2224`
     *
     * The BECMG group is used when a gradual change in conditions is expected
     * over a longer time period, usually two hours. The time period when the
     * change is expected is a four-digit group with the beginning hour and ending
     * hour of the change period which follows the BECMG indicator. The gradual
     * change will occur at an unspecified time within this time period. Only the
     * conditions are carried over from the previous time group.
     *
     * Example:
     *
     *  1. `OVC012 BECMG 1416 BKN020` - Ceiling one thousand two hundred overcast.
     *     Then a gradual change to ceiling two thousand broken between 1400Z and
     *     1600Z.
     */
    WeatherChangeType["BECMG"] = "BECMG";
    /**
     * TEMPORARY Group
     *
     * ie. `TEMPO 1316`
     *
     * The TEMPO group is used for any conditions in wind, visibility, weather, or
     * sky condition which are expected to last for generally less than an hour at
     * a time (occasional), and are expected to occur during less than half the
     * time period. The TEMPO indicator is followed by a four-digit group giving
     * the beginning hour and ending hour of the time period during which the
     * temporary conditions are expected. Only the changing forecast
     * meteorological conditions are included in TEMPO groups. The omitted
     * conditions are carried over from the previous time group.
     *
     * Examples:
     *
     *  1. `SCT030 TEMPO 1923 BKN030` - Three thousand scattered with occasional
     *     ceilings three thousand broken between 1900Z and 2300Z.
     *  2. `4SM HZ TEMPO 0006 2SM BR HZ` - Visibility four in haze with occasional
     *     visibility two in mist and haze between 0000Z and 0600Z.
     */
    WeatherChangeType["TEMPO"] = "TEMPO";
    /**
     * For periods up to 30 minutes (`INTER` or intermittent).
     *
     * Otherwise, similar to `TEMPO`
     */
    WeatherChangeType["INTER"] = "INTER";
    /**
     * Probability Forecast
     *
     * ie. `PROB40 0006`
     *
     * The probability or chance of thunderstorms or other precipitation events
     * occuring, along with associated weather conditions (wind, visibility, and
     * sky conditions).
     *
     * The PROB40 group is used when the occurrence of thunderstorms or
     * precipitation is in the 30% to less than 50% range, thus the probability
     * value 40 is appended to the PROB contraction. This is followed by a
     * four-digit group giving the beginning hour and ending hour of the time
     * period during which the thunderstorms or precipitation is expected.
     *
     * Note: PROB40 will not be shown during the first six hours of a forecast.
     *
     * Examples:
     *
     *  1. `PROB40 2102 1/2SM +TSRA` - Chance between 2100Z and 0200Z of
     *     visibility one-half thunderstorm, heavy rain.
     *  2. `PROB40 1014 1SM RASN` - Chance between 1000Z and 1400Z of visibility
     *     one rain and snow.
     *  3. `PROB40 2024 2SM FZRA` - Chance between 2000Z and 0000Z of visibility
     *     two freezing rain.
  
     */
    WeatherChangeType["PROB"] = "PROB";
})(WeatherChangeType || (WeatherChangeType = {}));
var Direction;
(function (Direction) {
    Direction["E"] = "E";
    Direction["ENE"] = "ENE";
    Direction["ESE"] = "ESE";
    Direction["N"] = "N";
    Direction["NE"] = "NE";
    Direction["NNE"] = "NNE";
    Direction["NNW"] = "NNW";
    Direction["NW"] = "NW";
    Direction["S"] = "S";
    Direction["SE"] = "SE";
    Direction["SSE"] = "SSE";
    Direction["SSW"] = "SSW";
    Direction["SW"] = "SW";
    Direction["W"] = "W";
    Direction["WNW"] = "WNW";
    Direction["WSW"] = "WSW";
})(Direction || (Direction = {}));
var DistanceUnit;
(function (DistanceUnit) {
    DistanceUnit["Meters"] = "m";
    DistanceUnit["StatuteMiles"] = "SM";
})(DistanceUnit || (DistanceUnit = {}));
var SpeedUnit;
(function (SpeedUnit) {
    SpeedUnit["Knot"] = "KT";
    SpeedUnit["MetersPerSecond"] = "MPS";
    SpeedUnit["KilometersPerHour"] = "KM/H";
})(SpeedUnit || (SpeedUnit = {}));
/**
 * Used to indicate the actual value is greater than or less than the value written
 *
 * For example,
 *
 *  1. `P6SM` = visibility greater than 6 statute miles
 *  2. `M1/4SM` = visibility less than 1/4 statute mile
 */
var ValueIndicator;
(function (ValueIndicator) {
    ValueIndicator["GreaterThan"] = "P";
    ValueIndicator["LessThan"] = "M";
})(ValueIndicator || (ValueIndicator = {}));
var RunwayInfoTrend;
(function (RunwayInfoTrend) {
    RunwayInfoTrend["Uprising"] = "U";
    RunwayInfoTrend["Decreasing"] = "D";
    RunwayInfoTrend["NoSignificantChange"] = "N";
})(RunwayInfoTrend || (RunwayInfoTrend = {}));
var RunwayInfoUnit;
(function (RunwayInfoUnit) {
    RunwayInfoUnit["Feet"] = "FT";
    RunwayInfoUnit["Meters"] = "m";
})(RunwayInfoUnit || (RunwayInfoUnit = {}));
var IcingIntensity;
(function (IcingIntensity) {
    /**
     * Trace Icing or None.
     *
     * Air Force code 0 means a trace of icing.
     * World Meteorological Organization code 0 means no icing
     */
    IcingIntensity["None"] = "0";
    /** Light Mixed Icing. */
    IcingIntensity["Light"] = "1";
    /** Light Rime Icing In Cloud. */
    IcingIntensity["LightRimeIcingCloud"] = "2";
    /** Light Clear Icing In Precipitation. */
    IcingIntensity["LightClearIcingPrecipitation"] = "3";
    /** Moderate Mixed Icing. */
    IcingIntensity["ModerateMixedIcing"] = "4";
    /** Moderate Rime Icing In Cloud. */
    IcingIntensity["ModerateRimeIcingCloud"] = "5";
    /** Moderate Clear Icing In Precipitation. */
    IcingIntensity["ModerateClearIcingPrecipitation"] = "6";
    /** Severe Mixed Icing. */
    IcingIntensity["SevereMixedIcing"] = "7";
    /** Severe Rime Icing In Cloud. */
    IcingIntensity["SevereRimeIcingCloud"] = "8";
    /** Severe Clear Icing In Precipitation. */
    IcingIntensity["SevereClearIcingPrecipitation"] = "9";
})(IcingIntensity || (IcingIntensity = {}));
var TurbulenceIntensity;
(function (TurbulenceIntensity) {
    /** None. */
    TurbulenceIntensity["None"] = "0";
    /** Light turbulence. */
    TurbulenceIntensity["Light"] = "1";
    /** Moderate turbulence in clear air, occasional. */
    TurbulenceIntensity["ModerateClearAirOccasional"] = "2";
    /** Moderate turbulence in clear air, frequent. */
    TurbulenceIntensity["ModerateClearAirFrequent"] = "3";
    /** Moderate turbulence in cloud, occasional. */
    TurbulenceIntensity["ModerateCloudOccasional"] = "4";
    /** Moderate turbulence in cloud, frequent. */
    TurbulenceIntensity["ModerateCloudFrequent"] = "5";
    /** Severe turbulence in clear air, occasional. */
    TurbulenceIntensity["SevereClearAirOccasional"] = "6";
    /** Severe turbulence in clear air, frequent. */
    TurbulenceIntensity["SevereClearAirFrequent"] = "7";
    /** Severe turbulence in cloud, occasional. */
    TurbulenceIntensity["SevereCloudOccasional"] = "8";
    /** Severe turbulence in cloud, frequent. */
    TurbulenceIntensity["SevereCloudFrequent"] = "9";
    /** Extreme turbulence */
    TurbulenceIntensity["Extreme"] = "X";
})(TurbulenceIntensity || (TurbulenceIntensity = {}));
var DepositType;
(function (DepositType) {
    /** (runway clearance in progress) */
    DepositType["NotReported"] = "/";
    DepositType["ClearDry"] = "0";
    DepositType["Damp"] = "1";
    DepositType["WetWaterPatches"] = "2";
    DepositType["RimeFrostCovered"] = "3";
    DepositType["DrySnow"] = "4";
    DepositType["WetSnow"] = "5";
    DepositType["Slush"] = "6";
    DepositType["Ice"] = "7";
    DepositType["CompactedSnow"] = "8";
    DepositType["FrozenRidges"] = "9";
})(DepositType || (DepositType = {}));
var DepositCoverage;
(function (DepositCoverage) {
    /**
     * Only reported by certain countries (e.g. Russia)
     */
    DepositCoverage["None"] = "0";
    /**
     * Not reported (e.g. due to rwy clearance in progress)
     */
    DepositCoverage["NotReported"] = "/";
    DepositCoverage["Less10"] = "1";
    DepositCoverage["From11To25"] = "2";
    DepositCoverage["From26To50"] = "5";
    DepositCoverage["From51To100"] = "9";
})(DepositCoverage || (DepositCoverage = {}));
var AltimeterUnit;
(function (AltimeterUnit) {
    /**
     * Inches of mercury (inHg)
     *
     * e.g. A2994 parses as 29.94 inHg
     */
    AltimeterUnit["InHg"] = "inHg";
    /**
     * Hectopascals (hPa), also known as millibars
     *
     * e.g. Q1018 parses as 1018 millibars
     */
    AltimeterUnit["HPa"] = "hPa";
})(AltimeterUnit || (AltimeterUnit = {}));

function degreesToCardinal(input) {
    const degrees = +input;
    if (isNaN(degrees))
        return "VRB";
    const dirs = [
        "N",
        "NNE",
        "NE",
        "ENE",
        "E",
        "ESE",
        "SE",
        "SSE",
        "S",
        "SSW",
        "SW",
        "WSW",
        "W",
        "WNW",
        "NW",
        "NNW",
    ];
    const ix = Math.floor((degrees + 11.25) / 22.5);
    return dirs[ix % 16];
}
function convertVisibility(input) {
    if (input === "9999")
        return {
            indicator: ValueIndicator.GreaterThan,
            value: +input,
            unit: DistanceUnit.Meters,
        };
    return {
        value: +input,
        unit: DistanceUnit.Meters,
    };
}
/**
 * @param input May start with P or M, and must end with SM
 * @returns Distance
 */
function convertNauticalMilesVisibility(input) {
    let indicator;
    let index = 0;
    if (input.startsWith("P")) {
        indicator = ValueIndicator.GreaterThan;
        index = 1;
    }
    else if (input.startsWith("M")) {
        indicator = ValueIndicator.LessThan;
        index = 1;
    }
    return {
        indicator,
        value: convertFractionalAmount(input.slice(index, -2)),
        unit: DistanceUnit.StatuteMiles,
    };
}
/**
 * Converts fractional and/or whole amounts
 *
 * Example "1/3", "1 1/3" and "1"
 */
function convertFractionalAmount(input) {
    const [whole, fraction] = input.split(" ");
    if (!fraction)
        return parseFraction(whole);
    return +whole + parseFraction(fraction);
}
function parseFraction(input) {
    const [top, bottom] = input.split("/");
    if (!bottom)
        return +top;
    return Math.round((+top / +bottom) * 100) / 100;
}
function convertTemperature(input) {
    if (input.startsWith("M"))
        return -pySplit(input, "M")[1];
    return +input;
}
/**
 * Converts number `.toFixed(1)` before outputting to match python implementation
 */
function convertTemperatureRemarks(sign, temperature) {
    const temp = +temperature / 10;
    if (sign === "0")
        return temp;
    return -temp;
}
function convertPrecipitationAmount(amount) {
    return +amount / 100;
}

var _HailSizeCommand_regex;
class HailSizeCommand extends Command {
    constructor() {
        super(...arguments);
        _HailSizeCommand_regex.set(this, /^GR ((\d\/\d)|((\d) ?(\d\/\d)?))/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _HailSizeCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _HailSizeCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const description = format(_("Remark.Hail.0", this.locale), matches[1]);
        remark.push({
            type: RemarkType.HailSize,
            description,
            raw: matches[0],
            size: convertFractionalAmount(matches[1]),
        });
        return [code.replace(__classPrivateFieldGet(this, _HailSizeCommand_regex, "f"), "").trim(), remark];
    }
}
_HailSizeCommand_regex = new WeakMap();

var _HourlyMaximumMinimumTemperatureCommand_regex;
class HourlyMaximumMinimumTemperatureCommand extends Command {
    constructor() {
        super(...arguments);
        _HourlyMaximumMinimumTemperatureCommand_regex.set(this, /^4([01])(\d{3})([01])(\d{3})\b/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _HourlyMaximumMinimumTemperatureCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _HourlyMaximumMinimumTemperatureCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const description = format(_("Remark.Hourly.Maximum.Minimum.Temperature", this.locale), convertTemperatureRemarks(matches[1], matches[2]).toFixed(1), convertTemperatureRemarks(matches[3], matches[4]).toFixed(1));
        remark.push({
            type: RemarkType.HourlyMaximumMinimumTemperature,
            description: description,
            raw: matches[0],
            max: convertTemperatureRemarks(matches[1], matches[2]),
            min: convertTemperatureRemarks(matches[3], matches[4]),
        });
        return [code.replace(__classPrivateFieldGet(this, _HourlyMaximumMinimumTemperatureCommand_regex, "f"), "").trim(), remark];
    }
}
_HourlyMaximumMinimumTemperatureCommand_regex = new WeakMap();

var _HourlyMaximumTemperatureCommand_regex;
class HourlyMaximumTemperatureCommand extends Command {
    constructor() {
        super(...arguments);
        _HourlyMaximumTemperatureCommand_regex.set(this, /^1([01])(\d{3})\b/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _HourlyMaximumTemperatureCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _HourlyMaximumTemperatureCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const description = format(_("Remark.Hourly.Maximum.Temperature", this.locale), convertTemperatureRemarks(matches[1], matches[2]).toFixed(1));
        remark.push({
            type: RemarkType.HourlyMaximumTemperature,
            description: description,
            raw: matches[0],
            max: convertTemperatureRemarks(matches[1], matches[2]),
        });
        return [code.replace(__classPrivateFieldGet(this, _HourlyMaximumTemperatureCommand_regex, "f"), "").trim(), remark];
    }
}
_HourlyMaximumTemperatureCommand_regex = new WeakMap();

var _HourlyMinimumTemperatureCommand_regex;
class HourlyMinimumTemperatureCommand extends Command {
    constructor() {
        super(...arguments);
        _HourlyMinimumTemperatureCommand_regex.set(this, /^2([01])(\d{3})\b/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _HourlyMinimumTemperatureCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _HourlyMinimumTemperatureCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const description = format(_("Remark.Hourly.Minimum.Temperature", this.locale), convertTemperatureRemarks(matches[1], matches[2]).toFixed(1));
        remark.push({
            type: RemarkType.HourlyMinimumTemperature,
            description,
            raw: matches[0],
            min: convertTemperatureRemarks(matches[1], matches[2]),
        });
        return [code.replace(__classPrivateFieldGet(this, _HourlyMinimumTemperatureCommand_regex, "f"), "").trim(), remark];
    }
}
_HourlyMinimumTemperatureCommand_regex = new WeakMap();

var _HourlyPrecipitationAmountCommand_regex;
class HourlyPrecipitationAmountCommand extends Command {
    constructor() {
        super(...arguments);
        _HourlyPrecipitationAmountCommand_regex.set(this, /^P(\d{4})\b/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _HourlyPrecipitationAmountCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _HourlyPrecipitationAmountCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const amount = +matches[1];
        const description = format(_("Remark.Precipitation.Amount.Hourly", this.locale), amount);
        remark.push({
            type: RemarkType.HourlyPrecipitationAmount,
            description,
            raw: matches[0],
            amount: amount / 100,
        });
        return [code.replace(__classPrivateFieldGet(this, _HourlyPrecipitationAmountCommand_regex, "f"), "").trim(), remark];
    }
}
_HourlyPrecipitationAmountCommand_regex = new WeakMap();

var _HourlyPressureCommand_regex;
class HourlyPressureCommand extends Command {
    constructor() {
        super(...arguments);
        _HourlyPressureCommand_regex.set(this, /^5(\d)(\d{3})\b/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _HourlyPressureCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _HourlyPressureCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const part1 = _(`Remark.Barometer.${+matches[1]}`, this.locale);
        const part2 = format(_("Remark.Pressure.Tendency", this.locale), +matches[2] / 10);
        const description = part1 != null && part2 != null ? `${part1} ${part2}` : undefined;
        remark.push({
            type: RemarkType.HourlyPressure,
            description,
            raw: matches[0],
            code: +matches[1],
            pressureChange: +matches[2] / 10,
        });
        return [code.replace(__classPrivateFieldGet(this, _HourlyPressureCommand_regex, "f"), "").trim(), remark];
    }
}
_HourlyPressureCommand_regex = new WeakMap();

var _HourlyTemperatureDewPointCommand_regex;
class HourlyTemperatureDewPointCommand extends Command {
    constructor() {
        super(...arguments);
        _HourlyTemperatureDewPointCommand_regex.set(this, /^T([01])(\d{3})(([01])(\d{3}))?/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _HourlyTemperatureDewPointCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _HourlyTemperatureDewPointCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const temperature = convertTemperatureRemarks(matches[1], matches[2]);
        if (!matches[3]) {
            const description = format(_("Remark.Hourly.Temperature.0", this.locale), temperature.toFixed(1));
            remark.push({
                type: RemarkType.HourlyTemperatureDewPoint,
                description,
                raw: matches[0],
                temperature,
            });
        }
        else {
            const dewPoint = convertTemperatureRemarks(matches[4], matches[5]);
            const description = format(_("Remark.Hourly.Temperature.Dew.Point", this.locale), temperature.toFixed(1), dewPoint.toFixed(1));
            remark.push({
                type: RemarkType.HourlyTemperatureDewPoint,
                description,
                raw: matches[0],
                temperature,
                dewPoint,
            });
        }
        return [code.replace(__classPrivateFieldGet(this, _HourlyTemperatureDewPointCommand_regex, "f"), "").trim(), remark];
    }
}
_HourlyTemperatureDewPointCommand_regex = new WeakMap();

var _IceAccretionCommand_regex;
class IceAccretionCommand extends Command {
    constructor() {
        super(...arguments);
        _IceAccretionCommand_regex.set(this, /^l(\d)(\d{3})\b/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _IceAccretionCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _IceAccretionCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const description = format(_("Remark.Ice.Accretion.Amount", this.locale), +matches[2], +matches[1]);
        remark.push({
            type: RemarkType.IceAccretion,
            description,
            raw: matches[0],
            amount: +matches[2] / 100,
            periodInHours: +matches[1],
        });
        return [code.replace(__classPrivateFieldGet(this, _IceAccretionCommand_regex, "f"), "").trim(), remark];
    }
}
_IceAccretionCommand_regex = new WeakMap();

var _ObscurationCommand_regex;
class ObscurationCommand extends Command {
    constructor() {
        super(...arguments);
        _ObscurationCommand_regex.set(this, /^([A-Z]{2}) ([A-Z]{3})(\d{3})/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _ObscurationCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _ObscurationCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const quantity = as(matches[2], CloudQuantity);
        const height = 100 * +matches[3];
        const phenomenon = as(matches[1], Phenomenon);
        const description = format(_("Remark.Obscuration", this.locale), _(`CloudQuantity.${quantity}`, this.locale), height, _(`Phenomenon.${phenomenon}`, this.locale));
        remark.push({
            type: RemarkType.Obscuration,
            description,
            raw: matches[0],
            quantity,
            height,
            phenomenon,
        });
        return [code.replace(__classPrivateFieldGet(this, _ObscurationCommand_regex, "f"), "").trim(), remark];
    }
}
_ObscurationCommand_regex = new WeakMap();

var _PrecipitationAmount24HourCommand_regex;
class PrecipitationAmount24HourCommand extends Command {
    constructor() {
        super(...arguments);
        _PrecipitationAmount24HourCommand_regex.set(this, /^7(\d{4})\b/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _PrecipitationAmount24HourCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _PrecipitationAmount24HourCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const amount = convertPrecipitationAmount(matches[1]);
        const description = format(_("Remark.Precipitation.Amount.24", this.locale), amount);
        remark.push({
            type: RemarkType.PrecipitationAmount24Hour,
            description,
            raw: matches[0],
            amount,
        });
        return [code.replace(__classPrivateFieldGet(this, _PrecipitationAmount24HourCommand_regex, "f"), "").trim(), remark];
    }
}
_PrecipitationAmount24HourCommand_regex = new WeakMap();

var _PrecipitationAmount36HourCommand_regex;
class PrecipitationAmount36HourCommand extends Command {
    constructor() {
        super(...arguments);
        _PrecipitationAmount36HourCommand_regex.set(this, /^([36])(\d{4})\b/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _PrecipitationAmount36HourCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _PrecipitationAmount36HourCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const periodInHours = +matches[1];
        const amount = convertPrecipitationAmount(matches[2]);
        const description = format(_("Remark.Precipitation.Amount.3.6", this.locale), periodInHours, amount);
        remark.push({
            type: RemarkType.PrecipitationAmount36Hour,
            description,
            raw: matches[0],
            periodInHours,
            amount,
        });
        return [code.replace(__classPrivateFieldGet(this, _PrecipitationAmount36HourCommand_regex, "f"), "").trim(), remark];
    }
}
_PrecipitationAmount36HourCommand_regex = new WeakMap();

var _PrecipitationBegEndCommand_regex;
class PrecipitationBegEndCommand extends Command {
    constructor() {
        super(...arguments);
        _PrecipitationBegEndCommand_regex.set(this, /^(([A-Z]{2})?([A-Z]{2})B(\d{2})?(\d{2})E(\d{2})?(\d{2}))/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _PrecipitationBegEndCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _PrecipitationBegEndCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const descriptive = matches[2] ? as(matches[2], Descriptive) : undefined;
        const phenomenon = as(matches[3], Phenomenon);
        const description = format(_("Remark.Precipitation.Beg.End", this.locale), descriptive ? _(`Descriptive.${descriptive}`, this.locale) : "", _(`Phenomenon.${phenomenon}`, this.locale), matches[4] || "", matches[5], matches[6] || "", matches[7]);
        remark.push({
            type: RemarkType.PrecipitationBegEnd,
            description,
            raw: matches[0],
            descriptive,
            phenomenon,
            startHour: matches[4] ? +matches[4] : undefined,
            startMin: +matches[5],
            endHour: matches[6] ? +matches[6] : undefined,
            endMin: +matches[7],
        });
        return [code.replace(__classPrivateFieldGet(this, _PrecipitationBegEndCommand_regex, "f"), "").trim(), remark];
    }
}
_PrecipitationBegEndCommand_regex = new WeakMap();

var _PrevailingVisibilityCommand_regex;
class PrevailingVisibilityCommand extends Command {
    constructor() {
        super(...arguments);
        _PrevailingVisibilityCommand_regex.set(this, /^VIS ((\d)*( )?(\d?\/?\d))V((\d)*( )?(\d?\/?\d))/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _PrevailingVisibilityCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _PrevailingVisibilityCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const minVisibility = matches[1];
        const maxVisibility = matches[5];
        const description = format(_("Remark.Variable.Prevailing.Visibility", this.locale), minVisibility, maxVisibility);
        remark.push({
            type: RemarkType.PrevailingVisibility,
            description,
            raw: matches[0],
            minVisibility: convertFractionalAmount(minVisibility),
            maxVisibility: convertFractionalAmount(maxVisibility),
        });
        return [code.replace(__classPrivateFieldGet(this, _PrevailingVisibilityCommand_regex, "f"), "").trim(), remark];
    }
}
_PrevailingVisibilityCommand_regex = new WeakMap();

var _SeaLevelPressureCommand_regex;
class SeaLevelPressureCommand extends Command {
    constructor() {
        super(...arguments);
        _SeaLevelPressureCommand_regex.set(this, /^SLP(\d{2})(\d)/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _SeaLevelPressureCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _SeaLevelPressureCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        let pressure = matches[1].startsWith("9") ? "9" : "10";
        pressure += matches[1] + "." + matches[2];
        const description = format(_("Remark.Sea.Level.Pressure", this.locale), pressure);
        remark.push({
            type: RemarkType.SeaLevelPressure,
            description,
            raw: matches[0],
            pressure: +pressure,
        });
        return [code.replace(__classPrivateFieldGet(this, _SeaLevelPressureCommand_regex, "f"), "").trim(), remark];
    }
}
_SeaLevelPressureCommand_regex = new WeakMap();

var _SecondLocationVisibilityCommand_regex;
class SecondLocationVisibilityCommand extends Command {
    constructor() {
        super(...arguments);
        _SecondLocationVisibilityCommand_regex.set(this, /^VIS ((\d)*( )?(\d?\/?\d)) (\w+)/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _SecondLocationVisibilityCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _SecondLocationVisibilityCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const distance = matches[1];
        const location = matches[5];
        const description = format(_("Remark.Second.Location.Visibility", this.locale), distance, location);
        remark.push({
            type: RemarkType.SecondLocationVisibility,
            description,
            raw: matches[0],
            distance: convertFractionalAmount(distance),
            location,
        });
        return [code.replace(__classPrivateFieldGet(this, _SecondLocationVisibilityCommand_regex, "f"), "").trim(), remark];
    }
}
_SecondLocationVisibilityCommand_regex = new WeakMap();

var _SectorVisibilityCommand_regex;
class SectorVisibilityCommand extends Command {
    constructor() {
        super(...arguments);
        _SectorVisibilityCommand_regex.set(this, /^VIS ([A-Z]{1,2}) ((\d)*( )?(\d?\/?\d))/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _SectorVisibilityCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _SectorVisibilityCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const direction = as(matches[1], Direction);
        const description = format(_("Remark.Sector.Visibility", this.locale), _(`Converter.${direction}`, this.locale), matches[2]);
        remark.push({
            type: RemarkType.SectorVisibility,
            description,
            raw: matches[0],
            direction,
            distance: convertFractionalAmount(matches[2]),
        });
        return [code.replace(__classPrivateFieldGet(this, _SectorVisibilityCommand_regex, "f"), "").trim(), remark];
    }
}
_SectorVisibilityCommand_regex = new WeakMap();

var _SmallHailSizeCommand_regex;
class SmallHailSizeCommand extends Command {
    constructor() {
        super(...arguments);
        _SmallHailSizeCommand_regex.set(this, /^GR LESS THAN ((\d )?(\d\/\d)?)/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _SmallHailSizeCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _SmallHailSizeCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const description = format(_("Remark.Hail.LesserThan", this.locale), matches[1]);
        remark.push({
            type: RemarkType.SmallHailSize,
            description,
            raw: matches[0],
            size: convertFractionalAmount(matches[1]),
        });
        return [code.replace(__classPrivateFieldGet(this, _SmallHailSizeCommand_regex, "f"), "").trim(), remark];
    }
}
_SmallHailSizeCommand_regex = new WeakMap();

var _SnowDepthCommand_regex;
class SnowDepthCommand extends Command {
    constructor() {
        super(...arguments);
        _SnowDepthCommand_regex.set(this, /^4\/(\d{3})/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _SnowDepthCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _SnowDepthCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const depth = +matches[1];
        const description = format(_("Remark.Snow.Depth", this.locale), depth);
        remark.push({
            type: RemarkType.SnowDepth,
            description,
            raw: matches[0],
            depth,
        });
        return [code.replace(__classPrivateFieldGet(this, _SnowDepthCommand_regex, "f"), "").trim(), remark];
    }
}
_SnowDepthCommand_regex = new WeakMap();

var _SnowIncreaseCommand_regex;
class SnowIncreaseCommand extends Command {
    constructor() {
        super(...arguments);
        _SnowIncreaseCommand_regex.set(this, /^SNINCR (\d+)\/(\d+)/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _SnowIncreaseCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _SnowIncreaseCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const inchesLastHour = +matches[1];
        const totalDepth = +matches[2];
        const description = format(_("Remark.Snow.Increasing.Rapidly", this.locale), inchesLastHour, totalDepth);
        remark.push({
            type: RemarkType.SnowIncrease,
            description,
            raw: matches[0],
            inchesLastHour,
            totalDepth,
        });
        return [code.replace(__classPrivateFieldGet(this, _SnowIncreaseCommand_regex, "f"), "").trim(), remark];
    }
}
_SnowIncreaseCommand_regex = new WeakMap();

var _SnowPelletsCommand_regex;
class SnowPelletsCommand extends Command {
    constructor() {
        super(...arguments);
        _SnowPelletsCommand_regex.set(this, /^GS (LGT|MOD|HVY)/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _SnowPelletsCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _SnowPelletsCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const description = format(_("Remark.Snow.Pellets", this.locale), _(`Remark.${matches[1]}`, this.locale));
        remark.push({
            type: RemarkType.SnowPellets,
            description,
            raw: matches[0],
            amount: matches[1],
        });
        return [code.replace(__classPrivateFieldGet(this, _SnowPelletsCommand_regex, "f"), "").trim(), remark];
    }
}
_SnowPelletsCommand_regex = new WeakMap();

var _SunshineDurationCommand_regex;
class SunshineDurationCommand extends Command {
    constructor() {
        super(...arguments);
        _SunshineDurationCommand_regex.set(this, /^98(\d{3})/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _SunshineDurationCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _SunshineDurationCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const duration = +matches[1];
        const description = format(_("Remark.Sunshine.Duration", this.locale), duration);
        remark.push({
            type: RemarkType.SunshineDuration,
            description,
            raw: matches[0],
            duration,
        });
        return [code.replace(__classPrivateFieldGet(this, _SunshineDurationCommand_regex, "f"), "").trim(), remark];
    }
}
_SunshineDurationCommand_regex = new WeakMap();

var _SurfaceVisibilityCommand_regex;
class SurfaceVisibilityCommand extends Command {
    constructor() {
        super(...arguments);
        _SurfaceVisibilityCommand_regex.set(this, /^SFC VIS ((\d)*( )?(\d?\/?\d))/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _SurfaceVisibilityCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _SurfaceVisibilityCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const distance = matches[1];
        const description = format(_("Remark.Surface.Visibility", this.locale), distance);
        remark.push({
            type: RemarkType.SurfaceVisibility,
            description,
            raw: matches[0],
            distance: convertFractionalAmount(distance),
        });
        return [code.replace(__classPrivateFieldGet(this, _SurfaceVisibilityCommand_regex, "f"), "").trim(), remark];
    }
}
_SurfaceVisibilityCommand_regex = new WeakMap();

var _ThunderStormLocationCommand_regex;
class ThunderStormLocationCommand extends Command {
    constructor() {
        super(...arguments);
        _ThunderStormLocationCommand_regex.set(this, /^TS ([A-Z]{2})/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _ThunderStormLocationCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _ThunderStormLocationCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const location = as(matches[1], Direction);
        const description = format(_("Remark.Thunderstorm.Location.0", this.locale), _(`Converter.${location}`, this.locale));
        remark.push({
            type: RemarkType.ThunderStormLocation,
            description,
            raw: matches[0],
            location,
        });
        return [code.replace(__classPrivateFieldGet(this, _ThunderStormLocationCommand_regex, "f"), "").trim(), remark];
    }
}
_ThunderStormLocationCommand_regex = new WeakMap();

var _ThunderStormLocationMovingCommand_regex;
class ThunderStormLocationMovingCommand extends Command {
    constructor() {
        super(...arguments);
        _ThunderStormLocationMovingCommand_regex.set(this, /^TS ([A-Z]{2}) MOV ([A-Z]{2})/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _ThunderStormLocationMovingCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _ThunderStormLocationMovingCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const location = as(matches[1], Direction);
        const moving = as(matches[2], Direction);
        const description = format(_("Remark.Thunderstorm.Location.Moving", this.locale), _(`Converter.${location}`, this.locale), _(`Converter.${moving}`, this.locale));
        remark.push({
            type: RemarkType.ThunderStormLocationMoving,
            description,
            raw: matches[0],
            location,
            moving,
        });
        return [code.replace(__classPrivateFieldGet(this, _ThunderStormLocationMovingCommand_regex, "f"), "").trim(), remark];
    }
}
_ThunderStormLocationMovingCommand_regex = new WeakMap();

var _TornadicActivityBegCommand_regex;
class TornadicActivityBegCommand extends Command {
    constructor() {
        super(...arguments);
        _TornadicActivityBegCommand_regex.set(this, /^(TORNADO|FUNNEL CLOUD|WATERSPOUT) (B(\d{2})?(\d{2}))( (\d+)? ([A-Z]{1,2})?)?/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _TornadicActivityBegCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _TornadicActivityBegCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const direction = as(matches[7], Direction);
        const description = format(_("Remark.Tornadic.Activity.Beginning", this.locale), _(`Remark.${matches[1].replace(" ", "")}`, this.locale), matches[3] || "", matches[4], matches[6], _(`Converter.${direction}`, this.locale));
        remark.push({
            type: RemarkType.TornadicActivityBeg,
            description,
            raw: matches[0],
            tornadicType: matches[1],
            startHour: matches[3] ? +matches[3] : undefined,
            startMinute: +matches[4],
            distance: +matches[6],
            direction,
        });
        return [code.replace(__classPrivateFieldGet(this, _TornadicActivityBegCommand_regex, "f"), "").trim(), remark];
    }
}
_TornadicActivityBegCommand_regex = new WeakMap();

var _TornadicActivityBegEndCommand_regex;
class TornadicActivityBegEndCommand extends Command {
    constructor() {
        super(...arguments);
        _TornadicActivityBegEndCommand_regex.set(this, /^(TORNADO|FUNNEL CLOUD|WATERSPOUT) (B(\d{2})?(\d{2}))(E(\d{2})?(\d{2}))( (\d+)? ([A-Z]{1,2})?)?/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _TornadicActivityBegEndCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _TornadicActivityBegEndCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const direction = as(matches[10], Direction);
        const description = format(_("Remark.Tornadic.Activity.BegEnd", this.locale), _(`Remark.${matches[1].replace(" ", "")}`, this.locale), matches[3] || "", matches[4], matches[6] || "", matches[7], matches[9], _(`Converter.${direction}`, this.locale));
        remark.push({
            type: RemarkType.TornadicActivityBegEnd,
            description,
            raw: matches[0],
            tornadicType: matches[1],
            startHour: matches[3] ? +matches[3] : undefined,
            startMinute: +matches[4],
            endHour: matches[6] ? +matches[6] : undefined,
            endMinute: +matches[7],
            distance: +matches[9],
            direction,
        });
        return [code.replace(__classPrivateFieldGet(this, _TornadicActivityBegEndCommand_regex, "f"), "").trim(), remark];
    }
}
_TornadicActivityBegEndCommand_regex = new WeakMap();

var _TornadicActivityEndCommand_regex;
class TornadicActivityEndCommand extends Command {
    constructor() {
        super(...arguments);
        _TornadicActivityEndCommand_regex.set(this, /^(TORNADO|FUNNEL CLOUD|WATERSPOUT) (E(\d{2})?(\d{2}))( (\d+)? ([A-Z]{1,2})?)?/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _TornadicActivityEndCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _TornadicActivityEndCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const direction = as(matches[7], Direction);
        const description = format(_("Remark.Tornadic.Activity.Ending", this.locale), _(`Remark.${matches[1].replace(" ", "")}`, this.locale), matches[3] || "", matches[4], matches[6], _(`Converter.${direction}`, this.locale));
        remark.push({
            type: RemarkType.TornadicActivityEnd,
            description,
            raw: matches[0],
            tornadicType: matches[1],
            endHour: matches[3] ? +matches[3] : undefined,
            endMinute: +matches[4],
            distance: +matches[6],
            direction,
        });
        return [code.replace(__classPrivateFieldGet(this, _TornadicActivityEndCommand_regex, "f"), "").trim(), remark];
    }
}
_TornadicActivityEndCommand_regex = new WeakMap();

var _TowerVisibilityCommand_regex;
class TowerVisibilityCommand extends Command {
    constructor() {
        super(...arguments);
        _TowerVisibilityCommand_regex.set(this, /^TWR VIS ((\d)*( )?(\d?\/?\d))/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _TowerVisibilityCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _TowerVisibilityCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const distance = matches[1];
        const description = format(_("Remark.Tower.Visibility", this.locale), distance);
        remark.push({
            type: RemarkType.TowerVisibility,
            description,
            raw: matches[0],
            distance: convertFractionalAmount(distance),
        });
        return [code.replace(__classPrivateFieldGet(this, _TowerVisibilityCommand_regex, "f"), "").trim(), remark];
    }
}
_TowerVisibilityCommand_regex = new WeakMap();

var _VariableSkyCommand_regex;
class VariableSkyCommand extends Command {
    constructor() {
        super(...arguments);
        _VariableSkyCommand_regex.set(this, /^([A-Z]{3}) V ([A-Z]{3})/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _VariableSkyCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _VariableSkyCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const firstQuantity = as(matches[1], CloudQuantity);
        const secondQuantity = as(matches[2], CloudQuantity);
        const description = format(_("Remark.Variable.Sky.Condition.0", this.locale), _(`CloudQuantity.${firstQuantity}`, this.locale), _(`CloudQuantity.${secondQuantity}`, this.locale));
        remark.push({
            type: RemarkType.VariableSky,
            description,
            raw: matches[0],
            cloudQuantityRange: [firstQuantity, secondQuantity],
        });
        return [code.replace(__classPrivateFieldGet(this, _VariableSkyCommand_regex, "f"), "").trim(), remark];
    }
}
_VariableSkyCommand_regex = new WeakMap();

var _VariableSkyHeightCommand_regex;
class VariableSkyHeightCommand extends Command {
    constructor() {
        super(...arguments);
        _VariableSkyHeightCommand_regex.set(this, /^([A-Z]{3})(\d{3}) V ([A-Z]{3})/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _VariableSkyHeightCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _VariableSkyHeightCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const firstQuantity = as(matches[1], CloudQuantity);
        const secondQuantity = as(matches[3], CloudQuantity);
        const height = 100 * +matches[2];
        const description = format(_("Remark.Variable.Sky.Condition.Height", this.locale), height, _(`CloudQuantity.${firstQuantity}`, this.locale), _(`CloudQuantity.${secondQuantity}`, this.locale));
        remark.push({
            type: RemarkType.VariableSkyHeight,
            description,
            raw: matches[0],
            height,
            cloudQuantityRange: [firstQuantity, secondQuantity],
        });
        return [code.replace(__classPrivateFieldGet(this, _VariableSkyHeightCommand_regex, "f"), "").trim(), remark];
    }
}
_VariableSkyHeightCommand_regex = new WeakMap();

var _VirgaDirectionCommand_regex;
class VirgaDirectionCommand extends Command {
    constructor() {
        super(...arguments);
        _VirgaDirectionCommand_regex.set(this, /^VIRGA ([A-Z]{2})/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _VirgaDirectionCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _VirgaDirectionCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const direction = as(matches[1], Direction);
        const description = format(_("Remark.Virga.Direction", this.locale), _(`Converter.${direction}`, this.locale));
        remark.push({
            type: RemarkType.VirgaDirection,
            description,
            raw: matches[0],
            direction,
        });
        return [code.replace(__classPrivateFieldGet(this, _VirgaDirectionCommand_regex, "f"), "").trim(), remark];
    }
}
_VirgaDirectionCommand_regex = new WeakMap();

var _WaterEquivalentSnowCommand_regex;
class WaterEquivalentSnowCommand extends Command {
    constructor() {
        super(...arguments);
        _WaterEquivalentSnowCommand_regex.set(this, /^933(\d{3})\b/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _WaterEquivalentSnowCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _WaterEquivalentSnowCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const amount = +matches[1] / 10;
        const description = format(_("Remark.Water.Equivalent.Snow.Ground", this.locale), amount);
        remark.push({
            type: RemarkType.WaterEquivalentSnow,
            description,
            raw: matches[0],
            amount,
        });
        return [code.replace(__classPrivateFieldGet(this, _WaterEquivalentSnowCommand_regex, "f"), "").trim(), remark];
    }
}
_WaterEquivalentSnowCommand_regex = new WeakMap();

var _WindPeakCommand_regex;
class WindPeakCommand extends Command {
    constructor() {
        super(...arguments);
        _WindPeakCommand_regex.set(this, /^PK WND (\d{3})(\d{2,3})\/(\d{2})?(\d{2})/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _WindPeakCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _WindPeakCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const degrees = +matches[1];
        const speed = +matches[2];
        const description = format(_("Remark.PeakWind", this.locale), degrees, speed, matches[3] || "", matches[4]);
        remark.push({
            type: RemarkType.WindPeak,
            description,
            raw: matches[0],
            speed,
            degrees,
            startHour: matches[3] ? +matches[3] : undefined,
            startMinute: +matches[4],
        });
        return [code.replace(__classPrivateFieldGet(this, _WindPeakCommand_regex, "f"), "").trim(), remark];
    }
}
_WindPeakCommand_regex = new WeakMap();

var _WindShiftCommand_regex;
class WindShiftCommand extends Command {
    constructor() {
        super(...arguments);
        _WindShiftCommand_regex.set(this, /^WSHFT (\d{2})?(\d{2})/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _WindShiftCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _WindShiftCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const description = format(_("Remark.WindShift.0", this.locale), matches[1] || "", matches[2]);
        remark.push({
            type: RemarkType.WindShift,
            description,
            raw: matches[0],
            startHour: matches[1] ? +matches[1] : undefined,
            startMinute: +matches[2],
        });
        return [code.replace(__classPrivateFieldGet(this, _WindShiftCommand_regex, "f"), "").trim(), remark];
    }
}
_WindShiftCommand_regex = new WeakMap();

var _WindShiftFropaCommand_regex;
class WindShiftFropaCommand extends Command {
    constructor() {
        super(...arguments);
        _WindShiftFropaCommand_regex.set(this, /^WSHFT (\d{2})?(\d{2}) FROPA/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _WindShiftFropaCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _WindShiftFropaCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const description = format(_("Remark.WindShift.FROPA", this.locale), matches[1] || "", matches[2]);
        remark.push({
            type: RemarkType.WindShiftFropa,
            description,
            raw: matches[0],
            startHour: matches[1] ? +matches[1] : undefined,
            startMinute: +matches[2],
        });
        return [code.replace(__classPrivateFieldGet(this, _WindShiftFropaCommand_regex, "f"), "").trim(), remark];
    }
}
_WindShiftFropaCommand_regex = new WeakMap();

class DefaultCommand extends Command {
    canParse() {
        return true;
    }
    execute(code, remark) {
        const rmkSplit = pySplit(code, " ", 1);
        const rem = _(`Remark.${rmkSplit[0]}`, this.locale);
        if (RemarkType[rmkSplit[0]]) {
            remark.push({
                type: rmkSplit[0],
                description: rem,
                raw: rmkSplit[0],
            });
        }
        else {
            const lastRemark = remark[remark.length - 1];
            if (lastRemark?.type === RemarkType.Unknown) {
                // Merge with last unknown value
                lastRemark.raw = `${lastRemark.raw} ${rmkSplit[0]}`;
            }
            else {
                remark.push({
                    type: RemarkType.Unknown,
                    raw: rmkSplit[0],
                });
            }
        }
        return [rmkSplit.length === 1 ? "" : rmkSplit[1], remark];
    }
}

var _PrecipitationBegCommand_regex;
class PrecipitationBegCommand extends Command {
    constructor() {
        super(...arguments);
        _PrecipitationBegCommand_regex.set(this, /^(([A-Z]{2})?([A-Z]{2})B(\d{2})?(\d{2}))/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _PrecipitationBegCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _PrecipitationBegCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const descriptive = matches[2] ? as(matches[2], Descriptive) : undefined;
        const phenomenon = as(matches[3], Phenomenon);
        const description = format(_("Remark.Precipitation.Beg.0", this.locale), descriptive ? _(`Descriptive.${descriptive}`, this.locale) : "", _(`Phenomenon.${phenomenon}`, this.locale), matches[4] || "", matches[5])?.trim();
        remark.push({
            type: RemarkType.PrecipitationBeg,
            description,
            raw: matches[0],
            descriptive,
            phenomenon,
            startHour: matches[4] ? +matches[4] : undefined,
            startMin: +matches[5],
        });
        return [code.replace(__classPrivateFieldGet(this, _PrecipitationBegCommand_regex, "f"), "").trim(), remark];
    }
}
_PrecipitationBegCommand_regex = new WeakMap();

var _PrecipitationEndCommand_regex;
class PrecipitationEndCommand extends Command {
    constructor() {
        super(...arguments);
        _PrecipitationEndCommand_regex.set(this, /^(([A-Z]{2})?([A-Z]{2})E(\d{2})?(\d{2}))/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _PrecipitationEndCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _PrecipitationEndCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const descriptive = matches[2] ? as(matches[2], Descriptive) : undefined;
        const phenomenon = as(matches[3], Phenomenon);
        const description = format(_("Remark.Precipitation.End", this.locale), descriptive ? _(`Descriptive.${descriptive}`, this.locale) : "", _(`Phenomenon.${phenomenon}`, this.locale), matches[4] || "", matches[5])?.trim();
        remark.push({
            type: RemarkType.PrecipitationEnd,
            description,
            raw: matches[0],
            descriptive,
            phenomenon,
            endHour: matches[4] ? +matches[4] : undefined,
            endMin: +matches[5],
        });
        return [code.replace(__classPrivateFieldGet(this, _PrecipitationEndCommand_regex, "f"), "").trim(), remark];
    }
}
_PrecipitationEndCommand_regex = new WeakMap();

var _NextForecastByCommand_regex;
class NextForecastByCommand extends Command {
    constructor() {
        super(...arguments);
        _NextForecastByCommand_regex.set(this, /^NXT FCST BY (\d{2})(\d{2})(\d{2})Z/);
    }
    canParse(code) {
        return __classPrivateFieldGet(this, _NextForecastByCommand_regex, "f").test(code);
    }
    execute(code, remark) {
        const matches = code.match(__classPrivateFieldGet(this, _NextForecastByCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const day = +matches[1];
        const hour = matches[2];
        const minute = matches[3];
        const description = format(_("Remark.Next.Forecast.By", this.locale), day, hour, minute);
        remark.push({
            type: RemarkType.NextForecastBy,
            description,
            raw: matches[0],
            day,
            hour: +hour,
            minute: +minute,
        });
        return [code.replace(__classPrivateFieldGet(this, _NextForecastByCommand_regex, "f"), "").trim(), remark];
    }
}
_NextForecastByCommand_regex = new WeakMap();

class RemarkCommandSupplier {
    constructor(locale) {
        this.locale = locale;
        this.defaultCommand = new DefaultCommand(locale);
        this.commandList = [
            new WindPeakCommand(locale),
            new WindShiftFropaCommand(locale),
            new WindShiftCommand(locale),
            new TowerVisibilityCommand(locale),
            new SurfaceVisibilityCommand(locale),
            new PrevailingVisibilityCommand(locale),
            new SecondLocationVisibilityCommand(locale),
            new SectorVisibilityCommand(locale),
            new TornadicActivityBegEndCommand(locale),
            new TornadicActivityBegCommand(locale),
            new TornadicActivityEndCommand(locale),
            new PrecipitationBegEndCommand(locale),
            new PrecipitationBegCommand(locale),
            new PrecipitationEndCommand(locale),
            new ThunderStormLocationMovingCommand(locale),
            new ThunderStormLocationCommand(locale),
            new SmallHailSizeCommand(locale),
            new HailSizeCommand(locale),
            new SnowPelletsCommand(locale),
            new VirgaDirectionCommand(locale),
            new CeilingHeightCommand(locale),
            new ObscurationCommand(locale),
            new VariableSkyHeightCommand(locale),
            new VariableSkyCommand(locale),
            new CeilingSecondLocationCommand(locale),
            new SeaLevelPressureCommand(locale),
            new SnowIncreaseCommand(locale),
            new HourlyMaximumMinimumTemperatureCommand(locale),
            new HourlyMaximumTemperatureCommand(locale),
            new HourlyMinimumTemperatureCommand(locale),
            new HourlyPrecipitationAmountCommand(locale),
            new HourlyTemperatureDewPointCommand(locale),
            new HourlyPressureCommand(locale),
            new IceAccretionCommand(locale),
            new PrecipitationAmount36HourCommand(locale),
            new PrecipitationAmount24HourCommand(locale),
            new SnowDepthCommand(locale),
            new SunshineDurationCommand(locale),
            new WaterEquivalentSnowCommand(locale),
            new NextForecastByCommand(locale),
        ];
    }
    get(code) {
        for (const command of this.commandList) {
            if (command.canParse(code))
                return command;
        }
        return this.defaultCommand;
    }
}
var RemarkType;
(function (RemarkType) {
    // Unknown processed with default command
    RemarkType["Unknown"] = "Unknown";
    // Processed with default command
    RemarkType["AO1"] = "AO1";
    RemarkType["AO2"] = "AO2";
    RemarkType["PRESFR"] = "PRESFR";
    RemarkType["PRESRR"] = "PRESRR";
    RemarkType["TORNADO"] = "TORNADO";
    RemarkType["FUNNELCLOUD"] = "FUNNELCLOUD";
    RemarkType["WATERSPOUT"] = "WATERSPOUT";
    RemarkType["VIRGA"] = "VIRGA";
    // Regular commands below
    RemarkType["WindPeak"] = "WindPeak";
    RemarkType["WindShiftFropa"] = "WindShiftFropa";
    RemarkType["WindShift"] = "WindShift";
    RemarkType["TowerVisibility"] = "TowerVisibility";
    RemarkType["SurfaceVisibility"] = "SurfaceVisibility";
    RemarkType["PrevailingVisibility"] = "PrevailingVisibility";
    RemarkType["SecondLocationVisibility"] = "SecondLocationVisibility";
    RemarkType["SectorVisibility"] = "SectorVisibility";
    RemarkType["TornadicActivityBegEnd"] = "TornadicActivityBegEnd";
    RemarkType["TornadicActivityBeg"] = "TornadicActivityBeg";
    RemarkType["TornadicActivityEnd"] = "TornadicActivityEnd";
    RemarkType["PrecipitationBeg"] = "PrecipitationBeg";
    RemarkType["PrecipitationBegEnd"] = "PrecipitationBegEnd";
    RemarkType["PrecipitationEnd"] = "PrecipitationEnd";
    RemarkType["ThunderStormLocationMoving"] = "ThunderStormLocationMoving";
    RemarkType["ThunderStormLocation"] = "ThunderStormLocation";
    RemarkType["SmallHailSize"] = "SmallHailSize";
    RemarkType["HailSize"] = "HailSize";
    RemarkType["SnowPellets"] = "SnowPellets";
    RemarkType["VirgaDirection"] = "VirgaDirection";
    RemarkType["CeilingHeight"] = "CeilingHeight";
    RemarkType["Obscuration"] = "Obscuration";
    RemarkType["VariableSkyHeight"] = "VariableSkyHeight";
    RemarkType["VariableSky"] = "VariableSky";
    RemarkType["CeilingSecondLocation"] = "CeilingSecondLocation";
    RemarkType["SeaLevelPressure"] = "SeaLevelPressure";
    RemarkType["SnowIncrease"] = "SnowIncrease";
    RemarkType["HourlyMaximumMinimumTemperature"] = "HourlyMaximumMinimumTemperature";
    RemarkType["HourlyMaximumTemperature"] = "HourlyMaximumTemperature";
    RemarkType["HourlyMinimumTemperature"] = "HourlyMinimumTemperature";
    RemarkType["HourlyPrecipitationAmount"] = "HourlyPrecipitationAmount";
    RemarkType["HourlyTemperatureDewPoint"] = "HourlyTemperatureDewPoint";
    RemarkType["HourlyPressure"] = "HourlyPressure";
    RemarkType["IceAccretion"] = "IceAccretion";
    RemarkType["PrecipitationAmount36Hour"] = "PrecipitationAmount36Hour";
    RemarkType["PrecipitationAmount24Hour"] = "PrecipitationAmount24Hour";
    RemarkType["SnowDepth"] = "SnowDepth";
    RemarkType["SunshineDuration"] = "SunshineDuration";
    RemarkType["WaterEquivalentSnow"] = "WaterEquivalentSnow";
    // Canada commands below
    RemarkType["NextForecastBy"] = "NextForecastBy";
})(RemarkType || (RemarkType = {}));

function isWeatherConditionValid(weather) {
    return (weather.phenomenons.length !== 0 ||
        weather.descriptive == Descriptive.THUNDERSTORM ||
        (weather.intensity === Intensity.IN_VICINITY &&
            weather.descriptive == Descriptive.SHOWERS));
}

var _CloudCommand_cloudRegex, _MainVisibilityCommand_regex, _WindCommand_regex, _WindVariationCommand_regex, _WindShearCommand_regex, _VerticalVisibilityCommand_regex, _MinimalVisibilityCommand_regex, _MainVisibilityNauticalMilesCommand_regex, _CommandSupplier_commands$2;
/**
 * This function creates a wind element.
 * @param wind The wind object
 * @param direction The direction in degrees
 * @param speed The speed
 * @param gust The speed of the gust.
 * @param unit The speed unit
 */
function makeWind(direction, speed, gust, unit) {
    return {
        speed: +speed,
        direction: degreesToCardinal(direction),
        degrees: direction !== "VRB" ? +direction : undefined,
        gust: gust ? +gust : undefined,
        unit,
    };
}
class CloudCommand {
    constructor() {
        _CloudCommand_cloudRegex.set(this, /^([A-Z]{3})(?:\/{3}|(\d{3}))?(?:\/{3}|(?:([A-Z]{2,3})(?:\/([A-Z]{2,3}))?))?$/);
    }
    parse(cloudString) {
        const m = cloudString.match(__classPrivateFieldGet(this, _CloudCommand_cloudRegex, "f"));
        if (!m)
            return;
        const quantity = as(m[1], CloudQuantity);
        const height = 100 * +m[2] || undefined;
        const type = m[3] ? as(m[3], CloudType) : undefined;
        const secondaryType = m[4] ? as(m[4], CloudType) : undefined;
        return { quantity, height, type, secondaryType };
    }
    execute(container, cloudString) {
        const cloud = this.parse(cloudString);
        if (cloud) {
            container.clouds.push(cloud);
            return true;
        }
        return false;
    }
    canParse(cloudString) {
        if (cloudString === "NSW")
            return false;
        return __classPrivateFieldGet(this, _CloudCommand_cloudRegex, "f").test(cloudString);
    }
}
_CloudCommand_cloudRegex = new WeakMap();
class MainVisibilityCommand {
    constructor() {
        _MainVisibilityCommand_regex.set(this, /^(\d{4})(|NDV)$/);
    }
    canParse(visibilityString) {
        return __classPrivateFieldGet(this, _MainVisibilityCommand_regex, "f").test(visibilityString);
    }
    execute(container, visibilityString) {
        const matches = visibilityString.match(__classPrivateFieldGet(this, _MainVisibilityCommand_regex, "f"));
        if (!matches)
            return false;
        const distance = convertVisibility(matches[1]);
        if (!container.visibility)
            container.visibility = distance;
        if (matches[2] === "NDV")
            container.visibility.ndv = true;
        return true;
    }
}
_MainVisibilityCommand_regex = new WeakMap();
class WindCommand {
    constructor() {
        _WindCommand_regex.set(this, /^(VRB|000|[0-3]\d{2})(\d{2})G?(\d{2,3})?(KT|MPS|KM\/H)?/);
    }
    canParse(windString) {
        return __classPrivateFieldGet(this, _WindCommand_regex, "f").test(windString);
    }
    parseWind(windString) {
        const matches = windString.match(__classPrivateFieldGet(this, _WindCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Wind should be defined");
        return makeWind(matches[1], matches[2], matches[3], as(matches[4] || "KT", SpeedUnit));
    }
    execute(container, windString) {
        const wind = this.parseWind(windString);
        container.wind = wind;
        return true;
    }
}
_WindCommand_regex = new WeakMap();
class WindVariationCommand {
    constructor() {
        _WindVariationCommand_regex.set(this, /^(\d{3})V(\d{3})/);
    }
    canParse(windString) {
        return __classPrivateFieldGet(this, _WindVariationCommand_regex, "f").test(windString);
    }
    parseWindVariation(wind, windString) {
        const matches = windString.match(__classPrivateFieldGet(this, _WindVariationCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Wind should be defined");
        wind.minVariation = +matches[1];
        wind.maxVariation = +matches[2];
    }
    execute(container, windString) {
        if (!container.wind)
            throw new UnexpectedParseError();
        this.parseWindVariation(container.wind, windString);
        return true;
    }
}
_WindVariationCommand_regex = new WeakMap();
class WindShearCommand {
    constructor() {
        _WindShearCommand_regex.set(this, /^WS(\d{3})\/(\w{3})(\d{2})G?(\d{2,3})?(KT|MPS|KM\/H)/);
    }
    canParse(windString) {
        return __classPrivateFieldGet(this, _WindShearCommand_regex, "f").test(windString);
    }
    parseWindShear(windString) {
        const matches = windString.match(__classPrivateFieldGet(this, _WindShearCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Wind shear should be defined");
        return {
            ...makeWind(matches[2], matches[3], matches[4], as(matches[5], SpeedUnit)),
            height: 100 * +matches[1],
        };
    }
    execute(container, windString) {
        container.windShear = this.parseWindShear(windString);
        return true;
    }
}
_WindShearCommand_regex = new WeakMap();
class VerticalVisibilityCommand {
    constructor() {
        _VerticalVisibilityCommand_regex.set(this, /^VV(\d{3})$/);
    }
    execute(container, visibilityString) {
        const matches = visibilityString.match(__classPrivateFieldGet(this, _VerticalVisibilityCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Vertical visibility should be defined");
        container.verticalVisibility = 100 * +matches[1];
        return true;
    }
    canParse(windString) {
        return __classPrivateFieldGet(this, _VerticalVisibilityCommand_regex, "f").test(windString);
    }
}
_VerticalVisibilityCommand_regex = new WeakMap();
class MinimalVisibilityCommand {
    constructor() {
        _MinimalVisibilityCommand_regex.set(this, /^(\d{4}[NnEeSsWw]{1,2})$/);
    }
    execute(container, visibilityString) {
        const matches = visibilityString.match(__classPrivateFieldGet(this, _MinimalVisibilityCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Vertical visibility should be defined");
        if (!container.visibility)
            throw new UnexpectedParseError("container.visibility not instantiated");
        container.visibility.min = {
            value: +matches[1].slice(0, 4),
            direction: matches[1].slice(4),
        };
        return true;
    }
    canParse(windString) {
        return __classPrivateFieldGet(this, _MinimalVisibilityCommand_regex, "f").test(windString);
    }
}
_MinimalVisibilityCommand_regex = new WeakMap();
class MainVisibilityNauticalMilesCommand {
    constructor() {
        _MainVisibilityNauticalMilesCommand_regex.set(this, /^(P|M)?(\d)*(\s)?((\d\/\d)?SM)$/);
    }
    execute(container, visibilityString) {
        const distance = convertNauticalMilesVisibility(visibilityString);
        container.visibility = distance;
        return true;
    }
    canParse(windString) {
        return __classPrivateFieldGet(this, _MainVisibilityNauticalMilesCommand_regex, "f").test(windString);
    }
}
_MainVisibilityNauticalMilesCommand_regex = new WeakMap();
let CommandSupplier$2 = class CommandSupplier {
    constructor() {
        _CommandSupplier_commands$2.set(this, [
            new WindShearCommand(),
            new WindCommand(),
            new WindVariationCommand(),
            new MainVisibilityCommand(),
            new MainVisibilityNauticalMilesCommand(),
            new MinimalVisibilityCommand(),
            new VerticalVisibilityCommand(),
            new CloudCommand(),
        ]);
    }
    get(input) {
        for (const command of __classPrivateFieldGet(this, _CommandSupplier_commands$2, "f")) {
            if (command.canParse(input))
                return command;
        }
    }
};
_CommandSupplier_commands$2 = new WeakMap();

var _AltimeterCommand_regex;
class AltimeterCommand {
    constructor() {
        _AltimeterCommand_regex.set(this, /^Q(\d{4})$/);
    }
    canParse(input) {
        return __classPrivateFieldGet(this, _AltimeterCommand_regex, "f").test(input);
    }
    execute(metar, input) {
        const matches = input.match(__classPrivateFieldGet(this, _AltimeterCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        metar.altimeter = {
            value: +matches[1],
            unit: AltimeterUnit.HPa,
        };
    }
}
_AltimeterCommand_regex = new WeakMap();

var _AltimeterMercuryCommand_regex;
class AltimeterMercuryCommand {
    constructor() {
        _AltimeterMercuryCommand_regex.set(this, /^A(\d{4})$/);
    }
    canParse(input) {
        return __classPrivateFieldGet(this, _AltimeterMercuryCommand_regex, "f").test(input);
    }
    execute(metar, input) {
        const matches = input.match(__classPrivateFieldGet(this, _AltimeterMercuryCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        const mercury = +matches[1] / 100;
        metar.altimeter = {
            value: mercury,
            unit: AltimeterUnit.InHg,
        };
    }
}
_AltimeterMercuryCommand_regex = new WeakMap();

var _RunwayCommand_genericRegex, _RunwayCommand_runwayMaxRangeRegex, _RunwayCommand_runwayRegex, _RunwayCommand_runwayDepositRegex;
class RunwayCommand {
    constructor() {
        _RunwayCommand_genericRegex.set(this, /^(R\d{2}\w?\/)/);
        _RunwayCommand_runwayMaxRangeRegex.set(this, /^R(\d{2}\w?)\/(\d{4})V([MP])?(\d{3,4})(?:([UDN])|(FT)(?:\/([UDN]))?)$/);
        _RunwayCommand_runwayRegex.set(this, /^R(\d{2}\w?)\/([MP])?(\d{4})(?:([UDN])|(FT)(?:\/([UDN]))?)$/);
        _RunwayCommand_runwayDepositRegex.set(this, /^R(\d{2}\w?)\/([/\d])([/\d])(\/\/|\d{2})(\/\/|\d{2})$/);
    }
    canParse(input) {
        return __classPrivateFieldGet(this, _RunwayCommand_genericRegex, "f").test(input);
    }
    execute(metar, input) {
        if (__classPrivateFieldGet(this, _RunwayCommand_runwayDepositRegex, "f").test(input)) {
            const matches = input.match(__classPrivateFieldGet(this, _RunwayCommand_runwayDepositRegex, "f"));
            if (!matches)
                throw new UnexpectedParseError("Should be able to parse");
            const depositType = as(matches[2], DepositType);
            const coverage = as(matches[3], DepositCoverage);
            metar.runwaysInfo.push({
                name: matches[1],
                depositType,
                coverage,
                thickness: matches[4],
                brakingCapacity: matches[5],
            });
        }
        else if (__classPrivateFieldGet(this, _RunwayCommand_runwayRegex, "f").test(input)) {
            const matches = input.match(__classPrivateFieldGet(this, _RunwayCommand_runwayRegex, "f"));
            if (!matches)
                throw new UnexpectedParseError("Should be able to parse");
            const indicator = matches[2] ? as(matches[2], ValueIndicator) : undefined;
            const trend = (() => {
                if (matches[6])
                    return as(matches[6], RunwayInfoTrend);
                if (matches[4])
                    return as(matches[4], RunwayInfoTrend);
            })();
            const unit = matches[5]
                ? as(matches[5], RunwayInfoUnit)
                : RunwayInfoUnit.Meters;
            metar.runwaysInfo.push({
                name: matches[1],
                indicator,
                minRange: +matches[3],
                trend,
                unit,
            });
        }
        else if (__classPrivateFieldGet(this, _RunwayCommand_runwayMaxRangeRegex, "f").test(input)) {
            const matches = input.match(__classPrivateFieldGet(this, _RunwayCommand_runwayMaxRangeRegex, "f"));
            if (!matches)
                throw new UnexpectedParseError("Should be able to parse");
            const indicator = matches[3] ? as(matches[3], ValueIndicator) : undefined;
            const trend = (() => {
                if (matches[7])
                    return as(matches[7], RunwayInfoTrend);
                if (matches[5])
                    return as(matches[5], RunwayInfoTrend);
            })();
            const unit = matches[6]
                ? as(matches[6], RunwayInfoUnit)
                : RunwayInfoUnit.Meters;
            metar.runwaysInfo.push({
                name: matches[1],
                indicator,
                minRange: +matches[2],
                maxRange: +matches[4],
                trend,
                unit,
            });
        }
    }
}
_RunwayCommand_genericRegex = new WeakMap(), _RunwayCommand_runwayMaxRangeRegex = new WeakMap(), _RunwayCommand_runwayRegex = new WeakMap(), _RunwayCommand_runwayDepositRegex = new WeakMap();

var _TemperatureCommand_regex;
class TemperatureCommand {
    constructor() {
        _TemperatureCommand_regex.set(this, /^(M?\d{2})\/(M?\d{2})$/);
    }
    canParse(input) {
        return __classPrivateFieldGet(this, _TemperatureCommand_regex, "f").test(input);
    }
    execute(metar, input) {
        const matches = input.match(__classPrivateFieldGet(this, _TemperatureCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        metar.temperature = convertTemperature(matches[1]);
        metar.dewPoint = convertTemperature(matches[2]);
    }
}
_TemperatureCommand_regex = new WeakMap();

var _CommandSupplier_commands$1;
let CommandSupplier$1 = class CommandSupplier {
    constructor() {
        _CommandSupplier_commands$1.set(this, [
            new RunwayCommand(),
            new TemperatureCommand(),
            new AltimeterCommand(),
            new AltimeterMercuryCommand(),
        ]);
    }
    get(input) {
        for (const command of __classPrivateFieldGet(this, _CommandSupplier_commands$1, "f")) {
            if (command.canParse(input))
                return command;
        }
    }
};
_CommandSupplier_commands$1 = new WeakMap();

var _IcingCommand_regex;
class IcingCommand {
    constructor() {
        _IcingCommand_regex.set(this, /^6(\d)(\d{3})(\d)$/);
    }
    canParse(input) {
        return __classPrivateFieldGet(this, _IcingCommand_regex, "f").test(input);
    }
    execute(container, input) {
        const matches = input.match(__classPrivateFieldGet(this, _IcingCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        if (!container.icing)
            container.icing = [];
        container.icing.push({
            intensity: as(matches[1], IcingIntensity),
            baseHeight: +matches[2] * 100,
            depth: +matches[3] * 1000,
        });
    }
}
_IcingCommand_regex = new WeakMap();

var _TurbulenceCommand_regex;
class TurbulenceCommand {
    constructor() {
        _TurbulenceCommand_regex.set(this, /^5(\d|X)(\d{3})(\d)$/);
    }
    canParse(input) {
        return __classPrivateFieldGet(this, _TurbulenceCommand_regex, "f").test(input);
    }
    execute(container, input) {
        const matches = input.match(__classPrivateFieldGet(this, _TurbulenceCommand_regex, "f"));
        if (!matches)
            throw new UnexpectedParseError("Match not found");
        if (!container.turbulence)
            container.turbulence = [];
        container.turbulence.push({
            intensity: as(matches[1], TurbulenceIntensity),
            baseHeight: +matches[2] * 100,
            depth: +matches[3] * 1000,
        });
    }
}
_TurbulenceCommand_regex = new WeakMap();

var _CommandSupplier_commands;
class CommandSupplier {
    constructor() {
        _CommandSupplier_commands.set(this, [new TurbulenceCommand(), new IcingCommand()]);
    }
    get(input) {
        for (const command of __classPrivateFieldGet(this, _CommandSupplier_commands, "f")) {
            if (command.canParse(input))
                return command;
        }
    }
}
_CommandSupplier_commands = new WeakMap();

var _a, _AbstractParser_TOKENIZE_REGEX, _AbstractParser_INTENSITY_REGEX, _AbstractParser_CAVOK, _AbstractParser_commonSupplier, _MetarParser_commandSupplier, _TAFParser_commandSupplier, _TAFParser_validityPattern, _TAFParser_partialPattern, _RemarkParser_supplier;
function isStation(stationString) {
    return stationString.length === 4;
}
/**
 * Parses the delivery time of a METAR/TAF
 * @param abstractWeatherCode The TAF or METAR object
 * @param timeString The string representing the delivery time
 */
function parseDeliveryTime(timeString) {
    const day = +timeString.slice(0, 2);
    const hour = +timeString.slice(2, 4);
    const minute = +timeString.slice(4, 6);
    if (isNaN(day) || isNaN(hour) || isNaN(minute))
        return;
    return {
        day,
        hour,
        minute,
    };
}
function parseFlags(abstractWeatherCode, flag) {
    const flags = findFlags(flag);
    if (flags)
        Object.assign(abstractWeatherCode, flags);
    return !!flags;
}
var FlagMap;
(function (FlagMap) {
    FlagMap["AMD"] = "amendment";
    FlagMap["AUTO"] = "auto";
    FlagMap["CNL"] = "canceled";
    FlagMap["COR"] = "corrected";
    FlagMap["NIL"] = "nil";
})(FlagMap || (FlagMap = {}));
function findFlags(flag) {
    if (flag in FlagMap)
        return { [FlagMap[flag]]: true };
}
/**
 * This function parses the array containing the remark and concat the array into a string
 * @param container the metar, taf or taf trend to update
 * @param line The array containing the current line tokens
 * @param index the index starting the remark ie token RMK
 */
function parseRemark(container, line, index, locale) {
    const remarks = new RemarkParser(locale).parse(line.slice(index + 1).join(" "));
    container.remarks = remarks;
    container.remark = remarks
        .map(({ description, raw }) => description || raw)
        .join(" ");
}
/**
 * Parses the temperature in a TAF
 * @param input the string containing the temperature
 * @returns TemperatureDated object
 */
function parseTemperature(input) {
    const parts = pySplit(input, "/");
    return {
        temperature: convertTemperature(parts[0].slice(2)),
        day: +parts[1].slice(0, 2),
        hour: +parts[1].slice(2, 4),
    };
}
/**
 * Parses validity of a TAF or a TAFTrend
 * @param input the string containing the validity
 * @returns Validity object
 */
function parseValidity(input) {
    const parts = pySplit(input, "/");
    return {
        startDay: +parts[0].slice(0, 2),
        startHour: +parts[0].slice(2),
        endDay: +parts[1].slice(0, 2),
        endHour: +parts[1].slice(2),
    };
}
/**
 * Parses the validity for a FROM taf trend
 * @param input the string containing the validity
 * @returns a Validity object
 */
function parseFromValidity(input) {
    return {
        startDay: +input.slice(2, 4),
        startHour: +input.slice(4, 6),
        startMinutes: +input.slice(6, 8),
    };
}
/**
 * Abstract class.
 * Base parser.
 */
class AbstractParser {
    constructor(locale) {
        this.locale = locale;
        this.FM = "FM";
        this.TEMPO = "TEMPO";
        this.INTER = "INTER";
        this.BECMG = "BECMG";
        this.RMK = "RMK";
    }
    parseWeatherCondition(input) {
        let intensity;
        if (input.match(__classPrivateFieldGet(_a, _a, "f", _AbstractParser_INTENSITY_REGEX))) {
            const match = input.match(__classPrivateFieldGet(_a, _a, "f", _AbstractParser_INTENSITY_REGEX))?.[0];
            if (match) {
                intensity = match;
                input = input.slice(match.length);
            }
        }
        let descriptive;
        const descriptives = Object.values(Descriptive);
        for (let i = 0; i < descriptives.length; i++) {
            const key = descriptives[i];
            if (input.startsWith(key)) {
                descriptive = key;
                input = input.slice(key.length);
                break;
            }
        }
        const weatherCondition = {
            intensity,
            descriptive,
            phenomenons: [],
        };
        const phenomenons = Object.values(Phenomenon);
        for (let i = 0; i < phenomenons.length; i++) {
            const key = phenomenons[i];
            // Thunderstorm as descriptive should not be added as a phenomenon
            if (descriptive === key)
                continue;
            // Phenomenons can be separated with a slash
            const conditionRegex = new RegExp(`^\/?${key}`);
            const inputMatch = input.match(conditionRegex)?.[0];
            if (inputMatch) {
                weatherCondition.phenomenons.push(key);
                input = input.slice(inputMatch.length);
                // Restart the search for an additional phenomenon
                i = -1;
                continue;
            }
        }
        // If anything is left unparsed, it's not a valid weather condition
        if (input.replace(/\//g, "").length)
            return;
        return weatherCondition;
    }
    /**
     * Parses the message into different tokens
     * @param input The metar or TAF as string
     * @returns List of tokens
     */
    tokenize(input) {
        return input.split(__classPrivateFieldGet(_a, _a, "f", _AbstractParser_TOKENIZE_REGEX)).filter((v) => v);
    }
    /**
     * Common parse method for METAR, TAF and trends object
     * @param abstractWeatherCode the object to update
     * @param input The token to parse
     * @returns True if the token was parsed false otherwise
     */
    generalParse(abstractWeatherContainer, input) {
        if (input === __classPrivateFieldGet(_a, _a, "f", _AbstractParser_CAVOK)) {
            abstractWeatherContainer.cavok = true;
            abstractWeatherContainer.visibility = {
                indicator: ValueIndicator.GreaterThan,
                value: 9999,
                unit: DistanceUnit.Meters,
            };
            return true;
        }
        const weatherCondition = this.parseWeatherCondition(input);
        if (weatherCondition && isWeatherConditionValid(weatherCondition)) {
            abstractWeatherContainer.weatherConditions.push(weatherCondition);
            return true;
        }
        const command = __classPrivateFieldGet(_a, _a, "f", _AbstractParser_commonSupplier).get(input);
        if (command) {
            try {
                return command.execute(abstractWeatherContainer, input);
            }
            catch (error) {
                if (error instanceof CommandExecutionError)
                    return false;
                throw error;
            }
        }
        return false;
    }
}
_a = AbstractParser;
_AbstractParser_TOKENIZE_REGEX = { value: /\s((?=\d\/\dSM)(?<!\s(P|M)?\d\s)|(?!\d\/\dSM))|=/ };
_AbstractParser_INTENSITY_REGEX = { value: /^(-|\+|VC)/ };
_AbstractParser_CAVOK = { value: "CAVOK" };
_AbstractParser_commonSupplier = { value: new CommandSupplier$2() };
class MetarParser extends AbstractParser {
    constructor() {
        super(...arguments);
        this.AT = "AT";
        this.TL = "TL";
        _MetarParser_commandSupplier.set(this, new CommandSupplier$1());
    }
    /**
     * Parses a trend of a metar
     * @param index the index starting the trend in the list
     * @param trend The trend to update
     * @param trendParts array of tokens
     * @returns the last index of the token that was last parsed
     */
    parseTrend(index, trend, trendParts) {
        let i = index + 1;
        while (i < trendParts.length &&
            trendParts[i] !== this.TEMPO &&
            trendParts[i] !== this.INTER &&
            trendParts[i] !== this.BECMG) {
            if (trendParts[i].startsWith(this.FM) ||
                trendParts[i].startsWith(this.TL) ||
                trendParts[i].startsWith(this.AT)) {
                const trendTime = {
                    type: TimeIndicator[trendParts[i].slice(0, 2)],
                    hour: +trendParts[i].slice(2, 4),
                    minute: +trendParts[i].slice(4, 6),
                };
                trend.times.push(trendTime);
            }
            else {
                this.generalParse(trend, trendParts[i]);
            }
            i = i + 1;
        }
        return i - 1;
    }
    /**
     * Parses an message and returns a METAR
     * @param input The message to parse
     * @returns METAR
     */
    parse(input) {
        const metarTab = this.tokenize(input);
        let index = 0;
        const type = this.parseType(metarTab[index]);
        if (type)
            index++;
        // Only parse flag if precedes station identifier
        if (isStation(metarTab[index + 1])) {
            var flags = findFlags(metarTab[index]);
            if (flags)
                index += 1;
        }
        const metar = {
            type,
            station: metarTab[index],
            ...parseDeliveryTime(metarTab[index + 1]),
            ...flags,
            message: input,
            remarks: [],
            clouds: [],
            weatherConditions: [],
            trends: [],
            runwaysInfo: [],
        };
        index += 2;
        while (index < metarTab.length) {
            if (!super.generalParse(metar, metarTab[index]) &&
                !parseFlags(metar, metarTab[index])) {
                if (metarTab[index] === "NOSIG") {
                    metar.nosig = true;
                }
                else if (metarTab[index] === this.TEMPO ||
                    metarTab[index] === this.INTER ||
                    metarTab[index] === this.BECMG) {
                    const startIndex = index;
                    const trend = {
                        type: WeatherChangeType[metarTab[index]],
                        weatherConditions: [],
                        clouds: [],
                        times: [],
                        remarks: [],
                        raw: "",
                    };
                    index = this.parseTrend(index, trend, metarTab);
                    trend.raw = metarTab.slice(startIndex, index + 1).join(" ");
                    metar.trends.push(trend);
                }
                else if (metarTab[index] === this.RMK) {
                    parseRemark(metar, metarTab, index, this.locale);
                    break;
                }
                else {
                    const command = __classPrivateFieldGet(this, _MetarParser_commandSupplier, "f").get(metarTab[index]);
                    if (command)
                        command.execute(metar, metarTab[index]);
                }
            }
            index = index + 1;
        }
        return metar;
    }
    parseType(token) {
        for (const type in MetarType) {
            if (token === MetarType[type])
                return type;
        }
    }
}
_MetarParser_commandSupplier = new WeakMap();
/**
 * Parser for TAF messages
 */
class TAFParser extends AbstractParser {
    constructor() {
        super(...arguments);
        this.TAF = "TAF";
        this.PROB = "PROB";
        this.TX = "TX";
        this.TN = "TN";
        _TAFParser_commandSupplier.set(this, new CommandSupplier());
        _TAFParser_validityPattern.set(this, /^\d{4}\/\d{4}$/);
        _TAFParser_partialPattern.set(this, /^PART (\d) OF (\d) /);
    }
    /**
     * Check a tokenized TAF against patterns that are explicitly not supported,
     * throwing a descriptive exception to assist anyone who might want to apply
     * any necessary custom parsing.
     *
     * @param input original input.
     */
    throwIfPartial(input) {
        // TAFs in NOAA cycle files beginning `PART x OF y`,
        // implying they are incomplete
        const matches = input.match(__classPrivateFieldGet(this, _TAFParser_partialPattern, "f"));
        if (matches) {
            const [partialMessage, part, total] = matches;
            throw new PartialWeatherStatementError(partialMessage.trim(), +part, +total);
        }
    }
    /**
     * TAF messages can be formatted poorly
     *
     * Attempt to handle those situations gracefully
     */
    parseMessageStart(input) {
        let index = 0;
        if (input[index] === this.TAF)
            index += 1;
        if (input[index + 1] === this.TAF)
            index += 2;
        const flags1 = findFlags(input[index]);
        if (flags1)
            index += 1;
        if (input[index] === this.TAF)
            index += 1;
        const flags2 = findFlags(input[index]);
        if (flags2)
            index += 1;
        return [index, { ...flags1, ...flags2 }];
    }
    /**
     * the message to parse
     * @param input
     * @returns a TAF object
     * @throws ParseError if the message is invalid
     */
    parse(input) {
        this.throwIfPartial(input);
        const lines = this.extractLinesTokens(input);
        let [index, flags] = this.parseMessageStart(lines[0]);
        const station = lines[0][index];
        index += 1;
        const time = parseDeliveryTime(lines[0][index]);
        if (time)
            index += 1;
        const validity = parseValidity(lines[0][index]);
        const taf = {
            station,
            ...flags,
            ...time,
            validity,
            message: input,
            trends: [],
            remarks: [],
            clouds: [],
            weatherConditions: [],
            initialRaw: lines[0].join(" "),
        };
        for (let i = index + 1; i < lines[0].length; i++) {
            const token = lines[0][i];
            const tafCommand = __classPrivateFieldGet(this, _TAFParser_commandSupplier, "f").get(token);
            if (token == this.RMK) {
                parseRemark(taf, lines[0], i, this.locale);
                break;
            }
            else if (tafCommand) {
                tafCommand.execute(taf, token);
            }
            else {
                this.generalParse(taf, token);
                parseFlags(taf, token);
            }
        }
        const minMaxTemperatureLines = [
            lines[0].slice(index + 1), // EU countries have min/max in first line
        ];
        // US military bases have min/max in last line
        if (lines.length > 1)
            minMaxTemperatureLines.push(lines[lines.length - 1]);
        this.parseMaxMinTemperatures(taf, minMaxTemperatureLines);
        // Handle the other lines
        for (let i = 1; i < lines.length; i++) {
            this.parseLine(taf, lines[i]);
        }
        return taf;
    }
    parseMaxMinTemperatures(taf, lines) {
        for (const line of lines) {
            for (const token of line) {
                if (token == this.RMK)
                    break;
                else if (token.startsWith(this.TX))
                    taf.maxTemperature = parseTemperature(token);
                else if (token.startsWith(this.TN))
                    taf.minTemperature = parseTemperature(token);
            }
        }
    }
    /**
     * Format the message as a multiple line code so each line can be parsed
     * @param tafCode The base message
     * @returns a list of string representing the lines of the message
     */
    extractLinesTokens(tafCode) {
        const singleLine = tafCode.replace(/\n/g, " ");
        const cleanLine = singleLine.replace(/\s{2,}/g, " ");
        const lines = joinProbIfNeeded(cleanLine
            .replace(/\s(?=PROB\d{2}\s(?=TEMPO|INTER)|TEMPO|INTER|BECMG|FM(?![A-Z]{2}\s)|PROB)/g, "\n")
            .split(/\n/));
        // TODO cleanup
        function joinProbIfNeeded(ls) {
            for (let i = 0; i < ls.length; i++) {
                if (/^PROB\d{2}$/.test(ls[i]) && /^TEMPO|INTER/.test(ls[i + 1])) {
                    ls.splice(i, 2, `${ls[i]} ${ls[i + 1]}`);
                }
            }
            return ls;
        }
        const linesToken = lines.map(this.tokenize);
        return linesToken;
    }
    /**
     * Parses the tokens of the line and updates the TAF object
     * @param taf TAF object to update
     * @param lineTokens the array of tokens representing a line
     */
    parseLine(taf, lineTokens) {
        let index = 1;
        let trend;
        if (lineTokens[0].startsWith(this.FM)) {
            trend = {
                ...this.makeEmptyTAFTrend(),
                type: WeatherChangeType.FM,
                validity: parseFromValidity(lineTokens[0]),
                raw: lineTokens.join(" "),
            };
        }
        else if (lineTokens[0].startsWith(this.PROB)) {
            const validity = this.findLineValidity(index, lineTokens);
            if (!validity)
                return;
            trend = {
                ...this.makeEmptyTAFTrend(),
                type: WeatherChangeType.PROB,
                validity,
                raw: lineTokens.join(" "),
            };
            if (lineTokens.length > 1 &&
                (lineTokens[1] === this.TEMPO || lineTokens[1] === this.INTER)) {
                trend = {
                    ...this.makeEmptyTAFTrend(),
                    type: WeatherChangeType[lineTokens[1]],
                    validity,
                    raw: lineTokens.join(" "),
                };
                index = 2;
            }
            trend.probability = +lineTokens[0].slice(4);
        }
        else {
            const validity = this.findLineValidity(index, lineTokens);
            if (!validity)
                return;
            trend = {
                ...this.makeEmptyTAFTrend(),
                type: WeatherChangeType[lineTokens[0]],
                validity,
                raw: lineTokens.join(" "),
            };
        }
        this.parseTrend(index, lineTokens, trend);
        taf.trends.push(trend);
    }
    /**
     * Finds a non-FM validity in a line
     * @param index the index at which the array should be parsed
     * @param line The array of string containing the line
     * @param trend The trend object to update
     */
    findLineValidity(index, line) {
        let validity;
        for (let i = index; i < line.length; i++) {
            if (__classPrivateFieldGet(this, _TAFParser_validityPattern, "f").test(line[i]))
                validity = parseValidity(line[i]);
        }
        return validity;
    }
    /**
     * Parses a trend of the TAF
     * @param index the index at which the array should be parsed
     * @param line The array of string containing the line
     * @param trend The trend object to update
     */
    parseTrend(index, line, trend) {
        for (let i = index; i < line.length; i++) {
            const tafCommand = __classPrivateFieldGet(this, _TAFParser_commandSupplier, "f").get(line[i]);
            if (line[i] === this.RMK) {
                parseRemark(trend, line, i, this.locale);
                break;
            }
            // already parsed
            else if (__classPrivateFieldGet(this, _TAFParser_validityPattern, "f").test(line[i]))
                continue;
            else if (tafCommand) {
                tafCommand.execute(trend, line[i]);
            }
            else
                super.generalParse(trend, line[i]);
        }
    }
    makeEmptyTAFTrend() {
        return {
            remarks: [],
            clouds: [],
            weatherConditions: [],
        };
    }
}
_TAFParser_commandSupplier = new WeakMap(), _TAFParser_validityPattern = new WeakMap(), _TAFParser_partialPattern = new WeakMap();
class RemarkParser {
    constructor(locale) {
        this.locale = locale;
        _RemarkParser_supplier.set(this, void 0);
        __classPrivateFieldSet(this, _RemarkParser_supplier, new RemarkCommandSupplier(this.locale), "f");
    }
    parse(code) {
        let rmkStr = code;
        let rmkList = [];
        while (rmkStr) {
            try {
                [rmkStr, rmkList] = __classPrivateFieldGet(this, _RemarkParser_supplier, "f").get(rmkStr).execute(rmkStr, rmkList);
            }
            catch (e) {
                if (e instanceof CommandExecutionError) {
                    [rmkStr, rmkList] = __classPrivateFieldGet(this, _RemarkParser_supplier, "f").defaultCommand.execute(rmkStr, rmkList);
                }
                else {
                    throw e;
                }
            }
        }
        return rmkList;
    }
}
_RemarkParser_supplier = new WeakMap();

/**
 *
 * @param date Ideally the date the report was issued. However, any date within
 * ~14 days of the report will work.
 * @param day Day of the month (from the report)
 * @param hour Hour (from the report)
 * @param minute Minute (from the report)
 * @returns
 */
function determineReportDate(date, day, hour, minute = 0) {
    // Some TAF reports do not include a delivery time
    if (day == null || hour == null)
        return date;
    const months = [
        setDateComponents(addMonthsUTC(date, -1), day, hour, minute),
        setDateComponents(new Date(date), day, hour, minute),
        setDateComponents(addMonthsUTC(date, 1), day, hour, minute),
    ];
    return months
        .map((d) => ({
        date: d,
        difference: Math.abs(d.getTime() - date.getTime()),
    }))
        .sort((a, b) => a.difference - b.difference)[0].date;
}
function setDateComponents(date, day, hour, minute) {
    date.setUTCDate(day);
    date.setUTCHours(hour);
    if (minute != null)
        date.setUTCMinutes(minute);
    return date;
}
function addMonthsUTC(date, count) {
    if (date && count) {
        let m, d = (date = new Date(+date)).getUTCDate();
        date.setUTCMonth(date.getUTCMonth() + count, 1);
        m = date.getUTCMonth();
        date.setUTCDate(d);
        if (date.getUTCMonth() !== m)
            date.setUTCDate(0);
    }
    return date;
}

function metarDatesHydrator(report, date) {
    return {
        ...report,
        issued: determineReportDate(date, report.day, report.hour, report.minute),
    };
}

function remarksDatesHydrator(remarks, date) {
    return remarks.map((remark) => {
        if (remark.type === RemarkType.NextForecastBy) {
            return {
                ...remark,
                date: determineReportDate(date, remark.day, remark.hour, remark.minute),
            };
        }
        return remark;
    });
}
function tafDatesHydrator(report, date) {
    const issued = determineReportDate(date, report.day, report.hour, report.minute);
    return {
        ...report,
        issued,
        validity: {
            ...report.validity,
            start: determineReportDate(issued, report.validity.startDay, report.validity.startHour),
            end: determineReportDate(issued, report.validity.endDay, report.validity.endHour),
        },
        minTemperature: report.minTemperature
            ? {
                ...report.minTemperature,
                date: determineReportDate(issued, report.minTemperature.day, report.minTemperature.hour),
            }
            : undefined,
        maxTemperature: report.maxTemperature
            ? {
                ...report.maxTemperature,
                date: determineReportDate(issued, report.maxTemperature.day, report.maxTemperature.hour),
            }
            : undefined,
        trends: report.trends.map((trend) => ({
            ...trend,
            remarks: remarksDatesHydrator(trend.remarks, issued),
            validity: (() => {
                switch (trend.type) {
                    case WeatherChangeType.FM:
                        return {
                            ...trend.validity,
                            start: determineReportDate(issued, trend.validity.startDay, trend.validity.startHour, trend.validity.startMinutes),
                        };
                    default:
                        return {
                            ...trend.validity,
                            start: determineReportDate(issued, trend.validity.startDay, trend.validity.startHour),
                            end: determineReportDate(issued, trend.validity.endDay, trend.validity.endHour),
                        };
                }
            })(),
        })),
        remarks: remarksDatesHydrator(report.remarks, issued),
    };
}

function getForecastFromTAF(taf) {
    const { trends, wind, visibility, verticalVisibility, windShear, cavok, remark, remarks, clouds, weatherConditions, initialRaw, validity, ...tafWithoutBaseProperties } = taf;
    return {
        ...tafWithoutBaseProperties,
        start: determineReportDate(taf.issued, taf.validity.startDay, taf.validity.startHour),
        end: determineReportDate(taf.issued, taf.validity.endDay, taf.validity.endHour),
        forecast: hydrateEndDates([makeInitialForecast(taf), ...taf.trends], taf.validity),
    };
}
/**
 * Treat the base of the TAF as a FM
 */
function makeInitialForecast(taf) {
    return {
        wind: taf.wind,
        visibility: taf.visibility,
        verticalVisibility: taf.verticalVisibility,
        windShear: taf.windShear,
        cavok: taf.cavok,
        remark: taf.remark,
        remarks: taf.remarks,
        clouds: taf.clouds,
        weatherConditions: taf.weatherConditions,
        raw: taf.initialRaw,
        turbulence: taf.turbulence,
        icing: taf.icing,
        validity: {
            // End day/hour are for end of the entire TAF
            startDay: taf.validity.startDay,
            startHour: taf.validity.startHour,
            startMinutes: 0,
            start: taf.validity.start,
        },
    };
}
function hasImplicitEnd({ type }) {
    return (type === WeatherChangeType.FM ||
        // BECMG are special - the "end" date in the validity isn't actually
        // the end date, it's when the change that's "becoming" is expected to
        // finish transition. The actual "end" date of the BECMG is determined by
        // the next FM/BECMG/end of the report validity, just like a FM
        type === WeatherChangeType.BECMG ||
        // Special case for beginning of report conditions
        type === undefined);
}
function hydrateEndDates(trends, reportValidity) {
    function findNext(index) {
        for (let i = index; i < trends.length; i++) {
            if (hasImplicitEnd(trends[i]))
                return trends[i];
        }
    }
    const forecasts = [];
    let previouslyHydratedTrend;
    for (let i = 0; i < trends.length; i++) {
        const currentTrend = trends[i];
        const nextTrend = findNext(i + 1);
        if (!hasImplicitEnd(currentTrend)) {
            const { validity, ...trend } = currentTrend;
            forecasts.push({
                ...trend,
                start: currentTrend.validity.start,
                // Has a type and not a FM/BECMG/undefined, so always has an end
                end: currentTrend.validity.end,
            });
            continue;
        }
        let forecast;
        const { validity, ...trendWithoutValidity } = currentTrend;
        if (nextTrend === undefined) {
            forecast = hydrateWithPreviousContextIfNeeded({
                ...trendWithoutValidity,
                start: currentTrend.validity.start,
                end: reportValidity.end,
                ...byIfNeeded(currentTrend),
            }, previouslyHydratedTrend);
        }
        else {
            forecast = hydrateWithPreviousContextIfNeeded({
                ...trendWithoutValidity,
                start: currentTrend.validity.start,
                end: new Date(nextTrend.validity.start),
                ...byIfNeeded(currentTrend),
            }, previouslyHydratedTrend);
        }
        forecasts.push(forecast);
        previouslyHydratedTrend = forecast;
    }
    return forecasts;
}
/**
 * BECMG doesn't always have all the context for the period, so
 * it needs to be populated
 */
function hydrateWithPreviousContextIfNeeded(forecast, context) {
    // BECMG is the only forecast type that inherits old conditions
    // Anything else starts anew
    if (forecast.type !== WeatherChangeType.BECMG || !context)
        return forecast;
    // Remarks should not be carried over
    context = { ...context };
    delete context.remark;
    context.remarks = [];
    // vertical visibility should not be carried over, if clouds exist
    if (forecast.clouds.length)
        delete context.verticalVisibility;
    // CAVOK should not propagate if anything other than wind changes
    if (forecast.clouds.length ||
        forecast.verticalVisibility ||
        forecast.weatherConditions.length ||
        forecast.visibility)
        delete context.cavok;
    forecast = {
        ...context,
        ...forecast,
    };
    if (!forecast.clouds.length) {
        forecast.clouds = context.clouds;
    }
    if (!forecast.weatherConditions.length)
        forecast.weatherConditions = context.weatherConditions;
    return forecast;
}
class TimestampOutOfBoundsError extends ParseError {
    constructor(message) {
        super(message);
        this.name = "TimestampOutOfBoundsError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
function getCompositeForecastForDate(date, forecastContainer) {
    // Validity bounds check
    if (date.getTime() < forecastContainer.start.getTime() ||
        date.getTime() >= forecastContainer.end.getTime())
        throw new TimestampOutOfBoundsError("Provided timestamp is outside the report validity period");
    let prevailing;
    let supplemental = [];
    for (const forecast of forecastContainer.forecast) {
        if (hasImplicitEnd(forecast) &&
            forecast.start.getTime() <= date.getTime()) {
            // Is FM, BECMG or initial forecast
            prevailing = forecast;
        }
        if (!hasImplicitEnd(forecast) &&
            forecast.end &&
            forecast.end.getTime() - date.getTime() > 0 &&
            forecast.start.getTime() - date.getTime() <= 0) {
            // Is TEMPO, INTER, PROB etc
            supplemental.push(forecast);
        }
    }
    if (!prevailing)
        throw new UnexpectedParseError("Unable to find trend for date");
    return { prevailing, supplemental };
}
function byIfNeeded(forecast) {
    if (forecast.type !== WeatherChangeType.BECMG)
        return {};
    return { by: forecast.validity.end };
}

function parseMetar(rawMetar, options) {
    return parse(rawMetar, options, MetarParser, metarDatesHydrator);
}
function parseTAF(rawTAF, options) {
    return parse(rawTAF, options, TAFParser, tafDatesHydrator);
}
function parseTAFAsForecast(rawTAF, options) {
    const taf = parseTAF(rawTAF, options);
    return getForecastFromTAF(taf);
}
function parse(rawReport, options, parser, datesHydrator) {
    const lang = options?.locale || en;
    try {
        const report = new parser(lang).parse(rawReport);
        if (options && "issued" in options && options.issued) {
            return datesHydrator(report, options.issued);
        }
        return report;
    }
    catch (e) {
        if (e instanceof ParseError)
            throw e;
        throw new InvalidWeatherStatementError(e);
    }
}

export { AltimeterUnit, CloudQuantity, CloudType, CommandExecutionError, DepositCoverage, DepositType, Descriptive, Direction, DistanceUnit, IcingIntensity, Intensity, InvalidWeatherStatementError, MetarType, ParseError, PartialWeatherStatementError, Phenomenon, RemarkType, RunwayInfoTrend, RunwayInfoUnit, SpeedUnit, TimeIndicator, TimestampOutOfBoundsError, TurbulenceIntensity, UnexpectedParseError, ValueIndicator, WeatherChangeType, getCompositeForecastForDate, isWeatherConditionValid, parseMetar, parseTAF, parseTAFAsForecast };
