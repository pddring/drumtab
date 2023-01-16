let midi= {
    NOTE_ON: 9,
    NOTE_OFF: 8,
    NOTE_NAMES: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
    DRUMS: {
        snare: {
            short: "SN",
            aliases: ["S"],
            long: "snare",
            midi: "D2",
            stave: "c"
        }, 
        bass: {
            short: "BD",
            aliases: ["B", "K", "KD"],
            long: "bass",
            midi: "C2",
            stave: "F"
        },
        hihat: {
            short: "HH",
            aliases: ["H"],
            long: "closed hi hat",
            midi: "Gb2",
            stave: "ng"
        }
    },

    lookup: (alias) => {
        let instrument = {};
        Object.keys(midi.DRUMS).forEach(key => {
            if(midi.DRUMS[key].short == alias || midi.DRUMS[key].aliases.includes(alias)) {
                instrument = midi.DRUMS[key];
            }
        });
        return instrument;
    },

    note2name: (note) => {
        let name = midi.NOTE_NAMES[note % 12];
        let octave = Math.floor(note / 12) - 1;
        return name + octave;
    },

    name2note: (name) => {
        for(let i = 0; i < 12; i++) {
            if(name.includes(midi.NOTE_NAMES[i])){
                break;
            }
        }
        let oct = parseInt(name.replace(/[A-Ga-g]/,"")) + 1;
        return oct*12+i;

    },

    process: (data) => {
        m = {
            message: (data[0] >> 4 ) & 0xF,
            channel: data[0] & 0xF,
            key: data[1],
            name: midi.note2name(data[1]),
            velocity: data[1],
            data: data
        };
        return m;
    }
}
var drumtab = {};

drumtab.voicingOptions = [
    {
        name: "Single voice",
        names: ["Single voice"],
        voices: [["CC", "HH", "RD", "SN", "T1", "T2", "FT", "BD", "HF"]]
    },
    {
        name: "Hands and feet",
        names: ["Hands", "Feet"],
        voices: [
            ["CC", "HH", "RD", "SN", "T1", "T2", "FT"],
            ["BD", "HF"]
        ],
    },
    {
        name: "Cymbals and drums",
        names: ["Cymbals", "Drums"],
        voices: [
            ["CC", "HH", "RD", "HF"],
            ["SN", "T1", "T2", "FT", "BD"]
        ]
    }
];


drumtab.init = (kitid) => {
    const canvas = document.getElementById(kitid);
    kit.ctx = canvas.getContext("2d");
    kit.image = new Image();
    kit.image.onload = () => {
        canvas.width = kit.image.naturalWidth;
        canvas.height = kit.image.naturalHeight;
        kit.ctx.drawImage(kit.image, 0,0);
        kit.draw();        
    }
    kit.image.src=kit.url;
}

kit.draw = (parts) => {
    let ctx = kit.ctx;
    kit.ctx.drawImage(kit.image, 0,0);
    if(parts) {
        Object.keys(parts).forEach((k) => {
            s = kit.zones[k];     
            ctx.shadowBlur = 10;
            ctx.shadowColor = "red";   
            ctx.beginPath();
            ctx.ellipse(s.x + (s.w / 2), s.y + (s.h / 2), s.w / 2, s.h / 2, s.angle, 0, 2 * Math.PI);
            ctx.fillStyle = s.colour;
            ctx.fill();
            ctx.strokeStyle = "red";
            ctx.lineWidth = 5;
            ctx.stroke();
        });
    }

}

drumtab.Note2ABC = (tabChar, instrument, duration, preChord=false) => {
    // sometimes (e.g. flams) there's part of the ABC notation which needs to be written before a chord []
    if(preChord) {
        return (tabChar == "f"?
            '{' + instrument.stave +  // flam
            (duration>1?duration:"") + 
            '}'
        :'');
    }

    return (tabChar == "O"||tabChar == "X"?"!^!":"") + // Accent
    instrument.stave + 
    (duration>1?duration:"")
}

