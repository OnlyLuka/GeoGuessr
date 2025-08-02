'use strict';

// Mapillary API token gratuit
const MAPILLARY_CLIENT_TOKEN = 'MLY|30659072840403619|361263956c0aac664f5a7475a63df437';

let map, resultmap;
let guessMarker = null, trueMarker = null;
let guessCoordinates = [];
let trueLocation = [];
let accumulatedDistance = 0;
let currentName = '';
let distanceFromGuess = 0;
let checkCount = 0;
let panoViewer;
let currentLang = 'en'; // Langue par défaut
let MAPILLARY_IMAGES = [];

// Initialisation de l'API client Mapillary 4.x (important)
const apiClient = new Mapillary.ApiClient({
    accessToken: MAPILLARY_CLIENT_TOKEN
});

const translations = {
    en: {
        title: "TerraSpot Project!",
        guess: "Guess!",
        next: "Next Location",
        correct: "Correct Location:",
        yourGuess: "Your Guess was",
        away: "away",
        roundScore: "Round Score:",
        miles: "Miles",
        km: "km",
        english: "English",
        french: "Français",
        error_loading: "Sorry, no valid Mapillary image found. Try refreshing the page."
    },
    fr: {
        title: "TerraSpot Projet!",
        guess: "Valider",
        next: "Lieu suivant",
        correct: "Bonne position :",
        yourGuess: "Votre estimation était à",
        away: "de distance",
        roundScore: "Score du tour :",
        miles: "Miles",
        km: "km",
        english: "English",
        french: "Français",
        error_loading: "Désolé, aucune image Mapillary valide trouvée. Essayez de rafraîchir la page."
    }
};

function getRandomMapillaryImage() {
    if (!MAPILLARY_IMAGES.length) return null;
    const idx = Math.floor(Math.random() * MAPILLARY_IMAGES.length);
    return MAPILLARY_IMAGES[idx];
}

