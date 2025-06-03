# WeatherStar 4000+

A live version of this project is available at https://weatherstar.netbymatt.com

## About

This project aims to bring back the feel of the 90's with a weather forecast that has the look and feel of The Weather Channel at that time but available in a modern way. This is by no means intended to be a perfect emulation of the WeatherStar 4000, the hardware that produced those wonderful blue and orange graphics you saw during the local forecast on The Weather Channel. If you would like a much more accurate project please see the [WS4000 Simulator](http://www.taiganet.com/). Instead, this project intends to create a simple to use interface with minimal configuration fuss. Some changes have been made to the screens available because either more or less forecast information is available today than was in the 90's. Most of these changes are captured in sections below.

## Acknowledgements

This project is based on the work of [Mike Battaglia](https://github.com/vbguyny/ws4kp). It was forked from his work in August 2020.

* Mike Battaglia for the original project and all of the code which draws the weather displays. This code remains largely intact and was a huge amount of work to get exactly right. He's also responsible for all of the background graphics including the maps used in the application.
* The team at [TWCClassics](https://twcclassics.com/) for several resources.
	* A [font](https://twcclassics.com/downloads.html) set used on the original WeatherStar 4000
	* [Icon](https://twcclassics.com/downloads.html) sets
	* Countless photos and videos of WeatherStar 4000 forecasts used as references.

## Does WeatherStar 4000+ work outside of the USA?

This project is tightly coupled to [NOAA's Weather API](https://www.weather.gov/documentation/services-web-api), which is exclusive to the United States. Using NOAA's Weather API is a crucial requirement to provide an authentic WeatherStar 4000+ experience.

If you would like to display weather information for international locations (outside of the USA), please checkout a fork of this project created by [@mwood77](https://github.com/mwood77):
- [`ws4kp-international`](https://github.com/mwood77/ws4kp-international)

## Run Your WeatherStar
There are a lot of CORS considerations and issues with api.weather.gov that are easiest to deal with by running a local server to see this in action (or use the live link above). You'll need Node.js >12.0 to run the local server.

To run via Node locally:
```
git clone https://github.com/netbymatt/ws4kp.git
cd ws4kp
npm i
node index.mjs
```

To run via Docker: 
```
docker run -p 8080:8080 ghcr.io/netbymatt/ws4kp
```
Open your web browser: http://localhost:8080/ 

To run via Docker Compose:
```
---
services:
  ws4kp:
    image: ghcr.io/netbymatt/ws4kp
    container_name: ws4kp
    environment:
      - WSQS_hazards_checkbox=true
      - WSQS_current_weather_checkbox=true
      - WSQS_latest_observations_checkbox=true
      - WSQS_hourly_checkbox=false
      - WSQS_hourly_graph_checkbox=true
      - WSQS_travel_checkbox=true
      - WSQS_regional_forecast_checkbox=true
      - WSQS_local_forecast_checkbox=true
      - WSQS_extended_forecast_checkbox=true
      - WSQS_almanac_checkbox=true
      - WSQS_spc_outlook_checkbox=true
      - WSQS_radar_checkbox=true
      - WSQS_settings_kiosk_checkbox=true
      - WSQS_settings_units_select=us
      - WSQS_latLonQuery="90210 Beverly Hills CA USA"
      # There are more possibilities, check the permalink for a complete list

    restart: unless-stopped
```

## Updates in 5.0
The change to 5.0 changes from drawing the weather graphics on canvas elements and instead uses HTML and CSS to style all of the weather graphics. A lot of other changes and fixes were implemented at the same time.

* Replace all canvas elements with HTML and CSS
* City and airport names are better parsed to fit the available space
* Remove the dependency on libgif-js
* Use browser for text wrapping where necessary
* Some new weather icons
* Refresh only on slideshow repeat
* Removed Almanac 30-day outlook
* Fixed startup issue when current conditions are unavailable

## Why the fork?

The fork is a result of wanting a more manageable, modern code base to work with. Part of it is an exercise in my education in JavaScript. There are several technical changes that were made behind the scenes.

* Make use of the new API available at https://api.weather.gov ([documentation](https://www.weather.gov/documentation/services-web-api)). This caused the removal of some of the original WeatherStar 4000 displays, and allowed for new displays to be created.
* Changed code to make extensive use of ES6 functionality including:
	* Arrow functions
	* Promises
	* Async/await and parallel loading of all forecast resources
	* Classes
* Common code base for each display through use of classes
* Separation between weather display code and user interface
* Use of a modern date parsing library [luxon](https://moment.github.io/luxon/)
* Attempt to remove the need for a local server to bypass [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) issues with the various APIs used. This is almost workable but there are still some minor CORS issues with https://api.weather.gov.
	* The necessary CORS pass through URLs have been rewritten so they can be deployed on Node.js using the included server or through S3/Cloudfront in a serverless environment.
* Proper settings for static resource caching
* Build system integration to reduce the number of scripts that need to be loaded

## What's different

I've made several changes to this Weather Star 4000 simulation compared to the original hardware unit and the code that this was forked from.

* Radar displays the timestamp of the image.
* A new hour-by-hour graph of the temperature, cloud cover and precipitation chances for the next 24 hours.
* A new hourly forecast display for the next 24 hours is available, and is shown in the style of the travel cities forecast. (off by default because it duplicates the hourly graph)
* The "Local Forecast" and "Extended Forecast" provide several additional days of information compared to the original format in the 90's.
* Narration was removed. In the original code narration made use of the computer's local text-to-speech engine which didn't sound great.
* Music was removed. I don't want to deal with copyright issues and hosting MP3s. If you're looking for the music that played during forecasts please visit [TWCClassics](https://twcclassics.com/audio/).
* Marine forecast (tides) is not available as it is not part of the new API.
* The nearby cities displayed on screens such as "Latest Observations" and "Regional Forecast" are likely not the same as they were in the 90's. The weather monitoring equipment at these stations move over time for one reason or another, and coming up with a simple formulaic way of finding nearby stations is sufficient to give the same look-and-feel as the original.
* "Flavors" are not present in this simulation. Flavors refer to the order of the weather information that was shown on the original units. Instead, the order of the displays has been fixed and a checkboxes can be used to turn on and off individual displays. The travel forecast has been defaulted to off so only local information shows for new users.

## Sharing a permalink (bookmarking)
Selected displays, the forecast city and widescreen setting are sticky from one session to the next. However if you would like to share your exact configuration or bookmark it click the "Copy Permalink" (or get "Get Parmalink") near the bottom of the page. A URL will be copied to your clipboard with all of you selected displays and location (or copy it from the page if your browser doesn't support clipboard transfers directly). You can then share this link or add it to your bookmarks.

Your permalink will be very long. Here is an example for the Orlando Internation Airport:
```
https://weatherstar.netbymatt.com/?hazards-checkbox=false&current-weather-checkbox=true&latest-observations-checkbox=true&hourly-checkbox=false&hourly-graph-checkbox=true&travel-checkbox=false&regional-forecast-checkbox=true&local-forecast-checkbox=true&extended-forecast-checkbox=true&almanac-checkbox=false&spc-outlook-checkbox=true&radar-checkbox=true&settings-wide-checkbox=false&settings-kiosk-checkbox=false&settings-scanLines-checkbox=false&settings-speed-select=1.00&settings-units-select=us&latLonQuery=Orlando+International+Airport%2C+Orlando%2C+FL%2C+USA&latLon=%7B%22lat%22%3A28.431%2C%22lon%22%3A-81.3076%7D
```
You can also build your own permalink. Any omitted settings will be filled with defaults. Here are a few examples:
```
https://weatherstar.netbymatt.com/?latLonQuery=Orlando+International+Airport
https://weatherstar.netbymatt.com/?kiosk=true
https://weatherstar.netbymatt.com/?settings-units-select=metric
```

## Kiosk mode
Kiosk mode can be activated by a checkbox on the page. Note that there is no way out of kiosk mode (except refresh or closing the browser), and the play/pause and other controls will not be available. This is deliberate as a browser's kiosk mode it intended not to be exited or significantly modified.

It's also possible to enter kiosk mode using a permalink. First generate a [Permalink](#sharing-a-permalink-bookmarking), then to the end of it add `&kiosk=true`. Opening this link will load all of the selected displays included in the Permalink, enter kiosk mode immediately upon loading and start playing the forecast.

## Default query string paramaters (environment variables)
When serving this via the built-in Express server, it's possible to define environment variables that direct the user to a default set of paramaters (like the  [Permalink](#sharing-a-permalink-bookmarking) above). If a user requests the root page at `http://localhost:8080/` the query string provided by environment variables will be appended to the url thus providing a default configuration.

Environment variables can be added to the command line as usual, or via a .env file which is parsed with [dotenv](https://github.com/motdotla/dotenv). Both methods have the same effect.

Environment variables that are to be added to the default query string are prefixed with `WSQS_` and then use the same key/value pairs generated by the [Permalink](#sharing-a-permalink-bookmarking) above, with the `- (dash)` character replaced by an `_ (underscore)`. For example, if you wanted to turn the travel forecast on, you would find `travel-checkbox=true` in the permalink, it's matching environment variable becomes `WSQS_travel_checkbox=true`.

## Serving static files
The app can be served as a static set of files on any web server. Run the provided gulp task to create a set of static distribution files:
```
npm run buildDist
```
The resulting files will be in the /dist folder in the root of the project. These can then be uploaded to a web server for hosting, no server-side scripting is required.

## Music
The WeatherStar had wonderful background music from the smooth jazz and new age genres by artists of the time. Lists of the music that played are available by searching online, but it's all copyrighted music and would be difficult to provide as part of this repository.

I've used AI tools to create WeatherStar-inspired music tracks that are unencumbered by copyright and are included in this repo. Too keep the size down, I've only included 4 tracks. Additional tracks are in a companion repository [ws4kp-music](https://github.com/netbymatt/ws4kp-music).

### Customizing the music
Placing .mp3 files in the `/server/music` folder will override the default music included in the repo. Subdirectories will not be scanned. When weatherstar loads in the browser it will load a list if available files and randomize the order when it starts playing. On each loop through the available tracks the order will again be shuffled. If you're using the static files method to host your WeatherStar music is located in `/music`.

If using docker, you must pass a local accessible folder to the container in the `/app/server/music` directory. 
```
docker run -p 8080:8080 -v /path/to/local/music:/app/server/music ghcr.io/netbymatt/ws4kp
```

### Music doesn't auto play
Ws4kp is muted by default, but if it was unmuted on the last visit it is coded to try and auto play music on subsequent visits. But, it's considered bad form to have a web site play music automatically on load, and I fully agree with this. [Chrome](https://developer.chrome.com/blog/autoplay/#media_engagement_index) and [Firefox](https://hacks.mozilla.org/2019/02/firefox-66-to-block-automatically-playing-audible-video-and-audio/) have extensive details on how and when auto play is allowed.

Chrome seems to be more lenient on auto play and will eventually let a site auto-play music if you're visited it enough recently and manually clicked to start playing music on each visit. It also has a flag you can add to the command line when launching Chrome: `chrome.exe --autoplay-policy=no-user-gesture-required`. This is the best solution when using Kiosk-style setup.

## Community Notes

Thanks to the WeatherStar community for providing these discussions to further extend your retro forecasts!

* [Stream as FFMPEG](https://github.com/netbymatt/ws4kp/issues/37#issuecomment-2008491948)
* [Weather like it's 1999](https://blog.scottlabs.io/2024/02/weather-like-its-1999/) Raspberry pi, streaming, music and CRT all combined into a complete solution.
* [ws4channels](https://github.com/rice9797/ws4channels) A Dockerized Node.js application to stream WeatherStar 4000 data into Channels DVR using Puppeteer and FFmpeg.

## Customization
A hook is provided as `/server/scripts/custom.js` to allow customizations to your own fork of this project, without accidentally pushing your customizations back upstream to the git repository. An sample file is provided at `/server/scripts/custom.sample.js` and should be renamed to `custom.js` activate it.

## Issue reporting and feature requests

Please do not report issues with api.weather.gov being down. It's a new service and not considered fully operational yet. Before reporting an issue or requesting a feature please consider that this is not intended to be a perfect recreation of the WeatherStar 4000, it's a best effort that fits within what's available from the API and within a web browser.

Note: not all units are converted to metric, if selected. Some text-based products such as warnings are simple text strings provided from the national weather service and thus have baked-in units such as "gusts up to 60 mph." These values will not be converted.

## Related Projects

Not retro enough? Try the [Weatherstar 3000+](https://github.com/netbymatt/ws3kp)

## Use

Linking directly to the live web site at https://weatherstar.netbymatt.com is encouraged. As is using the live site for digital signage, home dashboards, streaming and public display. Please note the disclaimer below.

## Disclaimer

This web site should NOT be used in life threatening weather situations, or be relied on to inform the public of such situations. The Internet is an unreliable network subject to server and network outages and by nature is not suitable for such mission critical use. If you require such access to NWS data, please consider one of their subscription services. The authors of this web site shall not be held liable in the event of injury, death or property damage that occur as a result of disregarding this warning.

The WeatherSTAR 4000 unit and technology is owned by The Weather Channel. This web site is a free, non-profit work by fans. All of the back ground graphics of this web site were created from scratch.  The icons were created by Charles Abel and Nick Smith (http://twcclassics.com/downloads/icons.html) as well as by Malek Masoud.  The fonts were originally created by Nick Smith (http://twcclassics.com/downloads/fonts.html).

