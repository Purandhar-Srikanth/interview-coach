import { useEffect, useRef, useState } from 'react'

// The Web Speech API isn't in TypeScript's standard types, so describe the small part we use.
type SpeechResult = { isFinal: boolean; 0: { transcript: string } }
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> }
type SpeechErrorEvent = { error: string }
type Recognizer = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechEvent) => void) | null
  onerror: ((event: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type RecognizerClass = new () => Recognizer

function getRecognizerClass(): RecognizerClass | null {
  const w = window as unknown as { SpeechRecognition?: RecognizerClass; webkitSpeechRecognition?: RecognizerClass }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow it in the browser’s address bar to answer by voice.',
  'service-not-allowed': 'Microphone access was blocked. Allow it in the browser’s address bar to answer by voice.',
  'audio-capture': 'No microphone was found.',
  network: 'Voice input needs an internet connection.',
}

/**
 * Speech-to-text using the browser's built-in speech service (Chrome, Edge; not Firefox).
 * Free and live: `onText` receives the full transcript (final + in-progress words) as you speak.
 * Audio goes to the browser's speech service, never to our server.
 */
export function useSpeechRecognition(onText: (text: string, isFinal: boolean) => void) {
  const [supported] = useState(() => getRecognizerClass() !== null)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognizer = useRef<Recognizer | null>(null)
  const onTextRef = useRef(onText)

  useEffect(() => {
    onTextRef.current = onText
  })

  // Stop listening if the component goes away (e.g. you navigate to another page).
  useEffect(() => () => recognizer.current?.stop(), [])

  function start() {
    const Recognizer = getRecognizerClass()
    if (!Recognizer || listening) return
    const r = new Recognizer()
    r.lang = navigator.language || 'en-US' // e.g. en-IN understands Indian English best
    r.continuous = true
    r.interimResults = true

    let finalText = ''
    r.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript
        if (event.results[i].isFinal) finalText += piece
        else interim += piece
      }
      onTextRef.current((finalText + interim).trim(), interim === '')
    }
    r.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(ERROR_MESSAGES[event.error] ?? 'Voice input stopped because of an error.')
      }
    }
    r.onend = () => {
      onTextRef.current(finalText.trim(), true) // drop any unfinished words
      setListening(false)
      recognizer.current = null
    }

    setError(null)
    recognizer.current = r
    r.start()
    setListening(true)
  }

  function stop() {
    recognizer.current?.stop()
  }

  return { supported, listening, error, start, stop, toggle: () => (listening ? stop() : start()) }
}
