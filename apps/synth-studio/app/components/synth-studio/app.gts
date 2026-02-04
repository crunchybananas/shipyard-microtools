import Component from "@glimmer/component";
import { modifier } from "ember-modifier";
import { initializeSynthStudio } from "synth-studio/synth-studio/init";

export default class SynthStudioApp extends Component {
  setupSynthStudio = modifier((element: HTMLElement) => {
    initializeSynthStudio(element);
  });

  <template>
    <div class="app" {{this.setupSynthStudio}}>
      <header class="header">
        <h1>SYNTH STUDIO</h1>
        <div class="header-controls">
          <select id="preset-select">
            <option value="">-- Presets --</option>
            <option value="bass">Bass</option>
            <option value="lead">Lead</option>
            <option value="pad">Pad</option>
            <option value="pluck">Pluck</option>
            <option value="brass">Brass</option>
            <option value="strings">Strings</option>
          </select>
          <button id="save-btn" class="btn">Save</button>
          <button id="export-btn" class="btn btn-primary">Export WAV</button>
        </div>
      </header>

      <main class="main-content">
        <div class="top-row">
          <section class="panel oscillator-panel">
            <h2>OSCILLATOR</h2>
            <div class="waveform-selector">
              <button class="wave-btn active" data-wave="sine" title="Sine">∿</button>
              <button class="wave-btn" data-wave="square" title="Square">□</button>
              <button class="wave-btn" data-wave="sawtooth" title="Sawtooth">⊿</button>
              <button class="wave-btn" data-wave="triangle" title="Triangle">△</button>
            </div>
            <div class="control-group">
              <label>Octave</label>
              <input type="range" id="octave" min="-2" max="2" value="0" step="1" />
              <span class="value" id="octave-value">0</span>
            </div>
            <div class="control-group">
              <label>Detune</label>
              <input type="range" id="detune" min="-50" max="50" value="0" />
              <span class="value" id="detune-value">0</span>
            </div>
          </section>

          <section class="panel filter-panel">
            <h2>FILTER</h2>
            <div class="control-group">
              <label>Cutoff</label>
              <input type="range" id="filter-cutoff" min="20" max="20000" value="5000" class="log-slider" />
              <span class="value" id="filter-cutoff-value">5000 Hz</span>
            </div>
            <div class="control-group">
              <label>Resonance</label>
              <input type="range" id="filter-resonance" min="0" max="30" value="1" step="0.1" />
              <span class="value" id="filter-resonance-value">1</span>
            </div>
            <div class="control-group">
              <label>Env Amt</label>
              <input type="range" id="filter-env-amount" min="0" max="10000" value="0" />
              <span class="value" id="filter-env-amount-value">0</span>
            </div>
          </section>

          <section class="panel visualization-panel">
            <h2>VISUALIZATION</h2>
            <div class="viz-container">
              <canvas id="waveform-canvas" width="300" height="80"></canvas>
              <canvas id="spectrum-canvas" width="300" height="80"></canvas>
            </div>
            <div class="viz-toggle">
              <button class="viz-btn active" data-viz="waveform">Waveform</button>
              <button class="viz-btn" data-viz="spectrum">Spectrum</button>
            </div>
          </section>
        </div>

        <div class="middle-row">
          <section class="panel envelope-panel">
            <h2>ENVELOPE</h2>
            <div class="adsr-visual">
              <canvas id="adsr-canvas" width="180" height="60"></canvas>
            </div>
            <div class="adsr-controls">
              <div class="adsr-knob">
                <input
                  type="range"
                  id="attack"
                  min="0.001"
                  max="2"
                  value="0.01"
                  step="0.001"
                  orient="vertical"
                />
                <label>A</label>
                <span class="value" id="attack-value">10ms</span>
              </div>
              <div class="adsr-knob">
                <input
                  type="range"
                  id="decay"
                  min="0.001"
                  max="2"
                  value="0.1"
                  step="0.001"
                  orient="vertical"
                />
                <label>D</label>
                <span class="value" id="decay-value">100ms</span>
              </div>
              <div class="adsr-knob">
                <input
                  type="range"
                  id="sustain"
                  min="0"
                  max="1"
                  value="0.7"
                  step="0.01"
                  orient="vertical"
                />
                <label>S</label>
                <span class="value" id="sustain-value">70%</span>
              </div>
              <div class="adsr-knob">
                <input
                  type="range"
                  id="release"
                  min="0.001"
                  max="3"
                  value="0.3"
                  step="0.001"
                  orient="vertical"
                />
                <label>R</label>
                <span class="value" id="release-value">300ms</span>
              </div>
            </div>
          </section>

