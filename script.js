const audio = document.querySelector("#audio");
const fileInput = document.querySelector("#fileInput");
const playlistEl = document.querySelector("#playlist");
const searchInput = document.querySelector("#searchInput");
const trackCount = document.querySelector("#trackCount");
const songTitle = document.querySelector("#songTitle");
const artistName = document.querySelector("#artistName");
const playbackMode = document.querySelector("#playbackMode");
const totalDuration = document.querySelector("#totalDuration");
const currentTime = document.querySelector("#currentTime");
const durationEl = document.querySelector("#duration");
const seekBar = document.querySelector("#seekBar");
const volumeBar = document.querySelector("#volumeBar");
const playBtn = document.querySelector("#playBtn");
const playIcon = document.querySelector("#playIcon");
const prevBtn = document.querySelector("#prevBtn");
const nextBtn = document.querySelector("#nextBtn");
const shuffleBtn = document.querySelector("#shuffleBtn");
const repeatBtn = document.querySelector("#repeatBtn");
const clearBtn = document.querySelector("#clearBtn");
const coverCanvas = document.querySelector("#coverCanvas");
const disc = document.querySelector(".disc");
const coverCtx = coverCanvas.getContext("2d");

let tracks = [];
let filteredTracks = [];
let currentIndex = -1;
let isShuffle = false;
let repeatMode = "off";
let animationId = null;

audio.volume = Number(volumeBar.value);
drawCover("Pulse Player", false);
renderPlaylist();

fileInput.addEventListener("change", () => {
  const files = [...fileInput.files].filter((file) => file.type.startsWith("audio/"));
  const newTracks = files.map((file) => {
    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    const parts = cleanName.split(" - ");

    return {
      id: crypto.randomUUID(),
      name: parts.length > 1 ? parts.slice(1).join(" - ") : cleanName,
      artist: parts.length > 1 ? parts[0] : "Local file",
      file,
      url: URL.createObjectURL(file),
      duration: 0
    };
  });

  tracks = [...tracks, ...newTracks];
  fileInput.value = "";
  applyFilter();

  if (currentIndex === -1 && tracks.length > 0) {
    loadTrack(0, false);
  }
});

searchInput.addEventListener("input", applyFilter);

playBtn.addEventListener("click", async () => {
  if (!tracks.length) {
    fileInput.click();
    return;
  }

  if (currentIndex === -1) {
    loadTrack(0, false);
  }

  if (audio.paused) {
    await audio.play();
  } else {
    audio.pause();
  }
});

prevBtn.addEventListener("click", () => {
  if (!tracks.length) return;

  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }

  playTrack(getPreviousIndex());
});

nextBtn.addEventListener("click", () => {
  if (!tracks.length) return;
  playTrack(getNextIndex());
});

shuffleBtn.addEventListener("click", () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle("active", isShuffle);
  playbackMode.textContent = isShuffle ? "Shuffle on" : "Shuffle off";
});

repeatBtn.addEventListener("click", () => {
  repeatMode = repeatMode === "off" ? "one" : repeatMode === "one" ? "all" : "off";
  repeatBtn.classList.toggle("active", repeatMode !== "off");
  repeatBtn.title = `Repeat ${repeatMode}`;
  repeatBtn.setAttribute("aria-label", `Repeat ${repeatMode}`);
  playbackMode.textContent = repeatMode === "off" ? "Repeat off" : `Repeat ${repeatMode}`;
});

clearBtn.addEventListener("click", () => {
  tracks.forEach((track) => URL.revokeObjectURL(track.url));
  tracks = [];
  filteredTracks = [];
  currentIndex = -1;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  searchInput.value = "";
  songTitle.textContent = "No track selected";
  artistName.textContent = "Load your favorite songs";
  playbackMode.textContent = "Ready";
  durationEl.textContent = "00:00";
  totalDuration.textContent = "00:00";
  currentTime.textContent = "00:00";
  seekBar.value = 0;
  drawCover("Pulse Player", false);
  renderPlaylist();
  updatePlayState();
});

seekBar.addEventListener("input", () => {
  if (!audio.duration) return;
  audio.currentTime = (Number(seekBar.value) / 100) * audio.duration;
});

volumeBar.addEventListener("input", () => {
  audio.volume = Number(volumeBar.value);
});

audio.addEventListener("loadedmetadata", () => {
  const track = tracks[currentIndex];

  if (track) {
    track.duration = audio.duration;
    durationEl.textContent = formatTime(audio.duration);
    totalDuration.textContent = formatTime(getTotalDuration());
    renderPlaylist();
  }
});

audio.addEventListener("timeupdate", () => {
  currentTime.textContent = formatTime(audio.currentTime);
  seekBar.value = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
});

audio.addEventListener("play", () => {
  playbackMode.textContent = "Playing";
  updatePlayState();
  startCoverAnimation();
});

audio.addEventListener("pause", () => {
  playbackMode.textContent = tracks.length ? "Paused" : "Ready";
  updatePlayState();
  stopCoverAnimation();
});

