# betterfinder-mod-weather-panel

[![release](https://img.shields.io/github/v/release/bryanthaboi/betterfinder-mod-weather-panel)](https://github.com/bryanthaboi/betterfinder-mod-weather-panel/releases)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![betterfinder](https://img.shields.io/badge/betterfinder-mod-8a5cf6)](https://github.com/bryanthaboi/betterfinder)

slide-out weather panel for ur finder. current temp, feels like, humidity, wind and a 3 day forecast for whatever city u set.

## grants

- `net`: GET to `api.open-meteo.com` and `geocoding-api.open-meteo.com` only, 64kb cap. no files leave ur machine
- `ui`: panel, toolbar

set the city and units in the weather settings pane. hit the toolbar button or refresh in the panel to update. no api key, open-meteo is free.

## install

browse tab in betterfinder settings, or grab `weather-panel.bfmod` from the [latest release](https://github.com/bryanthaboi/betterfinder-mod-weather-panel/releases/latest). nothing turns on until u approve the grants.

## build it urself

```sh
betterfinder-mod validate .
betterfinder-mod package . --out weather-panel.bfmod
```

mit. do whatever.