          <section class="panel effects-panel">
            <h2>EFFECTS</h2>
            <div class="effect-row">
              <div class="effect-toggle">
                <input type="checkbox" id="delay-enabled" />
                <label for="delay-enabled">Delay</label>
              </div>
              <div class="effect-controls">
                <div class="mini-control">
                  <input type="range" id="delay-time" min="0.05" max="1" value="0.3" step="0.01" />
                  <span>Time</span>
                </div>
                <div class="mini-control">
                  <input type="range" id="delay-feedback" min="0" max="0.9" value="0.4" step="0.01" />
                  <span>Feedback</span>
                </div>
                <div class="mini-control">
                  <input type="range" id="delay-mix" min="0" max="1" value="0.3" step="0.01" />
                  <span>Mix</span>
                </div>
              </div>
            </div>
            <div class="effect-row">
              <div class="effect-toggle">
                <input type="checkbox" id="reverb-enabled" />
                <label for="reverb-enabled">Reverb</label>
              </div>
              <div class="effect-controls">
                <div class="mini-control">
                  <input type="range" id="reverb-decay" min="0.1" max="5" value="2" step="0.1" />
                  <span>Decay</span>
                </div>
                <div class="mini-control">
                  <input type="range" id="reverb-mix" min="0" max="1" value="0.3" step="0.01" />
                  <span>Mix</span>
                </div>
              </div>
            </div>
            <div class="effect-row">
              <div class="effect-toggle">
                <input type="checkbox" id="distortion-enabled" />
                <label for="distortion-enabled">Distortion</label>
              </div>
              <div class="effect-controls">
                <div class="mini-control">
                  <input type="range" id="distortion-amount" min="0" max="100" value="20" />
                  <span>Amount</span>
                </div>
              </div>
            </div>
          </section>

          <section class="panel lfo-panel">
            <h2>LFO</h2>
            <div class="control-group">
              <label>Rate</label>
              <input type="range" id="lfo-rate" min="0.1" max="20" value="5" step="0.1" />
              <span class="value" id="lfo-rate-value">5 Hz</span>
            </div>
            <div class="control-group">
              <label>Depth</label>
              <input type="range" id="lfo-depth" min="0" max="100" value="0" />
              <span class="value" id="lfo-depth-value">0</span>
            </div>
            <div class="lfo-target">
              <button class="lfo-target-btn active" data-target="none">Off</button>
              <button class="lfo-target-btn" data-target="pitch">Pitch</button>
              <button class="lfo-target-btn" data-target="filter">Filter</button>
            </div>
          </section>

          <section class="panel master-panel">
            <h2>MASTER</h2>
            <div class="control-group">
              <label>Volume</label>
              <input type="range" id="master-volume" min="0" max="1" value="0.7" step="0.01" />
              <span class="value" id="master-volume-value">70%</span>
            </div>
            <div class="level-meter">
              <div class="meter-bar" id="meter-bar"></div>
            </div>
          </section>
        </div>

        <section class="keyboard-section">
          <h2>KEYBOARD <span class="keyboard-hint">(Use computer keys A-L or click)</span></h2>
          <div class="keyboard" id="keyboard"></div>
        </section>

        <section class="sequencer-section">
          <div class="sequencer-header">
            <h2>SEQUENCER</h2>
            <div class="sequencer-controls">
              <div class="bpm-control">
                <label>BPM</label>
                <input type="number" id="bpm" value="120" min="40" max="240" />
              </div>
              <div class="swing-control">
                <label>Swing</label>
                <input type="range" id="swing" min="0" max="0.5" value="0" step="0.01" />
              </div>
              <div class="transport">
                <button class="transport-btn" id="play-btn" title="Play">▶</button>
                <button class="transport-btn" id="stop-btn" title="Stop">⏹</button>
                <button class="transport-btn" id="record-btn" title="Record">⏺</button>
              </div>
            </div>
          </div>

          <div class="sequencer-grid" id="sequencer-grid">
            <div class="seq-track" data-track="synth1">
              <div class="track-label">
                <span>Synth 1</span>
                <select class="track-note">
                  <option value="C3">C3</option>
                  <option value="D3">D3</option>
                  <option value="E3">E3</option>
                  <option value="F3">F3</option>
                  <option value="G3">G3</option>
                  <option value="A3">A3</option>
                  <option value="B3">B3</option>
                  <option value="C4">C4</option>
                </select>
              </div>
              <div class="track-steps"></div>
            </div>

            <div class="seq-track" data-track="synth2">
              <div class="track-label">
                <span>Synth 2</span>
                <select class="track-note">
                  <option value="C2">C2</option>
                  <option value="D2">D2</option>
                  <option value="E2">E2</option>
                  <option value="F2">F2</option>
                  <option value="G2">G2</option>
                  <option value="A2">A2</option>
                  <option value="B2">B2</option>
                  <option value="C3">C3</option>
                </select>
              </div>
              <div class="track-steps"></div>
            </div>

            <div class="seq-track" data-track="kick">
              <div class="track-label">Kick</div>
              <div class="track-steps"></div>
            </div>

            <div class="seq-track" data-track="snare">
              <div class="track-label">Snare</div>
              <div class="track-steps"></div>
            </div>

            <div class="seq-track" data-track="hihat">
              <div class="track-label">Hi-Hat</div>
              <div class="track-steps"></div>
            </div>

            <div class="seq-track" data-track="clap">
              <div class="track-label">Clap</div>
              <div class="track-steps"></div>
            </div>
          </div>

          <div class="step-indicator" id="step-indicator"></div>
        </section>

        <div class="recording-indicator hidden" id="recording-indicator">● Recording</div>
      </main>
    </div>
  </template>
}
