chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "play-audio") {
    playAudio(msg.play);
  }
});

function playAudio({ source, volume }) {
  const audio = new Audio(source);
  audio.volume = volume ?? 1;
  audio.play();
}
