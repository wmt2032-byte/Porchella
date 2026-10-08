// =========================
// DESKTOP MAP
// =========================
const map = L.map('map').setView([36.85, -76.29], 13);

L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19
  }
).addTo(map);

// Global variables
let porchData = null;
const markers = {};
const neighborhoods = {};


// =========================
// LOAD PORCHES
// =========================
fetch('porches.geojson')
  .then(res => res.json())
  .then(data => {
    porchData = data;
    buildPorchLayer();
    buildNeighborhoods();
    buildLeftPanel();
    if (panelMap) {
      addPorchMarkers(panelMap);
    }
    setEmptyState();
  });

function setEmptyState() {
  const mobileContent = document.getElementById("panel-content");
  const desktopTitle = document.getElementById("desktop-title");
  const desktopList = document.getElementById("desktop-artist-list");
  const emptyHint = document.getElementById("empty-right-hint");

  desktopTitle.textContent = "Select a porch";
  mobileContent.innerHTML = '<p class="empty-state">Select an Address<br>or<br>Make a Search</p>';
  desktopList.innerHTML = '<p class="empty-state">Select an Address<br>or<br>Make a Search</p>';

  if (emptyHint) {
    emptyHint.style.zIndex = "1";
  }
}


// =========================
// BUILD PORCH MARKERS
// =========================
function addPorchMarkers(targetMap) {
  if (!porchData || !targetMap) return;

  L.geoJSON(porchData, {
    pointToLayer: (feature, latlng) => {
      const marker = L.circleMarker(latlng, {
        radius: 8,
        color: '#f59e0b',
        fillColor: '#fbbf24',
        fillOpacity: 0.9
      });

      const addr = feature.properties.Address;
      markers[addr] = marker;
      marker.on('click', () => selectPorch(addr));
      return marker;
    }
  }).addTo(targetMap);
}

function buildPorchLayer() {
  addPorchMarkers(map);
}


// =========================
// BUILD NEIGHBORHOODS
// =========================
function buildNeighborhoods() {
  porchData.features.forEach(f => {
    const hood = f.properties.Neighborhood;
    const addr = f.properties.Address;

    if (!neighborhoods[hood]) neighborhoods[hood] = [];
    neighborhoods[hood].push(addr);
  });
}


// =========================
// LEFT PANEL (DESKTOP + MOBILE LIST)
// =========================
function buildLeftPanel() {
  const hoodList = document.getElementById("neighborhood-list");
  hoodList.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = "Porches";
  title.className = "list-title";
  hoodList.appendChild(title);

  Object.entries(neighborhoods).forEach(([hood, porches]) => {
    const h = document.createElement("h3");
    h.textContent = hood;
    hoodList.appendChild(h);

    porches.forEach(addr => {
      const btn = document.createElement("button");
      btn.className = "porch-btn";
      btn.textContent = addr;

      btn.onclick = () => selectPorch(addr);

      hoodList.appendChild(btn);
    });
  });

  setupSearch();
}


