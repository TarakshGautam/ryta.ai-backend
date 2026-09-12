export const speakMessage = (text: string, gender: 'female' | 'male') => {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel(); // Stop ongoing speech

  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();

  let selectedVoice = null;

  if (gender === 'female') {
    selectedVoice = voices.find(
      (v) => (v.lang.includes('hi') || v.lang.includes('en')) && (v.name.includes('Zira') || v.name.includes('Google हिन्दी') || v.name.includes('Samantha') || v.name.includes('Female'))
    );
  } else {
    selectedVoice = voices.find(
      (v) => (v.lang.includes('hi') || v.lang.includes('en')) && (v.name.includes('David') || v.name.includes('Google UK English Male') || v.name.includes('Male'))
    );
  }

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.rate = 0.95;
  utterance.pitch = gender === 'female' ? 1.1 : 0.9;

  window.speechSynthesis.speak(utterance);
};