drumtab.selectedNotes = [];
drumtab.playing = false;
drumtab.pause = () => {
    drumtab.playback.pause();
}
drumtab.play = (done) => {
    if(!drumtab.playback) {
        drumtab.playback = new ABCJS.TimingCallbacks(score, {
            eventCallback: (e) => {
                // clear all selected notes
                while(drumtab.selectedNotes.length > 0) {
                    let n = drumtab.selectedNotes.pop();
                    n.classList.remove('selected');
                }

                // select current note
                if(e) {
                    for(let i = 0; i < e.elements.length; i++) {
                        if(e.elements[i][0]) {
                            e.elements[i][0].classList.add("selected");
                            drumtab.selectedNotes.push(e.elements[i][0]);
                        }
                    }
                }
            },
            beatCallback: (e) => {
                if(drumtab.playback.currentBeat % 2 == 1) {
                    // all sounds off
                    kit.draw();
                } else {
                    // some sounds might be on
                    let bar = Math.floor(drumtab.playback.currentBeat / (drumtab.drums.beats * 2));
                    let beat = (drumtab.playback.currentBeat / 2) % drumtab.drums.beats;
                    if(drumtab.drums.bars[bar] && drumtab.drums.bars[bar].all[beat]) {
                        console.log(drumtab.drums.bars[bar].all[beat]);
                        kit.draw(drumtab.drums.bars[bar].all[beat]);
                    }
                    //console.log(bar, beat);
                    if(drumtab.playback.currentBeat == drumtab.playback.totalBeats) {
                        if(done) {
                            drumtab.playing = false;
                            drumtab.playback = undefined;
                            done();
                        }
                    }
                }
                
            },
            qpm: bpm,
            beatSubdivisions: drumtab.drums.beats / 2
        });
    }
    drumtab.playing = true;
    drumtab.playback.start();
}

