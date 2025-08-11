var en = {
    CloudQuantity: {
        BKN: "broken",
        FEW: "few",
        NSC: "no significant clouds.",
        OVC: "overcast",
        SCT: "scattered",
        SKC: "sky clear",
    },
    CloudType: {
        AC: "Altocumulus",
        AS: "Altostratus",
        CB: "Cumulonimbus",
        CC: "CirroCumulus",
        CI: "Cirrus",
        CS: "Cirrostratus",
        CU: "Cumulus",
        NS: "Nimbostratus",
        SC: "Stratocumulus",
        ST: "Stratus",
        TCU: "Towering cumulus",
    },
    Converter: {
        D: "decreasing",
        E: "East",
        ENE: "East North East",
        ESE: "East South East",
        N: "North",
        NE: "North East",
        NNE: "North North East",
        NNW: "North North West",
        NSC: "no significant change",
        NW: "North West",
        S: "South",
        SE: "South East",
        SSE: "South South East",
        SSW: "South South West",
        SW: "South West",
        U: "up rising",
        VRB: "Variable",
        W: "West",
        WNW: "West North West",
        WSW: "West South West",
    },
    DepositBrakingCapacity: {
        GOOD: "good",
        MEDIUM: "medium",
        MEDIUM_GOOD: "medium/good",
        MEDIUM_POOR: "poor/medium",
        NOT_REPORTED: "not reported",
        POOR: "poor",
        UNRELIABLE: "figures unreliable",
    },
    DepositCoverage: {
        FROM_11_TO_25: "from 11% to 25%",
        FROM_26_TO_50: "from 26% to 50%",
        FROM_51_TO_100: "from 51% to 100%",
        LESS_10: "less than 10%",
        NOT_REPORTED: "not reported",
    },
    DepositThickness: {
        CLOSED: "closed",
        LESS_1_MM: "less than 1 mm",
        NOT_REPORTED: "not reported",
        THICKNESS_10: "10 cm",
        THICKNESS_15: "15 cm",
        THICKNESS_20: "20 cm",
        THICKNESS_25: "25 cm",
        THICKNESS_30: "30 cm",
        THICKNESS_35: "35 cm",
        THICKNESS_40: "40 cm or more",
    },
    DepositType: {
        CLEAR_DRY: "clear and dry",
        COMPACTED_SNOW: "compacted or rolled snow",
        DAMP: "damp",
        DRY_SNOW: "dry snow",
        FROZEN_RIDGES: "frozen ruts or ridges",
        ICE: "ice",
        NOT_REPORTED: "not reported",
        RIME_FROST_COVERED: "rime or frost covered",
        SLUSH: "slush",
        WET_SNOW: "wet snow",
        WET_WATER_PATCHES: "wet or water patches",
    },
    Descriptive: {
        BC: "patches",
        BL: "blowing",
        DR: "low drifting",
        FZ: "freezing",
        MI: "shallow",
        PR: "partial",
        SH: "showers of",
        TS: "thunderstorm",
    },
    Error: {
        prefix: "An error occurred. Error code n°",
    },
    ErrorCode: {
        AirportNotFound: "The airport was not found for this message.",
        InvalidMessage: "The entered message is invalid.",
    },
    Indicator: {
        M: "less than",
        P: "greater than",
    },
    "intensity-plus": "Heavy",
    Intensity: {
        "-": "Light",
        VC: "In the vicinity",
    },
    MetarFacade: {
        InvalidIcao: "Icao code is invalid.",
    },
    Phenomenon: {
        BR: "mist",
        DS: "duststorm",
        DU: "widespread dust",
        DZ: "drizzle",
        FC: "funnel cloud",
        FG: "fog",
        FU: "smoke",
        GR: "hail",
        GS: "small hail and/or snow pellets",
        HZ: "haze",
        IC: "ice crystals",
        PL: "ice pellets",
        PO: "dust or sand whirls",
        PY: "spray",
        RA: "rain",
        SA: "sand",
        SG: "snow grains",
        SN: "snow",
        SQ: "squall",
        SS: "sandstorm",
        TS: "thunderstorm",
        UP: "unknown precipitation",
        VA: "volcanic ash",
        NSW: 'no significant weather'
    },
    Remark: {
        ALQDS: "all quadrants",
        AO1: "automated stations without a precipitation discriminator",
        AO2: "automated station with a precipitation discriminator",
        AO2A: "automated station with a precipitation discriminator (augmented)",
        BASED: "based",
        Barometer: [
            "Increase, then decrease",
            "Increase, then steady, or increase then Increase more slowly",
            "steady or unsteady increase",
            "Decrease or steady, then increase; or increase then increase more rapidly",
            "Steady",
            "Decrease, then increase",
            "Decrease then steady; or decrease then decrease more slowly",
            "Steady or unsteady decrease",
            "Steady or increase, then decrease; or decrease then decrease more rapidly",
        ],
        Ceiling: {
            Height: "ceiling varying between {0} and {1} feet",
            Second: {
                Location: "ceiling of {0} feet measured by a second sensor located at {1}",
            },
        },
        DSNT: "distant",
        FCST: "forecast",
        FUNNELCLOUD: "funnel cloud",
        HVY: "heavy",
        Hail: {
            "0": "largest hailstones with a diameter of {0} inches",
            LesserThan: "largest hailstones with a diameter less than {0} inches",
        },
        Hourly: {
            Maximum: {
                Minimum: {
                    Temperature: "24-hour maximum temperature of {0}°C and 24-hour minimum temperature of {1}°C",
                },
                Temperature: "6-hourly maximum temperature of {0}°C",
            },
            Minimum: {
                Temperature: "6-hourly minimum temperature of {0}°C",
            },
            Temperature: {
                "0": "hourly temperature of {0}°C",
                Dew: {
                    Point: "hourly temperature of {0}°C and dew point of {1}°C",
                },
            },
        },
        Ice: {
            Accretion: {
                Amount: "{0}/100 of an inch of ice accretion in the past {1} hour(s)",
            },
        },
        LGT: "light",
        LTG: "lightning",
        MOD: "moderate",
        Next: {
            Forecast: {
                By: "next forecast by {0}, {1}:{2}Z"
            },
        },
        NXT: "next",
        ON: "on",
        Obscuration: "{0} layer at {1} feet composed of {2}",
        PRESFR: "pressure falling rapidly",
        PRESRR: "pressure rising rapidly",
        PeakWind: "peak wind of {1} knots from {0} degrees at {2}:{3}",
        Precipitation: {
            Amount: {
                "24": "{0} inches of precipitation fell in the last 24 hours",
                "3": {
                    "6": "{1} inches of precipitation fell in the last {0} hours",
                },
                Hourly: "{0}/100 of an inch of precipitation fell in the last hour",
            },
            Beg: {
                "0": "{0} {1} beginning at {2}:{3}",
                End: "{0} {1} beginning at {2}:{3} ending at {4}:{5}",
            },
            End: "{0} {1} ending at {2}:{3}",
        },
        Pressure: {
            Tendency: "of {0} hectopascals in the past 3 hours",
        },
        SLPNO: "sea level pressure not available",
        Sea: {
            Level: {
                Pressure: "sea level pressure of {0} HPa",
            },
        },
        Second: {
            Location: {
                Visibility: "visibility of {0} SM measured by a second sensor located at {1}",
            },
        },
        Sector: {
            Visibility: "visibility of {1} SM in the {0} direction",
        },
        Snow: {
            Depth: "snow depth of {0} inches",
            Increasing: {
                Rapidly: "snow depth increase of {0} inches in the past hour with a total depth on the ground of {1} inches",
            },
            Pellets: "{0} snow pellets",
        },
        Sunshine: {
            Duration: "{0} minutes of sunshine",
        },
        Surface: {
            Visibility: "surface visibility of {0} statute miles",
        },
        TORNADO: "tornado",
        Thunderstorm: {
            Location: {
                "0": "thunderstorm {0} of the station",
                Moving: "thunderstorm {0} of the station moving towards {1}",
            },
        },
        Tornadic: {
            Activity: {
                BegEnd: "{0} beginning at {1}:{2} ending at {3}:{4} {5} SM {6} of the station",
                Beginning: "{0} beginning at {1}:{2} {3} SM {4} of the station",
                Ending: "{0} ending at {1}:{2} {3} SM {4} of the station",
            },
        },
        Tower: {
            Visibility: "control tower visibility of {0} statute miles",
        },
        VIRGA: "virga",
        Variable: {
            Prevailing: {
                Visibility: "variable prevailing visibility between {0} and {1} SM",
            },
            Sky: {
                Condition: {
                    "0": "cloud layer varying between {0} and {1}",
                    Height: "cloud layer at {0} feet varying between {1} and {2}",
                },
            },
        },
        Virga: {
            Direction: "virga {0} from the station",
        },
        WATERSPOUT: "waterspout",
        Water: {
            Equivalent: {
                Snow: {
                    Ground: "water equivalent of {0} inches of snow",
                },
            },
        },
        WindShift: {
            "0": "wind shift at {0}:{1}",
            FROPA: "wind shift accompanied by frontal passage at {0}:{1}",
        },
    },
    TimeIndicator: {
        AT: "at",
        FM: "From",
        TL: "until",
    },
    ToString: {
        airport: "airport",
        altimeter: "altimeter (hPa)",
        amendment: "amendment",
        auto: "auto",
        cavok: "cavok",
        clouds: "clouds",
        day: {
            hour: "hour of the day",
            month: "day of the month",
        },
        deposit: {
            braking: "braking capacity",
            coverage: "coverage",
            thickness: "thickness",
            type: "type of deposit",
        },
        descriptive: "descriptive",
        dew: {
            point: "dew point",
        },
        end: {
            day: {
                month: "end day of the month",
            },
            hour: {
                day: "end hour of the day",
            },
        },
        height: {
            feet: "height (ft)",
            meter: "height (m)",
        },
        indicator: "indicator",
        intensity: "intensity",
        message: "original message",
        name: "name",
        nosig: "nosig",
        phenomenons: "phenomenons",
        probability: "probability",
        quantity: "quantity",
        remark: "remarks",
        report: {
            time: "time of report",
        },
        runway: {
            info: "runways information",
        },
        start: {
            day: {
                month: "starting day of the month",
            },
            hour: {
                day: "starting hour of the day",
            },
            minute: "starting minute",
        },
        temperature: {
            "0": "temperature (°C)",
            max: "maximum temperature (°C)",
            min: "minimum temperature (°C)",
        },
        trend: "trend",
        trends: "trends",
        type: "type",
        vertical: {
            visibility: "vertical visibility (ft)",
        },
        visibility: {
            main: "main visibility",
            max: "maximum visibility",
            min: {
                "0": "minimum visibility",
                direction: "minimum visibility direction",
            },
        },
        weather: {
            conditions: "weather conditions",
        },
        wind: {
            direction: {
                "0": "direction",
                degrees: "direction (degrees)",
            },
            gusts: "gusts",
            max: {
                variation: "maximal wind variation",
            },
            min: {
                variation: "minimal wind variation",
            },
            speed: "speed",
            unit: "unit",
        },
    },
    WeatherChangeType: {
        BECMG: "Becoming",
        FM: "From",
        PROB: "Probability",
        TEMPO: "Temporary",
    },
};

export { en as default };
