![Weatherstar 4000+ Current Conditions](https://github.com/netbymatt/ws4kp/blob/main/server/images/social/1200x600.png)

# WeatherStar 4000+

A live version of this project is available at https://weatherstar.netbymatt.com

## About

This project aims to bring back the feel of the 90s with a weather forecast that has the look and feel of The Weather Channel at that time but available in a modern way. This is by no means intended to be a perfect emulation of the WeatherStar 4000, the hardware that produced those wonderful blue and orange graphics you saw during the local forecast on The Weather Channel. If you would like a much more accurate project please see the [WS4000 Simulator](http://www.taiganet.com/). Instead, this project intends to create a simple to use interface with minimal configuration fuss. Some changes have been made to the screens available because either more or less forecast information is available today than was in the 90s. Most of these changes are captured in sections below.

## What's your motivation

Nostalgia. And I enjoy following the weather, especially severe storms.

It's also a creative outlet for me and keeps my programming skills honed for when I need them for my day job.

### Included technology
I've kept this open source, well commented, and made it as library-free as possible to help others interested in programming be able to jump right in and start working with the code.

From a learning standpoint, this codebase make use of a lot of different methods and technologies common on the internet including:

* The https://api.weather.gov REST API. ([documentation](https://www.weather.gov/documentation/services-web-api)).
* ES 6 functionality
	* Arrow functions
	* Promises
	* Async/await and parallel loading of all forecast resources
	* Classes and extensions
	* Javascript modules
* Separation between API code and user interface code
* Use of a modern date parsing library [luxon](https://moment.github.io/luxon/)
* Practical API rates and static asset caching
* Very straight-forward hand written HTML
* Build system integration (Gulp, Webpack) to reduce the number of scripts that need to be loaded
* Hand written CSS made easier to mange with SASS
* A linting library to keep code style consistent

## Quck Start

Ensure you have Node installed.
```bash
git clone https://github.com/netbymatt/ws4kp.git
cd ws4kp
npm install
npm start
```

Open your browser and navigate to https://localhost:8080

## Does WeatherStar 4000+ work outside of the USA?

This project is tightly coupled to [NOAA's Weather API](https://www.weather.gov/documentation/services-web-api), which is exclusive to the United States. Using NOAA's Weather API is a crucial requirement to provide an authentic WeatherStar 4000+ experience.

If you would like to display weather information for international locations (outside of the USA), please checkout a fork of this project created by [@mwood77](https://github.com/mwood77):
- [`ws4kp-international`](https://github.com/mwood77/ws4kp-international)

## Deployment Modes

WeatherStar 4000+ supports two deployment modes:

### Server Deployment (Recommended)

* Includes Node.js server with caching proxy for better performance (especially when running on a local server for multiple clients)
* Server-side request deduplication and caching
* Weather API observability and logging
* Used by: `npm start`, `DIST=1 npm start`, and `Dockerfile.server`

### Static Deployment

* Pure client-side deployment using nginx to serve static files
* All API requests are made directly from each browser to the weather services
* Browser-based caching
* Used by: static file hosting and default `Dockerfile`

## Other methods to run Ws4kp

### Development Mode (individual JS files, easier debugging)
```bash
npm start
```

### Development Mode without proxy caching
```bash
STATIC=1 npm start
```

### Production Mode (minified/concatenated JS, faster loading)
```bash
npm run build
DIST=1 npm start
```

### Production Mode without proxy caching (simulates static Docker deployment)
```bash
npm run build
STATIC=1 DIST=1 npm start
```

For all modes, access WeatherStar by going to: http://localhost:8080/

### Key Differences

**Development Mode (`npm start`):**
- Uses individual JavaScript module files served directly
- Easier debugging with source maps and readable code
- Slower initial load (many HTTP requests for individual files)
- Live file watching and faster development iteration

**Production Mode (`DIST=1 npm start`):**
- Uses minified and concatenated JavaScript bundles
- Faster initial load (fewer HTTP requests, smaller file sizes)
- Optimized for performance with multiple clients
- Requires `npm run build` to generate optimized files

### Docker Deployments

To run via Docker using a "static deployment" where everything happens in the browser (no server component, like STATIC=1):

```bash
docker run -p 8080:8080 ghcr.io/netbymatt/ws4kp
```

To run via Docker using a "server deployment" with a caching proxy server for multi-client performance and enhanced observability (like `npm run build; DIST=1 npm start`):

```bash
docker build -f Dockerfile.server -t ws4kp-server .
docker run -p 8080:8080 ws4kp-server
```

To run via Docker Compose (shown here in static deployment mode):

```yaml
---
services:
  ws4kp:
    image: ghcr.io/netbymatt/ws4kp
    container_name: ws4kp
    environment:
      # Each argument in the permalink URL can become an environment variable on the Docker host by adding WSQS_
      # Following the "Sharing a Permalink" example below, here are a few environment variables defined. Visit that section for a
      # more complete list of configuration options.
      - WSQS_latLonQuery=Orlando International Airport Orlando FL USA
      - WSQS_hazards_checkbox=false
      - WSQS_current_weather_checkbox=true
    ports:
      - 8080:8080 # change the first 8080 to meet your local network needs
    restart: unless-stopped
```

### Serving a static app

There are several ways to deploy WeatherStar as a static app that runs entirely in the browser:

**Manual static hosting (Apache, nginx, CDN, etc.):**
Build static distribution files for upload to any web server:

```bash
npm run build
```

The resulting files in `/dist` can be uploaded to any web server; no server-side scripting is required.

**Docker static deployment:**
The default Docker image uses nginx to serve pre-built static files:

```bash
docker run -p 8080:8080 ghcr.io/netbymatt/ws4kp
```

**Node.js in static mode:**
Use the Node.js server as a static file host without the caching proxy:

```bash
STATIC=1 npm start          # Use Express to serve development files
STATIC=1 DIST=1 npm start   # Use Express to serve (minimized) production files
```

## What's different

I've made several changes to this Weather Star 4000 simulation compared to the original hardware unit and the code that this was forked from.

* Radar displays the timestamp of the image.
* A new hour-by-hour graph of the temperature, cloud cover and precipitation chances for the next 24 hours.
* A new hourly forecast display for the next 24 hours is available, and is shown in the style of the travel cities forecast. (off by default because it duplicates the hourly graph)
* The SPC Outlook is shown in the style of the old air quality screen. This shows the probability of severe weather over the next 3 days at your location. SPC outlook only displays if you're within one of the highlight areas over the next 3 day. You can view the [maps](https://www.weather.gov/crh/outlooks) and pick a location within one of the risk categories to see if the screen is working for you.
* The "Local Forecast" and "Extended Forecast" provide several additional days of information compared to the original format in the 90s.
* The original music has been replaced. More info in [Music](#music).
* Marine forecast (tides) is not available as it is not reliably part of the new API.
* "Flavors" are not present in this simulation. Flavors refer to the order of the weather information that was shown on the original units. Instead, the order of the displays has been fixed and a checkboxes can be used to turn on and off individual displays. The travel forecast has been defaulted to off so only local information shows for new users.

## Sharing a permalink (bookmarking)
Selected displays, the forecast city and widescreen setting are sticky from one session to the next. However if you would like to share your exact configuration or bookmark it, click the "Copy Permalink" (or get "Get Permalink") near the bottom of the page. A URL will be copied to your clipboard with all of you selected displays and location (or copy it from the page if your browser doesn't support clipboard transfers directly). You can then share this link or add it to your bookmarks.

Your permalink will be very long. Here is an example for the Orlando International Airport:
```
https://weatherstar.netbymatt.com/?hazards-checkbox=false&current-weather-checkbox=true&latest-observations-checkbox=true&hourly-checkbox=false&hourly-graph-checkbox=true&travel-checkbox=false&regional-forecast-checkbox=true&local-forecast-checkbox=true&extended-forecast-checkbox=true&almanac-checkbox=false&spc-outlook-checkbox=true&radar-checkbox=true&settings-wide-checkbox=false&settings-kiosk-checkbox=false&settings-scanLines-checkbox=false&settings-speed-select=1.00&settings-units-select=us&latLonQuery=Orlando+International+Airport%2C+Orlando%2C+FL%2C+USA&latLon=%7B%22lat%22%3A28.431%2C%22lon%22%3A-81.3076%7D
```
You can also build your own permalink. Any omitted settings will be filled with defaults. Here are a few examples:
```
https://weatherstar.netbymatt.com/?latLonQuery=Orlando+International+Airport
https://weatherstar.netbymatt.com/?kiosk=true
https://weatherstar.netbymatt.com/?settings-units-select=metric
```

### Kiosk mode
Kiosk mode can be activated by a checkbox on the page. This will start Weatherstar in a fullscreen-like view without the play/volume/etc toolbar and scaled to fill the entire space. This does not activate the browser's fullscreen or kiosk mode. Those can only be activated by user interaction or by launching the browser with specific parameters such as `--start-fullscreen` or `--kiosk`. 

 When using kiosk mode (via the checkbox), there will be no way to exit the fullscreen-like view of weatherstar. Reloading the page should remove the kiosk checkbox and return you to the normal view. This is deliberate as a browser's kiosk mode it intended not to be exited or significantly modified. A separate full-screen icon is available in the tool bar to go full-screen on a laptop or mobile browser.

It's also possible to enter kiosk mode using a permalink. First generate a [Permalink](#sharing-a-permalink-bookmarking), then to the end of it add `&kiosk=true`. Opening this link will load all of the selected displays included in the Permalink, enter kiosk mode immediately upon loading and start playing the forecast.

### Default query string parameters (environment variables)
When serving this via the built-in Express server, it's possible to define environment variables that direct the user to a default set of parameters (like the  [Permalink](#sharing-a-permalink-bookmarking) above). If a user requests the root page at `http://localhost:8080/` the query string provided by environment variables will be appended to the url thus providing a default configuration.

Environment variables can be added to the command line as usual, or via a .env file which is parsed with [dotenv](https://github.com/motdotla/dotenv). Both methods have the same effect.

Environment variables that are to be added to the default query string are prefixed with `WSQS_` and then use the same key/value pairs generated by the [Permalink](#sharing-a-permalink-bookmarking) above, with the `- (dash)` character replaced by an `_ (underscore)`. For example, if you wanted to turn the travel forecast on, you would find `travel-checkbox=true` in the permalink, its matching environment variable becomes `WSQS_travel_checkbox=true`.

When using the Docker container, these environment variables are read on container start-up to generate the static redirect HTML.

## Settings

**Speed:** Controls the playback speed multiplier of the displays, from "Very Fast" (1.5x) to "Very Slow" (0.5x) with "Normal" being 1x

**Widescreen:** Stretches the background to 16:9 to avoid "pillarboxing" on modern displays

**Kiosk:** Immediately activates kiosk mode, which hides all settings. Exit by refreshing the page or using `Ctrl-K`. (Kiosk mode is similar to clicking the "Fullscreen" icon, but scales to the current browser viewport instead of activating the browser's actual "Fullscreen" mode.)

**Sticky Kiosk:** When enabled, stores the kiosk mode preference in local storage so the page automatically enters kiosk mode (maximizing the size of the main weather display without any settings) on subsequent visits. This feature is designed primarily for **iPhone and iPad users** who want to create a Home Screen app experience, since Mobile Safari doesn't support PWA installation via manifest.json or the Fullscreen API:

**For iOS/iPadOS (Mobile Safari):**

1. Tap the _Share_ icon and choose **Add to Home Screen**
2. Adjust the name as desired and tap **Add**
3. Launch the newly-created Home Screen shortcut
4. Configure all settings
5. Tap to enable **Sticky Kiosk**
6. _Make sure everything is configured exactly like you want it!_
7. Tap **Kiosk**

**For Android and Desktop browsers:** The included `manifest.json` file enables PWA (Progressive Web App) installation. To get the best app-like experience:

1. Configure all your settings first (ignore the "Kiosk" and "Sticky Kiosk" settings)
2. Create a permalink using the "Copy Permalink" feature and manually add `&kiosk=true` to the end
3. Open the edited permalink URL in your browser
4. Look for browser prompts to "Install" or "Add to Home Screen" from the kiosk-enabled URL
5. The PWA will launch directly into kiosk mode (without forcing kiosk mode when accessed from the browser)

For temporary fullscreen during regular browsing, use the fullscreen button in the toolbar.

**Important Notes:**

* **iOS/iPadOS limitations**: Mobile Safari strips all URL parameters when adding to Home Screen and runs shortcuts in an isolated environment with separate storage from the main Safari app
* After creating a Home Screen app on iOS or iPadOS and activating Kiosk mode, the only way to change settings is to delete the Home Screen shortcut and recreate it
* In situations where you _can_ edit a shortcut's URL, you can forcibly remove a "sticky" kiosk setting by adding `&kiosk=false` to the URL (or simply press `Ctrl-K` to exit kiosk mode if a keyboard is available)

**Scan Lines:** Enables a retro-style scan line effect

**Scan Lines Style:** Override the "auto" setting in case you prefer a different scale factor than what the automatic heuristics select for your browser and display

**Units:** Switches between US and metric units. (Note that some text-based products from the National Weather Service APIs contain embedded units that are not converted.)

**Volume:** Controls the audio level when music is enabled

## Music

The WeatherStar had wonderful background music from the smooth jazz and new age genres by artists of the time. Lists of the music that played are available by searching online, but it's all copyrighted music and would be difficult to provide as part of this repository.

I've used AI tools to create WeatherStar-inspired music tracks that are unencumbered by copyright and are included in this repo. To keep the size down, I've only included 4 tracks. Additional tracks are in a companion repository [ws4kp-music](https://github.com/netbymatt/ws4kp-music).

If you're looking for the original music that played during forecasts [TWCClassics](https://twcclassics.com/audio/) has thorough documentation of playlists.

### Customizing the music

WeatherStar 4000+ supports background music during forecast playback. The music behavior depends on how you deploy the application:

#### Express server modes (`npm start`, `DIST=1 npm start`, or `Dockerfile.server`)

When running with Node.js, the server generates a `playlist.json` file by scanning the `./server/music` directory for `.mp3` files. If no files are found in `./server/music`, it falls back to scanning `./server/music/default/`. The playlist is served dynamically at the `/playlist.json` endpoint.

**Adding your own music:** Place `.mp3` files in `./server/music/`

**Docker server example:**
```bash
docker build -f Dockerfile.server -t ws4kp-server .
docker run -p 8080:8080 -v /path/to/local/music:/app/server/music ws4kp-server
```

#### Static hosting modes (default `Dockerfile`, nginx, Apache, etc.)

When hosting static files, there are two scenarios:

**Static Docker deployment:** The build process creates a `playlist.json` file with default tracks, but the Docker image _intentionally_ removes it to force browser-based directory scanning. The browser attempts to fetch `playlist.json`, receives a 404 response with the `X-Weatherstar` header, which causes it to  fallback to scanning the `music/` directory.

**Manual static hosting:** If you build and upload the files yourself (`npm run build`), `playlist.json` will contain the default tracks unless you customize `./server/music/` before building.

For directory scanning to work properly:
* Your web server must generate directory listings for the `music/` path
* Your web server must set the `X-Weatherstar: true` header (the provided nginx configuration does this)

**Adding your own music:** Place `.mp3` files in `music/` (or bind mount to `/usr/share/nginx/html/music` for Docker)

**Docker static example:**
```bash
docker run -p 8080:8080 -v /path/to/local/music:/usr/share/nginx/html/music ghcr.io/netbymatt/ws4kp
```

Subdirectories will not be scanned. When WeatherStar loads in the browser, it randomizes the track order and reshuffles on each loop through the playlist.

### Music doesn't auto play
Ws4kp is muted by default, but if it was unmuted on the last visit it is coded to try and auto play music on subsequent visits. But, it's considered bad form to have a web site play music automatically on load, and I fully agree with this. [Chrome](https://developer.chrome.com/blog/autoplay/#media_engagement_index) and [Firefox](https://hacks.mozilla.org/2019/02/firefox-66-to-block-automatically-playing-audible-video-and-audio/) have extensive details on how and when auto play is allowed.

Chrome seems to be more lenient on auto play and will eventually let a site auto-play music if you're visited it enough recently and manually clicked to start playing music on each visit. It also has a flag you can add to the command line when launching Chrome: `chrome.exe --autoplay-policy=no-user-gesture-required`. This is the best solution when using Kiosk-style setup.

If you're unable to pre-set the play state before entering kiosk mode (such as with a home dashboard implementation) you can add the query string value below to the url. The browser will still follow the auto play rules outlined above.
```
?settings-mediaPlaying-boolean=true
```

## Community Notes

Thanks to the WeatherStar+ community for providing these discussions to further extend your retro forecasts!

* [Stream as FFMPEG](https://github.com/netbymatt/ws4kp/issues/37#issuecomment-2008491948)
* [Weather like it's 1999](https://blog.scottlabs.io/2024/02/weather-like-its-1999/) Raspberry pi, streaming, music and CRT all combined into a complete solution.
* [ws4channels](https://github.com/rice9797/ws4channels) A Dockerized Node.js application to stream WeatherStar 4000 data into Channels DVR using Puppeteer and FFmpeg.
* [SSL Certificates](https://github.com/netbymatt/ws4kp/issues/135) Discussion about how to host with an SSL certificate (enables geolocation).
* [Changing playlists](https://github.com/netbymatt/ws4kp/issues/138) Possible ways to automatically change the playlist on a schedule.
* [Customize Travel Forecast Cities](https://github.com/netbymatt/ws4kp/issues/146#issuecomment-3363940202)

## Customization

A hook is provided as `server/scripts/custom.js` to allow customizations to your own fork of this project, without accidentally pushing your customizations back upstream to the git repository. A sample file is provided at `server/scripts/custom.sample.js` and should be renamed to `custom.js` activate it.

When using Docker:

* **Static deployment**: Mount your `custom.js` file to `/usr/share/nginx/html/scripts/custom.js`
* **Server deployment**: Mount your `custom.js` file to `/app/server/scripts/custom.js`

### RSS feeds and custom scroll
If you would like your Weatherstar to have custom scrolling text in the bottom blue bar, or show headlines from an rss feed turn on the setting for `Enable RSS Feed/Text` and then enter a URL or text in the resulting text box. Then press set.

## Issue reporting and feature requests

Please do not report issues with api.weather.gov being down. It's a new service and not considered fully operational yet. I've also observed that the API can go down on a regional basis (based on NWS office locations). This means that you may have problems getting data for, say, Chicago right now, but Dallas and others are working just fine.

Before reporting an issue or requesting a feature please consider that this is not intended to be a perfect recreation of the WeatherStar 4000, it's a best effort that fits within what's available from the API and within a web browser.

Note: not all units are converted to metric, if selected. Some text-based products such as warnings are simple text strings provided from the national weather service and thus have baked-in units such as "gusts up to 60 mph." These values will not be converted.

## The full moon icon is broken

This is a known problem with the Ws4kp as it ages. It was a problem with the [actual Weatherstar hardware](https://youtu.be/rcUwlZ4pqh0?feature=shared&t=116) as well. 

## Phone App

An Android app is in a closed beta test. It's nothing too special, just a wrapper for displaying the website in a browser.

You can get this functionality without an app on both Andriod and iOS by using the install or add to home screen feature of your browser.

iOS native app? No. I own zero Apple devices and thus have no way to develop, test, compile or verify myself to the app store. That application will have to come from the community.

## Related Projects

Not retro enough? Try the [Weatherstar 3000+](https://github.com/netbymatt/ws3kp)

## Use

Linking directly to the live web site at https://weatherstar.netbymatt.com is encouraged. As is using the live site for digital signage, home dashboards, streaming and public display. Please note the disclaimer below.

## Acknowledgements

This project is based on the work of [Mike Battaglia](https://github.com/vbguyny/ws4kp). It was forked from his work in August 2020.

* Mike Battaglia for the original project and all of the code which draws the weather displays. This code remains largely intact and was a huge amount of work to get exactly right. He's also responsible for all of the background graphics including the maps used in the application.
* The team at [TWCClassics](https://twcclassics.com/) for several resources.
	* A [font](https://twcclassics.com/downloads.html) set used on the original WeatherStar 4000
	* [Icon](https://twcclassics.com/downloads.html) sets
	* Countless photos and videos of WeatherStar 4000 forecasts used as references.
* The growing list of contributors to this repository

## Disclaimer

This web site should NOT be used in life threatening weather situations, or be relied on to inform the public of such situations. The Internet is an unreliable network subject to server and network outages and by nature is not suitable for such mission critical use. If you require such access to NWS data, please consider one of their subscription services. The authors of this web site shall not be held liable in the event of injury, death or property damage that occur as a result of disregarding this warning.

The WeatherSTAR 4000 unit and technology is owned by The Weather Channel. This web site is a free, non-profit work by fans. All of the back ground graphics of this web site were created from scratch.  The icons were created by Charles Abel and Nick Smith (http://twcclassics.com/downloads/icons.html) as well as by Malek Masoud.  The fonts were originally created by Nick Smith (http://twcclassics.com/downloads/fonts.html).