drumtab.Tab2ABC = (tab, voicing) => {
    if(voicing === undefined) {
        voicing = drumtab.voicingOptions[1];
    }
    let lines = tab.split("\n");
    let drums = {
        bars: []
    }

    // go through each line of tab
    for(let i = 0; i < lines.length; i++) {
        
        // extract part names
        let m = lines[i].match(/^\s*([A-Za-z]+)\s*:?\s*\|/);
        if(m) {
            let instrument = midi.lookup(m[1]);
            let voice = {
                instrument: instrument.short,
                bars: []
            }

            // iterate through each bar
            let bars = lines[i].split("|").slice(1);
            for(let j = 0; j < bars.length; j++) {
                let bar = bars[j].trim();
                if(bar.length > 0) {
                    voice.bars[j] = bar;
                    
                    // store bar for all parts
                    while(drums.bars.length < bars.length - 1) {
                        let newBar = {
                            parts: {},
                            notes: bar.length,
                            skip: 0,
                            all: {},
                            voicing: {}
                        }
                        for(let k = 0; k < voicing.names.length; k++) {
                            newBar.voicing[voicing.names[k]] = {
                                beats: {},
                                parts: {},
                                abc: ""
                            };
                        }
                        drums.bars.push(newBar);
                    }
                    
                    // iterate through each note in the bar
                    for(let k = 0; k < bar.length; k++) {
                        if(bar[k] != "-") {
                            let duration = 1;
                            for(let lookAhead = k + 1; lookAhead < bar.length; lookAhead++) {
                                if(bar[lookAhead] == '-') {
                                    duration++;
                                } else {
                                    break;
                                }
                            }
                            if(drums.bars[j].all[k] === undefined) {
                                drums.bars[j].all[k] = {};
                            }
                            drums.bars[j].all[k][voice.instrument] = bar[k];
                            
                            // split into different stave voices
                            for(let l = 0; l < voicing.voices.length; l++) {
                                if(voicing.voices[l].includes(voice.instrument)) {
                                    if(drums.bars[j].voicing[voicing.names[l]].parts[voice.instrument] === undefined) {
                                        drums.bars[j].voicing[voicing.names[l]].parts[voice.instrument] = {};
                                    }
                                    drums.bars[j].voicing[voicing.names[l]].parts[voice.instrument][k] = bar[k];
                                    if(drums.bars[j].voicing[voicing.names[l]].beats[k] === undefined) {
                                        drums.bars[j].voicing[voicing.names[l]].beats[k] = [];
                                    }
                                    let note = {};
                                    note = {
                                        instrument: voice.instrument,
                                        style: bar[k],
                                        duration: duration,
                                        abc: drumtab.Note2ABC(bar[k], instrument, duration)
                                    }
                                    drums.bars[j].voicing[voicing.names[l]].beats[k].push(note);
                                }
                            }
                        }
                    }                        
                    drums.bars[j].parts[voice.instrument] = voice.bars[j];
                }
            }
        }
    }

    // get max number of beats in a bar
    drums.beats = 1;
    for(let i = 0; i < drums.bars.length; i++) {
        if(drums.bars[i].notes > drums.beats) {
            drums.beats = drums.bars[i].notes;
        }
    }
    drumtab.drums = drums;
    console.log(drums);

    let abc = "X: 1\n" +
    "M: 4/4\n" +
    "L: 1/" + drums.beats + "\n" +
    "U:n=!style=x!\n" +
    "K:perc\n"

    for(let i = 0; i < drums.bars.length; i++) {
        // check if bar is empty
        if(Object.keys(drums.bars[i].all).length == 0) {
            abc += `z${drums.beats}`
        } 

        // bar is not empty
        else {
            let voiceCount = Object.keys(drums.bars[i].voicing).length;
            let currentVoice = 0;
            for(const [voiceName, v] of Object.entries(drums.bars[i].voicing)) {
                let beatCount = 0;

                // TODO: add rests until first note found
                let firstBeat = 0;
                for(let j = 0; j < drums.beats; j++) {
                    if(v.beats[j] !== undefined) {
                        firstBeat = j;
                        beatCount = j;
                        break;
                    }
                }
                if(firstBeat > 0) {
                    abc += `z${firstBeat}`;
                }
                
                for(let [beat, notes] of Object.entries(v.beats)) {
                    beat = parseInt(beat);
                    
                    // merging notes from multiple instruments into a single voice may mean durations for some notes need shortening
                    let duration = drums.beats - beat;
                    for(let j = beat + 1; j < drums.beats; j++) {
                        if(v.beats[j] !== undefined) {
                            duration = j - beat;
                            break;
                        }
                    }
                    for(let j = 0; j < notes.length; j++) {                      
                        notes[j].duration = duration;
                    }

                    for(let j = 0; j < notes.length; j++) {
                        abc += drumtab.Note2ABC(notes[j].style, midi.lookup(notes[j].instrument), duration, true);
                    }
                    
                    // start a chord if necessary
                    if(notes.length > 1) {
                        abc += "[";
                    }  

                    for(let j = 0; j < notes.length; j++) {
                        // reset duration of all notes to minimum duration
                        notes[j].duration = duration;
                        notes[j].abc = drumtab.Note2ABC(notes[j].style, midi.lookup(notes[j].instrument), duration);
                        abc += notes[j].abc;
                    }

                    // end a chord if necessary
                    if(notes.length > 1) {
                        abc += "]";
                        
                    }
                    beatCount += duration;
                }
                if(currentVoice < voiceCount) {
                    abc += "&\\";
                } else {
                    abc += "|";
                }
                
                currentVoice++;
            }
        }
        abc += "|";
    }

    /// todo: not quite there yet!
    "|:ngngngngngngngng&\\\n" +
    "!^!F2c2F2c2:|"
    return abc;
}