audio.addEventListener("ended", () => {
  if (repeatMode === "one") {
    playTrack(currentIndex);
    return;
  }

  if (repeatMode === "all" || currentIndex < tracks.length - 1 || isShuffle) {
    playTrack(getNextIndex());
  } else {
    audio.currentTime = 0;
    updatePlayState();
  }
});

function applyFilter() {
  const query = searchInput.value.trim().toLowerCase();
  filteredTracks = tracks.filter((track) => {
    return `${track.name} ${track.artist}`.toLowerCase().includes(query);
  });

  renderPlaylist();
}

function renderPlaylist() {
  trackCount.textContent = `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"}`;
  totalDuration.textContent = formatTime(getTotalDuration());
  playlistEl.innerHTML = "";

  if (!tracks.length) {
    playlistEl.innerHTML = '<li class="empty-message">Your playlist will appear here.</li>';
    return;
  }

  if (!filteredTracks.length) {
    playlistEl.innerHTML = '<li class="empty-message">No matching songs found.</li>';
    return;
  }

  filteredTracks.forEach((track) => {
    const index = tracks.findIndex((item) => item.id === track.id);
    const item = document.createElement("li");
    const button = document.createElement("button");

    button.className = `track-row ${index === currentIndex ? "active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <span class="track-number">${index + 1}</span>
      <span class="track-info">
        <span class="track-name">${escapeHtml(track.name)}</span>
        <span class="track-meta">${escapeHtml(track.artist)} · ${formatTime(track.duration)}</span>
      </span>
    `;
    button.addEventListener("click", () => playTrack(index));
    item.appendChild(button);
    playlistEl.appendChild(item);
  });
}

function loadTrack(index, autoplay = true) {
  currentIndex = index;
  const track = tracks[currentIndex];

  audio.src = track.url;
  songTitle.textContent = track.name;
  artistName.textContent = track.artist;
  durationEl.textContent = track.duration ? formatTime(track.duration) : "00:00";
  playbackMode.textContent = autoplay ? "Playing" : "Selected";
  drawCover(track.name, false);
  renderPlaylist();

  if (autoplay) {
    audio.play();
  }
}

function playTrack(index) {
  if (index < 0 || index >= tracks.length) return;
  loadTrack(index, true);
}

function getNextIndex() {
  if (isShuffle && tracks.length > 1) {
    let nextIndex = currentIndex;

    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(Math.random() * tracks.length);
    }

    return nextIndex;
  }

  return (currentIndex + 1) % tracks.length;
}

function getPreviousIndex() {
  return (currentIndex - 1 + tracks.length) % tracks.length;
}

function updatePlayState() {
  const playing = !audio.paused;
  playIcon.textContent = playing ? "Ⅱ" : "▶";
  playBtn.title = playing ? "Pause" : "Play";
  playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
  disc.classList.toggle("playing", playing);
}

function startCoverAnimation() {
  cancelAnimationFrame(animationId);

  const animate = () => {
    const track = tracks[currentIndex];
    drawCover(track ? track.name : "Pulse Player", true);
    animationId = requestAnimationFrame(animate);
  };

  animate();
}

function stopCoverAnimation() {
  cancelAnimationFrame(animationId);
  const track = tracks[currentIndex];
  drawCover(track ? track.name : "Pulse Player", false);
}

function drawCover(seedText, animate) {
  const width = coverCanvas.width;
  const height = coverCanvas.height;
  const seed = [...seedText].reduce((total, char) => total + char.charCodeAt(0), 0);
  const hueA = seed % 360;
  const hueB = (seed * 3 + 90) % 360;
  const pulse = animate ? Math.sin(Date.now() / 210) * 12 : 0;

  const gradient = coverCtx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsl(${hueA}, 68%, 46%)`);
  gradient.addColorStop(0.55, "#232936");
  gradient.addColorStop(1, `hsl(${hueB}, 80%, 56%)`);

  coverCtx.fillStyle = gradient;
  coverCtx.fillRect(0, 0, width, height);

  for (let i = 0; i < 24; i += 1) {
    const barWidth = 8 + ((seed + i * 13) % 18);
    const barHeight = 44 + ((seed + i * 29) % 160) + pulse;
    const x = 24 + i * 14;
    const y = height - 36 - barHeight;

    coverCtx.fillStyle = i % 2 === 0 ? "rgba(255, 255, 255, 0.72)" : "rgba(34, 199, 169, 0.72)";
    coverCtx.fillRect(x, y, barWidth, barHeight);
  }

  coverCtx.fillStyle = "rgba(17, 19, 24, 0.46)";
  coverCtx.fillRect(0, 0, width, height);
  coverCtx.fillStyle = "#f3f5f8";
  coverCtx.font = "800 34px system-ui, sans-serif";
  coverCtx.textAlign = "center";
  coverCtx.textBaseline = "middle";
  coverCtx.fillText(getInitials(seedText), width / 2, height / 2);
}

function getInitials(text) {
  const words = text.trim().split(/\s+/).slice(0, 3);
  const initials = words.map((word) => word[0]).join("").toUpperCase();
  return initials || "PP";
}

function getTotalDuration() {
  return tracks.reduce((total, track) => total + (Number.isFinite(track.duration) ? track.duration : 0), 0);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[char];
  });
}