async function getLocationFromId(imageId) {
    const url = `https://graph.mapillary.com/${imageId}?fields=id,computed_geometry&access_token=${MAPILLARY_CLIENT_TOKEN}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.computed_geometry?.coordinates) {
            const [lng, lat] = data.computed_geometry.coordinates;
            return { lat, lng, imageId };
        }
    } catch (e) {
        console.warn(`Erreur lors de la récupération de l'emplacement pour l'image ${imageId}`, e);
    }
    return null;
}

function resetMarkers() {
    if (guessMarker) {
        if (map) map.removeLayer(guessMarker);
        guessMarker = null;
    }
    if (trueMarker) {
        if (resultmap) resultmap.removeLayer(trueMarker);
        trueMarker = null;
    }
}

async function initialize() {
    try {
        checkCount = 0;
        disableButton('check');
        hideButton('next');

        if (accumulatedDistance === 0) {
            document.getElementById("totaldistance").innerHTML = `${tr('roundScore')} 0 ${tr(unit())}`;
        }

        document.getElementById("location").innerHTML = ' ';
        document.getElementById("distance").innerHTML = ' ';
        document.getElementById("result").innerHTML = '';

        // Recherche d'une image Mapillary valide
        let randomLocation = null;
        let retries = 0;
        while (!randomLocation && retries < 10 && MAPILLARY_IMAGES.length) {
            const randomId = getRandomMapillaryImage();
            randomLocation = await getLocationFromId(randomId);
            retries++;
        }
        if (!randomLocation) {
            document.getElementById("result").innerHTML = `<div style="color:red; font-weight:bold; text-align:center;">${tr('error_loading')}</div>`;
            return;
        }

        trueLocation = [randomLocation.lat, randomLocation.lng];
        currentName = `${randomLocation.lat.toFixed(2)}, ${randomLocation.lng.toFixed(2)}`;

        // Suppression du viewer existant si besoin
        if (panoViewer) {
            panoViewer.remove();
            panoViewer = null;
        }

        // Initialisation du viewer Mapillary 4.x (note l'apiClient)
        panoViewer = new Mapillary.Viewer({
            container: 'pano',
            imageId: randomLocation.imageId,
            apiClient: apiClient,  // IMPORTANT ici
            component: { cover: false }
        });

        // Initialisation carte principale
        if (map) map.remove();
        map = L.map('map').setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        resetMarkers();
        guessCoordinates = [];

        // Gestion du clic sur la carte pour placer la supposition
        map.off('click'); // on s'assure de ne pas accumuler d'écouteurs
        map.on('click', (e) => {
            resetMarkers();
            guessMarker = L.marker(e.latlng).addTo(map);
            guessCoordinates = [e.latlng.lat, e.latlng.lng];
            if (checkCount === 0) {
                enableButton('check');
                checkCount++;
            }
        });

        // Initialisation de la carte résultat
        if (resultmap) resultmap.remove();
        resultmap = L.map('result').setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(resultmap);

        updateTexts();
        display_location();
    } catch (e) {
        console.error("Erreur lors de l'initialisation :", e);
        document.getElementById("result").innerHTML = `<div style="color:red; font-weight:bold; text-align:center;">${tr('error_loading')}</div>`;
    }
}

function check() {
    enableButton('next');
    showButton('next');
    disableButton('check');

    distanceFromGuess = calcDistance(
        guessCoordinates[0], guessCoordinates[1],
        trueLocation[0], trueLocation[1]
    );
    accumulatedDistance += parseFloat(distanceFromGuess);

    if (trueMarker) resultmap.removeLayer(trueMarker);
    if (guessMarker) resultmap.removeLayer(guessMarker);

    trueMarker = L.marker(trueLocation)
        .addTo(resultmap)
        .bindPopup(`${tr('correct')} ${currentName}`)
        .openPopup();

    guessMarker = L.marker(guessCoordinates)
        .addTo(resultmap)
        .bindPopup(tr('yourGuess'));

    L.polyline([guessCoordinates, trueLocation], { color: 'blue', dashArray: '5,10' }).addTo(resultmap);

    display_location();
}

function calcDistance(lat1, lon1, lat2, lon2) {
    const toRad = x => x * Math.PI / 180;
    const R = 6371; // Rayon moyen de la Terre en km
    const factor = unit() === 'km' ? 1 : 0.621371; // conversion km -> miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return (R * c * factor).toFixed(2);
}

function display_location() {
    document.getElementById("location").innerHTML = `${tr('correct')} ${currentName}`;
    document.getElementById("distance").innerHTML = `${tr('yourGuess')} ${distanceFromGuess} ${tr(unit())} ${tr('away')}`;
    document.getElementById("totaldistance").innerHTML = `${tr('roundScore')} ${accumulatedDistance.toFixed(2)} ${tr(unit())}`;
}

function disableButton(id) {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = true;
}

function enableButton(id) {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = false;
}

function showButton(id) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.style.display = "";
        btn.style.opacity = "1";
        btn.style.visibility = "visible";
    }
}

function hideButton(id) {
    const btn = document.getElementById(id);
    if (btn) {
        btn.style.display = "none";
        btn.style.opacity = "0";
        btn.style.visibility = "hidden";
    }
}

function unit() {
    return currentLang === 'fr' ? 'km' : 'miles';
}

function tr(key) {
    return translations[currentLang][key] || key;
}

// ----- LANGUE -----

function toggleLangMenu() {
    const menu = document.getElementById("lang-menu");
    menu.style.display = (menu.style.display === "none" || !menu.style.display) ? "block" : "none";
}

function setLanguage(lang) {
    if (lang === currentLang) return;
    currentLang = lang;
    document.getElementById("lang-menu").style.display = "none";
    updateTexts();
    display_location();
    document.getElementById("lang-btn").innerHTML = (lang === "fr" ? "FR" : "EN") + " ⯆";
}

function updateTexts() {
    document.querySelector('h1').innerText = tr('title');
    document.getElementById('check').innerText = tr('guess');
    document.getElementById('next').innerText = tr('next');
    document.querySelectorAll('#lang-menu div')[0].innerText = translations['en'].english;
    document.querySelectorAll('#lang-menu div')[1].innerText = translations['fr'].french;
}

// Ferme le menu langue si on clique ailleurs
window.addEventListener('click', function (e) {
    const menu = document.getElementById("lang-menu");
    const btn = document.getElementById("lang-btn");
    if (!menu || !btn) return;
    if (!menu.contains(e.target) && e.target !== btn) {
        menu.style.display = "none";
    }
});

// Charge la liste d'IDs Mapillary avant de lancer le jeu
window.addEventListener('DOMContentLoaded', () => {
    hideButton('next');
    disableButton('check');
    document.getElementById("lang-btn").innerHTML = "EN ⯆";
    fetch('mapillary_ids.json')
        .then(resp => resp.json())
        .then(ids => {
            MAPILLARY_IMAGES = ids;
            if (!MAPILLARY_IMAGES.length) {
                document.getElementById("result").innerHTML = `<div style="color:red; font-weight:bold; text-align:center;">Aucune image Mapillary trouvée (liste vide).</div>`;
                return;
            }
            initialize();
        })
        .catch(() => {
            document.getElementById("result").innerHTML = `<div style="color:red; font-weight:bold; text-align:center;">Echec du chargement de la liste Mapillary.</div>`;
        });
});