// =========================
// SEARCH
// =========================
function setupSearch() {
  const searchInput = document.getElementById("search");
  const searchResults = document.getElementById("search-results");

  function getMatchInfo(address) {
    const porch = porchData.features.find(f => f.properties.Address === address);
    if (!porch) return null;

    const props = porch.properties;
    const hoodName = props.Neighborhood || "";
    const acts = Array.isArray(props.Artists) ? props.Artists : [];
    const artistNames = acts.map(a => a.Artist || "").join(" ");

    return { hoodName, artistNames };
  }

  function filterPorchButtons(query) {
    const q = query.trim().toLowerCase();
    const buttons = document.querySelectorAll(".porch-btn");

    buttons.forEach(btn => {
      const addr = btn.textContent.trim();
      const info = getMatchInfo(addr);
      const hoodName = (info && info.hoodName) ? info.hoodName.toLowerCase() : "";
      const artistNames = (info && info.artistNames) ? info.artistNames.toLowerCase() : "";
      const show = !q || addr.toLowerCase().includes(q) || hoodName.includes(q) || artistNames.includes(q);
      btn.style.display = show ? "block" : "none";
    });
  }

  function renderResults(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      searchResults.innerHTML = "";
      searchResults.classList.add("hidden");
      return;
    }

    const matches = [];

    porchData.features.forEach(feature => {
      const props = feature.properties;
      const address = props.Address || "";
      const hood = props.Neighborhood || "";
      const artists = Array.isArray(props.Artists) ? props.Artists : [];

      const addressHit = address.toLowerCase().includes(q);
      const hoodHit = hood.toLowerCase().includes(q);

      if (addressHit || hoodHit) {
        matches.push({
          type: "address",
          label: address,
          subtitle: hood,
          address: address
        });
      }

      artists.forEach(act => {
        const artistName = act.Artist || "";
        if (artistName.toLowerCase().includes(q)) {
          matches.push({
            type: "artist",
            label: artistName,
            subtitle: `${address} • ${act.SetTime || "Set time TBD"}`,
            address: address
          });
        }
      });
    });

    const uniqueMatches = [];
    const seen = new Set();
    matches.forEach(item => {
      const key = `${item.type}-${item.label}-${item.address}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMatches.push(item);
      }
    });

    const resultList = uniqueMatches.slice(0, 12);

    if (!resultList.length) {
      searchResults.innerHTML = '<div class="search-empty">No matching porches, artists, or neighborhoods</div>';
      searchResults.classList.remove("hidden");
      return;
    }

    searchResults.innerHTML = resultList
      .map(item => {
        const strongText = item.type === "artist" ? item.label : item.label;
        return `<button class="search-result" data-address="${item.address}" data-label="${item.label}"><strong>${strongText}</strong><br><small>${item.subtitle}</small></button>`;
      })
      .join("");

    searchResults.classList.remove("hidden");

    searchResults.querySelectorAll(".search-result").forEach(button => {
      button.addEventListener("click", () => {
        const selectedAddress = button.dataset.address;
        const selectedLabel = button.dataset.label || selectedAddress;
        searchInput.value = selectedLabel;
        searchResults.classList.add("hidden");
        filterPorchButtons(selectedLabel);
        selectPorch(selectedAddress);
      });
    });
  }

  searchInput.addEventListener("input", e => {
    const q = e.target.value;
    filterPorchButtons(q);
    renderResults(q);
  });

  document.addEventListener("click", event => {
    if (!event.target.closest("#search") && !event.target.closest("#search-results")) {
      searchResults.classList.add("hidden");
    }
  });
}


// =========================
// MOBILE PANEL MAP
// =========================
let panelMap;

function initPanelMap() {
  panelMap = L.map('panel-map', {
    zoomControl: false,
    attributionControl: false
  }).setView([36.85, -76.29], 13);

  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19 }
  ).addTo(panelMap);

  if (porchData) {
    addPorchMarkers(panelMap);
  }
}

initPanelMap();


// =========================
// SELECT PORCH (DESKTOP + MOBILE)
// =========================
function selectPorch(address) {
  const marker = markers[address];
  if (!marker) return;

  const coords = marker.getLatLng();
  map.setView(coords, 17);

  const emptyHint = document.getElementById("empty-right-hint");
  if (emptyHint) {
    emptyHint.style.zIndex = "-1";
  }

  showArtistDetails(address);

  // MOBILE PANEL OPEN
  document.getElementById("side-panel").classList.add("open");
  document.getElementById("backdrop").classList.add("show");
}


function showArtistDetails(address) {
  const porch = porchData.features.find(f => f.properties.Address === address);
  const coords = porch.geometry.coordinates;

  // MOBILE PANEL MAP
  panelMap.setView([coords[1], coords[0]], 17);

  // MOBILE PANEL CONTENT
  const mobileContent = document.getElementById("panel-content");
  mobileContent.innerHTML = `<h2>${address}</h2>`;

  // DESKTOP PANEL CONTENT
  const desktopTitle = document.getElementById("desktop-title");
  const desktopList = document.getElementById("desktop-artist-list");

  desktopTitle.textContent = address;
  desktopList.innerHTML = "";

  const acts = porch.properties.Artists;

  if (!acts || acts.length === 0) {
    mobileContent.innerHTML += `<p>No scheduled acts for this porch.</p>`;
    desktopList.innerHTML = `<p>No scheduled acts for this porch.</p>`;
    return;
  }

  acts.forEach(a => {
    // MOBILE
    mobileContent.innerHTML += `
      <div class="artist-card">
        <h3>${a.Artist}</h3>
        <p><strong>Set:</strong> ${a.SetTime}</p>
        <p><a href="https://instagram.com/${a.Social.replace('@','')}" target="_blank">${a.Social}</a></p>
        <hr>
      </div>
    `;

    // DESKTOP
    const card = document.createElement("div");
    card.innerHTML = `
      <h3>${a.Artist}</h3>
      <p><strong>Set:</strong> ${a.SetTime}</p>
      <p><a href="https://instagram.com/${a.Social.replace('@','')}" target="_blank">${a.Social}</a></p>
      <hr>
    `;
    desktopList.appendChild(card);
  });
}



// =========================
// CLOSE MOBILE PANEL
// =========================
document.getElementById("backdrop").onclick = () => {
  document.getElementById("side-panel").classList.remove("open");
  document.getElementById("backdrop").classList.remove("show");
};
