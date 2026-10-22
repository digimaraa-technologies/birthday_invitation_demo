/**
 * Akash's Birthday Celebration — central configuration.
 * ------------------------------------------------------------------
 * Everything the organizer is likely to change lives here.
 * The rest of the site (HTML copy, CSS, script.js) reads from this file.
 *
 * Replace the WhatsApp number with the event organizer's number
 * (country code + number, digits only, no "+" and no spaces).
 */
const EVENT_CONFIG = {
  /* ---------- Event ---------- */
  name: "Akash",
  title: "Akash's Birthday Celebration",
  shortTitle: "Akash's Birthday",
  date: "2027-02-20", // ISO date
  startTime: "18:00", // 24h, local event time
  timezone: "Asia/Kolkata",
  countdownTarget: "2027-02-20T18:00:00+05:30", // same instant, explicit offset
  displayDate: "Saturday, 20 February 2027",
  startTimeLabel: "6:00 PM onwards",
  dayLabel: "Saturday",

  /* ---------- Venue ---------- */
  venue: {
    name: "Sri Lakshmi Mahal",
    address: "Srivaikundam, Tamil Nadu, India",
    // Placeholder event information — confirm the address with the organizer before publishing.
    mapsQuery: "Sri Lakshmi Mahal, Srivaikundam, Tamil Nadu",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Sri+Lakshmi+Mahal%2C+Srivaikundam%2C+Tamil+Nadu"
  },

  /* ---------- Theme ---------- */
  theme: {
    primary: "#d31876", // Hot Rose
    accent: "#ffbf00", // Amber Gold
    background: "#fff8f0", // warm ivory
    text: "#35212b" // deep plum
  },

  /* ---------- Local assets (paths are relative to index.html) ---------- */
  assets: {
    hero: "assets/birthday-hero.jpg",
    venue: "assets/venue.jpg",
    cakeCutting: "assets/cake-cutting.jpg",
    familyCelebration: "assets/family-celebration.jpg",
    dinner: "assets/birthday-dinner.jpg",
    // Photographs used by the programme (schedule) timeline.
    scheduleArrival: "assets/schedule-arrival.jpg",
    scheduleCake: "assets/schedule-cake.jpg",
    scheduleWishes: "assets/schedule-wishes.jpg",
    scheduleDinner: "assets/schedule-dinner.jpg",
    // Optional: a photo painted onto the scratch cover. Leave empty to use the
    // festive cover the canvas draws by itself (balloons, gifts, confetti).
    scratchCover: "assets/balloons.jpg",
    // Optional: an image layered into the entrance curtain (e.g. a curtain GIF).
    // Leave empty to use the CSS curtain, which works on its own.
    entrance: "assets/entrance.jpg",
    // Optional background track, e.g. "assets/celebration.mp3". Empty = silent.
    music: ""
  },

  /* ---------- RSVP ---------- */
  organizer: {
    // Digimaraa Technologies is the developer, not the organizer — do not reuse it here.
    whatsappNumber: "",
    messageTemplate:
      "Hi! I'd love to join {host}'s birthday celebration.\n\n" +
      "Name: {name}\n" +
      "Attendance: {attendance}\n" +
      "Number of guests: {guests}\n" +
      "Mobile: {phone}\n" +
      "Birthday wishes: {wishes}"
  },

  /* ---------- Behaviour ---------- */
  behaviour: {
    scratchRevealThreshold: 0.45, // auto-reveal once 45% of the cover is scratched
    maxGuests: 10
  }
};

window.EVENT_CONFIG = EVENT_CONFIG;
