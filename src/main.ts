import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";

const MERRILL_CLASSROOM = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;

const mapContainer = document.querySelector<HTMLElement>("#map")!;
const map = leaflet.map(mapContainer, {
  center: MERRILL_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// create the player marker
const playerMarker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// button to simulate sensor (geolocation)
const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    // update the position of the player marker
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());

    // generate new caches around the updated location
    for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
      for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
        if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
          makeCache(i, j, position.coords.latitude, position.coords.longitude);
        }
      }
    }
  });
});

// initialize points and status panel
let points = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

// function to create coins
function makeCoins(i: number, j: number): number {
  const coinCount = Math.floor(luck([i, j, "coinCount"].toString()) * 10); // generate coin count (0 to 9)
  return coinCount;
}

// function to create cache
function makeCache(i: number, j: number, playerLat: number, playerLng: number) {
  const bounds = leaflet.latLngBounds([
    [playerLat + i * TILE_DEGREES, playerLng + j * TILE_DEGREES],
    [playerLat + (i + 1) * TILE_DEGREES, playerLng + (j + 1) * TILE_DEGREES],
  ]);

  // create a cache (rectangle) on the map
  const cache = leaflet.rectangle(bounds) as leaflet.Layer;

  // bind a popup to the cache
  cache.bindPopup(() => {
    const coinCount = makeCoins(i, j);

    // create a container for the popup content
    const container = document.createElement("div");
    container.innerHTML = `
                <div>Cache at "${i},${j}". It has ${coinCount} coins.</div>
                <button id="collectCoins">Grab Coins</button>
                <button id="depositCoins">Put Coins</button>`;

    // get references to the buttons in the container
    const collectCoinsButton =
      container.querySelector<HTMLButtonElement>("#collectCoins")!;
    const depositCoinsButton =
      container.querySelector<HTMLButtonElement>("#depositCoins")!;

    // event listener for collecting coins
    collectCoinsButton.addEventListener("click", () => {
      points += coinCount;
      statusPanel.innerHTML = `${points} points accumulated`;
      cache.closePopup();
      map.removeLayer(cache);
    });

    // event listener for depositing coins
    depositCoinsButton.addEventListener("click", () => {
      if (points >= coinCount) {
        points -= coinCount;
        statusPanel.innerHTML = `${points} points accumulated`;
        makeCache(i, j, playerLat, playerLng); // create a new cache after depositing coins
      } else {
        alert("Not enough coins!");
      }
    });

    return container;
  });

  // add the cache to the map
  cache.addTo(map);
}

// loop to create caches initially
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
      makeCache(i, j, MERRILL_CLASSROOM.lat, MERRILL_CLASSROOM.lng);
    }
  }
}
