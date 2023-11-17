import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";

// Constants
const MERRILL_CLASSROOM = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;

// Counter for unique coin identifiers
let coinCounter = 0;

// Function to convert latitude and longitude to global grid coordinates
function convertToGameCells(
  latitude: number,
  longitude: number
): { i: number; j: number } {
  return {
    i: Math.floor(latitude / TILE_DEGREES),
    j: Math.floor(longitude / TILE_DEGREES),
  };
}

// Function to create caches
function makeCache(i: number, j: number, playerLat: number, playerLng: number) {
  const bounds = leaflet.latLngBounds([
    [playerLat + i * TILE_DEGREES, playerLng + j * TILE_DEGREES],
    [playerLat + (i + 1) * TILE_DEGREES, playerLng + (j + 1) * TILE_DEGREES],
  ]);

  // Create a cache (rectangle) on the map
  const cache = leaflet.rectangle(bounds) as leaflet.Layer;

  // Bind a popup to the cache
  cache.bindPopup(() => {
    const coinCount = Math.floor(luck([i, j, "coinCount"].toString()) * 10);

    // Unique identifier for each coin
    const coinId = coinCounter++;

    // Create a container for the popup content
    const container = document.createElement("div");
    container.innerHTML = `
                <div>Cache at "${i},${j}". It has ${coinCount} coins with ID ${coinId}.</div>
                <button id="collectCoins">Grab Coins</button>
                <button id="depositCoins">Put Coins</button>`;

    // Event listener for collecting coins
    container
      .querySelector<HTMLButtonElement>("#collectCoins")!
      .addEventListener("click", () => {
        alert(`You collected ${coinCount} coins with ID ${coinId}`);
        cache.closePopup();
        map.removeLayer(cache);
      });

    // Event listener for depositing coins
    container
      .querySelector<HTMLButtonElement>("#depositCoins")!
      .addEventListener("click", () => {
        alert(`You deposited ${coinCount} coins with ID ${coinId}`);
        makeCache(i, j, playerLat, playerLng);
      });

    return container;
  });

  // Add the cache to the map
  cache.addTo(map);
}

// Initialize Leaflet map
const mapContainer = document.querySelector<HTMLElement>("#map")!;
const map = leaflet.map(mapContainer, {
  center: MERRILL_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Add OpenStreetMap tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Create the player marker
const playerMarker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Button to simulate sensor (geolocation)
const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    // Update the position of the player marker
    playerMarker.setLatLng([
      position.coords.latitude,
      position.coords.longitude,
    ]);
    map.setView(playerMarker.getLatLng());

    // Generate new caches around the updated location
    for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
      for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
        if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
          const { i: gridI, j: gridJ } = convertToGameCells(
            position.coords.latitude,
            position.coords.longitude
          );
          makeCache(
            gridI,
            gridJ,
            position.coords.latitude,
            position.coords.longitude
          );
        }
      }
    }
  });
});

// Loop to create caches initially
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
      const { i: gridI, j: gridJ } = convertToGameCells(
        MERRILL_CLASSROOM.lat,
        MERRILL_CLASSROOM.lng
      );
      makeCache(gridI, gridJ, MERRILL_CLASSROOM.lat, MERRILL_CLASSROOM.lng);
    }
  }
}
