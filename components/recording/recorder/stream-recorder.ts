
import { reactive, shallowReactive } from "vue"
import { CONTENT_OPTIONS, StreamCallbacks } from "./runtime-spec";

const Kbps = 1024;
const Mbps = Kbps * Kbps;
const Sec = 1000;// milliseconds


const enum State {
  inactive = "inactive",
  recording = "recording",
  paused = "paused",
}

export default class StreamRecorder {
  recorder: MediaRecorder
  timeSliceInSec: number = undefined; // default to 1s
  stream: MediaStream;
  timeOutId: number;
  chunkList: Blob[] = [];
  cbs: StreamCallbacks;
  state: State; // private internal state. Not to be used with client code

  constructor(stream: MediaStream, sliceSec: number = 30, cbs: StreamCallbacks) {

    if (stream === undefined)
      throw new Error('no stream provided');

    this.stream = stream;
    this.cbs = cbs;

    if (sliceSec)
      this.timeSliceInSec = sliceSec * Sec;

    this.recorder = this.#createRecorder();
  }

  start() {
    if (this.recorder.state !== State.inactive)
      throw new Error('Recorder has already been started: ' + this.state);

    if (this.timeSliceInSec)
      this.recorder.start(this.timeSliceInSec);
    else
      this.recorder.start();
  }

  stop() {
    // evading recorder-stop-listener: intentionally stopping the stream
    this.recorder.stream.getTracks().forEach(track => track.stop());
    this.recorder.stop();

  }

  pause() {
    this.recorder.pause();  // notifying the caller about the paused dat
  }
  resume() {
    this.recorder.resume();
  }


  #createRecorder(): MediaRecorder {

    const recorder = new MediaRecorder(this.stream, CONTENT_OPTIONS);

    recorder.onstart = (e) => {
      this.state = State.recording;
      this.cbs.onStart();
    }

    recorder.ondataavailable = (e) => {
      this.chunkList.push(e.data);
    };
    recorder.onstop = (e) => {
      this.state = State.inactive;
      const recordedBlob = new Blob(this.chunkList, { type: this.recorder.mimeType });
      this.cbs.onStop(recordedBlob);
      this.chunkList = [];
    }
    recorder.onpause = (e) => {
      this.cbs.onPause();
    }

    recorder.onerror = (e) => {
      this.cbs.onError(e);
    }

    recorder.onresume = (e) => {
      this.cbs.onResume();
    }
    return recorder;
  }
}
